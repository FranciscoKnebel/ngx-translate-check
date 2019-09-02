#!/usr/bin/env node

import commander from 'commander';
import pkg from '../package.json';

import commandBuilder from './commands/builder';

const program = new commander.Command();

program.version(pkg.version);
program.description(pkg.description);

commandBuilder(program);

program
  .parse(process.argv);
