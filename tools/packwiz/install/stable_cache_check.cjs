'use strict';
// Guard for the Stable jar cache. Stable's prelaunch (stable-prelaunch.ps1 -> install_pack.cjs) copies
// every pinned jar from <cache>/<index dir> and never downloads, so a mod pushed to main without its jars
// in the cache stops Stable launching ("Missing pinned jar (no download attempted)", 2026-11-05).
//   node tools/packwiz/install/stable_cache_check.cjs            exit 1 listing every pinned jar missing or differing
//   node tools/packwiz/install/stable_cache_check.cjs --stock    first copy missing jars from local sources (verified, never downloads)
//   --cache <dir>   cache to check (default: the world-trial-final cache Stable's prelaunch uses)
//   --root <dir>    pack checkout (default: this one)
//   --source <dir>  extra folder holding jars (repeatable); defaults also scan jobs/*/jars and jobs/*/cache/<index dir>
// It only ever adds files that hash to the pin; it never deletes or overwrites anything in the cache.
// verify_hashes.cjs runs this check by default (when the default cache exists), so the usual
// rehash -> verify_hashes step before a push catches it.
const fs = require('node:fs');
const path = require('node:path');
const { clientArtifacts } = require('./client_artifacts.cjs');
const env = require('../../runtime_env/env.cjs').FIXED;

const ROOT = path.resolve(__dirname, '../../..');
const JOBS = env.ARTIFACT_JOBS;
const DEFAULT_CACHE = env.STABLE_CACHE;

// The jar every client/both metafile needs, as { file, dir, name, resolve(dir) } (resolve throws when the folder lacks a matching jar).
function pinnedJars(root) {
  return Array.from(clientArtifacts(root)).filter(a => a.sourceMetafile);
}

// Local folders that may hold a missing jar for index dir `dir`.
function sourceDirs(dir, extra = [], jobs = JOBS) {
  const found = [...extra];
  if (fs.existsSync(jobs)) for (const job of fs.readdirSync(jobs).sort().reverse()) {
    found.push(path.join(jobs, job, 'jars'), path.join(jobs, job, 'jars', dir), path.join(jobs, job, 'cache', dir));
  }
  return found.filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
}

// Pure-ish: { missing: [{file, name, reason}], stocked: [name] }. With `stock`, missing jars found (hash-verified) in `sources` are copied in.
function checkCache(root, cache, { stock = false, sources = [], jobs = JOBS } = {}) {
  const missing = [], stocked = [];
  for (const jar of pinnedJars(root)) {
    const target = path.join(cache, jar.dir);
    try { jar.resolve(target); continue; } catch (e) { var reason = e.message.replace(/ \(no download attempted\).*/, ''); }
    let fixed = false;
    if (stock) for (const d of sourceDirs(jar.dir, sources, jobs)) {
      try {
        const hit = jar.resolve(d);
        fs.mkdirSync(target, { recursive: true });
        const dest = path.join(target, path.basename(hit.path));
        if (fs.existsSync(dest)) break; // never overwrite a differing cached file
        fs.writeFileSync(dest, hit.bytes, { flag: 'wx' });
        stocked.push(jar.name); fixed = true; break;
      } catch { /* try the next source */ }
    }
    if (!fixed) missing.push({ file: jar.file, name: jar.name, reason });
  }
  return { missing, stocked };
}

function report(r, cache) {
  for (const n of r.stocked) console.log('STOCKED ' + n);
  for (const m of r.missing) console.log(`MISSING ${m.name} (${m.file}): ${m.reason}`);
  if (r.missing.length) console.log(`FAIL ${r.missing.length} pinned jar(s) not usable from ${cache}. Stable prelaunch would refuse to launch. Add the verified jars (or run with --stock to copy them from jobs/*/jars); never purge the cache.`);
  else console.log(`OK every pinned jar is in ${cache}` + (r.stocked.length ? ` (${r.stocked.length} stocked)` : ''));
  return r.missing.length ? 1 : 0;
}

function main(argv) {
  let cache = DEFAULT_CACHE, root = ROOT, stock = false; const sources = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stock') stock = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = path.resolve(argv[++i]);
    else if (argv[i] === '--root' && argv[i + 1]) root = path.resolve(argv[++i]);
    else if (argv[i] === '--source' && argv[i + 1]) sources.push(path.resolve(argv[++i]));
    else throw Error('Usage: stable_cache_check.cjs [--stock] [--cache <dir>] [--root <pack>] [--source <dir>]...');
  }
  return report(checkCache(root, cache, { stock, sources }), cache);
}
if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; } }
module.exports = { checkCache, pinnedJars, report, DEFAULT_CACHE };
