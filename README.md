# hikvision-isapi

Isomorphic Hikvision ISAPI client for Node.js 18+ and browsers. Zero runtime dependencies. HTTP Digest authentication handled automatically.

## Install

```sh
npm install hikvision-isapi
```

**Browser (CDN/script tag)** — exposes the global `Hikvision`:

```html
<script src="https://unpkg.com/hikvision-isapi/dist/hikvision-isapi.umd.min.js"></script>
```

## Quick start (Node)

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

## Quick start (Browser)

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

## API overview

All methods are `async` and return plain JavaScript objects parsed from the device response.

| Service | Method | Description |
|---------|--------|-------------|
| `client.device` | `getInfo(format?)` | Device model, firmware version, serial |
| | `getStatus(format?)` | Current device status |
| | `getCapabilities(format?)` | Device capability list |
| | `isOnline()` | Returns `true` if the device responds |
| `client.person` | `add(person)` | Add a person record |
| | `update(person)` | Update an existing person |
| | `get(employeeNo)` | Get a single person by employee number |
| | `search({ position?, maxResults?, employeeNo? })` | Search/list persons |
| | `delete(employeeNo)` | Delete a person |
| | `count()` | Return total person count |
| `client.card` | `add(card)` | Add a card record |
| | `update(card)` | Update an existing card |
| | `search({ position?, maxResults?, employeeNo? })` | Search/list cards |
| | `delete(cardNo)` | Delete a card |
| `client.face` | `upload(employeeNo, imageBase64, faceLibId?)` | Upload a face image |
| | `search({ employeeNo?, faceLibId?, position?, maxResults? })` | Search face records |
| | `delete(employeeNo, faceLibId?)` | Delete a face record |
| | `getFaceLibs()` | List face libraries on the device |
| `client.fingerprint` | `add({ employeeNo, fingerData, fingerPrintID? })` | Enroll a fingerprint |
| | `search({ employeeNo?, position?, maxResults? })` | Search fingerprint records |
| | `delete(employeeNo, fingerPrintID?)` | Delete a fingerprint |
| `client.accessControl` | `remoteControlDoor(doorNo, cmd)` | Open/close/lock a door remotely |
| | `getDoorStatus(doorNo)` | Get current door status |
| `client.event` | `search({ startTime?, endTime?, position?, maxResults?, employeeNo? })` | Query stored access events |
| | `subscribe(types?)` | Subscribe to real-time event types |
| `client.eventNotification` | `configureWebhook(url, opts?)` | Tell the device where to POST events |
| | `getConfig()` | Get current webhook/notification config |
| | `parseEvent(payload, contentType?)` | Normalize a received event payload |

### Enums

```js
import { UserType, EventType } from 'hikvision-isapi';

UserType.NORMAL     // 'normal'
UserType.VISITOR    // 'visitor'
UserType.BLACKLIST  // 'blackList'

EventType.ACCESS    // 'AccessControllerEvent'
```

## Configuration

```js
new HikvisionClient({
  host,           // Required. Base URL of the device, e.g. 'http://192.168.1.64'
  username,       // Required. Device admin username.
  password,       // Required. Device admin password.
  timeout,        // Optional. Request timeout in milliseconds. Default: 10000.
  defaultFormat,  // Optional. Response format: 'xml' | 'json'. Default: 'xml'.
})
```

`defaultFormat` controls both the `Accept` request header and serialization of request bodies. Most Hikvision devices support XML; some support JSON. Individual service methods accept an optional `format` parameter to override the default for that call.

## Errors

All errors extend `HikvisionError`, which extends `Error`.

| Class | When thrown | Notable properties |
|-------|-------------|-------------------|
| `HikvisionError` | Base class — never thrown directly | `message` |
| `AuthError` | 401 response or bad/missing Digest challenge | `message` |
| `RequestError` | Non-2xx HTTP response (non-401) or network failure | `statusCode`, `raw` |
| `DeviceError` | Device returned an ISAPI `ResponseStatus` fault | `statusCode`, `subStatusCode`, `raw` |
| `TimeoutError` | Request exceeded the configured `timeout` | `message` |

```js
import { HikvisionClient, AuthError, DeviceError, TimeoutError } from 'hikvision-isapi';

try {
  await client.person.add({ employeeNo: 'EMP001', name: 'John' });
} catch (err) {
  if (err instanceof AuthError) console.error('Bad credentials');
  else if (err instanceof DeviceError) console.error('ISAPI fault', err.subStatusCode, err.raw);
  else if (err instanceof TimeoutError) console.error('Device unreachable');
  else throw err;
}
```

## Limitations

- **Browser CORS:** Direct browser-to-device calls require the device to respond with permissive CORS headers (`Access-Control-Allow-Origin`). Most Hikvision devices do not send these by default, so browser requests will be blocked. This is a browser security constraint, not a library bug. Node.js is unaffected.

- **MD5 bundled (zero runtime dependencies):** The HTTP Digest authentication scheme typically requires MD5. The Web Crypto API does not expose MD5, so a small pure-JS MD5 implementation is bundled alongside a SHA-256 fallback. The package has zero runtime npm dependencies.

- **Endpoint and firmware drift:** ISAPI endpoint paths and XML/JSON field names vary across device models and firmware versions. The library uses best-known defaults derived from Hikvision's published ISAPI documentation. If a call is rejected or returns unexpected data, consult the ISAPI reference for your specific device model and firmware and adjust accordingly.

- **Webhooks (receiving events):** `eventNotification.configureWebhook(url)` instructs the device to POST events to a URL you control. Receiving those events requires your own HTTP server. Use `parseEvent(rawBody, contentType)` to normalize the incoming payload once your server receives it.

## License

MIT
