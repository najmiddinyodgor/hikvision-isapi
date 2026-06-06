# Hikvision ISAPI — JavaScript Port Design

**Date:** 2026-06-04
**Status:** Approved (pending spec review)
**Source project:** https://github.com/Shaykhnazar/hikvision-isapi (Laravel/PHP package)

## Goal

Port the Hikvision ISAPI Laravel/PHP package to a pure-JavaScript library. Ship it as:

1. An npm package usable from **both Node.js (18+) and browsers** (isomorphic).
2. A standalone **downloadable JavaScript file** (UMD/IIFE bundle) usable directly via `<script src>` or a CDN (unpkg/jsdelivr).

The library is a client for Hikvision ISAPI face-recognition terminals and access-control devices: device info, person/card/face/fingerprint CRUD, door access control, event search, and event-notification (webhook) configuration.

## Locked Decisions

| Decision | Choice |
|---|---|
| Runtime | Isomorphic — Node.js 18+ and browser, single codebase |
| Feature scope | Full parity with the original (all services) |
| Dependencies | **Zero runtime dependencies** — bundle a tiny pure-JS MD5, SHA-256, and minimal XML parser/builder |
| Language | Plain JavaScript (ESM source). **No** shipped type definitions |
| API shape | Service-oriented (mirrors the PHP package): `client.person.add()`, `client.face.upload()` |
| HTTP layer | Native `fetch` (built into Node 18+ and browsers) |
| Auth | HTTP Digest, computed in-library |

## Non-Goals / Out of Scope

- Laravel-specific infrastructure: Facades, service container, config/Database/Callback device providers, Laravel caching. Replaced by plain `new HikvisionClient(...)` instances. Multi-device = multiple client instances.
- Receiving webhooks (running an HTTP server). The library **configures** the device to POST events and **parses** incoming event payloads, but the consumer owns the receiving endpoint.
- TypeScript type definitions.

## Known Limitations (documented in README)

- **Browser CORS:** A Hikvision device must return permissive CORS headers, or direct browser-to-device calls fail at the network layer. This is unavoidable in-browser and is not a library bug. Node.js has no such restriction.
- **MD5 in browser:** Web Crypto (`crypto.subtle`) provides SHA-256 but not MD5, which Hikvision Digest auth typically uses. The library therefore bundles a small pure-JS MD5 (and SHA-256 for `algorithm=SHA-256` challenges) rather than relying on the platform.

## Architecture

### Directory layout

```
src/
  index.js                 # public exports: HikvisionClient, enums, errors
  client/
    HikvisionClient.js     # wires config, instantiates services
    HttpClient.js          # fetch wrapper, Digest auth, retry-on-401
    digestAuth.js          # parse WWW-Authenticate, build Authorization header
  internal/
    md5.js                 # tiny pure-JS MD5 (zero dep)
    sha256.js              # pure-JS SHA-256 (for SHA-256 digest challenges)
    xml.js                 # minimal XML parse + build
    serialize.js           # XML <-> JSON, content-type detection
  services/
    DeviceService.js
    PersonService.js
    CardService.js
    FaceService.js
    FingerprintService.js
    AccessControlService.js
    EventService.js
    EventNotificationService.js
  dto/                     # Person, Card, Face: factory + validate + toISAPI/fromISAPI
  enums/                   # UserType, EventType (Object.freeze)
  errors/                  # HikvisionError + subclasses
test/                      # vitest (devDependency only), mocked fetch
dist/                      # built outputs (gitignored)
```

### Core HTTP flow (`HttpClient`)

1. `request(method, path, { body, format })` issues a `fetch`.
2. The first call may return `401` with `WWW-Authenticate: Digest ...`. Parse `realm`, `nonce`, `qop`, `opaque`, `algorithm`.
3. Compute the Digest response using bundled MD5 (or SHA-256 when `algorithm=SHA-256`), build the `Authorization` header, and retry the request once. Cache `nonce`/client `cnonce` and the `nc` counter per client for subsequent calls to avoid re-challenging.
4. Serialize the request body: JS object → XML or JSON based on endpoint/`format`. Parse the response symmetrically.
5. Throw a typed error on a non-2xx status or an ISAPI `<ResponseStatus>` fault (carrying `statusCode`/`subStatusCode` and the raw response).

### Client configuration

