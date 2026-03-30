import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'cmstate.in.d.ts',
  outDir: 'node_modules/.tmp',
  deps: {
    onlyBundle: ['@codemirror/state'],
  },
  clean: false,
  dts: {
    sourcemap: false,
  },
})
