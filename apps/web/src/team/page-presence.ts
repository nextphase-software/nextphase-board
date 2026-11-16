// SPDX-License-Identifier: Apache-2.0
import type { BoardV13 } from 'nextphase-board-rules/document.ts';
import type { CommentThread } from './comments/rules.ts';
import { groupPeople, type Presence } from './presence.ts';
import type { VoteSession } from './hosted-board.ts';
export const onPage = (presence: { page?: string } | undefined, page: string) => !!presence?.page && presence.page === page;
export function pagePeople(self: Presence | undefined, others: readonly Presence[], page: string) {
  const people = groupPeople(self, others).filter(p => !p.own && p.connections.some(c => onPage(c, page)));
  return { shown: people.slice(0, 3).map(p => p.first), overflow: Math.max(0, people.length - 3),
    name: people.length ? people.map(p => p.first.label).join(', ') + ' on this page' : '' };
}
export function peoplePageWords(role: string, presence: Presence, page: string, pages: BoardV13['pages']) {
  const known = pages.find(p => p.id === presence.page);
  return role + (known ? presence.page === page ? ' · this page' : ` · on ${known.name}` : '');
}
export const followNotice = (label: string, name: string) => `Following ${label} to “${name}”.`;
export type ChangeOrigin = { origin: 'own' | 'remote' | 'reload'; connection?: string };
export function removedPage(before: BoardV13, after: BoardV13, page: string, change: ChangeOrigin, others: readonly Presence[] = []) {
  const at = before.pages.findIndex(p => p.id === page);
  if (at < 0 || after.pages.some(p => p.id === page)) return undefined;
  const next = after.pages.find(p => p.id === before.pages[Math.max(0, at - 1)].id) ?? after.pages[0];
  const label = others.find(p => p.connection === change.connection)?.label ?? 'Someone';
  return { page: next.id, notice: change.origin === 'remote' ? `${label} deleted page “${before.pages[at].name}”. You are now on “${next.name}”.` : '' };
}
export function threadPage(thread: Pick<CommentThread, 'anchor'>, board: BoardV13) {
  return (!thread.anchor.detached && board.objects.find(o => o.id === thread.anchor.objectId)?.page) || thread.anchor.page || board.pages[0].id;
}
export const threadOnPage = (thread: Pick<CommentThread, 'anchor'>, board: BoardV13, page: string) => threadPage(thread, board) === page && board.pages.some(p => p.id === page);
export function commentLocation(thread: Pick<CommentThread, 'anchor'>, board: BoardV13, page: string, base: string) {
  const target = board.pages.find(p => p.id === threadPage(thread, board));
  return target ? base + (target.id === page ? '' : ` · page ${target.name}`) : `On deleted page “${thread.anchor.pageName}”`;
}
export function votingPageLine(vote: Pick<VoteSession, 'page'>, pages: BoardV13['pages']) {
  const page = pages.find(p => p.id === vote.page);
  return page ? `This vote is on page “${page.name}”.` : "This vote's page was deleted.";
}
export const votingPageReason = (vote: Pick<VoteSession, 'status' | 'page'> | undefined, page: string) =>
  vote?.status === 'running' && vote.page === page ? 'A vote is running on this page' : '';
