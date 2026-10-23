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
  // Another project's single-job lock on the same machine: we wait while it is held by a live process.
  NEIGHBOUR_LOCKS: (e.PACKTEST_ANU_NEIGHBOUR_LOCKS || 'G:\\mods-ci\\lock').split(';').filter(Boolean),
  NODE: { version: 'v22.20.0', dir: `${TOOLS}\\node-v22.20.0-win-x64`, url: 'https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip', sums: 'https://nodejs.org/dist/v22.20.0/SHASUMS256.txt' },
  JAVA: { feature: 17, dir: `${TOOLS}\\temurin-17`, api: 'https://api.adoptium.net/v3/assets/latest/17/hotspot?os=windows&architecture=x64&image_type=jdk&vendor=eclipse' },
  // Windows' own bsdtar on Valhalla: Git's GNU tar on PATH reads 'C:\...' as a remote host.
  LOCAL_TAR: e.PACKTEST_TAR || require('node:path').join(e.SystemRoot || 'C:/Windows', 'System32', 'tar.exe'),
  // Remote lock heartbeat: the agent refreshes it; a lock older than this is stale.
  LOCK_STALE_MS: 10 * 60 * 1000
};
