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
