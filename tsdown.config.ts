import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  minify: true,
  sourcemap: true,
  publint: true,
  deps: { alwaysBundle: ['@actions/core', '@actions/github'] },
});
