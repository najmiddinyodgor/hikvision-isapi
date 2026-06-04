import { describe, it, expect, vi } from 'vitest';
import { PersonService } from '../../src/services/PersonService.js';
import { Person } from '../../src/dto/Person.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('PersonService', () => {
  it('add POSTs UserInfo Record', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    const svc = new PersonService(http);
    await svc.add(Person({ employeeNo: 'EMP001', name: 'John' }));
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/UserInfo/Record?format=json');
    expect(opts.body.UserInfo.employeeNo).toBe('EMP001');
  });
  it('add accepts a plain object', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new PersonService(http).add({ employeeNo: 'E2', name: 'Jane' });
    expect(http.request.mock.calls[0][2].body.UserInfo.employeeNo).toBe('E2');
  });
  it('search POSTs search body and returns matches', async () => {
    const http = fake(async () => ({ UserInfoSearch: { UserInfo: [{ employeeNo: 'EMP001' }] } }));
    const out = await new PersonService(http).search({ position: 0, maxResults: 30 });
    expect(http.request.mock.calls[0][1]).toBe('/ISAPI/AccessControl/UserInfo/Search?format=json');
    expect(out[0].employeeNo).toBe('EMP001');
  });
  it('delete PUTs a delete by employeeNo', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new PersonService(http).delete('EMP001');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/UserInfo/Delete?format=json');
    expect(opts.body.UserInfoDelCond.EmployeeNoList[0].employeeNo).toBe('EMP001');
  });
  it('count GETs count', async () => {
    const http = fake(async () => ({ UserInfoCount: { userNumber: '5' } }));
    const n = await new PersonService(http).count();
    expect(n).toBe(5);
  });
});
