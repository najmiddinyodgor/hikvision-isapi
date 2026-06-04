import { Card } from '../dto/Card.js';

const JSON_FMT = { format: 'json' };
const toCard = (c) => (typeof c.toISAPI === 'function' ? c : Card(c));

export class CardService {
  constructor(http) { this.http = http; }

  async add(card) {
    return this.http.request('POST', '/ISAPI/AccessControl/CardInfo/Record?format=json', { ...JSON_FMT, body: toCard(card).toISAPI() });
  }
  async update(card) {
    return this.http.request('PUT', '/ISAPI/AccessControl/CardInfo/Modify?format=json', { ...JSON_FMT, body: toCard(card).toISAPI() });
  }
  async search({ position = 0, maxResults = 30, employeeNo } = {}) {
    const cond = {
      CardInfoSearchCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        ...(employeeNo ? { EmployeeNoList: [{ employeeNo: String(employeeNo) }] } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/CardInfo/Search?format=json', { ...JSON_FMT, body: cond });
    const list = r.CardInfoSearch && r.CardInfoSearch.CardInfo;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(cardNo) {
    const body = { CardInfoDelCond: { CardNoList: [{ cardNo: String(cardNo) }] } };
    return this.http.request('PUT', '/ISAPI/AccessControl/CardInfo/Delete?format=json', { ...JSON_FMT, body });
  }
}
