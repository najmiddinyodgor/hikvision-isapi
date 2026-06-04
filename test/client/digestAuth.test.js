import { describe, it, expect } from 'vitest';
import { parseChallenge, buildAuthHeader } from '../../src/client/digestAuth.js';

const header = 'Digest realm="testrealm", qop="auth", nonce="abc123", opaque="xyz", algorithm=MD5';

describe('parseChallenge', () => {
  it('parses fields', () => {
    const c = parseChallenge(header);
    expect(c.realm).toBe('testrealm');
    expect(c.qop).toBe('auth');
    expect(c.nonce).toBe('abc123');
    expect(c.opaque).toBe('xyz');
    expect(c.algorithm).toBe('MD5');
  });
});

describe('buildAuthHeader', () => {
  it('builds a valid MD5 qop=auth response (RFC 2617 vector)', () => {
    const c = parseChallenge('Digest realm="testrealm@host.com", qop="auth", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41", algorithm=MD5');
    const h = buildAuthHeader({
      challenge: c, method: 'GET', uri: '/dir/index.html',
      username: 'Mufasa', password: 'Circle Of Life',
      nc: '00000001', cnonce: '0a4f113b',
    });
    expect(h).toContain('username="Mufasa"');
    expect(h).toContain('response="6629fae49393a05397450978507c4ef1"');
    expect(h).toContain('qop=auth');
    expect(h).toContain('nc=00000001');
    expect(h).toContain('cnonce="0a4f113b"');
    expect(h).toContain('opaque="5ccc069c403ebaf9f0171e9517f40e41"');
  });
});
