import type { TextDocument, TextDocumentChangeEvent, TextDocumentContentChangeEvent } from 'vscode'
import { Position } from 'vscode'
import type { ChangeSpec } from './cm'
import { ChangeSet } from './cm'

export function vscGetDocumentLength(doc: TextDocument) {
  const eod = doc.validatePosition(new Position(doc.lineCount, 0))
  return doc.offsetAt(eod)
}

export function vscContentChangeToChangeSpec(evt: TextDocumentContentChangeEvent): ChangeSpec {
  return {
    from: evt.rangeOffset,
    to: evt.rangeOffset + evt.rangeLength,
    insert: evt.text,
  }
}

// TODO: is a ChangeDesc version needed? can be more performant than changeset.desc
export function vscChangeToChangeSet(evt: TextDocumentChangeEvent): ChangeSet {
  const { contentChanges, document: doc } = evt
  const len = vscGetDocumentLength(doc)

  // compute old length by inverting each change event
  const oldLen = contentChanges.reduce((n, ch) => n + ch.rangeLength - ch.text.length, len)

  return ChangeSet.of(
    contentChanges.map(vscContentChangeToChangeSpec),
    oldLen,
    // [IMPORTANT CAVEAT]:
    // In CodeMirror, the line separator is always one unit wide, independent of line separator.
    // In order to convert between VS Code's position and offsets without the need to peek the content,
    // we hardcode the line separator to '\n' and it handles CRLF transparently.
    // Also, changing the line separator is a full-document rewrite, and it wipes all ranges anyway.
    '\n')
}
