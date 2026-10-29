'use strict';
// Dependency validation for a target lock: Maven version ranges as (Neo)Forge reads them, and the
// closure check over every kept jar's declared metadata (read by data_io/mod_metadata.cjs).
// Pure: callers pass the lock entries and the metadata units already read from verified bytes.

// Maven's ComparableVersion (the comparator behind FML's ranges), ported: '.' separates items, '-'
// and digit/letter transitions open a sublist, trailing nulls (0, release, empty lists) normalize away,
// known qualifiers order alpha < beta < milestone < rc < snapshot < release < sp, others after them.
const QUALIFIERS = ['alpha', 'beta', 'milestone', 'rc', 'snapshot', '', 'sp'];
const ALIASES = { ga: '', final: '', release: '', cr: 'rc' };
const INT = 0, STR = 1, LIST = 2;
function strItem(value, followedByDigit) {
  if (followedByDigit && value.length === 1) value = ({ a: 'alpha', b: 'beta', m: 'milestone' })[value] || value;
  return { kind: STR, value: ALIASES[value] ?? value };
}
const item = (digit, s) => (digit ? { kind: INT, value: BigInt(s) } : strItem(s, false));
function isNull(i) { return i.kind === INT ? i.value === 0n : i.kind === STR ? i.value === '' : i.items.length === 0; }
function normalize(list) {
  for (let i = list.items.length - 1; i >= 0; i--) {
    const x = list.items[i];
    if (isNull(x)) list.items.splice(i, 1);
    else if (x.kind !== LIST) break;
  }
}
function parseVersion(version) {
  const v = String(version).trim().toLowerCase();
  const root = { kind: LIST, items: [] };
  let list = root; const stack = [root];
  let digit = false, start = 0;
  const open = () => { const l = { kind: LIST, items: [] }; list.items.push(l); list = l; stack.push(l); };
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch === '.') { list.items.push(i === start ? { kind: INT, value: 0n } : item(digit, v.slice(start, i))); start = i + 1; }
    else if (ch === '-') { list.items.push(i === start ? { kind: INT, value: 0n } : item(digit, v.slice(start, i))); start = i + 1; open(); }
    else if (ch >= '0' && ch <= '9') {
      if (!digit && i > start) { list.items.push(strItem(v.slice(start, i), true)); start = i; open(); }
      digit = true;
    } else {
      if (digit && i > start) { list.items.push(item(true, v.slice(start, i))); start = i; open(); }
      digit = false;
    }
  }
  if (v.length > start) list.items.push(item(digit, v.slice(start)));
  while (stack.length) normalize(stack.pop());
  return root;
}
const qualifierKey = (q) => { const i = QUALIFIERS.indexOf(q); return i < 0 ? `${QUALIFIERS.length}-${q}` : String(i); };
function cmp(a, b) { // either may be null (absent)
  if (a === null) return b === null ? 0 : -cmp(b, null);
  if (a.kind === INT) {
    if (b === null) return a.value === 0n ? 0 : 1;
    if (b.kind === INT) return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
    return 1;
  }
  if (a.kind === STR) {
    if (b === null) { const x = qualifierKey(a.value), y = qualifierKey(''); return x < y ? -1 : x > y ? 1 : 0; }
    if (b.kind === INT || b.kind === LIST) return -1;
    const x = qualifierKey(a.value), y = qualifierKey(b.value); return x < y ? -1 : x > y ? 1 : 0;
  }
  if (b === null) return a.items.length ? cmp(a.items[0], null) : 0;
  if (b.kind === INT) return -1;
  if (b.kind === STR) return 1;
  for (let i = 0; i < Math.max(a.items.length, b.items.length); i++) {
    const r = cmp(a.items[i] ?? null, b.items[i] ?? null);
    if (r) return r;
  }
  return 0;
}
const compareVersions = (a, b) => cmp(parseVersion(a), parseVersion(b));

// A versionRange: '' or '*' = any; a bare version is Maven's "recommended" (no restriction);
// otherwise one or more [ ] / ( ) restrictions joined by commas. Throws on malformed input.
function parseRange(spec) {
  const s = String(spec || '').trim();
  if (s === '' || s === '*') return [];
  if (!/^[[(]/.test(s)) return [];
  const out = [];
  const re = /([[(])\s*([^,\])]*?)\s*(?:,\s*([^\])]*?)\s*)?([\])])\s*(?:,|$)/y;
  let m, consumed = 0;
  while (consumed < s.length && (m = re.exec(s))) {
    consumed = re.lastIndex;
    const [, open, lo, hi, close] = m;
    if (hi === undefined) { // [1.0] exact
      if (open !== '[' || close !== ']') throw new Error(`Malformed version range: ${spec}`);
      out.push({ lo, hi: lo, loInc: true, hiInc: true });
    } else out.push({ lo: lo || null, hi: hi || null, loInc: open === '[', hiInc: close === ']' });
  }
  if (consumed !== s.length) throw new Error(`Malformed version range: ${spec}`);
  return out;
}
function inRange(version, spec) {
  const ranges = parseRange(spec);
  if (!ranges.length) return true;
  return ranges.some(r => {
    if (r.lo !== null) { const c = compareVersions(version, r.lo); if (c < 0 || (c === 0 && !r.loInc)) return false; }
    if (r.hi !== null) { const c = compareVersions(version, r.hi); if (c > 0 || (c === 0 && !r.hiInc)) return false; }
    return true;
  });
}
const restricts = (spec) => parseRange(spec).length > 0;

