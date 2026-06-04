import { describe, it, expect } from 'vitest';
import { buildXml, parseXml } from '../../src/internal/xml.js';

describe('buildXml', () => {
  it('builds nested xml', () => {
    const xml = buildXml({ UserInfo: { employeeNo: 'EMP001', name: 'John' } }, 'UserInfo');
    expect(xml).toContain('<UserInfo');
    expect(xml).toContain('<employeeNo>EMP001</employeeNo>');
    expect(xml).toContain('<name>John</name>');
  });
  it('builds repeated tags from arrays', () => {
    const xml = buildXml({ list: { item: ['a', 'b'] } }, 'list');
    expect(xml).toContain('<item>a</item>');
    expect(xml).toContain('<item>b</item>');
  });
  it('escapes special chars', () => {
    const xml = buildXml({ r: { v: 'a & b < c' } }, 'r');
    expect(xml).toContain('a &amp; b &lt; c');
  });
});

describe('parseXml', () => {
  it('parses nested xml to object', () => {
    const obj = parseXml('<UserInfo><employeeNo>EMP001</employeeNo><name>John</name></UserInfo>');
    expect(obj.UserInfo.employeeNo).toBe('EMP001');
    expect(obj.UserInfo.name).toBe('John');
  });
  it('collapses repeated tags into arrays', () => {
    const obj = parseXml('<list><item>a</item><item>b</item></list>');
    expect(obj.list.item).toEqual(['a', 'b']);
  });
  it('round-trips ResponseStatus', () => {
    const obj = parseXml('<ResponseStatus><statusCode>1</statusCode><subStatusCode>ok</subStatusCode></ResponseStatus>');
    expect(obj.ResponseStatus.statusCode).toBe('1');
  });
  it('parses a root tag with namespace attributes (xmlns URL contains //)', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<DeviceInfo version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">'
      + '<deviceName>Access Controller</deviceName><model>DS-K1T343MWX</model></DeviceInfo>';
    const obj = parseXml(xml);
    expect(obj.DeviceInfo.deviceName).toBe('Access Controller');
    expect(obj.DeviceInfo.model).toBe('DS-K1T343MWX');
  });
});
