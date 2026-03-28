# vscot - VS Code Offset Tracker

Compat layer to track VS Code's document offsets across edits with CodeMirror's state library.

**Source**: Instead of using the bundled file [on npm](https://www.npmjs.com/package/@codemirror/state), the bundle uses source files from the [repository](https://github.com/codemirror/state) of CodeMirror's state library `@codemirror/state` as a submodule for optimal treeshaking.

**Types**: `src/cm/index.d.ts` uses the generated types from CodeMirror's built package v6.6.0 for easy referencing type definitions and documentations. Care should be taken of duplicate type definitions.

# Setup

```
git submodule update --init
npm i
```
