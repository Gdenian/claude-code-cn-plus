'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hashFile(filePath) {
  return sha256(fs.readFileSync(filePath));
}

module.exports = {
  hashFile,
  sha256,
};
