// SPDX-License-Identifier: Apache-2.0
export type Landing = { boardId: string; threadId: string; commentId: string; noticeId: string; source: string };
export const notificationNavigation: { target?: Landing; returnNotice?: string } = {};
type Drafts = Map<string, { reply: import('./comments/card').Draft; editing: { id: string; draft: import('./comments/card').Draft } | null }>;
type Requests = Map<string, import('./comments/rules').CommentRequest>;
let retained: { boardId: string; drafts: Drafts; requests: Requests } | undefined;
export function notificationDrafts(boardId: string): Drafts {
  if (retained?.boardId !== boardId) { retained?.drafts.clear(); retained?.requests.clear(); retained = { boardId, drafts: new Map(), requests: new Map() }; }
  return retained.drafts;
}
export function notificationRequests(boardId: string): Requests {
  notificationDrafts(boardId);
  return retained!.requests;
}
export function clearNotificationMemory(boardId?: string) {
  if (!boardId || retained?.boardId === boardId) { retained?.drafts.clear(); retained?.requests.clear(); retained = undefined; }
  if (!boardId || notificationNavigation.target?.boardId === boardId) delete notificationNavigation.target;
  delete notificationNavigation.returnNotice;
}
