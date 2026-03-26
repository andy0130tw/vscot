import { ChangeSet, type ChangeSpec, MapMode } from '$cmstate/change.js'
import { RangeValue, RangeSet } from '$cmstate/rangeset.js'
import type {
  Disposable,
  Range as VscRange,
  TextDocument,
  TextDocumentContentChangeEvent,
  DecorationRenderOptions,
} from 'vscode'
import {
  Position,
  workspace,
  DecorationRangeBehavior,
} from 'vscode'


function vscGetDocumentLength(doc: TextDocument) {
  const eod = doc.validatePosition(new Position(doc.lineCount, 0))
  return doc.offsetAt(eod)
}

export function vscChangeEventToChangeSpec(evt: TextDocumentContentChangeEvent): ChangeSpec {
  return {
    from: evt.rangeOffset,
    to: evt.rangeOffset + evt.rangeLength,
    insert: evt.text,
  }
}

export class VscEditTracker implements Disposable {
  lineSep: string
  changeSet: ChangeSet
  _disposable: Disposable | undefined

  private constructor(readonly doc: TextDocument) {
    this.lineSep = doc.eol === 1 ? '\n' : '\r\n'
    this.changeSet = ChangeSet.empty(0)
  }

  static create(doc: TextDocument) {
    const vscet = new VscEditTracker(doc)
    vscet.listen()
    return vscet
  }

  // FIXME: should create a single listener and route docs
  listen() {
    if (this._disposable) {
      throw new Error('already listened')
    }
    let lenPrev = vscGetDocumentLength(this.doc)
    this._disposable = workspace.onDidChangeTextDocument(e => {
      // TODO: handle reason (undo/redo)
      if (e.document !== this.doc) return
      this.absorb(e.contentChanges, lenPrev)
      lenPrev = vscGetDocumentLength(this.doc)
    })
    this.flush()
  }

  private absorb(evts: readonly TextDocumentContentChangeEvent[], startLen: number) {
    const cs = ChangeSet.of(evts.map(vscChangeEventToChangeSpec), startLen, this.lineSep)
    this.changeSet = this.changeSet.compose(cs)
  }

  flush() {
    this.changeSet = ChangeSet.empty(this.changeSet.newLength)
  }

  mapPos(pos: Position, assoc?: number): number
  mapPos(pos: Position, assoc: number, mapMode: MapMode): number | null
  mapPos(pos: Position, assoc = -1, mapMode = MapMode.Simple): number | null {
    const offset = this.doc.offsetAt(pos)
    return this.changeSet.mapPos(offset, assoc, mapMode)
  }

  mapRangeSet<T extends RangeValue>(rs: RangeSet<T>): RangeSet<T> {
    return rs.map(this.changeSet)
  }

  dispose() {
    if (this._disposable) {
      return this._disposable.dispose()
    }
  }
}

export class DecorationFromVsc extends RangeValue {
  constructor(readonly renderOptions: DecorationRenderOptions) {
    super()
    const rb = renderOptions.rangeBehavior
    const DRB = DecorationRangeBehavior
    const startIsInclusive = rb === DRB.OpenOpen || rb === DRB.OpenClosed
    const endIsInclusive = rb === DRB.OpenOpen || rb === DRB.ClosedOpen
    // compat to CM's MarkDecoration; edit happens at side=0
    this.startSide = startIsInclusive ? -1 :  5e8
    this.endSide   = endIsInclusive   ?  1 : -6e8
  }
  rangeVsc(doc: TextDocument, r: VscRange) {
    if (r.isEmpty) {
      throw new Error('empty deco is not allowed')
    }
    return this.range(doc.offsetAt(r.start), doc.offsetAt(r.end))
  }
}

export { RangeSet }
