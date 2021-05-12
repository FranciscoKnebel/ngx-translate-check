// rollup.config.js
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import hashbang from 'rollup-plugin-hashbang';
import { terser } from "rollup-plugin-terser";

import pkg from './package.json';

export default {
  input: 'src/main.js',
  output: {
    file: pkg.main,
    format: 'cjs'
  },
  plugins: [
    hashbang(),
    resolve({
      preferBuiltins: true,
      mainFields: ['main', 'module', 'src']
    }),
    commonjs(),
    json({
      preferConst: true,
      indent: '  ',
      compact: true,
      namedExports: true
    }),
    terser()
  ],
  external: [
    'path',
    'fs',
    'events',
    'child_process',
    'util',
    'os',
    'stream'
  ]
};
