// SPDX-License-Identifier: Apache-2.0
import type { BoardV14, Page } from 'nextphase-board-rules/document.ts';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const boardPattern = new RegExp(`^#/b/(${uuid})(?:\\?page=([^&#]*))?$`);

export function readHostedBoardLink(fragment: string) {
  const match = boardPattern.exec(fragment);
  if (!match) return undefined;
  const [, board, page] = match;
  return page === undefined ? { board } : { board, page };
}

export function readPageValue(address: string, hostedBoard?: string) {
  const url = new URL(address);
  if (hostedBoard === undefined) return url.searchParams.get('page') ?? undefined;
  const link = readHostedBoardLink(url.hash);
  return link?.board === hostedBoard ? link.page : undefined;
}

export function pageLink(address: string, page: string, hostedBoard?: string) {
  const url = new URL(address);
  if (hostedBoard !== undefined) return `${url.origin}${url.pathname}#/b/${hostedBoard}?page=${page}`;
  const parts = url.search ? url.search.slice(1).split('&') : [];
  const entry = new URLSearchParams({ page }).toString();
  const query: string[] = [];
  let replaced = false;
  for (const part of parts) {
    if (!new URLSearchParams('?' + part).has('page')) query.push(part);
    else if (!replaced) { query.push(entry); replaced = true; }
  }
  if (!replaced) query.push(entry);
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
export const copiedPageNotice = (name: string, hosted: boolean) =>
  `Link to “${name}” copied.` + (hosted ? '' : ' It opens in this browser only.');

// Only the storage session can mark the initial board as adopted. A repaint
// before that adoption must leave the captured link available.
let startup: { kind: 'waiting'; value?: string }
  | { kind: 'adopted'; board: BoardV14; value?: string; showNotice: boolean }
  | { kind: 'spent' }
  | undefined;
export function captureStartupPage(address: string) {
  startup ??= { kind: 'waiting', value: readPageValue(address) };
}
export function markStartupAdoption(board: BoardV14, showNotice: boolean) {
  if (startup?.kind === 'waiting') startup = { kind: 'adopted', board, value: startup.value, showNotice };
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
