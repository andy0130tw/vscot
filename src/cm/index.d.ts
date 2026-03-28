//#region node_modules/@codemirror/state/dist/index.d.ts
/**
A text iterator iterates over a sequence of strings. When
iterating over a [`Text`](https://codemirror.net/6/docs/ref/#state.Text) document, result values will
either be lines or line breaks.
*/
interface TextIterator extends Iterator<string>, Iterable<string> {
  /**
  Retrieve the next string. Optionally skip a given number of
  positions after the current position. Always returns the object
  itself.
  */
  next(skip?: number): this;
  /**
  The current string. Will be the empty string when the cursor is
  at its end or `next` hasn't been called on it yet.
  */
  value: string;
  /**
  Whether the end of the iteration has been reached. You should
  probably check this right after calling `next`.
  */
  done: boolean;
  /**
  Whether the current string represents a line break.
  */
  lineBreak: boolean;
}
/**
The data structure for documents. @nonabstract
*/
declare abstract class Text implements Iterable<string> {
  /**
  The length of the string.
  */
  abstract readonly length: number;
  /**
  The number of lines in the string (always >= 1).
  */
  abstract readonly lines: number;
  /**
  Get the line description around the given position.
  */
  lineAt(pos: number): Line;
  /**
  Get the description for the given (1-based) line number.
  */
  line(n: number): Line;
  /**
  Replace a range of the text with the given content.
  */
  replace(from: number, to: number, text: Text): Text;
  /**
  Append another document to this one.
  */
  append(other: Text): Text;
  /**
  Retrieve the text between the given points.
  */
  slice(from: number, to?: number): Text;
  /**
  Retrieve a part of the document as a string
  */
  abstract sliceString(from: number, to?: number, lineSep?: string): string;
  /**
  Test whether this text is equal to another instance.
  */
  eq(other: Text): boolean;
  /**
  Iterate over the text. When `dir` is `-1`, iteration happens
  from end to start. This will return lines and the breaks between
  them as separate strings.
  */
  iter(dir?: 1 | -1): TextIterator;
  /**
  Iterate over a range of the text. When `from` > `to`, the
  iterator will run in reverse.
  */
  iterRange(from: number, to?: number): TextIterator;
  /**
  Return a cursor that iterates over the given range of lines,
  _without_ returning the line breaks between, and yielding empty
  strings for empty lines.
  
  When `from` and `to` are given, they should be 1-based line numbers.
  */
  iterLines(from?: number, to?: number): TextIterator;
  /**
  Return the document as a string, using newline characters to
  separate lines.
  */
  toString(): string;
  /**
  Convert the document to an array of lines (which can be
  deserialized again via [`Text.of`](https://codemirror.net/6/docs/ref/#state.Text^of)).
  */
  toJSON(): string[];
  /**
  If this is a branch node, `children` will hold the `Text`
  objects that it is made up of. For leaf nodes, this holds null.
  */
  abstract readonly children: readonly Text[] | null;
  /**
  @hide
  */
  [Symbol.iterator]: () => Iterator<string>;
  /**
  Create a `Text` instance for the given array of lines.
  */
  static of(text: readonly string[]): Text;
  /**
  The empty document.
  */
  static empty: Text;
}
/**
This type describes a line in the document. It is created
on-demand when lines are [queried](https://codemirror.net/6/docs/ref/#state.Text.lineAt).
*/
declare class Line {
  /**
  The position of the start of the line.
  */
  readonly from: number;
  /**
  The position at the end of the line (_before_ the line break,
  or at the end of document for the last line).
  */
  readonly to: number;
  /**
  This line's line number (1-based).
  */
  readonly number: number;
  /**
  The line's content.
  */
  readonly text: string;
  /**
  The length of the line (not including any line break after it).
  */
  get length(): number;
}
/**
Distinguishes different ways in which positions can be mapped.
*/
declare enum MapMode {
  /**
  Map a position to a valid new position, even when its context
  was deleted.
  */
  Simple = 0,
  /**
  Return null if deletion happens across the position.
  */
  TrackDel = 1,
  /**
  Return null if the character _before_ the position is deleted.
  */
  TrackBefore = 2,
  /**
  Return null if the character _after_ the position is deleted.
  */
  TrackAfter = 3
}
/**
A change description is a variant of [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet)
that doesn't store the inserted text. As such, it can't be
applied, but is cheaper to store and manipulate.
*/
declare class ChangeDesc {
  /**
  The length of the document before the change.
  */
  get length(): number;
  /**
  The length of the document after the change.
  */
  get newLength(): number;
  /**
  False when there are actual changes in this set.
  */
  get empty(): boolean;
  /**
  Iterate over the unchanged parts left by these changes. `posA`
  provides the position of the range in the old document, `posB`
  the new position in the changed document.
  */
  iterGaps(f: (posA: number, posB: number, length: number) => void): void;
  /**
  Iterate over the ranges changed by these changes. (See
  [`ChangeSet.iterChanges`](https://codemirror.net/6/docs/ref/#state.ChangeSet.iterChanges) for a
  variant that also provides you with the inserted text.)
  `fromA`/`toA` provides the extent of the change in the starting
  document, `fromB`/`toB` the extent of the replacement in the
  changed document.
  
  When `individual` is true, adjacent changes (which are kept
  separate for [position mapping](https://codemirror.net/6/docs/ref/#state.ChangeDesc.mapPos)) are
  reported separately.
  */
  iterChangedRanges(f: (fromA: number, toA: number, fromB: number, toB: number) => void, individual?: boolean): void;
  /**
  Get a description of the inverted form of these changes.
  */
  get invertedDesc(): ChangeDesc;
  /**
  Compute the combined effect of applying another set of changes
  after this one. The length of the document after this set should
  match the length before `other`.
  */
  composeDesc(other: ChangeDesc): ChangeDesc;
  /**
  Map this description, which should start with the same document
  as `other`, over another set of changes, so that it can be
  applied after it. When `before` is true, map as if the changes
  in `this` happened before the ones in `other`.
  */
  mapDesc(other: ChangeDesc, before?: boolean): ChangeDesc;
  /**
  Map a given position through these changes, to produce a
  position pointing into the new document.
  
  `assoc` indicates which side the position should be associated
  with. When it is negative, the mapping will try to keep the
  position close to the character before it (if any), and will
  move it before insertions at that point or replacements across
  that point. When it is zero or positive, the position is associated
  with the character after it, and will be moved forward for
  */
  /**
  
  `mode` determines whether deletions should be
  [reported](https://codemirror.net/6/docs/ref/#state.MapMode). It defaults to
  [`MapMode.Simple`](https://codemirror.net/6/docs/ref/#state.MapMode.Simple) (don't report
  deletions).
  */
  mapPos(pos: number, assoc?: number): number;
  mapPos(pos: number, assoc: number, mode: MapMode): number | null;
  /**
  Check whether these changes touch a given range. When one of the
  changes entirely covers the range, the string `"cover"` is
  returned.
  */
  touchesRange(from: number, to?: number): boolean | "cover";
  /**
  Serialize this change desc to a JSON-representable value.
  */
  toJSON(): readonly number[];
  /**
  Create a change desc from its JSON representation (as produced
  by [`toJSON`](https://codemirror.net/6/docs/ref/#state.ChangeDesc.toJSON).
  */
  static fromJSON(json: any): ChangeDesc;
}
/**
This type is used as argument to
[`EditorState.changes`](https://codemirror.net/6/docs/ref/#state.EditorState.changes) and in the
[`changes` field](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) of transaction
specs to succinctly describe document changes. It may either be a
plain object describing a change (a deletion, insertion, or
replacement, depending on which fields are present), a [change
set](https://codemirror.net/6/docs/ref/#state.ChangeSet), or an array of change specs.
*/
type ChangeSpec = {
  from: number;
  to?: number;
  insert?: string | Text;
} | ChangeSet | readonly ChangeSpec[];
/**
A change set represents a group of modifications to a document. It
stores the document length, and can only be applied to documents
with exactly that length.
*/
declare class ChangeSet extends ChangeDesc {
  private constructor();
  /**
  Apply the changes to a document, returning the modified
  document.
  */
  apply(doc: Text): Text;
  mapDesc(other: ChangeDesc, before?: boolean): ChangeDesc;
  /**
  Given the document as it existed _before_ the changes, return a
  change set that represents the inverse of this set, which could
  be used to go from the document created by the changes back to
  the document as it existed before the changes.
  */
  invert(doc: Text): ChangeSet;
  /**
  Combine two subsequent change sets into a single set. `other`
  must start in the document produced by `this`. If `this` goes
  `docA` → `docB` and `other` represents `docB` → `docC`, the
  returned value will represent the change `docA` → `docC`.
  */
  compose(other: ChangeSet): ChangeSet;
  /**
  Given another change set starting in the same document, maps this
  change set over the other, producing a new change set that can be
  applied to the document produced by applying `other`. When
  `before` is `true`, order changes as if `this` comes before
  `other`, otherwise (the default) treat `other` as coming first.
  
  Given two changes `A` and `B`, `A.compose(B.map(A))` and
  `B.compose(A.map(B, true))` will produce the same document. This
  provides a basic form of [operational
  transformation](https://en.wikipedia.org/wiki/Operational_transformation),
  and can be used for collaborative editing.
  */
  map(other: ChangeDesc, before?: boolean): ChangeSet;
  /**
  Iterate over the changed ranges in the document, calling `f` for
  each, with the range in the original document (`fromA`-`toA`)
  and the range that replaces it in the new document
  (`fromB`-`toB`).
  
  When `individual` is true, adjacent changes are reported
  separately.
  */
  iterChanges(f: (fromA: number, toA: number, fromB: number, toB: number, inserted: Text) => void, individual?: boolean): void;
  /**
  Get a [change description](https://codemirror.net/6/docs/ref/#state.ChangeDesc) for this change
  set.
  */
  get desc(): ChangeDesc;
  /**
  Serialize this change set to a JSON-representable value.
  */
  toJSON(): any;
  /**
  Create a change set for the given changes, for a document of the
  given length, using `lineSep` as line separator.
  */
  static of(changes: ChangeSpec, length: number, lineSep?: string): ChangeSet;
  /**
  Create an empty changeset of the given length.
  */
  static empty(length: number): ChangeSet;
  /**
  Create a changeset from its JSON representation (as produced by
  [`toJSON`](https://codemirror.net/6/docs/ref/#state.ChangeSet.toJSON).
  */
  static fromJSON(json: any): ChangeSet;
}
/**
A single selection range. When
[`allowMultipleSelections`](https://codemirror.net/6/docs/ref/#state.EditorState^allowMultipleSelections)
is enabled, a [selection](https://codemirror.net/6/docs/ref/#state.EditorSelection) may hold
multiple ranges. By default, selections hold exactly one range.
*/
/**
Each range is associated with a value, which must inherit from
this class.
*/
declare abstract class RangeValue {
  /**
  Compare this value with another value. Used when comparing
  rangesets. The default implementation compares by identity.
  Unless you are only creating a fixed number of unique instances
  of your value type, it is a good idea to implement this
  properly.
  */
  eq(other: RangeValue): boolean;
  /**
  The bias value at the start of the range. Determines how the
  range is positioned relative to other ranges starting at this
  position. Defaults to 0.
  */
  startSide: number;
  /**
  The bias value at the end of the range. Defaults to 0.
  */
  endSide: number;
  /**
  The mode with which the location of the range should be mapped
  when its `from` and `to` are the same, to decide whether a
  change deletes the range. Defaults to `MapMode.TrackDel`.
  */
  mapMode: MapMode;
  /**
  Determines whether this value marks a point range. Regular
  ranges affect the part of the document they cover, and are
  meaningless when empty. Point ranges have a meaning on their
  own. When non-empty, a point range is treated as atomic and
  shadows any ranges contained in it.
  */
  point: boolean;
  /**
  Create a [range](https://codemirror.net/6/docs/ref/#state.Range) with this value.
  */
  range(from: number, to?: number): Range<this>;
}
/**
A range associates a value with a range of positions.
*/
declare class Range<T extends RangeValue> {
  /**
  The range's start position.
  */
  readonly from: number;
  /**
  Its end position.
  */
  readonly to: number;
  /**
  The value associated with this range.
  */
  readonly value: T;
  private constructor();
}
/**
Collection of methods used when comparing range sets.
*/
interface RangeComparator<T extends RangeValue> {
  /**
  Notifies the comparator that a range (in positions in the new
  document) has the given sets of values associated with it, which
  are different in the old (A) and new (B) sets.
  */
  compareRange(from: number, to: number, activeA: T[], activeB: T[]): void;
  /**
  Notification for a changed (or inserted, or deleted) point range.
  */
  comparePoint(from: number, to: number, pointA: T | null, pointB: T | null): void;
  /**
  Notification for a changed boundary between ranges. For example,
  if the same span is covered by two partial ranges before and one
  bigger range after, this is called at the point where the ranges
  used to be split.
  */
  boundChange?(pos: number): void;
}
/**
Methods used when iterating over the spans created by a set of
ranges. The entire iterated range will be covered with either
`span` or `point` calls.
*/
interface SpanIterator<T extends RangeValue> {
  /**
  Called for any ranges not covered by point decorations. `active`
  holds the values that the range is marked with (and may be
  empty). `openStart` indicates how many of those ranges are open
  (continued) at the start of the span.
  */
  span(from: number, to: number, active: readonly T[], openStart: number): void;
  /**
  Called when going over a point decoration. The active range
  decorations that cover the point and have a higher precedence
  are provided in `active`. The open count in `openStart` counts
  the number of those ranges that started before the point and. If
  the point started before the iterated range, `openStart` will be
  `active.length + 1` to signal this.
  */
  point(from: number, to: number, value: T, active: readonly T[], openStart: number, index: number): void;
}
/**
A range cursor is an object that moves to the next range every
time you call `next` on it. Note that, unlike ES6 iterators, these
start out pointing at the first element, so you should call `next`
only after reading the first range (if any).
*/
interface RangeCursor<T> {
  /**
  Move the iterator forward.
  */
  next(): void;
  /**
  Jump the cursor to the given position.
  */
  goto(pos: number): void;
  /**
  The next range's value. Holds `null` when the cursor has reached
  its end.
  */
  value: T | null;
  /**
  The next range's start position.
  */
  from: number;
  /**
  The next end position.
  */
  to: number;
  /**
  The position of the set that this range comes from in the array
  of sets being iterated over.
  */
  rank: number;
}
type RangeSetUpdate<T extends RangeValue> = {
  /**
  An array of ranges to add. If given, this should be sorted by
  `from` position and `startSide` unless
  [`sort`](https://codemirror.net/6/docs/ref/#state.RangeSet.update^updateSpec.sort) is given as
  `true`.
  */
  add?: readonly Range<T>[];
  /**
  Indicates whether the library should sort the ranges in `add`.
  Defaults to `false`.
  */
  sort?: boolean;
  /**
  Filter the ranges already in the set. Only those for which this
  function returns `true` are kept.
  */
  filter?: (from: number, to: number, value: T) => boolean;
  /**
  Can be used to limit the range on which the filter is
  applied. Filtering only a small range, as opposed to the entire
  set, can make updates cheaper.
  */
  filterFrom?: number;
  /**
  The end position to apply the filter to.
  */
  filterTo?: number;
};
/**
A range set stores a collection of [ranges](https://codemirror.net/6/docs/ref/#state.Range) in a
way that makes them efficient to [map](https://codemirror.net/6/docs/ref/#state.RangeSet.map) and
[update](https://codemirror.net/6/docs/ref/#state.RangeSet.update). This is an immutable data
structure.
*/
declare class RangeSet<T extends RangeValue> {
  private constructor();
  /**
  The number of ranges in the set.
  */
  get size(): number;
  /**
  Update the range set, optionally adding new ranges or filtering
  out existing ones.
  
  (Note: The type parameter is just there as a kludge to work
  around TypeScript variance issues that prevented `RangeSet<X>`
  from being a subtype of `RangeSet<Y>` when `X` is a subtype of
  `Y`.)
  */
  update<U extends T>(updateSpec: RangeSetUpdate<U>): RangeSet<T>;
  /**
  Map this range set through a set of changes, return the new set.
  */
  map(changes: ChangeDesc): RangeSet<T>;
  /**
  Iterate over the ranges that touch the region `from` to `to`,
  calling `f` for each. There is no guarantee that the ranges will
  be reported in any specific order. When the callback returns
  `false`, iteration stops.
  */
  between(from: number, to: number, f: (from: number, to: number, value: T) => void | false): void;
  /**
  Iterate over the ranges in this set, in order, including all
  ranges that end at or after `from`.
  */
  iter(from?: number): RangeCursor<T>;
  /**
  Iterate over the ranges in a collection of sets, in order,
  starting from `from`.
  */
  static iter<T extends RangeValue>(sets: readonly RangeSet<T>[], from?: number): RangeCursor<T>;
  /**
  Iterate over two groups of sets, calling methods on `comparator`
  to notify it of possible differences.
  */
  static compare<T extends RangeValue>(oldSets: readonly RangeSet<T>[], newSets: readonly RangeSet<T>[],
  /**
  This indicates how the underlying data changed between these
  ranges, and is needed to synchronize the iteration.
  */
  textDiff: ChangeDesc, comparator: RangeComparator<T>,
  /**
  Can be used to ignore all non-point ranges, and points below
  the given size. When -1, all ranges are compared.
  */
  minPointSize?: number): void;
  /**
  Compare the contents of two groups of range sets, returning true
  if they are equivalent in the given range.
  */
  static eq<T extends RangeValue>(oldSets: readonly RangeSet<T>[], newSets: readonly RangeSet<T>[], from?: number, to?: number): boolean;
  /**
  Iterate over a group of range sets at the same time, notifying
  the iterator about the ranges covering every given piece of
  content. Returns the open count (see
  [`SpanIterator.span`](https://codemirror.net/6/docs/ref/#state.SpanIterator.span)) at the end
  of the iteration.
  */
  static spans<T extends RangeValue>(sets: readonly RangeSet<T>[], from: number, to: number, iterator: SpanIterator<T>,
  /**
  When given and greater than -1, only points of at least this
  size are taken into account.
  */
  minPointSize?: number): number;
  /**
  Create a range set for the given range or array of ranges. By
  default, this expects the ranges to be _sorted_ (by start
  position and, if two start at the same position,
  `value.startSide`). You can pass `true` as second argument to
  cause the method to sort them.
  */
  static of<T extends RangeValue>(ranges: readonly Range<T>[] | Range<T>, sort?: boolean): RangeSet<T>;
  /**
  Join an array of range sets into a single set.
  */
  static join<T extends RangeValue>(sets: readonly RangeSet<T>[]): RangeSet<T>;
  /**
  The empty set of ranges.
  */
  static empty: RangeSet<any>;
}
/**
A range set builder is a data structure that helps build up a
[range set](https://codemirror.net/6/docs/ref/#state.RangeSet) directly, without first allocating
an array of [`Range`](https://codemirror.net/6/docs/ref/#state.Range) objects.
*/
//#endregion
export { ChangeSet, type ChangeSpec, Line, MapMode, Range, RangeSet, RangeValue, Text };
//# sourceMappingURL=cmstate.in.d.mts.map