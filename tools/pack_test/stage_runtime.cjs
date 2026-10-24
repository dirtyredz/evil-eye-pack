'use strict';
// Runtime paths excluded from staged-server copies and remote syncs.
const WORLD = 'smoke-world';
const STAGE_RUNTIME = Object.freeze([WORLD, 'logs', 'crash-reports', 'pack_test', 'packwiz-install.log', 'console.log']);
const STAGE_SKIP = new Set(STAGE_RUNTIME);
const isStageRuntime = (rel) => STAGE_SKIP.has(rel.split('/')[0]);

module.exports = { WORLD, STAGE_RUNTIME, isStageRuntime };
