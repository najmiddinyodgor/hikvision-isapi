import { parseChallenge, buildAuthHeader } from './digestAuth.js';
import { serialize, deserialize } from '../internal/serialize.js';
import { AuthError, RequestError, DeviceError, TimeoutError } from '../errors/index.js';

function randomCnonce() {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

export class HttpClient {
  constructor({ host, username, password, timeout = 10000, defaultFormat = 'xml' }) {
    if (!host) throw new Error('HttpClient requires host');
    this.host = host.replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.timeout = timeout;
    this.defaultFormat = defaultFormat;
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

    let response;
    try {
      response = await doFetch();
    } catch (e) {
      if (e.name === 'AbortError') throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
      throw new RequestError(e.message, { cause: e });
    }

    if (response.status === 401) {
      const wa = response.headers.get('www-authenticate');
      if (!wa || !/digest/i.test(wa)) throw new AuthError('Unauthorized (no digest challenge)');
      const challenge = parseChallenge(wa);
      // drain the challenge response so the socket can be reused (undici)
      try { await response.text(); } catch { /* ignore */ }
      if (!challenge.nonce || !challenge.realm) throw new AuthError('Malformed digest challenge');
      const nc = '00000001'; // single handshake per request, against a fresh nonce
      const authHeader = buildAuthHeader({
        challenge, method, uri: path,
        username: this.username, password: this.password,
        nc, cnonce: randomCnonce(),
      });
      try {
        response = await doFetch(authHeader);
      } catch (e) {
        if (e.name === 'AbortError') throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
        throw new RequestError(e.message, { cause: e });
      }
      if (response.status === 401) throw new AuthError('Authentication failed (bad credentials)');
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
