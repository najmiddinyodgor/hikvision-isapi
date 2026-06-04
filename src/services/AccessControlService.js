export class AccessControlService {
  constructor(http) { this.http = http; }

  // cmd: 'open' | 'close' | 'alwaysOpen' | 'alwaysClose'
  async remoteControlDoor(doorNo, cmd) {
    const body = { RemoteControlDoor: { cmd } };
    return this.http.request('PUT', `/ISAPI/AccessControl/RemoteControl/door/${doorNo}`, { body });
  }
  async getDoorStatus(doorNo) {
    const r = await this.http.request('GET', `/ISAPI/AccessControl/RemoteControl/door/${doorNo}/status`);
    return r.DoorStatus || r;
  }
}
