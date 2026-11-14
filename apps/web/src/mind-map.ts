// SPDX-License-Identifier: Apache-2.0
import { add, type Board as AnyBoard, type BoardV11 as Board, type Item } from "nextphase-board-rules/document.ts";
import { OBJECT_TYPES, isMindNode, type MindNodeKeys, type Rectangle } from "nextphase-board-rules/objects/registry.ts";
import { TEXT_LAYOUT } from "./geometry.ts";
import { layoutRuns, type RunLine } from "./text-runs.ts";
import { bands } from "./connectors.ts";

// Interaction v40 values. Mind-map rules ask the registry; they never name a type.
export const MIND_MAP = { wrap: 320, padX: 8, padY: 6, column: 72, gap: 32, placeholder: "Add text", nameLimit: 40 } as const;
export const STARTER = ["Main topic", "First idea", "Second idea", "Third idea"] as const;
export type Side = "left" | "right";
export type MeasureText = (text: string, bold: boolean, size: number) => number;
export type MeasureNode = (text: string, root: boolean) => { width: number; height: number };
type Node = Item & MindNodeKeys & Rectangle & { text: string };
type Index = { nodes: Map<string, Node>; kids: Map<string, Node[]> };
type Change = Partial<MindNodeKeys & Rectangle>;
type Point = { x: number; y: number };

const record = () => OBJECT_TYPES.find((t) => isMindNode(t)) as unknown as { type: Parameters<typeof add>[1]; fontSize: (o: { parent?: string | null }) => number };
const nodeOf = (o: Item): o is Node => isMindNode(o);
const byRank = (a: Node, b: Node) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function index(objects: readonly Item[]): Index {
  const nodes = new Map(objects.filter(nodeOf).map((o) => [o.id, o]));
  const kids = new Map<string, Node[]>();
  for (const o of nodes.values()) if (o.parent !== null) kids.set(o.parent, [...kids.get(o.parent) ?? [], o]);
  for (const list of kids.values()) list.sort(byRank);
  return { nodes, kids };
}
const childrenIn = (idx: Index, id: string) => idx.kids.get(id) ?? [];
function descendantsIn(idx: Index, id: string): Node[] {
  const result: Node[] = [];
  const visit = (parent: string) => { for (const child of childrenIn(idx, parent)) if (!result.includes(child)) { result.push(child); visit(child.id); } };
  visit(id);
  return result;
}
function rootIn(idx: Index, id: string): Node {
  let node = idx.nodes.get(id)!;
  for (let steps = 0; node.parent !== null && idx.nodes.has(node.parent) && steps <= idx.nodes.size; steps++) node = idx.nodes.get(node.parent)!;
  return node;
}

export const isRoot = (node: { parent: string | null }) => node.parent === null;
export const children = (objects: readonly Item[], id: string) => childrenIn(index(objects), id);
export const descendants = (objects: readonly Item[], id: string) => descendantsIn(index(objects), id);
export const rootOf = (objects: readonly Item[], id: string) => rootIn(index(objects), id);
export function mapOf(objects: readonly Item[], id: string): Node[] {
  const idx = index(objects), root = rootIn(idx, id);
  return [root, ...descendantsIn(idx, root.id)];
}
// A node's outer side is its first-level ancestor's side; a root has none.
export function outerSide(objects: readonly Item[], id: string): Side | null {
  const idx = index(objects);
  let node = idx.nodes.get(id);
  while (node && node.parent !== null && idx.nodes.get(node.parent)?.parent !== null) node = idx.nodes.get(node.parent!);
  return node?.side ?? null;
}
export function outerSides(objects: readonly Item[]): Map<string, Side | null> {
  const idx = index(objects), sides = new Map<string, Side | null>();
  const visit = (node: Node, side: Side | null) => { sides.set(node.id, side); for (const child of childrenIn(idx, node.id)) visit(child, side ?? child.side); };
  for (const node of idx.nodes.values()) if (node.parent === null) visit(node, null);
  return sides;
}
export type MapCommand = "Add child" | "Add child left" | "Add child right" | "Add sibling" | "Collapse" | "Expand";
export function hiddenIds(objects: readonly Item[]): Set<string> {
  const idx = index(objects), hidden = new Set<string>();
  for (const node of idx.nodes.values()) if (node.collapsed && node.parent !== null) for (const d of descendantsIn(idx, node.id)) hidden.add(d.id);
  return hidden;
}
export const hiddenCount = (objects: readonly Item[], id: string) => descendants(objects, id).length;
export const withMaps = (objects: readonly Item[], ids: Iterable<string>) => {
  const idx = index(objects), result = new Set(ids);
  for (const id of [...result]) if (idx.nodes.has(id)) { const root = rootIn(idx, id); result.add(root.id); for (const d of descendantsIn(idx, root.id)) result.add(d.id); }
  return result;
};
// Copying, cutting or duplicating a collapsed node carries its hidden descendants.
export function withHiddenDescendants(objects: readonly Item[], selected: ReadonlySet<string>): Set<string> {
  const idx = index(objects), result = new Set(selected);
  for (const id of selected) { const node = idx.nodes.get(id); if (node?.collapsed) for (const d of descendantsIn(idx, id)) result.add(d.id); }
  return result;
}

