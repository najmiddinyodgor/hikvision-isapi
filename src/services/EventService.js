const JSON_FMT = { format: 'json' };

export class EventService {
  constructor(http) { this.http = http; }

  async search({ startTime, endTime, position = 0, maxResults = 30, employeeNo } = {}) {
    const body = {
      AcsEventCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        major: 0,
        minor: 0,
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(employeeNo ? { employeeNoString: String(employeeNo) } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/AcsEvent?format=json', { ...JSON_FMT, body });
    const list = r.AcsEvent && r.AcsEvent.InfoList;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async subscribe(types = []) {
    const body = {
      SubscribeEvent: {
        heartbeat: 30,
        eventMode: 'list',
        EventList: { Event: types.map((type) => ({ type })) },
      },
    };
    return this.http.request('POST', '/ISAPI/Event/notification/subscribeEvent?format=json', { ...JSON_FMT, body });
  }
}
