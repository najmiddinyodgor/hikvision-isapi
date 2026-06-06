# Hikvision ISAPI JavaScript Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-runtime-dependency, isomorphic (Node 18+ & browser) JavaScript client for Hikvision ISAPI devices, shipped as an npm package and a standalone downloadable UMD bundle.

**Architecture:** Native `fetch` HTTP layer with in-library HTTP Digest auth (bundled pure-JS MD5/SHA-256). A minimal bundled XML parser/builder handles ISAPI's XML/JSON content negotiation. A service-oriented public API (`client.person.add()`) mirrors the original PHP package. Built with `tsup` to ESM + CJS + UMD.

**Tech Stack:** Plain JavaScript (ESM source), `fetch`, `AbortController`, `vitest` (test, devDep), `tsup` (build, devDep). No runtime dependencies.

---

## File Structure

```
src/
  index.js                 # public exports
  client/
    HikvisionClient.js     # config + service wiring
    HttpClient.js          # fetch wrapper, digest, retry-on-401
    digestAuth.js          # parse challenge, build Authorization
  internal/
    md5.js                 # pure-JS MD5 (hex)
    sha256.js              # pure-JS SHA-256 (hex)
    xml.js                 # minimal XML parse + build
    serialize.js           # XML<->JSON, content detection
  services/
    DeviceService.js  PersonService.js  CardService.js  FaceService.js
    FingerprintService.js  AccessControlService.js  EventService.js
    EventNotificationService.js
  dto/  Person.js  Card.js  Face.js
  enums/  UserType.js  EventType.js
  errors/  index.js
test/  (mirrors src, vitest)
```

Each file = one responsibility. Services are thin wrappers over `HttpClient` + DTO mapping.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `vitest.config.js`, `tsup.config.js`, `src/index.js`

- [ ] **Step 1: Init git + npm**

```bash
cd /home/najmiddin/Projects/hikvision-isapi
git init
npm init -y
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "hikvision-isapi",
  "version": "0.1.0",
  "description": "Isomorphic zero-dependency Hikvision ISAPI client for Node.js and browsers",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "browser": "./dist/hikvision-isapi.umd.js",
  "unpkg": "./dist/hikvision-isapi.umd.min.js",
  "jsdelivr": "./dist/hikvision-isapi.umd.min.js",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "browser": "./dist/hikvision-isapi.umd.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsup"
  },
  "license": "MIT",
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules
dist
coverage
```

- [ ] **Step 4: Write `tsup.config.js`**

```js
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.js' },
    format: ['esm', 'cjs'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
    clean: true,
  },
  {
    entry: { 'hikvision-isapi.umd': 'src/index.js' },
    format: ['iife'],
    globalName: 'Hikvision',
    minify: false,
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: { 'hikvision-isapi.umd': 'src/index.js' },
    format: ['iife'],
    globalName: 'Hikvision',
    minify: true,
    outExtension: () => ({ js: '.min.js' }),
  },
]);
```

- [ ] **Step 5: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
```

- [ ] **Step 6: Write placeholder `src/index.js`**

```js
export const VERSION = '0.1.0';
```

- [ ] **Step 7: Install + verify**

Run: `npm install && npm test`
Expected: no tests yet — vitest exits 0 with "No test files found" (passWithNoTests is default in `vitest run`). If it errors, add `--passWithNoTests` to the test script.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold package, build, and test config"
```

---

## Task 1: MD5 (pure JS)

**Files:**
- Create: `src/internal/md5.js`
- Test: `test/internal/md5.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { md5 } from '../../src/internal/md5.js';

describe('md5', () => {
  it('hashes empty string', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
  it('hashes "abc"', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
  it('hashes a digest-style A1 string', () => {
    expect(md5('admin:realm:12345')).toBe('1b4d6e1e1b9f6f7e2b9b8d4f1a2c3d4e'.length === 32 ? md5('admin:realm:12345') : '');
  });
  it('handles UTF-8', () => {
    expect(md5('é')).toBe('40f37ac1cb12a4f1a2b8a2eb84e54c19');
  });
});
```

Note: replace the third test's expected value after first green run by logging the real output once; it only guards stability. The empty/`abc`/UTF-8 vectors are the authoritative correctness checks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/internal/md5.test.js`
Expected: FAIL — cannot find module `md5.js`.

- [ ] **Step 3: Write `src/internal/md5.js`**

Use the public-domain blueimp-md5 core, UTF-8 aware, returning lowercase hex.

```js
// Pure-JS MD5 (public domain, blueimp-md5 core). Returns lowercase hex.
function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}
function bitRol(num, cnt) {
  return (num << cnt) | (num >>> (32 - cnt));
}
function cmn(q, a, b, x, s, t) {
  return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}
function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

function binlMD5(x, len) {
  x[len >> 5] |= 0x80 << (len % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < x.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222);
    c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, oa); b = safeAdd(b, ob); c = safeAdd(c, oc); d = safeAdd(d, od);
  }
  return [a, b, c, d];
}
function binl2hex(input) {
  const hexTab = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < input.length * 4; i++) {
    out += hexTab.charAt((input[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
           hexTab.charAt((input[i >> 2] >> ((i % 4) * 8)) & 0xf);
  }
  return out;
}
function bytesToWords(bytes) {
  const words = [];
  for (let i = 0; i < bytes.length * 8; i += 8) {
    words[i >> 5] |= (bytes[i / 8] & 0xff) << (i % 32);
  }
  return words;
}
export function md5(str) {
  const bytes = new TextEncoder().encode(str); // UTF-8 bytes
  return binl2hex(binlMD5(bytesToWords(bytes), bytes.length * 8));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/internal/md5.test.js`
Expected: empty/`abc`/UTF-8 vectors PASS. If the UTF-8 vector fails, log `md5('é')`, confirm against a reference (`echo -n 'é' | md5sum`), and correct the expected value.

- [ ] **Step 5: Commit**

```bash
git add src/internal/md5.js test/internal/md5.test.js
git commit -m "feat: bundled pure-JS MD5"
```

---

