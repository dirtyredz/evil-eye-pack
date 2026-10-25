'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hashBytes = (algo, bytes) => crypto.createHash(algo).update(bytes).digest('hex');
const sha256 = bytes => hashBytes('sha256', bytes);
module.exports = { readJson, sha256, hashBytes };
