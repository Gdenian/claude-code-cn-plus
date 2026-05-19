#!/usr/bin/env node
'use strict';

const { localizeAuto } = require('../src/auto-localize');

if (require.main === module) {
  localizeAuto().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { localizeAuto };
