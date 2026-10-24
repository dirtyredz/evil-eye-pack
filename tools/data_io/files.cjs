'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
module.exports = { readJson, sha256 };