// Box: words wrap at 320 px; width is the widest line plus 8 px each side and
// height the lines at 1.45 plus 6 px top and bottom, each rounded up.
export function nodeLines(text: string, root: boolean, measure: MeasureText): RunLine[] {
  const size = record().fontSize({ parent: root ? null : "" });
  return layoutRuns(text || MIND_MAP.placeholder, [], MIND_MAP.wrap, (value) => measure(value, root, size));
}
export function nodeBox(text: string, root: boolean, measure: MeasureText): { width: number; height: number } {
  const lines = nodeLines(text, root, measure), size = record().fontSize({ parent: root ? null : "" });
  const widest = Math.min(MIND_MAP.wrap, Math.max(0, ...lines.map((line) => line.width)));
  return { width: Math.ceil(widest + 2 * MIND_MAP.padX),
    height: Math.ceil(Math.max(1, lines.length) * size * TEXT_LAYOUT.lineHeight + 2 * MIND_MAP.padY) };
}

// Steps 2–6 of the layout: ranks, columns, blocks, the fixed root and one rounding.
function layoutInto(idx: Index, rootId: string, set: (id: string, change: Change) => void) {
  const root = idx.nodes.get(rootId)!, rx = Math.round(root.x), ry = Math.round(root.y);
  set(root.id, { x: rx, y: ry });
  const rank = (id: string) => childrenIn(idx, id).forEach((child, i) => { set(child.id, { rank: i }); rank(child.id); });
  rank(root.id);
  const visible = (node: Node) => node.collapsed ? [] : childrenIn(idx, node.id);
  const blocks = new Map<string, number>();
  const block = (node: Node): number => {
    const list = visible(node);
    const value = list.length ? Math.max(node.height, list.reduce((sum, k) => sum + block(k), 0) + MIND_MAP.gap * (list.length - 1)) : node.height;
    blocks.set(node.id, value);
    return value;
  };
  for (const side of ["right", "left"] as const) {
    const first = childrenIn(idx, root.id).filter((node) => node.side === side);
    if (!first.length) continue;
    const right = side === "right", columns: Node[][] = [];
    const walk = (node: Node, depth: number) => { (columns[depth] ??= []).push(node); visible(node).forEach((k) => walk(k, depth + 1)); };
    first.forEach((node) => walk(node, 1));
    const xs = new Map<string, number>();
    let edge = right ? rx + root.width : rx;
    for (let depth = 1; depth < columns.length; depth++) {
      const start = right ? edge + MIND_MAP.column : edge - MIND_MAP.column;
      for (const node of columns[depth]) xs.set(node.id, right ? start : start - node.width);
      const widest = Math.max(...columns[depth].map((node) => node.width));
      edge = right ? start + widest : start - widest;
    }
    const stack = (list: Node[]) => list.reduce((sum, node) => sum + block(node), 0) + MIND_MAP.gap * (list.length - 1);
    const place = (node: Node, top: number) => {
      set(node.id, { x: Math.round(xs.get(node.id)!), y: Math.round(top + blocks.get(node.id)! / 2 - node.height / 2) });
      const list = visible(node);
      let next = top + (blocks.get(node.id)! - (list.length ? stack(list) : 0)) / 2;
      for (const child of list) { place(child, next); next += blocks.get(child.id)! + MIND_MAP.gap; }
    };
    let top = ry + root.height / 2 - stack(first) / 2;
    for (const node of first) { place(node, top); top += blocks.get(node.id)! + MIND_MAP.gap; }
  }
}
function applyChanges<T extends Item>(objects: readonly T[], changes: ReadonlyMap<string, Change>): T[] {
  let changed = false;
  const result = objects.map((o) => {
    const change = changes.get(o.id);
    if (!change || Object.entries(change).every(([key, value]) => (o as Record<string, unknown>)[key] === value)) return o;
    changed = true;
    return { ...o, ...change };
  });
  return changed ? result : objects as T[];
}
function collect() {
  const changes = new Map<string, Change>();
  return { changes, set: (id: string, change: Change) => changes.set(id, { ...changes.get(id), ...change }) };
}
// Lays out every map whose root is named; hidden nodes keep their saved boxes.
export function layoutRoots<T extends Item>(objects: readonly T[], roots: Iterable<string>): T[] {
  let current = objects as T[];
  for (const id of new Set(roots)) {
    const idx = index(current);
    if (!idx.nodes.has(id)) continue;
    const { changes, set } = collect();
    layoutInto(idx, rootIn(idx, id).id, set);
    current = applyChanges(current, changes);
  }
  return current;
}
const same = (a: Node | undefined, b: Node | undefined) => JSON.stringify(a && { ...a, order: 0 }) === JSON.stringify(b && { ...b, order: 0 });
// The maps a change touches: those holding a node that is new, changed or gone.
export function changedRoots(before: readonly Item[], after: readonly Item[]): Set<string> {
  const old = index(before), next = index(after), touched = new Set<string>();
  for (const [id, node] of next.nodes) if (!same(old.nodes.get(id), node)) touched.add(id);
  for (const [id, node] of old.nodes) if (!same(node, next.nodes.get(id))) {
    const root = rootIn(old, id);
    for (const member of [root, ...descendantsIn(old, root.id)]) if (next.nodes.has(member.id)) touched.add(member.id);
  }
  return new Set([...touched].map((id) => rootIn(next, id).id));
}
// The commit's layout: every map the change touches, from saved boxes, except
// the map of a node whose text session is open.
export function settle<B extends AnyBoard>(before: AnyBoard, after: B, editing?: string): B {
  const roots = changedRoots(before.objects, after.objects);
  if (editing && after.objects.some((o) => o.id === editing && nodeOf(o))) roots.delete(rootOf(after.objects, editing).id);
  if (!roots.size) return after;
  const objects = layoutRoots(after.objects, roots);
  return objects === after.objects ? after : { ...after, objects };
}

