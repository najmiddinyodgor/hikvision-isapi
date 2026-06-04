#!/usr/bin/env node
/**
 * hik-cors-proxy — a tiny CORS reverse proxy for Hikvision ISAPI devices.
 *
 * WHY: Hikvision firmware sends no CORS headers and kills the preflight OPTIONS,
 * so a browser page (e.g. the ERP) cannot call a device directly. This proxy sits
 * between the browser and the device on your own machine: it answers the CORS
 * preflight, adds the CORS headers the browser needs, and — crucially — exposes
 * the `WWW-Authenticate` header so the in-browser Hikvision client can complete
 * the HTTP Digest handshake. The proxy itself stays transparent to auth: it just
 * relays the 401 + challenge back, and forwards the retried `Authorization` header
 * on to the device.
 *
 * REQUEST SHAPE:
 *   http://localhost:8787/<deviceHost>/<isapi-path>
 *   e.g.  http://localhost:8787/192.168.0.101/ISAPI/System/deviceInfo
 *   <deviceHost> may include a port: 192.168.0.101:8000
 *
 * USE FROM THE BROWSER (point the client's host at the proxy + device):
 *   new Hikvision.HikvisionClient({ host: 'http://localhost:8787/192.168.0.101', ... })
 *   The digest `uri` the client signs is the ISAPI path only (/ISAPI/...), which is
 *   exactly what the proxy forwards to the device, so digest stays valid.
 *
 * RUN:
 *   node hik-cors-proxy.mjs
 *   PORT=9000 HIK_ALLOW=192.168.0.101,192.168.0.196 HIK_SCHEME=http node hik-cors-proxy.mjs
 *
 * ENV:
 *   PORT        listen port            (default 8787)
 *   HIK_ALLOW   comma list of allowed device hosts; empty = allow any (default: empty)
 *               SSRF guard — set this to your device IPs in anything but a trusted LAN.
 *   HIK_SCHEME  upstream scheme to the device: http | https   (default http)
 *   HIK_TIMEOUT upstream timeout in ms                          (default 30000)
 *
 * Zero dependencies. Node 18+.
 */

import http from 'node:http';
import https from 'node:https';

const PORT = Number(process.env.PORT || 8787);
const SCHEME = (process.env.HIK_SCHEME || 'http').toLowerCase();
const TIMEOUT = Number(process.env.HIK_TIMEOUT || 30000);
const ALLOW = (process.env.HIK_ALLOW || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const upstream = SCHEME === 'https' ? https : http;

// Headers we must not blindly relay (hop-by-hop, per RFC 7230 §6.1) plus host.
const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function setCors(res, reqOrigin) {
  // No cookies are used (the client sends Authorization, not credentials), so a
  // wildcard origin is safe and simplest. Echo the origin if present for clarity.
  res.setHeader('Access-Control-Allow-Origin', reqOrigin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '600');
  // The digest handshake lives in the browser, so it MUST be able to read the
  // challenge header off the 401 response.
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
}

function isAllowed(hostWithPort) {
  if (ALLOW.length === 0) return true; // open mode (trusted LAN only)
  const hostOnly = hostWithPort.split(':')[0];
  return ALLOW.includes(hostWithPort) || ALLOW.includes(hostOnly);
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;

  // Preflight: answer locally, the device never sees it.
  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  // Path: /<deviceHost>/<isapi-path...>
  const rawUrl = req.url || '/';
  const firstSlash = rawUrl.indexOf('/', 1);
  const target = firstSlash === -1 ? rawUrl.slice(1) : rawUrl.slice(1, firstSlash);
  const targetPath = firstSlash === -1 ? '/' : rawUrl.slice(firstSlash);

  if (!target) {
    setCors(res, origin);
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request: expected /<deviceHost>/<path>, e.g. /192.168.0.101/ISAPI/System/deviceInfo');
    return;
  }
  if (!isAllowed(target)) {
    setCors(res, origin);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end(`Forbidden: ${target} is not in HIK_ALLOW`);
    return;
  }

  const [host, port] = target.split(':');

  // Forward headers, dropping hop-by-hop ones; force the upstream Host header.
  const fwdHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) fwdHeaders[k] = v;
  }
  fwdHeaders.host = target;

  const options = {
    host,
    port: port ? Number(port) : (SCHEME === 'https' ? 443 : 80),
    method: req.method,
    path: targetPath,
    headers: fwdHeaders,
    timeout: TIMEOUT,
    // Hikvision devices ship self-signed certs; don't reject them on https.
    rejectUnauthorized: false,
  };

  const proxyReq = upstream.request(options, (proxyRes) => {
    setCors(res, origin);
    // Relay status + headers, minus hop-by-hop. Keep WWW-Authenticate (challenge).
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) res.setHeader(k, v);
    }
    res.writeHead(proxyRes.statusCode || 502);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('upstream timeout')));
  proxyReq.on('error', (err) => {
    if (res.headersSent) { res.destroy(); return; }
    setCors(res, origin);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Upstream error: ${err.message}`);
  });

  // Stream the request body (e.g. base64 face uploads) straight through.
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`hik-cors-proxy listening on http://localhost:${PORT}`);
  console.log(`  upstream scheme : ${SCHEME}`);
  console.log(`  allowlist       : ${ALLOW.length ? ALLOW.join(', ') : '(open — any host)'}`);
  console.log(`  example         : http://localhost:${PORT}/192.168.0.101/ISAPI/System/deviceInfo`);
});
