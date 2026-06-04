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
