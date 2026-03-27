# vscot - VS Code Offset Tracker

Compat layer to track VS Code's document offsets across edits with CodeMirror's state library.

Instead of using the bundled file [on npm](https://www.npmjs.com/package/@codemirror/state), the [repository](https://github.com/codemirror/state) of CodeMirror's state library `@codemirror/state` is added as a submodule for optimal treeshaking.

# Setup

```
git submodule update --init
npm i
```

`src/cm/index.d.ts` is copied as-is from CodeMirror's built package v6.6.0 for easy referencing.
