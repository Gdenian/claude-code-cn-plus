#!/usr/bin/env node
'use strict';

const { run } = require('../src/cli');

run().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
