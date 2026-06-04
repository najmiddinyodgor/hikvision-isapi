import { buildXml, parseXml } from './xml.js';

export function serialize(obj, format, rootName) {
  if (format === 'json') {
    return { body: JSON.stringify(obj), contentType: 'application/json' };
  }
  return { body: buildXml(obj, rootName), contentType: 'application/xml' };
}

export function deserialize(text, contentType = '') {
  if (!text) return null;
  const t = text.trim();
  // Trust the body shape over the Content-Type header: some Hikvision firmwares
  // mislabel an XML body as application/json (e.g. deviceInfo?format=json).
  if (t.startsWith('<')) return parseXml(t);
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  if (/json/i.test(contentType)) return JSON.parse(t);
  if (/xml/i.test(contentType)) return parseXml(t);
  return text;
}
