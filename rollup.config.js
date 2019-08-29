// rollup.config.js
import json from 'rollup-plugin-json';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/cli.js',
    format: 'cjs'
  },
  plugins: [
    json({
      preferConst: true,
      indent: '  ',
      compact: true,
      namedExports: true
    })
  ]
};