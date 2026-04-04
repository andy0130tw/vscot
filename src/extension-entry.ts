import {
  type TextDocument,
  type ExtensionContext,
  workspace,
  window,
  type DecorationRenderOptions,
  DecorationRangeBehavior,
  Range as VscRange,
  type DecorationOptions,
} from 'vscode'
import { DecorationFromVsc, EditTracker } from './tracker'
import { vscChangeToChangeSet, rangeSetToArray } from './utils'
import { RangeSet } from './cm'

interface DocumentState {
  tracker: EditTracker
  hira: { range: VscRange, version: number } | null
}

export function activate(context: ExtensionContext) {
  const docs = new Map<TextDocument, DocumentState>()

  const decoOpts: DecorationRenderOptions = {
    backgroundColor: 'yellow',
    rangeBehavior: DecorationRangeBehavior.OpenOpen,
  }
  const deco = window.createTextEditorDecorationType(decoOpts)

  workspace.onDidChangeTextDocument(evt => {
    try {
      const doc = evt.document

      console.log(doc.version, 'changes',
        ...evt.contentChanges.map(
          ({range, rangeOffset, rangeLength, text}) => ({range, rangeOffset, rangeLength, text})))

      if (!docs.has(doc)) {
        docs.set(doc, {
          tracker: new EditTracker(doc, 50),
          hira: null,
        })
        return
      }

      const state = docs.get(doc)!
      const tracker = state.tracker

      tracker.absorb(vscChangeToChangeSet(evt))

      if (doc.version % 5 == 0) {
        tracker.checkpoint()

        const text = doc.getText()
        const mat = /\([^]+?\)/.exec(text)
        if (mat) {
          state.hira = {
            range: new VscRange(doc.positionAt(mat.index), doc.positionAt(mat.index + mat[0].length)),
            version: doc.version,
          }
        } else {
          state.hira = null
        }
      }

      if (!window.activeTextEditor) {
        return
      }

      const makeDebugDeco = (q = false) => ({
        range: new VscRange(doc.lineCount, 0, doc.lineCount, 0),
        renderOptions: {
          after: {
            color: 'green',
            textDecoration: 'underline',
            contentText: doc.version.toString() + (q ? '?' : '') + ' ' +
              rangeSetToArray((tracker.getDelta(-1).checkpoint as any).lineBreaks)
                .map(({from, to}, i) => `${i}:${from}-${to}`).join(' '),
          }
        }
      })

      if (state.hira) {
        const r1 = tracker.mapVscPos(state.hira.version, state.hira.range.start, -1)
        const r2 = tracker.mapVscPos(state.hira.version, state.hira.range.end, 1)
        console.log('range!', r1, r2)

        const ranges: DecorationOptions[] = [{ range: new VscRange(doc.positionAt(r1), doc.positionAt(r2)) }]

        window.activeTextEditor.setDecorations(deco, [...ranges, makeDebugDeco()])
      } else {
        window.activeTextEditor.setDecorations(deco, [makeDebugDeco(true)])
      }
      console.log(doc.version, tracker)
    } catch (err: any) {
      console.error('err!', evt)
      window.showErrorMessage(err.message, { modal: true, detail: (err as Error).stack?.slice(0, 1000) })
    }

    // console.log(evt.document.uri, evt.document.version, vscChangeToChangeSet(evt))
  })
}
