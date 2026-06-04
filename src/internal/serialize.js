import { buildXml, parseXml } from './xml.js';

export function serialize(obj, format, rootName) {
  if (format === 'json') {
    return { body: JSON.stringify(obj), contentType: 'application/json' };
  }
  return { body: buildXml(obj, rootName), contentType: 'application/xml' };
}

export function deserialize(text, contentType = '') {
  if (!text) return null;
  if (/json/i.test(contentType)) return JSON.parse(text);
  if (/xml/i.test(contentType)) return parseXml(text);
  // best-effort sniff
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  if (t.startsWith('<')) return parseXml(t);
  return text;
}
