'use strict';
const fs = require('node:fs');
const path = require('node:path');
const env = require('../server_smoke/env.cjs');
const { inventory } = require('./inventory.cjs');
const { connect, familyModel, cost } = require('./model.cjs');
const { categorize } = require('./categories.cjs');
const { parseTiming } = require('./timing.cjs');
const { render } = require('./page.cjs');
const { capture } = require('./capture.cjs');
const { verify } = require('../packwiz/verify_hashes.cjs');
const { runMeta, checkDestination } = require('../pack_test/session/run_meta.cjs');
const { execFileSync } = require('node:child_process');
async function run(argv, { dryRun = false, log = console.log } = {}) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--out', '--cache', '--mods', '--evidence', '--world'].includes(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Expected --out, --cache, --mods, --evidence or --world followed by a path');
    opts[argv[i].slice(2)] = path.resolve(argv[i + 1]);
  }
  const root = path.resolve(__dirname, '../..');
  const out = opts.out || path.join(env.ARTIFACTS, 'mod-map');
  const cache = opts.cache || path.join(env.ARTIFACTS, 'pack-test/stage/server');
  const checkouts = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true }).split(/\r?\n/).filter(l => l.startsWith('worktree ')).map(l => l.slice(9));
  checkDestination(out, { artifacts: env.ARTIFACTS, checkouts });
  for (const source of [cache, opts.mods, opts.world, opts.evidence].filter(Boolean)) {
    const relative = path.relative(path.resolve(source), path.resolve(out));
    if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Output must not be inside a read-only input: ' + source);
  }
  const checked = verify(root);
  if (checked.problems.length) throw new Error(checked.problems.join('\n'));
  const input = inventory(root, [opts.mods || 'C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft/mods', path.join(cache, 'mods')]);
  input.warnings.push(...connect(input.nodes));
  log(`Validated ${input.pins.length} pinned jars; output ${out}`);
  if (dryRun) { log('DRY RUN: would capture one local offline boot (or reuse --evidence), then write timestamped and latest HTML. No boot or artifact writes.'); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const identity = runMeta(path.join(root, 'pack.toml'));
  const evidence = opts.evidence || path.join(out, 'runs', stamp);
  let boot;
  if (opts.evidence) {
    const saved = JSON.parse(fs.readFileSync(path.join(evidence, 'inputs.json'), 'utf8'));
    if (saved.identity.indexSha256 !== identity.indexSha256 || JSON.stringify(saved.pins) !== JSON.stringify(input.pins)) throw new Error('Saved boot inputs differ from current checkout; refusing stale timing');
    boot = JSON.parse(fs.readFileSync(path.join(evidence, 'boot.json'), 'utf8'));
    if (boot.wallSeconds === null || boot.crashed || !boot.completed) throw new Error('Saved boot is incomplete');
  } else {
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, 'inputs.json'), JSON.stringify({ identity, pins: input.pins }, null, 2));
    boot = await capture(root, cache, evidence, log, opts.world);
  }
  const timing = parseTiming(fs.readFileSync(path.join(evidence, 'trace.log'), 'utf8'));
  if (!Object.keys(timing.mods).length || timing.logToDoneSeconds === null) throw new Error('No paired TRACE measurements or Done marker; refusing an empty timing report');
  const registries = JSON.parse(fs.readFileSync(path.join(evidence, 'registries.json'), 'utf8'));
  const overrides = require('./overrides.json');
  const categoryMapping = require('./categories.json');
  const data = { ...input, ...familyModel(input.nodes, registries, overrides), timing, registries, boot, identity, evidence, created: stamp };
  data.categories = categorize(data, categoryMapping, data.nodes, timing, cost);
  const html = render(data, overrides);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `mod-map-${stamp}.html`), html);
  fs.writeFileSync(path.join(out, 'mod-map.html'), html);
  const families = data.families.map(f => ({ name: f.name, members: f.members.length, ...cost([...f.members, ...f.libraries], timing) }));
  const categories = data.categories.map(category => ({ name: category.name, members: category.memberCount, ...category.categoryCost }));
  log(JSON.stringify({ html: path.join(out, 'mod-map.html'), evidence, bootSeconds: boot.wallSeconds, measuredMods: Object.keys(timing.mods).length, warnings: [...input.warnings, ...timing.warnings], categories, families }, null, 2));
}
module.exports = { run };
