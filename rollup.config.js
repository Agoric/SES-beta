import path from 'path';
import minify from 'rollup-plugin-babel-minify';
import stripCode from 'rollup-plugin-strip-code';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: path.resolve('src/main.js'),
  output: {
    file: path.resolve(isProduction ? 'dist/realm-shim.min.js' : 'dist/realm-shim.js'),
    name: 'Realm',
    format: 'umd',
    sourcemap: true
  },
  plugins: [
    stripCode({
      start_comment: 'START_TESTS_ONLY',
      end_comment: 'END_TESTS_ONLY'
    }),
    isProduction
      ? minify({
          comments: false
        })
      : {}
  ]
};
