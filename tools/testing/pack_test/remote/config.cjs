'use strict';
// ANU (the LAN build/test PC) as seen from Valhalla: host alias, folders and tool locations.
// Everything of ours lives in G:\evil-eye-pack-ci (Defender excludes G:\ only) and C:\Tools\evil-eye-pack.
// Each value can be overridden by an environment variable for another machine.
const e = process.env;

const ROOT = e.PACKTEST_ANU_ROOT || 'G:\\evil-eye-pack-ci';
const TOOLS = e.PACKTEST_ANU_TOOLS || 'C:\\Tools\\evil-eye-pack';
const adoptium = (major) => `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?os=windows&architecture=x64&image_type=jdk&vendor=eclipse`;

// Per-runtime remote directories. The Forge lane keeps the original paths; every other runtime (the
// NeoForge migration) gets its own stage, world cache and synced tool code under lanes\<runtime id>, so a
// migration job never reuses or overwrites Forge's. Every lane shares the one pack-test LOCK.
function lane(runtime) {
  if (!runtime || !runtime.id) throw new Error('the ANU lane needs the run runtime');
  if (runtime.loader === 'forge') return { id: runtime.id, STAGE: `${ROOT}\\stage\\server`, WORLDS: `${ROOT}\\cache\\worlds`, CODE: `${ROOT}\\tools` };
  const base = `${ROOT}\\lanes\\${runtime.id}`;
  return { id: runtime.id, STAGE: `${base}\\stage\\server`, WORLDS: `${base}\\cache\\worlds`, CODE: `${base}\\tools` };
}

module.exports = {
  HOST: e.PACKTEST_ANU_HOST || 'anu',
  FALLBACK_HOST: e.PACKTEST_ANU_FALLBACK_HOST || 'anu-byname',
  ROOT,
  TOOLS,
  lane,
  RUNS: `${ROOT}\\runs`,
  INCOMING: `${ROOT}\\incoming`,
  LOCK: `${ROOT}\\lock`,
  // Another project's single-job lock on the same machine (read only: its pid, job and sibling queue\ tickets).
  // While it is held the pack test runs beside it only when ANU has room (see capacity.cjs).
  NEIGHBOUR_LOCKS: (e.PACKTEST_ANU_NEIGHBOUR_LOCKS || 'G:\\mods-ci\\lock').split(';').filter(Boolean),
  NODE: { version: 'v22.20.0', dir: `${TOOLS}\\node-v22.20.0-win-x64`, url: 'https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip', sums: 'https://nodejs.org/dist/v22.20.0/SHASUMS256.txt' },
  // One portable Temurin per Java major a supported runtime needs, installed side by side.
  JAVAS: { 17: { dir: `${TOOLS}\\temurin-17`, api: adoptium(17) }, 21: { dir: `${TOOLS}\\temurin-21`, api: adoptium(21) } },
  // Room needed to run beside a neighbour job: free physical RAM (GB) and mean CPU load over CPU_SAMPLES readings.
  MIN_FREE_GB: Number(e.PACKTEST_ANU_MIN_FREE_GB || 8),
  MAX_CPU_PCT: Number(e.PACKTEST_ANU_MAX_CPU_PCT || 50),
  CPU_SAMPLES: Number(e.PACKTEST_ANU_CPU_SAMPLES || 5),
  CPU_SAMPLE_MS: Number(e.PACKTEST_ANU_CPU_SAMPLE_MS || 1000),
  // Windows' own bsdtar on Valhalla: Git's GNU tar on PATH reads 'C:\...' as a remote host.
  LOCAL_TAR: e.PACKTEST_TAR || require('node:path').join(e.SystemRoot || 'C:/Windows', 'System32', 'tar.exe'),
  // Remote lock heartbeat: the agent refreshes it; a lock older than this is stale.
  LOCK_STALE_MS: 10 * 60 * 1000
};
