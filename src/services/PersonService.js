import { Person } from '../dto/Person.js';

const JSON_FMT = { format: 'json' };

function toPerson(p) {
  return typeof p.toISAPI === 'function' ? p : Person(p);
}

export class PersonService {
  constructor(http) { this.http = http; }

  async add(person) {
    const body = toPerson(person).toISAPI();
    return this.http.request('POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', { ...JSON_FMT, body });
  }
  async update(person) {
    const body = toPerson(person).toISAPI();
    return this.http.request('PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json', { ...JSON_FMT, body });
  }
  async get(employeeNo) {
    const results = await this.search({ employeeNo, maxResults: 1 });
    return results[0] || null;
  }
  async search({ position = 0, maxResults = 30, employeeNo } = {}) {
    const cond = {
      UserInfoSearchCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        ...(employeeNo ? { EmployeeNoList: [{ employeeNo: String(employeeNo) }] } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/UserInfo/Search?format=json', { ...JSON_FMT, body: cond });
    const list = r.UserInfoSearch && r.UserInfoSearch.UserInfo;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(employeeNo) {
    const body = { UserInfoDelCond: { EmployeeNoList: [{ employeeNo: String(employeeNo) }] } };
    return this.http.request('PUT', '/ISAPI/AccessControl/UserInfo/Delete?format=json', { ...JSON_FMT, body });
  }
  async count() {
    const r = await this.http.request('GET', '/ISAPI/AccessControl/UserInfo/Count?format=json', JSON_FMT);
    const n = r.UserInfoCount && r.UserInfoCount.userNumber;
    return n === undefined ? 0 : Number(n);
  }
}