function newNode(board: Board, values: Partial<Node>): { board: Board; node: Node } {
  const placed = add(board, record().type, 0, 0);
  const node = { ...placed.objects.at(-1)!, ...values } as Node;
  return { node, board: { ...placed, objects: bands([...placed.objects.slice(0, -1), node] as Board["objects"]).map((o, order) => ({ ...o, order })) } };
}
// A starter map: a root and three right-side ideas, the root box centred on the point.
export function starterMap(board: Board, at: Point, measure: MeasureNode): { board: Board; id: string } {
  const box = measure(STARTER[0], true);
  let current = newNode(board, { text: STARTER[0], ...box, x: Math.round(at.x - box.width / 2), y: Math.round(at.y - box.height / 2) });
  const root = current.node;
  STARTER.slice(1).forEach((text, rank) => {
    current = newNode(current.board, { text, parent: root.id, side: "right", rank, ...measure(text, false), x: root.x, y: root.y });
  });
  return { id: root.id, board: { ...current.board, objects: layoutRoots(current.board.objects, [root.id]) } };
}
function insertChild(board: Board, parentId: string, at: number, side: Side | null, measure: MeasureNode) {
  const idx = index(board.objects), parent = idx.nodes.get(parentId)!, list = childrenIn(idx, parentId);
  const { changes, set } = collect();
  if (parent.collapsed) set(parent.id, { collapsed: false });
  list.forEach((child, i) => set(child.id, { rank: i < at ? i : i + 1 }));
  const updated = { ...board, objects: applyChanges(board.objects, changes) };
  const { board: next, node } = newNode(updated, { text: "", parent: parentId, side, rank: at, ...measure("", false), x: parent.x, y: parent.y });
  return { board: { ...next, objects: layoutRoots(next.objects, [rootIn(idx, parentId).id]) }, id: node.id };
}
// Add child: the last child; on a root the given side, or the side with fewer
// first-level nodes (right when equal). A collapsed parent expands first.
export function addChild(board: Board, id: string, measure: MeasureNode, side?: Side): { board: Board; id: string } | undefined {
  const idx = index(board.objects), node = idx.nodes.get(id);
  if (!node) return undefined;
  const list = childrenIn(idx, id), count = (s: Side) => list.filter((n) => n.side === s).length;
  return insertChild(board, id, list.length, node.parent === null ? side ?? (count("right") <= count("left") ? "right" : "left") : null, measure);
}
// Add sibling: directly after the node, under the same parent; nothing on a root.
export function addSibling(board: Board, id: string, measure: MeasureNode): { board: Board; id: string } | undefined {
  const idx = index(board.objects), node = idx.nodes.get(id);
  if (!node || node.parent === null) return undefined;
  return insertChild(board, node.parent, childrenIn(idx, node.parent).indexOf(node) + 1, node.side, measure);
}
// The cycle rule: a node never goes under itself or one of its descendants.
export function canReparent(objects: readonly Item[], id: string, target: string): boolean {
  const idx = index(objects);
  return idx.nodes.has(id) && idx.nodes.has(target) && id !== target && !descendantsIn(idx, id).some((n) => n.id === target);
}
// Release over a target: the node becomes its last child with its branch; a
// collapsed target expands; a root that joins takes the node look.
export function reparent(board: Board, id: string, target: string, side: Side, measure: MeasureNode): Board {
  if (!canReparent(board.objects, id, target)) return board;
  const idx = index(board.objects), node = idx.nodes.get(id)!, goal = idx.nodes.get(target)!;
  const oldRoot = rootIn(idx, id).id, { changes, set } = collect();
  const list = childrenIn(idx, target).filter((n) => n.id !== id);
  list.forEach((child, i) => set(child.id, { rank: i }));
  if (goal.collapsed) set(goal.id, { collapsed: false });
  set(id, { parent: target, side: goal.parent === null ? side : null, rank: list.length,
    ...(node.parent === null ? { collapsed: false, ...measure(node.text, false) } : {}) });
  if (node.parent === null) for (const child of childrenIn(idx, id)) set(child.id, { side: null });
  const objects = applyChanges(board.objects, changes);
  return { ...board, objects: layoutRoots(objects, [oldRoot, rootIn(index(objects), target).id]) };
}
// Release elsewhere: a non-root node becomes the root of a new map, its root box
// centred where the dragged box's centre was, its children on the right.
export function detach(board: Board, id: string, centre: Point, measure: MeasureNode): Board {
  const idx = index(board.objects), node = idx.nodes.get(id);
  if (!node || node.parent === null) return board;
  const oldRoot = rootIn(idx, id).id, box = measure(node.text, true), { changes, set } = collect();
  set(id, { parent: null, side: null, rank: 0, collapsed: false, ...box,
    x: Math.round(centre.x - box.width / 2), y: Math.round(centre.y - box.height / 2) });
  for (const child of childrenIn(idx, id)) set(child.id, { side: "right" });
  return { ...board, objects: layoutRoots(applyChanges(board.objects, changes), [oldRoot, id]) };
}
export function collapse(board: Board, id: string, collapsed: boolean): Board {
  const idx = index(board.objects), node = idx.nodes.get(id);
  if (!node || node.parent === null || !childrenIn(idx, id).length || node.collapsed === collapsed) return board;
  const objects = applyChanges(board.objects, new Map([[id, { collapsed }]]));
  return { ...board, objects: layoutRoots(objects, [rootIn(idx, id).id]) };
}
// Deleting moves children up: each surviving node goes to its nearest surviving
// ancestor in its deleted ancestor's place and order, or becomes a root centred
// where it was, its children on the right.
export function afterDelete<B extends AnyBoard>(before: AnyBoard, after: B, measure?: MeasureNode): B {
  const idx = index(before.objects), live = new Set(after.objects.map((o) => o.id));
  const removed = new Set([...idx.nodes.keys()].filter((id) => !live.has(id)));
  if (!removed.size) return after;
  const { changes, set } = collect(), roots = new Set<string>();
  const expand = (node: Node): Node[] => removed.has(node.id) ? childrenIn(idx, node.id).flatMap(expand) : [node];
  const surviving = [...idx.nodes.values()].filter((n) => !removed.has(n.id));
  for (const node of surviving) {
    let ancestor = node.parent;
    while (ancestor !== null && removed.has(ancestor)) ancestor = idx.nodes.get(ancestor)!.parent;
    if (node.parent !== null && ancestor === null) {
      const box = measure ? measure(node.text, true) : { width: node.width, height: node.height };
      set(node.id, { parent: null, side: null, rank: 0, collapsed: false, ...box,
        x: Math.round(node.x + node.width / 2 - box.width / 2), y: Math.round(node.y + node.height / 2 - box.height / 2) });
    }
    if (ancestor === null && node.parent !== null || node.parent === null) roots.add(node.id);
    else roots.add(rootIn(idx, node.id).id);
  }
  for (const parent of surviving) {
    const original = childrenIn(idx, parent.id);
    if (!original.some((child) => removed.has(child.id)) && !changes.get(parent.id)?.hasOwnProperty("parent")) continue;
    const newRoot = changes.get(parent.id)?.parent === null && parent.parent !== null;
    original.flatMap((child) => expand(child).map((node) => ({ node, from: child }))).forEach(({ node, from }, rank) =>
      set(node.id, { parent: parent.id, rank, side: newRoot ? "right" : parent.parent === null ? from.side : null }));
  }
  const objects = applyChanges(after.objects, changes);
  return { ...after, objects: layoutRoots(objects, [...roots].filter((id) => live.has(id))) };
}
// The copied snapshot is consistent: a node whose parent is also copied keeps
// that link; any other copied node becomes a root, its copied children
// first-level nodes on the right. A node that becomes a root takes its look.
export function copiedStructure<T extends Item>(objects: readonly T[], measure?: MeasureNode): T[] {
  const nodes = new Map<string, Node>();
  for (const o of objects) if (nodeOf(o)) nodes.set(o.id, o);
  const copyRoot = (node: Node) => node.parent === null || !nodes.has(node.parent);
  return objects.map((o) => {
    if (!nodeOf(o)) return o;
    if (!copyRoot(o)) {
      const parent = nodes.get(o.parent!)!;
      const side = copyRoot(parent) ? parent.parent === null ? o.side : "right" : null;
      return side === o.side ? o : { ...o, side };
    }
    if (o.parent === null) return o;
    return { ...o, parent: null, side: null, collapsed: false, ...(measure ? measure(o.text, true) : {}) };
  });
}
export const remapParent = <T extends Item>(o: T, ids: ReadonlyMap<string, string>): T =>
  nodeOf(o) && o.parent !== null ? { ...o, parent: ids.get(o.parent) ?? null } : o;

