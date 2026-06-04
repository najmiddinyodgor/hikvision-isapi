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
