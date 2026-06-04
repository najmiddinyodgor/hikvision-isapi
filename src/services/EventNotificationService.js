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