```js
new HikvisionClient({
  host: 'https://192.168.1.64',   // http:// or https://
  username,
  password,
  timeout: 10000,                 // optional; via AbortController
  defaultFormat: 'xml'            // 'xml' | 'json'
});
```

## Services (full parity)

| Service | Methods | ISAPI endpoints (representative) |
|---|---|---|
| `device` | `getInfo()`, `getStatus()`, `getCapabilities()`, `isOnline()` | `/ISAPI/System/deviceInfo`, `/ISAPI/System/status`, `/capabilities` |
| `person` | `add()`, `update()`, `get()`, `search()`, `delete()`, `count()` | `/ISAPI/AccessControl/UserInfo/*` |
| `card` | `add()`, `update()`, `search()`, `delete()` | `/ISAPI/AccessControl/CardInfo/*` |
| `face` | `upload()`, `search()`, `delete()`, `getFaceLibs()` | `/ISAPI/Intelligent/FDLib/*`, `FaceDataRecord` |
| `fingerprint` | `add()`, `search()`, `delete()` | `/ISAPI/AccessControl/CaptureFingerPrint`, `FingerPrintCfg` |
| `accessControl` | `remoteControlDoor(door, cmd)`, `getDoorStatus()` | `/ISAPI/AccessControl/RemoteControl/door/*` |
| `event` | `search(filter)`, `subscribe()` | `/ISAPI/AccessControl/AcsEvent` |
| `eventNotification` | `configureWebhook(url, opts)`, `getConfig()`, `parseEvent(payload)` | `/ISAPI/Event/notification/httpHosts/*` |

- `parseEvent(payload)` is a framework-agnostic helper: feed it a raw POSTed body (XML/JSON or multipart) and receive a normalized event object. It does **not** run a server.

## Data model

### DTOs

Plain factory functions with validation rather than heavy classes. Each exposes `toISAPI()` / `fromISAPI()` to map between normalized JS fields and the ISAPI XML/JSON shape.

```js
Person({ employeeNo, name, userType, validBegin, validEnd, /* ... */ });
Card({ employeeNo, cardNo, cardType, /* ... */ });
Face({ employeeNo, faceLibId, imageBase64, /* ... */ });
```

### Enums

`Object.freeze`d maps with labels:

- `UserType`: `normal`, `visitor`, `blocklist`
- `EventType`: frozen map of event codes with `.label`

### Errors

- `HikvisionError` (base)
  - `AuthError` — Digest auth failed
  - `RequestError` — transport/HTTP error
  - `DeviceError` — ISAPI fault, carries `statusCode` / `subStatusCode`
  - `TimeoutError` — request exceeded `timeout`

All carry the raw response for debugging.

## Build & packaging

Build tool: `tsup` (devDependency only — runtime stays zero-dep; wraps esbuild, emits ESM/CJS/UMD from one config).

Outputs:

- `dist/index.mjs` — ESM (`import`)
- `dist/index.cjs` — CommonJS (`require`)
- `dist/hikvision-isapi.umd.js` and `dist/hikvision-isapi.umd.min.js` — **the downloadable file**; exposes global `Hikvision`; usable via `<script src>`

`package.json`:

- `exports` map (`import`/`require`/`browser`)
- `browser` field
- `unpkg` / `jsdelivr` fields pointing at the UMD min build so CDN download works out of the box

## Testing

- Framework: `vitest` (devDependency only).
- Strategy: mock `fetch`. Test-driven, per service.
- Coverage targets:
  - Digest challenge parsing and response-hash correctness (MD5 and SHA-256 paths).
  - XML ↔ JSON serialize round-trips.
  - Each service builds the correct endpoint, method, and body.
  - Error mapping (HTTP status and ISAPI faults → typed errors).

## Documentation

README with:

- Browser `<script>` usage and npm usage examples.
- Per-service examples mirroring the original PHP package.
- The CORS and MD5 limitation notes.

## Build order (for the implementation plan)

1. `internal/` primitives: md5, sha256, xml, serialize (TDD, pure functions).
2. `client/`: digestAuth, HttpClient, HikvisionClient skeleton.
3. `errors/`, `enums/`, `dto/`.
4. Services one at a time (TDD), starting with `device` (simplest, validates the whole HTTP+auth path end to end), then `person`, `card`, `face`, `fingerprint`, `accessControl`, `event`, `eventNotification`.
5. Build config + outputs (ESM/CJS/UMD), `package.json` fields.
6. README + examples.
