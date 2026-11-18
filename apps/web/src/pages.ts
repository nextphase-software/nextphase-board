// SPDX-License-Identifier: Apache-2.0
import { freshIdentifier, validPageName, type BoardV14 as Board, type Page } from 'nextphase-board-rules/document.ts';
import { hasEnds } from 'nextphase-board-rules/objects/registry.ts';
import { copiedSet } from './connectors.ts';
import { withHiddenDescendants, withMaps } from './mind-map.ts';
import { copyObjects } from './clipboard.ts';
import { commandObjectLabel } from './sections.ts';
import { findResults, stepResult, type FindResult, type FindCursor } from './find.ts';
import type { ResolvedItem } from './geometry.ts';

export type PageNavigation = { id: string; openingReason: string; openPage: (id: string, force?: boolean) => import('./view.ts').View | undefined; afterHistory: (before: Board, next: Board, step?: string) => void };
export const PAGE_LIMIT = 'A board holds at most 50 pages.';
export const OBJECT_LIMIT = 'A board holds at most 250 objects.';
export const ONLY_PAGE = 'A board needs at least one page.';
export const pageObjects = (board: Board, page: string) => board.objects.filter(o => o.page === page);
// A read-only projection for drawing/listing. Commands always receive the whole board.
export const pageBoard = (board: Board, page: string): Board => ({ ...board, objects: pageObjects(board, page) });
export function nextPageName(board: Board): string {
  let n = 1;
  while (board.pages.some(p => p.name === `Page ${n}`)) n++;
  return `Page ${n}`;
}
function pageOf(board: Board, id: string): Page {
  const page = board.pages.find(p => p.id === id);
  if (!page) throw Error('Unknown page');
  return page;
}
export function addPage(board: Board): { board: Board; page: Page } {
  if (board.pages.length >= 50) throw Error(PAGE_LIMIT);
  const page = { id: freshIdentifier(board), name: nextPageName(board) };
  return { board: { ...board, pages: [...board.pages, page] }, page };
}
export function renamePage(board: Board, id: string, input: string): Board {
  const page = pageOf(board, id), name = [...input.trim()].slice(0, 60).join('').trim();
  return name === page.name || !validPageName(name) ? board
    : { ...board, pages: board.pages.map(p => p.id === id ? { ...p, name } : p) };
}
export function movePage(board: Board, id: string, index: number): Board {
  const page = pageOf(board, id), from = board.pages.indexOf(page);
  const to = Math.max(0, Math.min(board.pages.length - 1, index));
  if (from === to) return board;
  const pages = [...board.pages]; pages.splice(from, 1); pages.splice(to, 0, page);
  return { ...board, pages };
}
export const movePageUp = (board: Board, id: string) => movePage(board, id, board.pages.findIndex(p => p.id === id) - 1);
export const movePageDown = (board: Board, id: string) => movePage(board, id, board.pages.findIndex(p => p.id === id) + 1);
export function duplicatePageReason(board: Board, id: string): string {
  return board.pages.length >= 50 ? PAGE_LIMIT : board.objects.length + pageObjects(board, id).length > 250 ? OBJECT_LIMIT : '';
}
export const duplicatePageNotice = (name: string, copy: string) => `Duplicated page “${name}” as “${copy}”.`;
export function duplicatePage(board: Board, id: string): { board: Board; page: Page; notice: string } {
  const source = pageOf(board, id), reason = duplicatePageReason(board, id);
  if (reason) throw Error(reason);
  const page = { id: freshIdentifier(board), name: [...`${source.name} copy`].slice(0, 60).join('').trim() };
  const items = pageObjects(board, id);
  const pages = [...board.pages]; pages.splice(pages.indexOf(source) + 1, 0, page);
  const next = copyObjects({ ...board, pages }, {
    objects: items.map(({ generation: _generation, order: _order, page: _page, ...o }) => o),
    sourceIdentifiers: items.flatMap(o => [o.id, o.generation, ...(o.group ? [o.group] : [])]),
  }, 0, 0, page.id);
  return { board: next, page, notice: duplicatePageNotice(source.name, page.name) };
}
export function fallbackPage(before: Board, after: Board, open: string): string {
  if (after.pages.some(p => p.id === open)) return open;
  const index = before.pages.findIndex(p => p.id === open);
  for (let i = index - 1; i >= 0; i--) if (after.pages.some(p => p.id === before.pages[i].id)) return before.pages[i].id;
  return after.pages[0].id;
}
export function deletePageNotice(name: string, count: number, opened?: string): string {
  return `Deleted page “${name}”${count ? ` and its ${count} ${count === 1 ? 'object' : 'objects'}` : ''}. Undo restores it.` +
    (opened === undefined ? '' : ` Now on “${opened}”.`);
}
export function deletePage(board: Board, id: string, open: string): { board: Board; open: string; notice: string } {
  const page = pageOf(board, id);
  if (board.pages.length === 1) throw Error(ONLY_PAGE);
  const removed = pageObjects(board, id);
  if (board.retiredGenerations.length + removed.length > 10000) throw Error('10,000 retired-generation limit reached; this command cannot remove an object.');
  const next = { ...board, pages: board.pages.filter(p => p.id !== id),
    objects: board.objects.filter(o => o.page !== id).map((o, order) => ({ ...o, order })),
    retiredGenerations: [...board.retiredGenerations, ...removed.map(o => o.generation)].sort() };
  const opened = fallbackPage(board, next, open);
  return { board: next, open: opened, notice: deletePageNotice(page.name, removed.length, id === open ? pageOf(next, opened).name : undefined) };
}
export function movedSet(board: Board, selected: ReadonlySet<string>): Set<string> {
  let result = copiedSet(board.objects, withHiddenDescendants(board.objects, selected));
  let size = -1;
  while (size !== result.size) {
    size = result.size;
    result = withMaps(board.objects, result);
    const groups = new Set(board.objects.filter(o => result.has(o.id) && o.group).map(o => o.group));
    for (const o of board.objects) if (o.group && groups.has(o.group)) result.add(o.id);
    result = copiedSet(board.objects, result);
  }
  for (const o of board.objects) if (hasEnds(o) && !(result.has(o.from.object) && result.has(o.to.object))) result.delete(o.id);
  return result;
}
export function moveNotice(board: Board, ids: ReadonlySet<string>, page: string, removed: number): string {
  const count = ids.size, object = board.objects.find(o => ids.has(o.id));
  return (count === 1 ? `Moved ${commandObjectLabel(board, object!)} to “${page}”. Undo moves it back.`
    : `Moved ${count} objects to “${page}”. Undo moves them back.`) + (removed === 1
      ? ' 1 connector to an object left on this page was removed.' : removed ? ` ${removed} connectors to objects left on this page were removed.` : '');
}
export function moveToPage(board: Board, selected: ReadonlySet<string>, target: string) {
  const page = pageOf(board, target), ids = movedSet(board, selected);
  if (!ids.size || board.objects.filter(o => ids.has(o.id)).every(o => o.page === target)) return { board, count: 0, removed: 0, notice: '' };
  const removed = board.objects.filter(o => hasEnds(o) && !ids.has(o.id) && ids.has(o.from.object) !== ids.has(o.to.object));
  if (board.retiredGenerations.length + removed.length > 10000) throw Error('10,000 retired-generation limit reached; this command cannot remove an object.');
  const deleted = new Set(removed.map(o => o.id));
  const next = { ...board, retiredGenerations: [...board.retiredGenerations, ...removed.map(o => o.generation)].sort(),
    objects: board.objects.filter(o => !deleted.has(o.id)).map((o, order) => ids.has(o.id)
      ? { ...o, page: target, section: o.section && ids.has(o.section) ? o.section : null, order } : o.order === order ? o : { ...o, order }) };
  return { board: next, count: ids.size, removed: removed.length, notice: moveNotice(board, ids, page.name, removed.length) };
}
export function pageFindResults(board: Board, displayed: readonly ResolvedItem[], query: string): FindResult[] {
  return board.pages.flatMap(p => findResults(displayed.filter(o => o.page === p.id), query).map(r => ({ ...r, page: p.id })));
}
export const firstPageResult = (results: readonly FindResult[], open: string): FindCursor => ({ current: results.find(r => r.page === open) ?? null, removed: null });
export const resultPageLine = (board: Board, cursor: FindCursor): string => board.pages.length > 1 && cursor.current
  ? `On page “${board.pages.find(p => p.id === cursor.current!.page)?.name ?? ''}”` : '';
export function stepPageResult(board: Board, results: readonly FindResult[], cursor: FindCursor, open: string, direction: -1 | 1): FindCursor {
  if (!results.length) return cursor;
  const removedPage = cursor.removed?.page;
  if (cursor.current || cursor.removed && board.pages.some(p => p.id === removedPage)) {
    if (cursor.removed) {
      return stepResult(results, cursor, direction, board.pages.map(p => p.id));
    }
    return stepResult(results, cursor, direction);
  }
  const at = board.pages.findIndex(p => p.id === open);
  for (let n = 1; n <= board.pages.length; n++) {
    const page = board.pages[(at + n * direction + board.pages.length) % board.pages.length];
    const matches = results.filter(r => r.page === page.id);
    if (matches.length) return { current: direction === 1 ? matches[0] : matches.at(-1)!, removed: null };
  }
  return { current: null, removed: null };
}
