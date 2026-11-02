'use strict';
// Conservative constant-pool reference strings; never suppress an entire locally defined package.
function strings(bytes) {
  if (bytes.length < 10 || bytes.readUInt32BE(0) !== 0xcafebabe) throw new Error('Invalid class header');
  let offset = 10;
  const count = bytes.readUInt16BE(8), values = [];
  if (count === 0) throw new Error('Empty constant pool');
  function take(n) {
    if (offset + n > bytes.length) throw new Error('Truncated constant pool');
    const at = offset; offset += n; return at;
  }
  for (let i = 1; i < count; i++) {
    const tag = bytes[take(1)];
    if (tag === 1) {
      const length = bytes.readUInt16BE(take(2));
      const at = take(length); values.push(bytes.subarray(at, at + length).toString('utf8'));
    } else if ([3, 4, 9, 10, 11, 12, 17, 18].includes(tag)) take(4);
    else if ([7, 8, 16, 19, 20].includes(tag)) take(2);
    else if (tag === 15) take(3);
    else if (tag === 5 || tag === 6) {
      take(8); if (++i >= count) throw new Error('Invalid double-width pool entry');
    } else throw new Error('Unknown constant pool tag ' + tag);
  }
  if (offset + 8 > bytes.length) throw new Error('Missing class declaration');
  return values;
}

module.exports = { strings };
