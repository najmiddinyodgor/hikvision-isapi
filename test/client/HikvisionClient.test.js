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
