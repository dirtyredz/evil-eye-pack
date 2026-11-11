'use strict';
// The live-registry snapshot KubeJS script (items, blocks, fluids, tags, mods, loot tables). One owner,
// injected into a throwaway server by both the pack test (session/prepare.cjs) and the mod-map capture.
const path = require('node:path');

const REGISTRIES_PROBE = path.join(__dirname, 'registries.js');

module.exports = { REGISTRIES_PROBE };
