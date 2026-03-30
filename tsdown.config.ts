import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  deps: {
    neverBundle: ['vscode'],
  },
  dts: true,
})
