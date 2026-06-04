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
