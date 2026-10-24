'use strict';
const fs = require('node:fs');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
module.exports = { readJson };
