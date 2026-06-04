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
  it('fromISAPI reads UserInfo', () => {
    const p = Person.fromISAPI({ UserInfo: { employeeNo: 'EMP001', name: 'John' } });
    expect(p.employeeNo).toBe('EMP001');
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
    expect(body.FaceInfo.employeeNo).toBe('EMP001');
    expect(body.FaceInfo.faceLibId).toBe('1');
  });
});
