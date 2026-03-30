# vscot - VS Code Offset Tracker

A lightweight compatibility layer designed to track VS Code document offsets across edits using the CodeMirror state library.

## Bundle Strategy

This bundle tries to include only the needed part from CodeMirror because I believe the best treeshaking is not to treeshake at all. The result is the unconventional (bizarre) repo structure. You may ask, what if I also uses CodeMirror in my VS Code's extension? While it might still be compatible, I think the chance is really small if the abstraction is not leaky enough.

**Source**: Source files are copied from the [repository](https://github.com/codemirror/state) of CodeMirror's state library `@codemirror/state` from the submodule.

**Types**: `src/cm/index.d.ts` uses the generated types from CodeMirror's built package on npm for easy referencing type definitions and documentations. Should not contain duplicated type definitions if done right.

# Setup

```bash
git submodule update --init
npm i
npm run tsc      # for type checking
npm run compile  # for bundling
```
