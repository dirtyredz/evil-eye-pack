'use strict';
// Read the scalar fields in Forge mods.toml. Unrelated arrays/inline tables are
// ignored; quoted strings, comments and multiline descriptions are tokenized.
function tables(text) {
  const rows = [{ table: '', values: {} }];
  let row = rows[0];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const header = /^\s*\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/.exec(lines[i]);
    if (header) {
      row = { table: header[1].trim().replace(/["']/g, ''), values: {} }; rows.push(row); continue;
    }
    const kv = /^\s*([\w-]+)\s*=\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let raw = kv[2], value;
    const triple = raw.startsWith('"""') ? '"""' : raw.startsWith("'''") ? "'''" : null;
    if (triple) {
      raw = raw.slice(3);
      while (!raw.includes(triple) && i + 1 < lines.length) raw += '\n' + lines[++i];
      if (!raw.includes(triple)) throw new Error('Unterminated TOML multiline string');
      value = raw.slice(0, raw.indexOf(triple)).replace(/^\n/, '');
      if (triple === '"""') value = decode(value);
    } else if (raw[0] === '"' || raw[0] === "'") {
      const q = raw[0]; let end = 1;
      for (; end < raw.length; end++) {
        if (q === '"' && raw[end] === '\\') { end++; continue; }
        if (raw[end] === q) break;
      }
      if (end === raw.length) throw new Error('Unterminated TOML string');
      value = q === '"' ? decode(raw.slice(1, end)) : raw.slice(1, end);
    } else if (/^(true|false)\s*(?:#.*)?$/.test(raw)) value = raw.startsWith('true');
    else continue;
    row.values[kv[1]] = value;
  }
  return rows;
}
function decode(s) {
  return s.replace(/\\\r?\n\s*/g, '').replace(/\\(u[\da-fA-F]{4}|U[\da-fA-F]{8}|[btnfr"\\])/g, (_, c) =>
    c[0] === 'u' || c[0] === 'U' ? String.fromCodePoint(parseInt(c.slice(1), 16)) : ({ b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' })[c]);
}
function parseMods(text) {
  const rows = tables(text);
  return rows.filter(r => r.table === 'mods').map(r => {
    if (!r.values.modId) throw new Error('mods.toml entry without modId');
    return { id: r.values.modId, name: r.values.displayName || r.values.modId,
      description: String(r.values.description || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      dependencies: rows.filter(d => d.table === 'dependencies.' + r.values.modId).map(d => ({
        id: d.values.modId, mandatory: d.values.mandatory === true, side: d.values.side || 'BOTH', range: d.values.versionRange || ''
      })) };
  });
}
module.exports = { tables, parseMods };
