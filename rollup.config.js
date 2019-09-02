// rollup.config.js
import json from 'rollup-plugin-json';
import minify from 'rollup-plugin-babel-minify';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import hashbang from 'rollup-plugin-hashbang';

export default {
  input: 'src/main.js',
  output: {
    file: 'bin/ng-translate-check',
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
    minify({
      comments: false
    })
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