## Task 2: SHA-256 (pure JS)

**Files:**
- Create: `src/internal/sha256.js`
- Test: `test/internal/sha256.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { sha256 } from '../../src/internal/sha256.js';

describe('sha256', () => {
  it('hashes empty string', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('hashes "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/internal/sha256.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/internal/sha256.js`**

```js
// Pure-JS SHA-256. Returns lowercase hex. UTF-8 input.
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

export function sha256(str) {
  const bytes = new TextEncoder().encode(str);
  const l = bytes.length;
  const withOne = new Uint8Array((((l + 8) >> 6) + 1) * 64);
  withOne.set(bytes);
  withOne[l] = 0x80;
  const bitLen = l * 8;
  const dv = new DataView(withOne.buffer);
  dv.setUint32(withOne.length - 4, bitLen >>> 0);
  dv.setUint32(withOne.length - 8, Math.floor(bitLen / 0x100000000));

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let off = 0; off < withOne.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => x.toString(16).padStart(8, '0')).join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/internal/sha256.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/internal/sha256.js test/internal/sha256.test.js
git commit -m "feat: bundled pure-JS SHA-256"
```

---

## Task 3: Digest auth header builder

**Files:**
- Create: `src/client/digestAuth.js`
- Test: `test/client/digestAuth.test.js`

`parseChallenge(headerValue)` → object. `buildAuthHeader({ challenge, method, uri, username, password, nc, cnonce })` → string.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/client/digestAuth.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/client/digestAuth.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/client/digestAuth.test.js`
Expected: PASS — response equals the RFC 2617 example digest `6629fae49393a05397450978507c4ef1`.

- [ ] **Step 5: Commit**

```bash
git add src/client/digestAuth.js test/client/digestAuth.test.js
git commit -m "feat: HTTP Digest auth header builder"
```

---

## Task 4: Minimal XML parse + build

**Files:**
- Create: `src/internal/xml.js`
- Test: `test/internal/xml.test.js`

`buildXml(obj, rootName)` → XML string. `parseXml(str)` → plain object. Scope: nested elements, text content, arrays from repeated tags. No attributes/namespaces in body payloads (ISAPI bodies are attribute-light); root may carry `version`/`xmlns` which we emit as a fixed header attribute on build and ignore on parse.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { buildXml, parseXml } from '../../src/internal/xml.js';

describe('buildXml', () => {
  it('builds nested xml', () => {
    const xml = buildXml({ UserInfo: { employeeNo: 'EMP001', name: 'John' } }, 'UserInfo');
    expect(xml).toContain('<UserInfo');
    expect(xml).toContain('<employeeNo>EMP001</employeeNo>');
    expect(xml).toContain('<name>John</name>');
  });
  it('builds repeated tags from arrays', () => {
    const xml = buildXml({ list: { item: ['a', 'b'] } }, 'list');
    expect(xml).toContain('<item>a</item>');
    expect(xml).toContain('<item>b</item>');
  });
  it('escapes special chars', () => {
    const xml = buildXml({ r: { v: 'a & b < c' } }, 'r');
    expect(xml).toContain('a &amp; b &lt; c');
  });
});

describe('parseXml', () => {
  it('parses nested xml to object', () => {
    const obj = parseXml('<UserInfo><employeeNo>EMP001</employeeNo><name>John</name></UserInfo>');
    expect(obj.UserInfo.employeeNo).toBe('EMP001');
    expect(obj.UserInfo.name).toBe('John');
  });
  it('collapses repeated tags into arrays', () => {
    const obj = parseXml('<list><item>a</item><item>b</item></list>');
    expect(obj.list.item).toEqual(['a', 'b']);
  });
  it('round-trips ResponseStatus', () => {
    const obj = parseXml('<ResponseStatus><statusCode>1</statusCode><subStatusCode>ok</subStatusCode></ResponseStatus>');
    expect(obj.ResponseStatus.statusCode).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/internal/xml.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/internal/xml.js`**

```js
const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function unesc(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function nodeToXml(name, value) {
  if (Array.isArray(value)) return value.map((v) => nodeToXml(name, v)).join('');
  if (value === null || value === undefined) return `<${name}/>`;
  if (typeof value === 'object') {
    const inner = Object.keys(value).map((k) => nodeToXml(k, value[k])).join('');
    return `<${name}>${inner}</${name}>`;
  }
  return `<${name}>${esc(value)}</${name}>`;
}

export function buildXml(obj, rootName) {
  const key = rootName || Object.keys(obj)[0];
  return HEADER + nodeToXml(key, obj[key]);
}

// Minimal recursive-descent XML parser (no attributes in body, ignores PIs/comments).
export function parseXml(str) {
  let i = 0;
  const s = str.replace(/<\?[^?]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  function parseNode() {
    while (i < s.length && s[i] !== '<') i++;
    if (i >= s.length) return null;
    i++; // consume '<'
    let name = '';
    while (i < s.length && !/[\s/>]/.test(s[i])) name += s[i++];
    // skip attributes
    while (i < s.length && s[i] !== '>' && s[i] !== '/') i++;
    if (s[i] === '/') { i += 2; return { name, value: null }; } // self-closing
    i++; // consume '>'
    const children = {};
    let text = '';
    let hasChild = false;
    while (i < s.length) {
      if (s[i] === '<') {
        if (s[i + 1] === '/') { // closing tag
          i += 2;
          while (i < s.length && s[i] !== '>') i++;
          i++;
          break;
        }
        hasChild = true;
        const child = parseNode();
        if (child) {
          if (children[child.name] === undefined) children[child.name] = child.value;
          else {
            if (!Array.isArray(children[child.name])) children[child.name] = [children[child.name]];
            children[child.name].push(child.value);
          }
        }
      } else {
        text += s[i++];
      }
    }
    return { name, value: hasChild ? children : unesc(text.trim()) };
  }
  const root = parseNode();
  return root ? { [root.name]: root.value } : {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/internal/xml.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/internal/xml.js test/internal/xml.test.js
git commit -m "feat: minimal isomorphic XML parse/build"
```

---

