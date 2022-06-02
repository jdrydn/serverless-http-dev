#!/usr/bin/env node
const createServer = require('./server');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const args = yargs(hideBin(process.argv))
  .usage('$0 --entry ./app.js --handler http')
  .option('entry', {
    type: 'string',
    description: 'Select which entry file to use (relative to the CWD)',
    required: true,
  })
  .option('handler', {
    type: 'string',
    description: 'Select which named export to use (from the entry)',
    required: true,
  })
  .option('http-host', {
    type: 'string',
    description: 'Select which HTTP host to use',
    default: undefined,
  })
  .option('http-port', {
    type: 'number',
    description: 'Select which HTTP port to use',
    default: 3000,
  })
  .parse();

/* eslint-disable no-console, no-process-exit */

process.on('uncaughtException', err => {
  console.error('uncaughtException', err);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('unhandledRejection', err);
  process.exit(1);
});

const closeServer = createServer(args);

process.on('SIGTERM', () => {
  closeServer();
  process.exit(1);
});
