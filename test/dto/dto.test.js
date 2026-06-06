import { describe, it, expect } from 'vitest';
import { Person } from '../../src/dto/Person.js';
import { Card } from '../../src/dto/Card.js';
import { Face } from '../../src/dto/Face.js';
import { UserType } from '../../src/enums/UserType.js';

describe('Person', () => {
  it('requires employeeNo and name', () => {
    expect(() => Person({ name: 'X' })).toThrow(/employeeNo/);
    expect(() => Person({ employeeNo: '1' })).toThrow(/name/);
  });
  it('toISAPI builds UserInfo body', () => {
    const p = Person({ employeeNo: 'EMP001', name: 'John', userType: UserType.NORMAL });
    const body = p.toISAPI();
    expect(body.UserInfo.employeeNo).toBe('EMP001');
    expect(body.UserInfo.name).toBe('John');
    expect(body.UserInfo.userType).toBe('normal');
  });
  it('always emits a Valid block so UserInfo/Record is not rejected with 400', () => {
    const body = Person({ employeeNo: 'EMP001', name: 'John' }).toISAPI();
    expect(body.UserInfo.Valid).toBeDefined();
    expect(body.UserInfo.Valid.enable).toBe(true);
    expect(body.UserInfo.Valid.timeType).toBe('local');
    expect(body.UserInfo.Valid.beginTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.UserInfo.Valid.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('lets the caller override the validity window', () => {
    const body = Person({
      employeeNo: '1', name: 'J', validBegin: '2025-01-01T00:00:00', validEnd: '2026-01-01T00:00:00',
    }).toISAPI();
    expect(body.UserInfo.Valid.beginTime).toBe('2025-01-01T00:00:00');
    expect(body.UserInfo.Valid.endTime).toBe('2026-01-01T00:00:00');
  });
  it('fromISAPI reads UserInfo', () => {
    const p = Person.fromISAPI({ UserInfo: { employeeNo: 'EMP001', name: 'John' } });
    expect(p.employeeNo).toBe('EMP001');
  });
  it('grants door access by default so enrolled persons can authenticate', () => {
    const body = Person({ employeeNo: '1', name: 'J' }).toISAPI();
    expect(body.UserInfo.doorRight).toBe('1');
    expect(body.UserInfo.RightPlan).toEqual([{ doorNo: 1, planTemplateNo: '1' }]);
  });
  it('lets the caller override door rights', () => {
    const body = Person({
      employeeNo: '1', name: 'J', doorRight: '1', RightPlan: [{ doorNo: 2, planTemplateNo: '3' }],
    }).toISAPI();
    expect(body.UserInfo.RightPlan).toEqual([{ doorNo: 2, planTemplateNo: '3' }]);
  });
  it('maps department to the integer groupId', () => {
    const body = Person({ employeeNo: '1', name: 'J', department: '5' }).toISAPI();
    expect(body.UserInfo.groupId).toBe(5);
  });
  it('accepts groupId directly', () => {
    const body = Person({ employeeNo: '1', name: 'J', groupId: 3 }).toISAPI();
    expect(body.UserInfo.groupId).toBe(3);
  });
  it('omits groupId when no department is given', () => {
    const body = Person({ employeeNo: '1', name: 'J' }).toISAPI();
    expect(body.UserInfo.groupId).toBeUndefined();
  });
  it('fromISAPI reads department (groupId) and gender back; groupId 0 => none', () => {
    const p = Person.fromISAPI({ UserInfo: { employeeNo: '1', name: 'J', gender: 'male', groupId: 5 } });
    expect(p.department).toBe(5);
    expect(p.gender).toBe('male');
    const none = Person.fromISAPI({ UserInfo: { employeeNo: '2', name: 'K', groupId: 0 } });
    expect(none.department).toBeUndefined();
  });
});

describe('Card', () => {
  it('toISAPI builds CardInfo body', () => {
    const c = Card({ employeeNo: 'EMP001', cardNo: '123456' });
    expect(c.toISAPI().CardInfo.cardNo).toBe('123456');
  });
});

describe('Face', () => {
  it('toISAPI includes faceLibId and image', () => {
    const f = Face({ employeeNo: 'EMP001', faceLibId: '1', imageBase64: 'AAA' });
    const body = f.toISAPI();
    expect(body.FaceDataRecord.FPID).toBe('EMP001');
    expect(body.FaceDataRecord.FDID).toBe('1');
  });
});
