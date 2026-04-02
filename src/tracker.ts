import type {
  Range as VscRange,
  TextDocument,
  DecorationRenderOptions,
  Disposable,
} from 'vscode'
import {
  Position,
  DecorationRangeBehavior,
} from 'vscode'
import { ChangeSet, MapMode, RangeSet, RangeValue } from './cm'
import type { Range } from './cm'
import { rangeSetToArray, vscGetDocumentLength } from './utils'


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
  rangeVsc(doc: TextDocument, r: VscRange): Range<this> {
    if (r.isEmpty) {
      throw new Error('empty deco is not allowed')
    }
    return this.range(doc.offsetAt(r.start), doc.offsetAt(r.end))
  }
  toVscRange(): VscRange {
    return 0 as any
    // TODO
  }
}

class LineBreak extends RangeValue {}
LineBreak.prototype.startSide = 1
LineBreak.prototype.endSide = -1
LineBreak.prototype.point = true

class CheckpointNode {
  constructor(
    readonly version: number,
    readonly lineBreaks: RangeSet<LineBreak>,
    // i-th element is the offset of the (i+1)-th line
    readonly offsetTable: number[],
    public changeSet: ChangeSet,
    // -1 means newest
    public nextVersion: number = -1) {}

  // NOTE: does not validate position
  offsetAt(pos: Position) {
    if (pos.line == 0) return pos.character
    return this.offsetTable[pos.line - 1] + pos.character
  }

  mapRangeSet<T extends RangeValue>(rs: RangeSet<T>): RangeSet<T> {
    // FIXME
    return rs.map(this.changeSet)
  }

  static init(version: number, doc: TextDocument) {
    const nls = []
    const offsets = []
    for (let i = 1; i < doc.lineCount; i++) {
      const offs = doc.offsetAt(new Position(i, 0))
      nls.push(new LineBreak().range(offs - doc.eol, offs))
      offsets.push(offs)
    }

    return new CheckpointNode(version, RangeSet.of(nls), offsets, ChangeSet.empty(vscGetDocumentLength(doc)))
  }

  static createFrom(version: number, base: CheckpointNode, eol: number) {
    // remove newlines that are deleted through edits
    const cleaned = base.lineBreaks.update({
      filter: (ff, tt) => base.changeSet.touchesRange(ff, tt) !== 'cover',
    })

    // add introduced nls in the target coord space
    const nlsToAdd: Range<LineBreak>[] = []
    base.changeSet.iterChanges((_fa, _ta, fb, _tb, ins) => {
      const it = ins.iterLines()
      it.next()  // skip dummy head
      let offs = it.value.length + 1
      it.next()  // skip first line
      while (!it.done) {
        nlsToAdd.push(new LineBreak().range(fb + offs - eol, fb + offs))
        offs += it.value.length + 1
        it.next()
      }
    })

    const newnls = cleaned.map(base.changeSet).update({ add: nlsToAdd })
    const offsets = rangeSetToArray(newnls).map(({to}) => to)

    return new CheckpointNode(version, newnls, offsets, ChangeSet.empty(base.changeSet.newLength))
  }
}

type Delta = {
  checkpoint: CheckpointNode
  changeSet: ChangeSet
}

export class EditTracker implements Disposable {
  private isDisposed = false
  private oldestCheckpoint: CheckpointNode
  private newestCheckpoint!: CheckpointNode
  private checkpointByVersion = new Map<number, CheckpointNode>()

  constructor(
    readonly doc: TextDocument,
    private maxCheckpointCount: number,
    private readonly onDispose?: (tracker: EditTracker) => void,
  ) {
    const ver = doc.version
    const node = CheckpointNode.init(ver, doc)
    this.oldestCheckpoint = node
    this.appendNode(ver, node)
  }

  appendNode(ver: number, node: CheckpointNode) {
    this.checkpointByVersion.set(ver, node)
    this.newestCheckpoint = node
    if (this.maxCheckpointCount > 0 && this.checkpointByVersion.size > this.maxCheckpointCount) {
      // recycle oldest node to keep count = max
      const oldestNode = this.oldestCheckpoint
      const nextNode = this.checkpointByVersion.get(oldestNode.nextVersion)!
      this.checkpointByVersion.delete(oldestNode.version)
      this.oldestCheckpoint = nextNode
    }
  }

  absorb(cs: ChangeSet) {
    const cp = this.newestCheckpoint
    cp.changeSet = cp.changeSet.compose(cs)
  }

  checkpoint() {
    const doc = this.doc
    const ver = doc.version
    if (this.newestCheckpoint.version === ver) return
    if (this.newestCheckpoint.version > ver) {
      throw new Error('attempt to checkpoint a document with version smaller than the last checkpointed one ' +
        `(${ver} < ${this.newestCheckpoint.version})`)
    }

    const prev = this.newestCheckpoint
    prev.nextVersion = ver
    this.appendNode(ver, CheckpointNode.createFrom(ver, prev, doc.eol))
  }

  getDelta(version: number): Delta {
    if (version < 0) {
      return {
        checkpoint: this.newestCheckpoint,
        changeSet: this.newestCheckpoint.changeSet,
      }
    }

    let changeSet: ChangeSet | undefined
    let checkpoint: CheckpointNode
    while (version >= 0) {
      const cp = this.checkpointByVersion.get(version)
      if (!cp) {
        throw new Error(`Version ${version} is not checkpointed`)
      }
      checkpoint = cp
      if (changeSet == null) {
        changeSet = checkpoint.changeSet
      } else {
        changeSet = changeSet.compose(checkpoint.changeSet)
      }

      version = checkpoint.nextVersion
    }

    return {
      checkpoint: checkpoint!,
      changeSet: changeSet!,
    }
  }

  mapVscPos(version: number, pos: Position, assoc?: number): number
  mapVscPos(version: number, pos: Position, assoc: number, mapMode: MapMode): number | null
  mapVscPos(version: number, pos: Position, assoc = -1, mapMode = MapMode.Simple): number | null {
    const delta = this.getDelta(version)

    const offs = delta.checkpoint.offsetAt(pos)
    return delta.changeSet.mapPos(offs, assoc, mapMode)
  }

  dispose() {
    if (this.isDisposed) return
    this.isDisposed = true
    this.oldestCheckpoint = this.newestCheckpoint = null as any
    this.checkpointByVersion.clear()
    this.onDispose?.(this)
  }
}
