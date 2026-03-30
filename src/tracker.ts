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
import { vscGetDocumentLength } from './utils'


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


class CheckpointNode {
  constructor(
    readonly version: number,
    public changeSet: ChangeSet,
    // -1 means newest
    public nextVersion: number = -1) {}
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
    const node = new CheckpointNode(ver, ChangeSet.empty(vscGetDocumentLength(doc)))
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
      this.checkpointByVersion.delete(oldestNode.nextVersion)
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

    const prev = this.newestCheckpoint
    prev.nextVersion = ver
    this.appendNode(ver, new CheckpointNode(ver, ChangeSet.empty(vscGetDocumentLength(doc))))
  }

  getDelta(version: number): ChangeSet {
    let changeSet: ChangeSet | undefined
    while (version >= 0) {
      let checkpoint = this.checkpointByVersion.get(version)
      if (!checkpoint) {
        throw new Error(`Version ${version} is not checkpointed`)
      }
      if (changeSet == null) {
        changeSet = checkpoint.changeSet
      } else {
        changeSet = changeSet.compose(checkpoint.changeSet)
      }

      version = checkpoint.nextVersion
    }

    return changeSet!
  }

  // TODO: add a param to set version
  mapPos(pos: Position, assoc?: number): number
  mapPos(pos: Position, assoc: number, mapMode: MapMode): number | null
  mapPos(pos: Position, assoc = -1, mapMode = MapMode.Simple): number | null {
    const offset = this.doc.offsetAt(pos)
    return this.newestCheckpoint.changeSet.mapPos(offset, assoc, mapMode)
  }

  mapRangeSet<T extends RangeValue>(rs: RangeSet<T>): RangeSet<T> {
    // FIXME
    return rs.map(this.newestCheckpoint.changeSet)
  }

  dispose() {
    if (this.isDisposed) return
    this.isDisposed = true
    this.onDispose?.(this)
  }
}
