const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function unesc(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function nodeToXml(name, value) {
  if (Array.isArray(value)) return value.map((v) => nodeToXml(name, v)).join('');
  if (value === null || value === undefined) return `<${name}/>`;
  if (typeof value === 'object') {
    const inner = Object.keys(value).map((k) => nodeToXml(k, value[k])).join('');
    return `<${name}>${inner}</${name}>`;
  }
  return `<${name}>${esc(value)}</${name}>`;
}

export function buildXml(obj, rootName) {
  const key = rootName || Object.keys(obj)[0];
  return HEADER + nodeToXml(key, obj[key]);
}

// Minimal recursive-descent XML parser (no attributes in body, ignores PIs/comments).
export function parseXml(str) {
  let i = 0;
  const s = str.replace(/<\?[^?]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  function parseNode() {
    while (i < s.length && s[i] !== '<') i++;
    if (i >= s.length) return null;
    i++; // consume '<'
    let name = '';
    while (i < s.length && !/[\s/>]/.test(s[i])) name += s[i++];
    // skip attributes
    while (i < s.length && s[i] !== '>' && s[i] !== '/') i++;
    if (s[i] === '/') { i += 2; return { name, value: null }; } // self-closing
    i++; // consume '>'
    const children = {};
    let text = '';
    let hasChild = false;
    while (i < s.length) {
      if (s[i] === '<') {
        if (s[i + 1] === '/') { // closing tag
          i += 2;
          while (i < s.length && s[i] !== '>') i++;
          i++;
          break;
        }
        hasChild = true;
        const child = parseNode();
        if (child) {
          if (children[child.name] === undefined) children[child.name] = child.value;
          else {
            if (!Array.isArray(children[child.name])) children[child.name] = [children[child.name]];
            children[child.name].push(child.value);
          }
        }
      } else {
        text += s[i++];
      }
    }
    return { name, value: hasChild ? children : unesc(text.trim()) };
  }
  const root = parseNode();
  return root ? { [root.name]: root.value } : {};
}