// FML's VersionSupportMatrix (FancyModLoader 1.21.1 branch): on Minecraft 1.21.1 a minecraft or
// neoforge range that fails is retried with 1.21 / 21.0.166, so 1.21-era mods declaring
// [1.21,1.21.1) still load. Mirrored exactly; no other leniency.
function supportMatrix(runtime, id) {
  if (runtime.minecraft !== '1.21.1') return [];
  return id === 'minecraft' ? ['1.21'] : id === 'neoforge' ? ['21.0.166'] : [];
}

// entries: [{ key, side, units: readJarMods(...) result }] for every kept jar (not resource packs).
// runtime: { minecraft, neoforge, java }. waivers: { '<mod> -> <dep>': reason }.
// Returns { errors, warnings, providers } — errors are strings, sorted, deterministic.
function checkClosure(entries, runtime, { waivers = {} } = {}) {
  const errors = [], warnings = [];
  const builtins = new Map([['minecraft', [runtime.minecraft, ...supportMatrix(runtime, 'minecraft')]], ['neoforge', [runtime.neoforge, ...supportMatrix(runtime, 'neoforge')]], ['java', [String(runtime.java || '')]]]);
  const providers = new Map(); // id -> [{ key, version, bundled, side }]
  for (const e of entries) {
    const outer = e.units[0];
    if (!outer) { errors.push(`${e.key}: no jar metadata read`); continue; }
    if (outer.loader === 'forge') errors.push(`${e.key}: Forge-only metadata (META-INF/mods.toml without neoforge.mods.toml)`);
    if (!e.units.some(u => u.mods.length)) errors.push(`${e.key}: no NeoForge mod metadata in the jar or its declared jar-in-jar`);
    for (const u of e.units) {
      // NeoForge never reads META-INF/mods.toml: a bundled Forge-metadata jar provides no mod IDs. A library
      // (FMLModType GAMELIBRARY/LIBRARY) is expected to look like that; anything else is worth a warning.
      if (u.bundled && u.loader === 'forge') {
        if (!/^(GAMELIBRARY|LIBRARY)$/.test(u.modType || '')) warnings.push(`${e.key}: bundled ${u.source} carries Forge-only metadata`);
        continue;
      }
      for (const m of u.mods) {
        if (!providers.has(m.id)) providers.set(m.id, []);
        providers.get(m.id).push({ key: e.key, version: m.version, bundled: u.bundled, side: e.side });
      }
    }
  }
  for (const [id, list] of providers) {
    const outer = [...new Set(list.filter(p => !p.bundled).map(p => p.key))];
    if (outer.length > 1) errors.push(`${id}: provided by more than one jar (${outer.join(', ')})`);
  }
  const versionsOf = (id, side) => {
    if (builtins.has(id)) return builtins.get(id);
    return (providers.get(id) || []).filter(p => side === 'client' || p.side !== 'client').map(p => p.version);
  };
  for (const e of entries) for (const u of e.units.filter((x) => !(x.bundled && x.loader === 'forge'))) for (const m of u.mods) for (const d of m.dependencies) {
    const tag = `${m.id} -> ${d.id}`;
    const where = `${e.key}${u.bundled ? ` (${u.source})` : ''}: ${m.id} ${d.type} ${d.id} ${d.range || '*'}`;
    const serverSide = e.side !== 'client' && String(d.side).toUpperCase() !== 'CLIENT';
    const found = versionsOf(d.id, serverSide ? 'server' : 'client');
    const present = found.length > 0;
    const satisfied = found.some(v => v !== null && v !== undefined && inRange(v, d.range));
    const unknown = present && !satisfied && found.every(v => v === null || v === undefined) && restricts(d.range);
    const fail = (why) => (waivers[tag] ? warnings.push(`${where}: ${why} (waived: ${waivers[tag]})`) : errors.push(`${where}: ${why}`));
    if (d.type === 'required') {
      if (!present) fail(serverSide && (providers.get(d.id) || []).length ? 'provided only by client-side jars' : 'missing');
      else if (unknown) fail(`provider version unknown (${d.id})`);
      else if (!satisfied && restricts(d.range)) fail(`unsatisfied (found ${found.join(', ')})`);
    } else if (d.type === 'optional') {
      if (present && unknown) fail(`installed optional provider version unknown (${d.id})`);
      else if (present && !satisfied && restricts(d.range)) fail(`installed optional dependency out of range (found ${found.join(', ')})`);
    } else if (d.type === 'incompatible') {
      if (present && (satisfied || !restricts(d.range) || unknown)) fail('incompatible mod is installed');
    } else if (d.type === 'discouraged') {
      if (present && (satisfied || !restricts(d.range))) warnings.push(`${where}: discouraged mod is installed`);
    }
  }
  return { errors: [...new Set(errors)].sort(), warnings: [...new Set(warnings)].sort(), providers };
}

module.exports = { compareVersions, parseRange, inRange, checkClosure };
