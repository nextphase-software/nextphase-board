// SPDX-License-Identifier: Apache-2.0
import { hasText, hasEnds, isContainer, type Rectangle } from 'nextphase-board-rules/objects/registry.ts';
import type { ResolvedItem } from './geometry.ts';
import { readingOrder } from './tidy-up.ts';

export type FindResult = Rectangle & { id: string; page?: string };
export type FindCursor = { current: FindResult | null; removed: FindResult | null };
const normalized = (text: string) => text.normalize('NFC').toLowerCase();
export const findQuery = (text: string) => normalized(text.trim());
export const REMOVED_RESULT = 'The result you were on was removed. Return goes to the next one.';

export function unionBoxes(boxes: readonly Rectangle[]): Rectangle | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y };
}

export function objectBox(object: ResolvedItem): Rectangle {
  const box = { x: object.x, y: object.y, width: object.width, height: object.displayHeight };
  if (isContainer(object)) return { ...box, y: box.y - 26, height: box.height + 26 };
  if (hasEnds(object) && object.text && object.connectorLayout) {
    return unionBoxes([box, object.connectorLayout.labelBox])!;
  }
  return box;
}

function ordered(results: readonly FindResult[]): FindResult[] {
  return readingOrder(results.map(r => ({ ...r, ids: [r.id] }))).map(({ ids: _ids, ...r }) => r);
}

export function findResults(objects: readonly ResolvedItem[], query: string): FindResult[] {
  const match = findQuery(query);
  return match ? ordered(objects.filter(o => hasText(o) && o.text && normalized(o.text).includes(match))
    .map(o => ({ id: o.id, ...objectBox(o) }))) : [];
}

export function queryCursor(results: readonly FindResult[]): FindCursor {
  return { current: results[0] ?? null, removed: null };
}

// A board change updates the last box without choosing a result or moving the view.
export function reconcileCursor(results: readonly FindResult[], cursor: FindCursor): FindCursor {
  if (!cursor.current) return cursor;
  const current = results.find(r => r.id === cursor.current!.id);
  if (!current) return { current: null, removed: cursor.current };
  const old = cursor.current;
  return current.x === old.x && current.y === old.y && current.width === old.width && current.height === old.height && current.page === old.page
    ? cursor : { current, removed: null };
}

export function stepResult(results: readonly FindResult[], cursor: FindCursor, direction: -1 | 1, pages?: readonly string[]): FindCursor {
  if (!results.length) return cursor;
  let index = cursor.current ? results.findIndex(r => r.id === cursor.current!.id) : -1;
  if (index < 0 && cursor.removed) {
    const restored = results.find(r => r.id === cursor.removed!.id);
    if (restored) return { current: restored, removed: null };
    const combined = [...results, cursor.removed];
    const places = pages ? pages.flatMap(page => ordered(combined.filter(r => r.page === page))) : ordered(combined);
    const place = places.findIndex(r => r.id === cursor.removed!.id);
    return { current: places[(place + direction + places.length) % places.length], removed: null };
  }
  if (index < 0) index = direction === 1 ? -1 : 0;
  return { current: results[(index + direction + results.length) % results.length], removed: null };
}

export function findCounter(query: string, results: readonly FindResult[], cursor: FindCursor): string {
  if (!findQuery(query)) return '';
  if (!results.length) return 'No results';
  const index = results.findIndex(r => r.id === cursor.current?.id);
  return `${index < 0 ? '–' : index + 1} of ${results.length}`;
}
export function removedMessage(results: readonly FindResult[], cursor: FindCursor): string {
  return results.length && !cursor.current && cursor.removed ? REMOVED_RESULT : '';
}
export function fadedIds(objects: readonly ResolvedItem[], results: readonly FindResult[], selected: ReadonlySet<string>): Set<string> {
  const matches = new Set(results.map(r => r.id));
  return new Set(results.length && !selected.size ? objects.filter(o => !isContainer(o) && !matches.has(o.id)).map(o => o.id) : []);
}
export function sectionsList(objects: readonly ResolvedItem[]) {
  const sections = objects.filter(o => isContainer(o));
  return ordered(sections.map(o => ({ id: o.id, ...objectBox(o) })))
    .map(box => ({ ...box, label: sections.find(o => o.id === box.id)!.text!.trim() || 'Untitled section' }));
}

// Shared seam for screen/scene parts; the state hook is its only owner.
export type FindActions = {
  open: boolean; query: string; results: FindResult[]; cursor: FindCursor; faded: ReadonlySet<string>;
  counter: string; removed: string; pageLine?: string; multiplePages?: boolean; shortcut: string;
  field: (element: { focus(): void; select(): void } | null) => void;
  changeQuery: (query: string) => void; show: () => void; close: () => void; step: (direction: -1 | 1) => void;
  sections: (FindResult & { label: string })[]; canFit: boolean; canFitSelection: boolean;
  zoomToFit: () => void; zoomToSelection: () => void; fitSection: (id: string) => void;
};

// Structural UI seam; page state and every mutation live in use-pages.
export type Pages = {
  id: string; local: boolean; list: import('nextphase-board-rules/document.ts').Page[];
  open: boolean; menu: string; editing: string; name: string; moveOpen: boolean;
  drag: { id: string; y: number; active: boolean; gap: number } | null;
  go: { id: string; text: string } | null; openingReason: string; editingReason: string; addReason: string;
  button: { current: HTMLButtonElement | null }; panel: { current: HTMLElement | null };
  names: { current: Map<string, HTMLButtonElement> }; options: { current: Map<string, HTMLButtonElement> };
  nameField: { current: HTMLInputElement | null }; pageMenu: { current: HTMLDivElement | null };
  moveButton: { current: HTMLButtonElement | null }; moveMenu: { current: HTMLDivElement | null };
  duplicateReason: (id: string) => string; toggle: () => void; closeList: () => void;
  openPage: import('./pages.ts').PageNavigation['openPage']; add: () => void; rename: (id: string) => void;
  finishName: (keep: boolean) => void; changeName: (name: string) => void;
  choose: (action: string, id: string) => void; beginDrag: (id: string, y: number) => void;
  dragTo: (y: number) => void; endDrag: (cancel?: boolean) => boolean;
  clickPage: (id: string) => void; suppressClick: () => void; showMenu: (id: string) => void;
  closeMenu: () => void; toggleMove: () => void; closeMove: () => void;
  movedCount: (ids: ReadonlySet<string>) => number; move: (id: string, selected: ReadonlySet<string>) => void;
};