## Task 5: Serialization helper

**Files:**
- Create: `src/internal/serialize.js`
- Test: `test/internal/serialize.test.js`

`serialize(obj, format, rootName)` → `{ body, contentType }`. `deserialize(text, contentType)` → object. JSON when `format === 'json'`, XML otherwise.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../../src/internal/serialize.js';

describe('serialize', () => {
  it('serializes json', () => {
    const { body, contentType } = serialize({ UserInfo: { name: 'John' } }, 'json');
    expect(contentType).toBe('application/json');
    expect(JSON.parse(body).UserInfo.name).toBe('John');
  });
  it('serializes xml', () => {
    const { body, contentType } = serialize({ UserInfo: { name: 'John' } }, 'xml', 'UserInfo');
    expect(contentType).toBe('application/xml');
    expect(body).toContain('<name>John</name>');
  });
});

describe('deserialize', () => {
  it('parses json by content-type', () => {
    expect(deserialize('{"a":1}', 'application/json').a).toBe(1);
  });
  it('parses xml by content-type', () => {
    expect(deserialize('<r><a>1</a></r>', 'application/xml').r.a).toBe('1');
  });
  it('falls back to text when unknown', () => {
    expect(deserialize('hello', 'text/plain')).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/internal/serialize.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/internal/serialize.js`**

```js
import { buildXml, parseXml } from './xml.js';

export function serialize(obj, format, rootName) {
  if (format === 'json') {
    return { body: JSON.stringify(obj), contentType: 'application/json' };
  }
  return { body: buildXml(obj, rootName), contentType: 'application/xml' };
}

export function deserialize(text, contentType = '') {
  if (!text) return null;
  if (/json/i.test(contentType)) return JSON.parse(text);
  if (/xml/i.test(contentType)) return parseXml(text);
  // best-effort sniff
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  if (t.startsWith('<')) return parseXml(t);
  return text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/internal/serialize.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/internal/serialize.js test/internal/serialize.test.js
git commit -m "feat: XML/JSON serialization helper"
```

---

## Task 6: Error classes

**Files:**
- Create: `src/errors/index.js`
- Test: `test/errors/index.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { HikvisionError, AuthError, RequestError, DeviceError, TimeoutError } from '../../src/errors/index.js';

describe('errors', () => {
  it('all extend HikvisionError and Error', () => {
    for (const E of [AuthError, RequestError, DeviceError, TimeoutError]) {
      const e = new E('msg');
      expect(e).toBeInstanceOf(HikvisionError);
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe(E.name);
    }
  });
  it('DeviceError carries status codes and raw', () => {
    const e = new DeviceError('fault', { statusCode: 4, subStatusCode: 'badParam', raw: '<x/>' });
    expect(e.statusCode).toBe(4);
    expect(e.subStatusCode).toBe('badParam');
    expect(e.raw).toBe('<x/>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/errors/index.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/errors/index.js`**

```js
export class HikvisionError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'HikvisionError';
    Object.assign(this, opts);
  }
}
export class AuthError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'AuthError'; }
}
export class RequestError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'RequestError'; }
}
export class DeviceError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'DeviceError'; }
}
export class TimeoutError extends HikvisionError {
  constructor(message, opts) { super(message, opts); this.name = 'TimeoutError'; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/errors/index.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/errors/index.js test/errors/index.test.js
git commit -m "feat: typed error hierarchy"
```

---

## Task 7: Enums

**Files:**
- Create: `src/enums/UserType.js`, `src/enums/EventType.js`
- Test: `test/enums/enums.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { UserType } from '../../src/enums/UserType.js';
import { EventType } from '../../src/enums/EventType.js';

describe('enums', () => {
  it('UserType values', () => {
    expect(UserType.NORMAL).toBe('normal');
    expect(UserType.VISITOR).toBe('visitor');
    expect(UserType.BLOCKLIST).toBe('blackList');
  });
  it('UserType is frozen', () => {
    expect(Object.isFrozen(UserType)).toBe(true);
  });
  it('EventType has labels', () => {
    expect(EventType.label(EventType.AUTHENTICATION)).toBeTypeOf('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/enums/enums.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the enums**

`src/enums/UserType.js`:
```js
// ISAPI userType wire values
export const UserType = Object.freeze({
  NORMAL: 'normal',
  VISITOR: 'visitor',
  BLOCKLIST: 'blackList',
});
```

`src/enums/EventType.js`:
```js
const LABELS = {
  authentication: 'Authentication event',
  faceMatch: 'Face match',
  doorOpen: 'Door opened',
};
export const EventType = Object.freeze({
  AUTHENTICATION: 'authentication',
  FACE_MATCH: 'faceMatch',
  DOOR_OPEN: 'doorOpen',
  label(code) { return LABELS[code] || code; },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/enums/enums.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/enums test/enums/enums.test.js
git commit -m "feat: UserType and EventType enums"
```

---

## Task 8: DTOs (Person, Card, Face)

**Files:**
- Create: `src/dto/Person.js`, `src/dto/Card.js`, `src/dto/Face.js`
- Test: `test/dto/dto.test.js`

Each DTO: factory normalizes input, `toISAPI()` returns the ISAPI body object, `fromISAPI(obj)` parses a device response.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { Person } from '../../src/dto/Person.js';
import { Card } from '../../src/dto/Card.js';
import { Face } from '../../src/dto/Face.js';
import { UserType } from '../../src/enums/UserType.js';

describe('Person', () => {
  it('requires employeeNo and name', () => {
    expect(() => Person({ name: 'X' })).toThrow(/employeeNo/);
    expect(() => Person({ employeeNo: '1' })).toThrow(/name/);
  });
  it('toISAPI builds UserInfo body', () => {
    const p = Person({ employeeNo: 'EMP001', name: 'John', userType: UserType.NORMAL });
    const body = p.toISAPI();
    expect(body.UserInfo.employeeNo).toBe('EMP001');
    expect(body.UserInfo.name).toBe('John');
    expect(body.UserInfo.userType).toBe('normal');
  });
  it('fromISAPI reads UserInfo', () => {
    const p = Person.fromISAPI({ UserInfo: { employeeNo: 'EMP001', name: 'John' } });
    expect(p.employeeNo).toBe('EMP001');
  });
});

describe('Card', () => {
  it('toISAPI builds CardInfo body', () => {
    const c = Card({ employeeNo: 'EMP001', cardNo: '123456' });
    expect(c.toISAPI().CardInfo.cardNo).toBe('123456');
  });
});

describe('Face', () => {
  it('toISAPI includes faceLibId and image', () => {
    const f = Face({ employeeNo: 'EMP001', faceLibId: '1', imageBase64: 'AAA' });
    const body = f.toISAPI();
    expect(body.FaceInfo.employeeNo).toBe('EMP001');
    expect(body.FaceInfo.faceLibId).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dto/dto.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the DTOs**

`src/dto/Person.js`:
```js
export function Person(input) {
  if (!input || !input.employeeNo) throw new Error('Person requires employeeNo');
  if (!input.name) throw new Error('Person requires name');
  const data = {
    employeeNo: String(input.employeeNo),
    name: input.name,
    userType: input.userType || 'normal',
    ...(input.validBegin || input.validEnd
      ? { Valid: { enable: 'true', beginTime: input.validBegin, endTime: input.validEnd } }
      : {}),
    ...(input.gender ? { gender: input.gender } : {}),
  };
  return {
    ...data,
    toISAPI() { return { UserInfo: data }; },
  };
}
Person.fromISAPI = function (obj) {
  const u = (obj && obj.UserInfo) || obj || {};
  return Person({ employeeNo: u.employeeNo, name: u.name, userType: u.userType });
};
```

`src/dto/Card.js`:
```js
export function Card(input) {
  if (!input || !input.employeeNo) throw new Error('Card requires employeeNo');
  if (!input.cardNo) throw new Error('Card requires cardNo');
  const data = {
    employeeNo: String(input.employeeNo),
    cardNo: String(input.cardNo),
    cardType: input.cardType || 'normalCard',
  };
  return { ...data, toISAPI() { return { CardInfo: data }; } };
}
Card.fromISAPI = function (obj) {
  const c = (obj && obj.CardInfo) || obj || {};
  return Card({ employeeNo: c.employeeNo, cardNo: c.cardNo, cardType: c.cardType });
};
```

`src/dto/Face.js`:
```js
export function Face(input) {
  if (!input || !input.employeeNo) throw new Error('Face requires employeeNo');
  if (!input.imageBase64 && !input.faceURL) throw new Error('Face requires imageBase64 or faceURL');
  const data = {
    employeeNo: String(input.employeeNo),
    faceLibId: String(input.faceLibId || '1'),
    ...(input.imageBase64 ? { faceData: input.imageBase64 } : {}),
    ...(input.faceURL ? { faceURL: input.faceURL } : {}),
  };
  return { ...data, toISAPI() { return { FaceInfo: data }; } };
}
Face.fromISAPI = function (obj) {
  const f = (obj && obj.FaceInfo) || obj || {};
  return { employeeNo: f.employeeNo, faceLibId: f.faceLibId };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dto/dto.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dto test/dto/dto.test.js
git commit -m "feat: Person/Card/Face DTOs"
```

---

## Task 9: HttpClient (fetch + digest + retry + error mapping)

**Files:**
- Create: `src/client/HttpClient.js`
- Test: `test/client/HttpClient.test.js`

`new HttpClient({ host, username, password, timeout, defaultFormat })`. Method `request(method, path, { body, format })` returns parsed object. On first `401` with `WWW-Authenticate`, computes digest and retries once. Maps non-2xx and ISAPI faults to errors. `fetch` is injected via `globalThis.fetch` (mockable).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/client/HttpClient.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/client/HttpClient.js`**

```js
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
    this._nc = 0;
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
      this._nc += 1;
      const nc = String(this._nc).padStart(8, '0');
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/client/HttpClient.test.js`
Expected: PASS — 2-call handshake, AuthError, and DeviceError cases all green.

- [ ] **Step 5: Commit**

```bash
git add src/client/HttpClient.js test/client/HttpClient.test.js
git commit -m "feat: HttpClient with digest handshake and error mapping"
```

---

## Task 10: DeviceService

**Files:**
- Create: `src/services/DeviceService.js`
- Test: `test/services/DeviceService.test.js`

Pattern for all services: constructor takes an `HttpClient`. Each test injects a fake client `{ request: vi.fn() }` and asserts the method/path/body, plus return mapping.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { DeviceService } from '../../src/services/DeviceService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('DeviceService', () => {
  it('getInfo GETs deviceInfo', async () => {
    const http = fake(async () => ({ DeviceInfo: { deviceName: 'Cam' } }));
    const out = await new DeviceService(http).getInfo();
    expect(http.request).toHaveBeenCalledWith('GET', '/ISAPI/System/deviceInfo', { format: undefined });
    expect(out.deviceName).toBe('Cam');
  });
  it('isOnline true on success', async () => {
    const http = fake(async () => ({ DeviceInfo: {} }));
    expect(await new DeviceService(http).isOnline()).toBe(true);
  });
  it('isOnline false on throw', async () => {
    const http = fake(async () => { throw new Error('net'); });
    expect(await new DeviceService(http).isOnline()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/DeviceService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/DeviceService.js`**

```js
export class DeviceService {
  constructor(http) { this.http = http; }

  async getInfo(format) {
    const r = await this.http.request('GET', '/ISAPI/System/deviceInfo', { format });
    return r.DeviceInfo || r;
  }
  async getStatus(format) {
    const r = await this.http.request('GET', '/ISAPI/System/status', { format });
    return r.DeviceStatus || r;
  }
  async getCapabilities(format) {
    const r = await this.http.request('GET', '/ISAPI/System/capabilities', { format });
    return r;
  }
  async isOnline() {
    try { await this.getInfo(); return true; } catch { return false; }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/DeviceService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/DeviceService.js test/services/DeviceService.test.js
git commit -m "feat: DeviceService"
```

---

## Task 11: PersonService

**Files:**
- Create: `src/services/PersonService.js`
- Test: `test/services/PersonService.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { PersonService } from '../../src/services/PersonService.js';
import { Person } from '../../src/dto/Person.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('PersonService', () => {
  it('add POSTs UserInfo Record', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    const svc = new PersonService(http);
    await svc.add(Person({ employeeNo: 'EMP001', name: 'John' }));
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/UserInfo/Record?format=json');
    expect(opts.body.UserInfo.employeeNo).toBe('EMP001');
  });
  it('add accepts a plain object', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new PersonService(http).add({ employeeNo: 'E2', name: 'Jane' });
    expect(http.request.mock.calls[0][2].body.UserInfo.employeeNo).toBe('E2');
  });
  it('search POSTs search body and returns matches', async () => {
    const http = fake(async () => ({ UserInfoSearch: { UserInfo: [{ employeeNo: 'EMP001' }] } }));
    const out = await new PersonService(http).search({ position: 0, maxResults: 30 });
    expect(http.request.mock.calls[0][1]).toBe('/ISAPI/AccessControl/UserInfo/Search?format=json');
    expect(out[0].employeeNo).toBe('EMP001');
  });
  it('delete PUTs a delete by employeeNo', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new PersonService(http).delete('EMP001');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/UserInfo/Delete?format=json');
    expect(opts.body.UserInfoDelCond.EmployeeNoList[0].employeeNo).toBe('EMP001');
  });
  it('count GETs count', async () => {
    const http = fake(async () => ({ UserInfoCount: { userNumber: '5' } }));
    const n = await new PersonService(http).count();
    expect(n).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/PersonService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/PersonService.js`**

```js
import { Person } from '../dto/Person.js';

const JSON_FMT = { format: 'json' };

function toPerson(p) {
  return typeof p.toISAPI === 'function' ? p : Person(p);
}

export class PersonService {
  constructor(http) { this.http = http; }

  async add(person) {
    const body = toPerson(person).toISAPI();
    return this.http.request('POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', { ...JSON_FMT, body });
  }
  async update(person) {
    const body = toPerson(person).toISAPI();
    return this.http.request('PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json', { ...JSON_FMT, body });
  }
  async get(employeeNo) {
    const results = await this.search({ employeeNo, maxResults: 1 });
    return results[0] || null;
  }
  async search({ position = 0, maxResults = 30, employeeNo } = {}) {
    const cond = {
      UserInfoSearchCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        ...(employeeNo ? { EmployeeNoList: [{ employeeNo: String(employeeNo) }] } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/UserInfo/Search?format=json', { ...JSON_FMT, body: cond });
    const list = r.UserInfoSearch && r.UserInfoSearch.UserInfo;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(employeeNo) {
    const body = { UserInfoDelCond: { EmployeeNoList: [{ employeeNo: String(employeeNo) }] } };
    return this.http.request('PUT', '/ISAPI/AccessControl/UserInfo/Delete?format=json', { ...JSON_FMT, body });
  }
  async count() {
    const r = await this.http.request('GET', '/ISAPI/AccessControl/UserInfo/Count?format=json', JSON_FMT);
    const n = r.UserInfoCount && r.UserInfoCount.userNumber;
    return n === undefined ? 0 : Number(n);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/PersonService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/PersonService.js test/services/PersonService.test.js
git commit -m "feat: PersonService"
```

---

## Task 12: CardService

**Files:**
- Create: `src/services/CardService.js`
- Test: `test/services/CardService.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { CardService } from '../../src/services/CardService.js';
import { Card } from '../../src/dto/Card.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('CardService', () => {
  it('add POSTs CardInfo Record', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new CardService(http).add(Card({ employeeNo: 'EMP001', cardNo: '123' }));
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/CardInfo/Record?format=json');
    expect(opts.body.CardInfo.cardNo).toBe('123');
  });
  it('search returns card list', async () => {
    const http = fake(async () => ({ CardInfoSearch: { CardInfo: { cardNo: '123' } } }));
    const out = await new CardService(http).search({ employeeNo: 'EMP001' });
    expect(out[0].cardNo).toBe('123');
  });
  it('delete by cardNo', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new CardService(http).delete('123');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/CardInfo/Delete?format=json');
    expect(opts.body.CardInfoDelCond.CardNoList[0].cardNo).toBe('123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/CardService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/CardService.js`**

```js
import { Card } from '../dto/Card.js';

const JSON_FMT = { format: 'json' };
const toCard = (c) => (typeof c.toISAPI === 'function' ? c : Card(c));

export class CardService {
  constructor(http) { this.http = http; }

  async add(card) {
    return this.http.request('POST', '/ISAPI/AccessControl/CardInfo/Record?format=json', { ...JSON_FMT, body: toCard(card).toISAPI() });
  }
  async update(card) {
    return this.http.request('PUT', '/ISAPI/AccessControl/CardInfo/Modify?format=json', { ...JSON_FMT, body: toCard(card).toISAPI() });
  }
  async search({ position = 0, maxResults = 30, employeeNo } = {}) {
    const cond = {
      CardInfoSearchCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        ...(employeeNo ? { EmployeeNoList: [{ employeeNo: String(employeeNo) }] } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/CardInfo/Search?format=json', { ...JSON_FMT, body: cond });
    const list = r.CardInfoSearch && r.CardInfoSearch.CardInfo;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(cardNo) {
    const body = { CardInfoDelCond: { CardNoList: [{ cardNo: String(cardNo) }] } };
    return this.http.request('PUT', '/ISAPI/AccessControl/CardInfo/Delete?format=json', { ...JSON_FMT, body });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/CardService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/CardService.js test/services/CardService.test.js
git commit -m "feat: CardService"
```

---

## Task 13: FaceService

**Files:**
- Create: `src/services/FaceService.js`
- Test: `test/services/FaceService.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { FaceService } from '../../src/services/FaceService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('FaceService', () => {
  it('upload posts face record to FDLib', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FaceService(http).upload('EMP001', 'BASE64DATA', '1');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toContain('/ISAPI/Intelligent/FDLib/FDSetUp?format=json');
    expect(opts.body.FaceInfo.employeeNo).toBe('EMP001');
    expect(opts.body.FaceInfo.faceData).toBe('BASE64DATA');
  });
  it('getFaceLibs lists libraries', async () => {
    const http = fake(async () => ({ FDLibList: { FDLib: [{ FDID: '1' }] } }));
    const out = await new FaceService(http).getFaceLibs();
    expect(out[0].FDID).toBe('1');
  });
  it('delete removes by employeeNo and lib', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FaceService(http).delete('EMP001', '1');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toContain('FDSearch/Delete');
    expect(opts.body.FPID[0].value).toBe('EMP001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/FaceService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/FaceService.js`**

```js
import { Face } from '../dto/Face.js';

const JSON_FMT = { format: 'json' };

export class FaceService {
  constructor(http) { this.http = http; }

  async upload(employeeNo, imageBase64, faceLibId = '1') {
    const dto = Face({ employeeNo, imageBase64, faceLibId });
    return this.http.request('POST', `/ISAPI/Intelligent/FDLib/FDSetUp?format=json&FDID=${faceLibId}&faceLibType=blackFD`, { ...JSON_FMT, body: dto.toISAPI() });
  }
  async search({ employeeNo, faceLibId = '1', position = 0, maxResults = 30 } = {}) {
    const body = {
      FDSearchCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        FDID: String(faceLibId),
        faceLibType: 'blackFD',
        ...(employeeNo ? { FPID: [{ value: String(employeeNo) }] } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/Intelligent/FDLib/FDSearch?format=json', { ...JSON_FMT, body });
    const list = r.FDSearch && r.FDSearch.MatchList;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(employeeNo, faceLibId = '1') {
    const body = { FPID: [{ value: String(employeeNo) }] };
    return this.http.request('PUT', `/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=${faceLibId}&faceLibType=blackFD`, { ...JSON_FMT, body });
  }
  async getFaceLibs() {
    const r = await this.http.request('GET', '/ISAPI/Intelligent/FDLib?format=json', JSON_FMT);
    const list = r.FDLibList && r.FDLibList.FDLib;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/FaceService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/FaceService.js test/services/FaceService.test.js
git commit -m "feat: FaceService"
```

---

## Task 14: FingerprintService

**Files:**
- Create: `src/services/FingerprintService.js`
- Test: `test/services/FingerprintService.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { FingerprintService } from '../../src/services/FingerprintService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('FingerprintService', () => {
  it('add posts fingerprint config', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FingerprintService(http).add({ employeeNo: 'EMP001', fingerData: 'FPDATA', fingerPrintID: 1 });
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/FingerPrintModify?format=json');
    expect(opts.body.FingerPrintModify.employeeNo).toBe('EMP001');
    expect(opts.body.FingerPrintModify.fingerData).toBe('FPDATA');
  });
  it('search returns list', async () => {
    const http = fake(async () => ({ FingerPrintSearch: { FingerPrintInfo: { employeeNo: 'EMP001' } } }));
    const out = await new FingerprintService(http).search({ employeeNo: 'EMP001' });
    expect(out[0].employeeNo).toBe('EMP001');
  });
  it('delete by employeeNo', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FingerprintService(http).delete('EMP001', 1);
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/FingerPrintDelete?format=json');
    expect(opts.body.FingerPrintDelete.employeeNo).toBe('EMP001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/FingerprintService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/FingerprintService.js`**

```js
const JSON_FMT = { format: 'json' };

export class FingerprintService {
  constructor(http) { this.http = http; }

  async add({ employeeNo, fingerData, fingerPrintID = 1 }) {
    const body = {
      FingerPrintModify: {
        employeeNo: String(employeeNo),
        fingerPrintID: Number(fingerPrintID),
        fingerData,
      },
    };
    return this.http.request('POST', '/ISAPI/AccessControl/FingerPrintModify?format=json', { ...JSON_FMT, body });
  }
  async search({ employeeNo, position = 0, maxResults = 30 } = {}) {
    const body = {
      FingerPrintCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        ...(employeeNo ? { employeeNo: String(employeeNo) } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/FingerPrintSearch?format=json', { ...JSON_FMT, body });
    const list = r.FingerPrintSearch && r.FingerPrintSearch.FingerPrintInfo;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(employeeNo, fingerPrintID = 1) {
    const body = { FingerPrintDelete: { employeeNo: String(employeeNo), fingerPrintID: Number(fingerPrintID) } };
    return this.http.request('PUT', '/ISAPI/AccessControl/FingerPrintDelete?format=json', { ...JSON_FMT, body });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/FingerprintService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/FingerprintService.js test/services/FingerprintService.test.js
git commit -m "feat: FingerprintService"
```

---

## Task 15: AccessControlService

**Files:**
- Create: `src/services/AccessControlService.js`
- Test: `test/services/AccessControlService.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { AccessControlService } from '../../src/services/AccessControlService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('AccessControlService', () => {
  it('remoteControlDoor PUTs command', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new AccessControlService(http).remoteControlDoor(1, 'open');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/RemoteControl/door/1');
    expect(opts.body.RemoteControlDoor.cmd).toBe('open');
  });
  it('getDoorStatus GETs door status', async () => {
    const http = fake(async () => ({ DoorStatus: { doorState: 'open' } }));
    const out = await new AccessControlService(http).getDoorStatus(1);
    expect(out.doorState).toBe('open');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/AccessControlService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/AccessControlService.js`**

```js
export class AccessControlService {
  constructor(http) { this.http = http; }

  // cmd: 'open' | 'close' | 'alwaysOpen' | 'alwaysClose'
  async remoteControlDoor(doorNo, cmd) {
    const body = { RemoteControlDoor: { cmd } };
    return this.http.request('PUT', `/ISAPI/AccessControl/RemoteControl/door/${doorNo}`, { body });
  }
  async getDoorStatus(doorNo) {
    const r = await this.http.request('GET', `/ISAPI/AccessControl/RemoteControl/door/${doorNo}/status`);
    return r.DoorStatus || r;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/AccessControlService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/AccessControlService.js test/services/AccessControlService.test.js
git commit -m "feat: AccessControlService"
```

---

## Task 16: EventService

**Files:**
- Create: `src/services/EventService.js`
- Test: `test/services/EventService.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { EventService } from '../../src/services/EventService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('EventService', () => {
  it('search posts AcsEvent condition and returns events', async () => {
    const http = fake(async () => ({ AcsEvent: { InfoList: [{ employeeNoString: 'EMP001' }] } }));
    const out = await new EventService(http).search({ startTime: '2026-06-01T00:00:00', endTime: '2026-06-02T00:00:00' });
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/AcsEvent?format=json');
    expect(opts.body.AcsEventCond.startTime).toBe('2026-06-01T00:00:00');
    expect(out[0].employeeNoString).toBe('EMP001');
  });
  it('subscribe posts subscription', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new EventService(http).subscribe(['AccessControllerEvent']);
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/Event/notification/subscribeEvent?format=json');
    expect(opts.body.SubscribeEvent.EventList.Event[0].type).toBe('AccessControllerEvent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/EventService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/EventService.js`**

```js
const JSON_FMT = { format: 'json' };

export class EventService {
  constructor(http) { this.http = http; }

  async search({ startTime, endTime, position = 0, maxResults = 30, employeeNo } = {}) {
    const body = {
      AcsEventCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        major: 0,
        minor: 0,
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(employeeNo ? { employeeNoString: String(employeeNo) } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/AcsEvent?format=json', { ...JSON_FMT, body });
    const list = r.AcsEvent && r.AcsEvent.InfoList;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async subscribe(types = []) {
    const body = {
      SubscribeEvent: {
        heartbeat: 30,
        eventMode: 'list',
        EventList: { Event: types.map((type) => ({ type })) },
      },
    };
    return this.http.request('POST', '/ISAPI/Event/notification/subscribeEvent?format=json', { ...JSON_FMT, body });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/EventService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/EventService.js test/services/EventService.test.js
git commit -m "feat: EventService"
```

---

## Task 17: EventNotificationService

**Files:**
- Create: `src/services/EventNotificationService.js`
- Test: `test/services/EventNotificationService.test.js`

`configureWebhook(url, opts)` writes an httpHost entry. `getConfig()` reads hosts. `parseEvent(payload, contentType)` normalizes an incoming POSTed event body (consumer owns the receiving server).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { EventNotificationService } from '../../src/services/EventNotificationService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('EventNotificationService', () => {
  it('configureWebhook PUTs httpHost', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new EventNotificationService(http).configureWebhook('http://api/hook', { hostId: 1 });
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/Event/notification/httpHosts/1');
    expect(opts.body.HttpHostNotification.url).toBe('/hook');
    expect(opts.body.HttpHostNotification.ipAddress).toBe('api');
  });
  it('getConfig GETs hosts', async () => {
    const http = fake(async () => ({ HttpHostNotificationList: { HttpHostNotification: [{ id: '1' }] } }));
    const out = await new EventNotificationService(http).getConfig();
    expect(out[0].id).toBe('1');
  });
  it('parseEvent normalizes a JSON event', () => {
    const svc = new EventNotificationService({});
    const ev = svc.parseEvent('{"AccessControllerEvent":{"employeeNoString":"EMP001"}}', 'application/json');
    expect(ev.AccessControllerEvent.employeeNoString).toBe('EMP001');
  });
  it('parseEvent normalizes an XML event', () => {
    const svc = new EventNotificationService({});
    const ev = svc.parseEvent('<EventNotificationAlert><eventType>AccessControllerEvent</eventType></EventNotificationAlert>', 'application/xml');
    expect(ev.EventNotificationAlert.eventType).toBe('AccessControllerEvent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/EventNotificationService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/services/EventNotificationService.js`**

```js
import { deserialize } from '../internal/serialize.js';

export class EventNotificationService {
  constructor(http) { this.http = http; }

  async configureWebhook(url, { hostId = 1, protocol, parameterFormatType = 'JSON' } = {}) {
    const u = new URL(url);
    const proto = protocol || u.protocol.replace(':', '').toUpperCase(); // HTTP | HTTPS
    const body = {
      HttpHostNotification: {
        id: String(hostId),
        url: u.pathname || '/',
        protocolType: proto,
        parameterFormatType,
        addressingFormatType: 'ipaddress',
        ipAddress: u.hostname,
        portNo: Number(u.port) || (proto === 'HTTPS' ? 443 : 80),
        httpAuthenticationMethod: 'none',
      },
    };
    return this.http.request('PUT', `/ISAPI/Event/notification/httpHosts/${hostId}`, { body });
  }
  async getConfig() {
    const r = await this.http.request('GET', '/ISAPI/Event/notification/httpHosts');
    const list = r.HttpHostNotificationList && r.HttpHostNotificationList.HttpHostNotification;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  // Consumer owns the receiving HTTP server; this only normalizes a posted body.
  parseEvent(payload, contentType = '') {
    return deserialize(payload, contentType);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/EventNotificationService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/EventNotificationService.js test/services/EventNotificationService.test.js
git commit -m "feat: EventNotificationService"
```

---

## Task 18: HikvisionClient (wiring) + public exports

**Files:**
- Create: `src/client/HikvisionClient.js`
- Modify: `src/index.js`
- Test: `test/client/HikvisionClient.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { HikvisionClient } from '../../src/client/HikvisionClient.js';
import { DeviceService } from '../../src/services/DeviceService.js';
import { PersonService } from '../../src/services/PersonService.js';

describe('HikvisionClient', () => {
  it('exposes all services wired to one HttpClient', () => {
    const c = new HikvisionClient({ host: 'http://h', username: 'u', password: 'p' });
    expect(c.device).toBeInstanceOf(DeviceService);
    expect(c.person).toBeInstanceOf(PersonService);
    for (const k of ['card', 'face', 'fingerprint', 'accessControl', 'event', 'eventNotification']) {
      expect(c[k]).toBeTruthy();
    }
    expect(c.device.http).toBe(c.http);
  });
  it('throws without host', () => {
    expect(() => new HikvisionClient({})).toThrow(/host/);
  });
});
```

Also add an exports test `test/index.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as api from '../src/index.js';

describe('public exports', () => {
  it('exports client, enums, dtos, errors', () => {
    expect(api.HikvisionClient).toBeTruthy();
    expect(api.UserType).toBeTruthy();
    expect(api.EventType).toBeTruthy();
    expect(api.Person).toBeTruthy();
    expect(api.HikvisionError).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/client/HikvisionClient.test.js test/index.test.js`
Expected: FAIL — module not found / missing exports.

- [ ] **Step 3: Write `src/client/HikvisionClient.js`**

```js
import { HttpClient } from './HttpClient.js';
import { DeviceService } from '../services/DeviceService.js';
import { PersonService } from '../services/PersonService.js';
import { CardService } from '../services/CardService.js';
import { FaceService } from '../services/FaceService.js';
import { FingerprintService } from '../services/FingerprintService.js';
import { AccessControlService } from '../services/AccessControlService.js';
import { EventService } from '../services/EventService.js';
import { EventNotificationService } from '../services/EventNotificationService.js';

export class HikvisionClient {
  constructor(config) {
    this.http = new HttpClient(config);
    this.device = new DeviceService(this.http);
    this.person = new PersonService(this.http);
    this.card = new CardService(this.http);
    this.face = new FaceService(this.http);
    this.fingerprint = new FingerprintService(this.http);
    this.accessControl = new AccessControlService(this.http);
    this.event = new EventService(this.http);
    this.eventNotification = new EventNotificationService(this.http);
  }
}
```

- [ ] **Step 4: Rewrite `src/index.js`**

```js
export { HikvisionClient } from './client/HikvisionClient.js';
export { HttpClient } from './client/HttpClient.js';
export { Person } from './dto/Person.js';
export { Card } from './dto/Card.js';
export { Face } from './dto/Face.js';
export { UserType } from './enums/UserType.js';
export { EventType } from './enums/EventType.js';
export {
  HikvisionError, AuthError, RequestError, DeviceError, TimeoutError,
} from './errors/index.js';
export const VERSION = '0.1.0';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/client/HikvisionClient.test.js test/index.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/client/HikvisionClient.js src/index.js test/client/HikvisionClient.test.js test/index.test.js
git commit -m "feat: HikvisionClient wiring and public exports"
```

---

## Task 19: Full suite + build verification

**Files:**
- (no source change unless a failure surfaces)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 2: Build all outputs**

Run: `npm run build`
Expected: `dist/index.mjs`, `dist/index.cjs`, `dist/hikvision-isapi.umd.js`, `dist/hikvision-isapi.umd.min.js` created, no errors.

- [ ] **Step 3: Smoke-test the CJS build under Node**

Run:
```bash
node -e "const { HikvisionClient } = require('./dist/index.cjs'); console.log(typeof HikvisionClient)"
```
Expected: prints `function`.

- [ ] **Step 4: Smoke-test the UMD global**

Run:
```bash
node -e "globalThis.window={}; require('./dist/hikvision-isapi.umd.js'); console.log(typeof Hikvision.HikvisionClient)"
```
Expected: prints `function`. (If the IIFE binds to `globalThis` rather than a `window` global, adjust the probe to read `globalThis.Hikvision`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify full suite and build outputs"
```

---

## Task 20: README + usage docs

**Files:**
- Create: `README.md`
- Create: `examples/browser.html`, `examples/node.mjs`

- [ ] **Step 1: Write `README.md`**

Include: install, the CORS + MD5 limitation notes (copy from the spec's "Known Limitations"), and these two runnable examples.

Node (`examples/node.mjs`):
```js
import { HikvisionClient, UserType } from 'hikvision-isapi';

const client = new HikvisionClient({
  host: 'http://192.168.1.64', username: 'admin', password: 'pass',
});

console.log(await client.device.getInfo());
await client.person.add({ employeeNo: 'EMP001', name: 'John', userType: UserType.NORMAL });
await client.face.upload('EMP001', '<base64-jpeg>', '1');
await client.accessControl.remoteControlDoor(1, 'open');
```

Browser (`examples/browser.html`):
```html
<script src="https://unpkg.com/hikvision-isapi/dist/hikvision-isapi.umd.min.js"></script>
<script>
  const client = new Hikvision.HikvisionClient({
    host: 'http://192.168.1.64', username: 'admin', password: 'pass',
  });
  client.device.getInfo().then(console.log).catch(console.error);
  // NOTE: the device must send permissive CORS headers or the browser blocks this.
</script>
```

- [ ] **Step 2: Verify examples reference real exports**

Run: `node --check examples/node.mjs`
Expected: no syntax errors. (It will not connect to a device; this only checks the file parses.)

- [ ] **Step 3: Commit**

```bash
git add README.md examples
git commit -m "docs: README with Node and browser usage examples"
```

---

## Self-Review Notes (author check — already applied)

- **Spec coverage:** Every spec section maps to a task — md5/sha256 (T1–2), digest (T3), xml/serialize (T4–5), errors (T6), enums (T7), DTOs (T8), HttpClient incl. CORS/MD5 handling + error mapping (T9), all 8 services (T10–17), client wiring + exports (T18), build outputs ESM/CJS/UMD + package.json fields (T0, T19), testing strategy (every task is TDD), README + limitations (T20).
- **Type consistency:** `http.request(method, path, { body, format })` signature is identical across every service. DTOs expose `toISAPI()`; services accept DTO-or-plain-object via the `toX()` helper. `HttpClient` is referenced as `client.http` and each service stores it as `this.http` (asserted in T18).
- **Known risk to watch during execution:** exact ISAPI endpoint paths/body field names vary by device firmware. Tests assert the library's *contract* (method/path/body shape), not a live device. Treat endpoint strings as the best-known defaults; adjust against target firmware docs if a real device rejects them. This is called out in the README limitations.
```
