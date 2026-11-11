'use strict';
// Neutral staged-server runtime policy: runtime paths excluded from staged-server copies and remote
// syncs, and where the local stage for a pack runtime lives (one stage per loader runtime, so a
// NeoForge stage can never reuse Forge libraries or the reverse).
const path = require('node:path');

const WORLD = 'smoke-world';
const STAGE_RUNTIME = Object.freeze([WORLD, 'logs', 'crash-reports', 'pack_test', 'packwiz-install.log', 'console.log']);
const STAGE_SKIP = new Set(STAGE_RUNTIME);
const isStageRuntime = (rel) => STAGE_SKIP.has(rel.split('/')[0]);
const stageDirFor = (artifacts, runtime) => path.join(artifacts, 'pack-test/stage', runtime.id, 'server');

module.exports = { WORLD, STAGE_RUNTIME, isStageRuntime, stageDirFor };
