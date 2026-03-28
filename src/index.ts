// [IMPORTANT CAVEAT]:
// In CodeMirror, the line separator is always one unit wide, independent of line separator.
// In order to convert between VS Code's position and offsets without the need to peek the content,
// we hardcode the line separator to '\n' and it handles CRLF transparently.
// Also, changing the line separator is a full-document rewrite, and it wipes all ranges anyway.

export {
  vscGetDocumentLength,
  vscChangeEventToChangeSpec,
} from './utils'

export { RangeSet } from './cm'
