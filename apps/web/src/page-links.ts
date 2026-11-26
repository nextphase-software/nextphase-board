// SPDX-License-Identifier: Apache-2.0
import type { BoardV14, Page } from 'nextphase-board-rules/document.ts';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const boardPattern = new RegExp(`^#/b/(${uuid})(?:\\?([^#]*))?$`);

export function readHostedBoardLink(fragment: string): { board: string; page?: string; object?: string } | undefined {
  const match = boardPattern.exec(fragment);
  if (!match) return undefined;
  const [, board, query] = match;
  const result: { board: string; page?: string; object?: string } = { board };
  if (query === undefined) return result;
  for (const part of query.split('&')) {
    const parameter = /^(page|object)=(.*)$/s.exec(part);
    if (!parameter) return undefined;
    const key = parameter[1] as 'page' | 'object';
    if (Object.hasOwn(result, key)) return undefined;
    result[key] = parameter[2];
  }
  return result;
}

export function readPageValue(address: string, hostedBoard?: string) {
  const url = new URL(address);
  if (hostedBoard === undefined) return url.searchParams.get('page') ?? undefined;
  const link = readHostedBoardLink(url.hash);
  return link?.board === hostedBoard ? link.page : undefined;
}

export function readObjectValue(address: string, hostedBoard?: string) {
  const url = new URL(address);
  if (hostedBoard === undefined) return url.searchParams.get('object') ?? undefined;
  const link = readHostedBoardLink(url.hash);
  return link?.board === hostedBoard ? link.object : undefined;
}

export function pageLink(address: string, page: string, hostedBoard?: string, object?: string) {
  const url = new URL(address);
  if (hostedBoard !== undefined) return `${url.origin}${url.pathname}#/b/${hostedBoard}?page=${page}${object === undefined ? '' : `&object=${object}`}`;
  const parts = url.search ? url.search.slice(1).split('&') : [];
  const entries = new URLSearchParams({ page });
  if (object !== undefined) entries.set('object', object);
  const query: string[] = [];
  for (const part of parts) {
    const partKeys = new URLSearchParams('?' + part);
    const key = partKeys.has('page') ? 'page' : partKeys.has('object') ? 'object' : undefined;
    if (!key) query.push(part);
    else if (entries.has(key)) {
      query.push(new URLSearchParams({ [key]: entries.get(key)! }).toString());
      entries.delete(key);
    }
  }
  for (const [key, value] of entries) query.push(new URLSearchParams({ [key]: value }).toString());
  url.search = query.join('&');
  return url.href;
}

export function resolvePage(pages: readonly Page[], value: string | undefined, remembered: string) {
  const found = pages.find(page => page.id === (value ?? remembered));
  return { page: found ?? pages[0], missing: value !== undefined && !found };
}

export const COPY_PAGE_LINK = 'Copy link to page';
export const clipboardRefused = 'Could not copy the link. Your browser blocked the clipboard.';
export const missingPageNotice = (name: string) => `That page no longer exists. You are on “${name}”.`;
export const missingObjectNotice = 'That object no longer exists.';
export const copiedPageNotice = (name: string, hosted: boolean) =>
  `Link to “${name}” copied.` + (hosted ? '' : ' It opens in this browser only.');

// Only the storage session can mark the initial board as adopted. A repaint
// before that adoption must leave the captured link available.
let startup: { kind: 'waiting'; value?: string; object?: string }
  | { kind: 'adopted'; board: BoardV14; value?: string; object?: string; showNotice: boolean }
  | { kind: 'spent' }
  | undefined;
export function captureStartupPage(address: string) {
  startup ??= { kind: 'waiting', value: readPageValue(address), object: readObjectValue(address) };
}
export function markStartupAdoption(board: BoardV14, showNotice: boolean) {
  if (startup?.kind === 'waiting') startup = { ...startup, kind: 'adopted', board, showNotice };
}
export function startupPagePending() {
  return startup?.kind === 'waiting' || startup?.kind === 'adopted';
}
export function takeStartupAdoption(boardId: string) {
  const adopted = startup;
  if (adopted?.kind !== 'adopted' || adopted.board.boardId !== boardId) return;
  discardStartupPage();
  return adopted;
}
export function discardStartupPage() {
  startup = { kind: 'spent' };
}
