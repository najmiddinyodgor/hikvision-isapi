import { describe, it, expect } from 'vitest';
import { UserType } from '../../src/enums/UserType.js';
import { EventType } from '../../src/enums/EventType.js';

describe('enums', () => {
  it('UserType values', () => {
    expect(UserType.NORMAL).toBe('normal');
    expect(UserType.VISITOR).toBe('visitor');
    expect(UserType.BLOCKLIST).toBe('blackList');
  });
  it('UserType is frozen', () => {
    expect(Object.isFrozen(UserType)).toBe(true);
  });
  it('EventType has labels', () => {
    expect(EventType.label(EventType.AUTHENTICATION)).toBeTypeOf('string');
  });
});