// While one node is dragged, it and its branch follow the pointer and the rest of
// its map is drawn laid out without them (saved boxes, nothing committed).
export function dragPreview(board: Board, id: string, dx: number, dy: number): Board {
  const idx = index(board.objects), node = idx.nodes.get(id);
  if (!node) return board;
  const branch = new Set([id, ...descendantsIn(idx, id).map((n) => n.id)]);
  const rest = node.parent === null ? [] : layoutRoots(board.objects.filter((o) => !branch.has(o.id)), [rootIn(idx, id).id]);
  const placed = new Map(rest.map((o) => [o.id, o]));
  return { ...board, objects: board.objects.map((o) => branch.has(o.id) && "x" in o
    ? { ...o, x: o.x + dx, y: o.y + dy } : placed.get(o.id) ?? o) };
}
export function branchIds(objects: readonly Item[], id: string): string[] {
  return [id, ...descendants(objects, id).map((n) => n.id)];
}
// The drop target: the topmost visible node whose box holds the pointer, never
// the dragged node or one of its descendants. On a root, the pointer picks the side.
export function dropTarget(objects: readonly Item[], point: Point, dragged: ReadonlySet<string>): { target: string; side: Side } | null {
  const hidden = hiddenIds(objects);
  const node = [...bands(objects)].reverse().filter(nodeOf).find((o) => !hidden.has(o.id) && !dragged.has(o.id) &&
    point.x >= o.x && point.x <= o.x + o.width && point.y >= o.y && point.y <= o.y + o.height);
  if (!node) return null;
  return { target: node.id, side: node.parent === null ? point.x < node.x + node.width / 2 ? "left" : "right" : outerSide(objects, node.id)! };
}

// Words: names are cut to 40 code points with an ellipsis; an empty node is "Empty".
export function nodeName(text: string): string {
  const points = Array.from(text);
  return !points.length ? "Empty" : points.length > MIND_MAP.nameLimit ? points.slice(0, MIND_MAP.nameLimit).join("") + "…" : text;
}
export const MAP_WORDS = {
  addedChild: (parent: string) => `Added a child to “${nodeName(parent)}”.`,
  addedSibling: (parent: string) => `Added a node to “${nodeName(parent)}”.`,
  moved: (node: string, target: string) => `Moved “${nodeName(node)}” under “${nodeName(target)}”.`,
  separate: (node: string) => `“${nodeName(node)}” is now a separate map.`,
  collapsed: (node: string, count: number) => `Collapsed “${nodeName(node)}”: ${count} hidden.`,
  expanded: (node: string) => `Expanded “${nodeName(node)}”.`,
  badge: (node: string, count: number) => `Expand “${nodeName(node)}”, ${count} hidden`,
  count: (count: number) => count > 99 ? "99+" : String(count),
};
