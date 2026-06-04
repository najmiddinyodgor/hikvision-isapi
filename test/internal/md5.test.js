import { describe, it, expect } from 'vitest';
import { md5 } from '../../src/internal/md5.js';

describe('md5', () => {
  it('hashes empty string', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
  it('hashes "abc"', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
  it('handles UTF-8', () => {
    expect(md5('é')).toBe('66ddcd97cfdeabb2f6fb8a999b4bc76f');
  });
});
