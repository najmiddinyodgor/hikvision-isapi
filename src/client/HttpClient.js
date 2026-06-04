import { parseChallenge, buildAuthHeader } from './digestAuth.js';
import { serialize, deserialize } from '../internal/serialize.js';
import { AuthError, RequestError, DeviceError, TimeoutError } from '../errors/index.js';

function randomCnonce() {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

// Build an absolute base URL from either `host` or `ip`/`protocol`/`port`.
// A bare host (no scheme) is the cause of the "ip appended to the page URL" bug
// in browsers: fetch() treats a scheme-less string as a relative path.
function normalizeHost({ host, ip, protocol, port }) {
  let base = (host || ip || '').toString().trim().replace(/\/+$/, '');
  if (!base) throw new Error('HttpClient requires a host or ip');
  if (!/^https?:\/\//i.test(base)) base = `${protocol || 'http'}://${base}`;
  // append port only when one is given and the host part has none
  if (port && !/:\d+$/.test(base.replace(/^https?:\/\//i, '').split('/')[0])) {
    base += `:${port}`;
  }
  return base;
}

export class HttpClient {
  constructor({ host, ip, protocol, port, username, password, timeout = 10000, defaultFormat = 'xml' }) {
    this.host = normalizeHost({ host, ip, protocol, port });
    this.username = username;
    this.password = password;
    this.timeout = timeout;
    this.defaultFormat = defaultFormat;
    // Cached digest challenge so later requests authenticate on the first try
    // instead of paying a 401 round-trip (and, in the browser, a CORS preflight)
    // every single call. `_nc` is the RFC 2617 nonce-count for the cached nonce.
    this._challenge = null;
    this._nc = 0;
  }

  // Build an Authorization header from the cached challenge, advancing the
  // nonce-count. Returns undefined when no challenge is known yet (cold start).
  _authHeader(method, path) {
    if (!this._challenge) return undefined;
    this._nc += 1;
    const nc = this._nc.toString(16).padStart(8, '0');
    return buildAuthHeader({
      challenge: this._challenge, method, uri: path,
      username: this.username, password: this.password,
      nc, cnonce: randomCnonce(),
    });
  }

  async request(method, path, { body, format } = {}) {
    const fmt = format || this.defaultFormat;
    const url = this.host + path;
    let payload;
    if (body !== undefined) {
      const rootName = Object.keys(body)[0];
      payload = serialize(body, fmt, rootName);
    }

    const doFetch = (authHeader) => {
      const headers = { Accept: fmt === 'json' ? 'application/json' : 'application/xml' };
      if (payload) headers['Content-Type'] = payload.contentType;
      if (authHeader) headers.Authorization = authHeader;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      return fetch(url, {
        method,
        headers,
        body: payload ? payload.body : undefined,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    };

    const send = (authHeader) => doFetch(authHeader).catch((e) => {
      if (e.name === 'AbortError') throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
      throw new RequestError(e.message, { cause: e });
    });

    // Authenticate up front with the cached challenge. Only a cold client (no
    // challenge yet) sends the first request without digest, purely to obtain it.
    let response = await send(this._authHeader(method, path));

    // A 401 means either the cold-start probe or a stale/rotated nonce. Refresh
    // the challenge from the response and retry once with a freshly counted auth.
    if (response.status === 401) {
      const wa = response.headers.get('www-authenticate');
      if (!wa || !/digest/i.test(wa)) { this._challenge = null; throw new AuthError('Unauthorized (no digest challenge)'); }
      const challenge = parseChallenge(wa);
      // drain the challenge response so the socket can be reused (undici)
      try { await response.text(); } catch { /* ignore */ }
      if (!challenge.nonce || !challenge.realm) { this._challenge = null; throw new AuthError('Malformed digest challenge'); }
      this._challenge = challenge;
      this._nc = 0;
      response = await send(this._authHeader(method, path));
      if (response.status === 401) {
        this._challenge = null; // drop the bad cache so the next call re-handshakes
        throw new AuthError('Authentication failed (bad credentials)');
      }
    }

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const parsed = deserialize(text, contentType);

    if (!response.ok) {
      throw new RequestError(`HTTP ${response.status}`, { statusCode: response.status, raw: text });
    }
    // ISAPI fault detection
    const rs = parsed && parsed.ResponseStatus;
    if (rs && rs.statusCode && String(rs.statusCode) !== '1' && !/^OK$/i.test(rs.statusString || '')) {
      throw new DeviceError(`ISAPI fault: ${rs.subStatusCode || rs.statusCode}`, {
        statusCode: Number(rs.statusCode), subStatusCode: rs.subStatusCode, raw: text,
      });
    }
    return parsed;
  }
}
