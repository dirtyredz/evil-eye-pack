#!/usr/bin/env node
'use strict';
// Does playerdata/<uuid>.dat hold the same player as level.dat's Player tag? A dedicated server reads only the
// former; singleplayer keeps the host in the latter (and, in 1.21.1, writes both on save).
//   node player-data-check.cjs <world dir> <uuid>      exit 0 identical, 1 missing or different (reason printed)
const fs = require('node:fs');
const path = require('node:path');
const { parseNbt, gunzipMaybe } = require('../data_io/world/nbt.cjs');

function main([world, uuid]) {
  if (!world || !uuid) throw new Error('usage: player-data-check.cjs <world dir> <uuid>');
  const read = (f) => parseNbt(gunzipMaybe(fs.readFileSync(f)));
  const player = read(path.join(world, 'level.dat')).Data.Player;
  const file = path.join(world, 'playerdata', `${uuid}.dat`);
  if (!player) { console.log('level.dat has no Player tag; nothing singleplayer-specific to carry over.'); return 0; }
  if (!fs.existsSync(file)) { console.log(`MISSING ${file}: the host's inventory/position exist only in level.dat.`); return 1; }
  const j = (o) => JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? String(v) : v));
  const pd = read(file);
  const differing = Object.keys(player).filter((k) => j(player[k]) !== j(pd[k]));
  if (differing.length) { console.log(`DIFFERENT: playerdata/${uuid}.dat differs from level.dat Player in: ${differing.join(', ')}. Open the world once in singleplayer and quit to title, then copy again.`); return 1; }
  console.log(`Player data OK: playerdata/${uuid}.dat is identical to level.dat's Player tag (${Object.keys(player).length} keys; Pos ${j(player.Pos)}); nothing to rewrite.`);
  return 0;
}
try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
