import { Department } from '../dto/Department.js';
import { PersonService } from './PersonService.js';

const PAGE = 30; // UserInfoSearchCond maxResults is capped at 30 by the firmware

// The device has no department registry, so departments are aggregated from the
// `PersonInfoExtends` value of every enrolled person. See dto/Department.js.
export class DepartmentService {
  constructor(http) {
    this.http = http;
    this.person = new PersonService(http);
  }

  // Paginate the whole user table once, yielding raw UserInfo records.
  async _allPersons() {
    const all = [];
    for (let position = 0; ; position += PAGE) {
      const batch = await this.person.search({ position, maxResults: PAGE }); // eslint-disable-line no-await-in-loop
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  }

  // List distinct departments (by groupId) with their member employeeNos/counts.
  async list() {
    const persons = await this._allPersons();
    const byId = new Map();
    for (const u of persons) {
      const id = Department.fromUserInfo(u);
      if (id == null) continue;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(String(u.employeeNo));
    }
    return [...byId.entries()]
      .map(([id, employeeNos]) => Department({ id, employeeNos }))
      .sort((a, b) => a.id - b.id);
  }

  // The raw person records belonging to one department (groupId).
  async listPersons(id) {
    const target = Number(id);
    const persons = await this._allPersons();
    return persons.filter((u) => Department.fromUserInfo(u) === target);
  }
}
