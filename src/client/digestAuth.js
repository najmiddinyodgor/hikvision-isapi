import { md5 } from '../internal/md5.js';
import { sha256 } from '../internal/sha256.js';

export function parseChallenge(headerValue) {
  const out = {};
  const body = headerValue.replace(/^Digest\s+/i, '');
  // split on commas not inside quotes
  const parts = body.match(/([a-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^,]+)/gi) || [];
  for (const p of parts) {
    const eq = p.indexOf('=');
    const k = p.slice(0, eq).trim().toLowerCase();
    let v = p.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function hasher(algorithm) {
  return /sha-?256/i.test(algorithm || '') ? sha256 : md5;
}

export function buildAuthHeader({ challenge, method, uri, username, password, nc, cnonce }) {
  const h = hasher(challenge.algorithm);
  const ha1 = h(`${username}:${challenge.realm}:${password}`);
  const ha2 = h(`${method}:${uri}`);
  const qop = challenge.qop ? challenge.qop.split(',')[0].trim() : undefined;
  let response;
  if (qop) {
    response = h(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = h(`${ha1}:${challenge.nonce}:${ha2}`);
  }
  const fields = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (challenge.algorithm) fields.push(`algorithm=${challenge.algorithm}`);
  if (qop) { fields.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`); }
  if (challenge.opaque) fields.push(`opaque="${challenge.opaque}"`);
  return `Digest ${fields.join(', ')}`;
}
