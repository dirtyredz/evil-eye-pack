'use strict';
// ANU (the LAN build/test PC) as seen from Valhalla: host alias, folders and tool locations.
// Everything of ours lives in G:\evil-eye-pack-ci (Defender excludes G:\ only) and C:\Tools\evil-eye-pack.
// Each value can be overridden by an environment variable for another machine.
const e = process.env;

const ROOT = e.PACKTEST_ANU_ROOT || 'G:\\evil-eye-pack-ci';
const TOOLS = e.PACKTEST_ANU_TOOLS || 'C:\\Tools\\evil-eye-pack';

module.exports = {
  HOST: e.PACKTEST_ANU_HOST || 'anu',
  FALLBACK_HOST: e.PACKTEST_ANU_FALLBACK_HOST || 'anu-byname',
  ROOT,
  TOOLS,
  STAGE: `${ROOT}\\stage\\server`,
  RUNS: `${ROOT}\\runs`,
  WORLDS: `${ROOT}\\cache\\worlds`,
  CODE: `${ROOT}\\tools`,
  INCOMING: `${ROOT}\\incoming`,
  LOCK: `${ROOT}\\lock`,
  // Another project's single-job lock on the same machine (read only: its pid, job and sibling queue\ tickets).
  // While it is held the pack test runs beside it only when ANU has room (see capacity.cjs).
  NEIGHBOUR_LOCKS: (e.PACKTEST_ANU_NEIGHBOUR_LOCKS || 'G:\\mods-ci\\lock').split(';').filter(Boolean),
  NODE: { version: 'v22.20.0', dir: `${TOOLS}\\node-v22.20.0-win-x64`, url: 'https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip', sums: 'https://nodejs.org/dist/v22.20.0/SHASUMS256.txt' },
  JAVA: { feature: 17, dir: `${TOOLS}\\temurin-17`, api: 'https://api.adoptium.net/v3/assets/latest/17/hotspot?os=windows&architecture=x64&image_type=jdk&vendor=eclipse' },
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
