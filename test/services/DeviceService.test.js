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
