import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.js' },
    format: ['esm', 'cjs'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
    clean: true,
  },
  {
    entry: { 'hikvision-isapi.umd': 'src/index.js' },
    format: ['iife'],
    globalName: 'Hikvision',
    minify: false,
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: { 'hikvision-isapi.umd': 'src/index.js' },
    format: ['iife'],
    globalName: 'Hikvision',
    minify: true,
    outExtension: () => ({ js: '.min.js' }),
  },
]);
