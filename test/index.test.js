import { describe, it, expect } from 'vitest';
import * as api from '../src/index.js';

describe('public exports', () => {
  it('exports client, enums, dtos, errors', () => {
    expect(api.HikvisionClient).toBeTruthy();
    expect(api.UserType).toBeTruthy();
    expect(api.EventType).toBeTruthy();
    expect(api.Person).toBeTruthy();
    expect(api.HikvisionError).toBeTruthy();
  });
});
