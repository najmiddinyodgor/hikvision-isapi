import { describe, it, expect, vi } from 'vitest';
import { DepartmentService } from '../../src/services/DepartmentService.js';

// Build a fake http whose UserInfo/Search returns the given persons in pages of 30.
function fakeHttp(persons) {
  return {
    request: vi.fn(async (method, path, { body }) => {
      const pos = body.UserInfoSearchCond.searchResultPosition;
      const page = persons.slice(pos, pos + 30);
      return { UserInfoSearch: { UserInfo: page } };
    }),
  };
}

const P = (employeeNo, groupId) => ({
  employeeNo,
  name: `n${employeeNo}`,
  ...(groupId != null ? { groupId } : {}),
});

describe('DepartmentService', () => {
  it('aggregates distinct departments (groupId) with member counts, sorted by id', async () => {
    const http = fakeHttp([P('1', 2), P('2', 1), P('3', 2), P('4', 0)]);
    const out = await new DepartmentService(http).list();
    expect(out.map((d) => d.id)).toEqual([1, 2]); // groupId 0 excluded
    const g2 = out.find((d) => d.id === 2);
    expect(g2.count).toBe(2);
    expect(g2.employeeNos).toEqual(['1', '3']);
  });

  it('paginates past the 30-row cap', async () => {
    const persons = Array.from({ length: 65 }, (_, i) => P(String(i + 1), 7));
    const http = fakeHttp(persons);
    const out = await new DepartmentService(http).list();
    expect(out[0].count).toBe(65);
    expect(http.request).toHaveBeenCalledTimes(3); // 30 + 30 + 5
  });

  it('listPersons returns the raw records for one department id', async () => {
    const http = fakeHttp([P('1', 2), P('2', 1), P('3', 2)]);
    const out = await new DepartmentService(http).listPersons(2);
    expect(out.map((u) => u.employeeNo)).toEqual(['1', '3']);
  });
});
