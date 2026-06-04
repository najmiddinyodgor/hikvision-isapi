import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../../src/client/HttpClient.js';
import { AuthError, DeviceError } from '../../src/errors/index.js';

function res({ status = 200, headers = {}, body = '' }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  };
}

describe('HttpClient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('performs digest handshake then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res({
        status: 401,
        headers: { 'www-authenticate': 'Digest realm="r", qop="auth", nonce="n", algorithm=MD5' },
      }))
      .mockResolvedValueOnce(res({
        status: 200,
        headers: { 'content-type': 'application/xml' },
        body: '<DeviceInfo><deviceName>Cam</deviceName></DeviceInfo>',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const c = new HttpClient({ host: 'http://host', username: 'u', password: 'p' });
    const out = await c.request('GET', '/ISAPI/System/deviceInfo');
    expect(out.DeviceInfo.deviceName).toBe('Cam');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondHeaders = fetchMock.mock.calls[1][1].headers;
    expect(secondHeaders.Authorization).toContain('Digest');
  });

  it('throws AuthError when still 401 after digest', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res({ status: 401, headers: { 'www-authenticate': 'Digest realm="r", nonce="n"' } }))
      .mockResolvedValueOnce(res({ status: 401, headers: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const c = new HttpClient({ host: 'http://host', username: 'u', password: 'p' });
    await expect(c.request('GET', '/x')).rejects.toBeInstanceOf(AuthError);
  });

  it('uses nc=00000001 on the digest retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res({ status: 401, headers: { 'www-authenticate': 'Digest realm="r", qop="auth", nonce="n", algorithm=MD5' } }))
      .mockResolvedValueOnce(res({ status: 200, headers: { 'content-type': 'application/xml' }, body: '<DeviceInfo/>' }));
    vi.stubGlobal('fetch', fetchMock);
    const c = new HttpClient({ host: 'http://host', username: 'u', password: 'p' });
    await c.request('GET', '/x');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toContain('nc=00000001');
  });

  it('prepends a scheme to a bare ip so fetch gets an absolute url', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res({
      status: 200, headers: { 'content-type': 'application/xml' }, body: '<DeviceInfo/>',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const c = new HttpClient({ ip: '192.168.0.196', port: 80, username: 'u', password: 'p' });
    expect(c.host).toBe('http://192.168.0.196:80');
    await c.request('GET', '/ISAPI/System/deviceInfo');
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.0.196:80/ISAPI/System/deviceInfo');
  });

  it('respects an explicit protocol and an already-schemed host', () => {
    expect(new HttpClient({ ip: '10.0.0.5', protocol: 'https', username: 'u', password: 'p' }).host)
      .toBe('https://10.0.0.5');
    expect(new HttpClient({ host: 'http://host:8080', port: 80, username: 'u', password: 'p' }).host)
      .toBe('http://host:8080');
  });

  it('maps ISAPI fault to DeviceError', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res({
      status: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<ResponseStatus><statusCode>6</statusCode><subStatusCode>badParam</subStatusCode></ResponseStatus>',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const c = new HttpClient({ host: 'http://host', username: 'u', password: 'p' });
    await expect(c.request('PUT', '/x', { body: { A: {} } })).rejects.toBeInstanceOf(DeviceError);
  });
});
