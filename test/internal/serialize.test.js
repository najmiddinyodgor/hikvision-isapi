import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../../src/internal/serialize.js';

describe('serialize', () => {
  it('serializes json', () => {
    const { body, contentType } = serialize({ UserInfo: { name: 'John' } }, 'json');
    expect(contentType).toBe('application/json');
    expect(JSON.parse(body).UserInfo.name).toBe('John');
  });
  it('serializes xml', () => {
    const { body, contentType } = serialize({ UserInfo: { name: 'John' } }, 'xml', 'UserInfo');
    expect(contentType).toBe('application/xml');
    expect(body).toContain('<name>John</name>');
  });
});

describe('deserialize', () => {
  it('parses json by content-type', () => {
    expect(deserialize('{"a":1}', 'application/json').a).toBe(1);
  });
  it('parses xml by content-type', () => {
    expect(deserialize('<r><a>1</a></r>', 'application/xml').r.a).toBe('1');
  });
  it('falls back to text when unknown', () => {
    expect(deserialize('hello', 'text/plain')).toBe('hello');
  });
  it('trusts the body shape when firmware mislabels XML as json', () => {
    const out = deserialize('<DeviceInfo><model>DS-K1T343MWX</model></DeviceInfo>', 'application/json');
    expect(out.DeviceInfo.model).toBe('DS-K1T343MWX');
  });
});
