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
