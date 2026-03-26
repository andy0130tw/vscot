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


// [IMPORTANT CAVEAT]:
// In CodeMirror, the line separator is always one unit wide, independent of line separator.
// In order to convert between VS Code's position and offsets without the need to peek the content,
// we hardcode the line separator to '\n' and it supports CRLF transparently.
// Also, changing the line separator is a full-document rewrite, and it wipes all ranges anyway.

export function vscGetDocumentLength(doc: TextDocument) {
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

type TrackerStore = {
  readonly trackers: Set<VscEditTracker>
  lenPrev: number
}

export class VscEditTracker implements Disposable {
  changeSet: ChangeSet
  private isDisposed = false

  constructor(
    readonly doc: TextDocument,
    private readonly onDispose?: (tracker: VscEditTracker) => void,
  ) {
    this.changeSet = ChangeSet.empty(0)
  }

  static create(doc: TextDocument) {
    return defaultRegistry.track(doc)
  }

  absorbChangeSet(cs: ChangeSet) {
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
    if (this.isDisposed) return
    this.isDisposed = true
    this.onDispose?.(this)
  }
}

export class VscDocumentRegistry implements Disposable {
  private readonly stores = new Map<TextDocument, TrackerStore>()
  private readonly changeListener: Disposable
  private readonly closeListener: Disposable
  private isDisposed = false

  constructor() {
    this.changeListener = workspace.onDidChangeTextDocument(e => {
      const store = this.stores.get(e.document)
      if (!store) return

      // TODO: handle reason (undo/redo)
      const cs = ChangeSet.of(
        e.contentChanges.map(vscChangeEventToChangeSpec),
        store.lenPrev,
        // see [IMPORTANT CAVEAT]
        '\n',
      )
      for (const tracker of store.trackers) {
        tracker.absorbChangeSet(cs)
      }
      store.lenPrev = vscGetDocumentLength(e.document)
    })

    this.closeListener = workspace.onDidCloseTextDocument(doc => {
      this.stores.delete(doc)
    })
  }

  track(doc: TextDocument) {
    if (this.isDisposed) {
      throw new Error('document registry is disposed')
    }

    let store = this.stores.get(doc)
    if (!store) {
      store = {
        trackers: new Set(),
        lenPrev: vscGetDocumentLength(doc),
      }
      this.stores.set(doc, store)
    }

    const tracker = new VscEditTracker(doc, current => {
      const currentStore = this.stores.get(doc)
      if (!currentStore) return
      currentStore.trackers.delete(current)
      if (currentStore.trackers.size === 0) {
        this.stores.delete(doc)
      }
    })
    store.trackers.add(tracker)
    return tracker
  }

  dispose() {
    if (this.isDisposed) return
    this.isDisposed = true
    this.changeListener.dispose()
    this.closeListener.dispose()

    for (const store of this.stores.values()) {
      for (const tracker of store.trackers) {
        tracker.dispose()
      }
    }
    this.stores.clear()
  }
}

const defaultRegistry = new VscDocumentRegistry()

export function registerVscDocumentRegistry(subscriptions?: { push(value: Disposable): unknown }) {
  const registry = new VscDocumentRegistry()
  subscriptions?.push(registry)
  return registry
}

export class DecorationFromVsc<T> extends RangeValue {
  constructor(
    readonly data: T,
    readonly renderOptions: DecorationRenderOptions,
  ) {
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
