// SPDX-License-Identifier: Apache-2.0
export const TRASH_AGE = 2592000000;
export type LifecycleState = 'active'|'moving'|'trashed'|'restoring'|'purging'|'deleted';
export type LifecycleResult = {boardId:string;workspaceId:string;state:LifecycleState;cycle:number|null;generation:number;deletedAt:number|null;restoreBefore:number|null};
export type TrashRow = {boardId:string;workspaceId:string;state:'moving'|'restoring'|'purging';cycle:number;generation:number} |
  {boardId:string;workspaceId:string;state:'trashed';cycle:number;generation:number;title:string;deletedAt:number;restoreBefore:number};
export const restoreAllowed = (deadline:number,now=Date.now()) => now<deadline;
export const lifecycleTime = (at:number) => new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(at);
export const resumedLabel = (state:'moving'|'restoring'|'purging') => state==='moving'?'Moving to trash…':state==='restoring'?'Restoring…':'Deletion pending';
export const restoredNote = 'The same board and link are available again. Current comments and unexpired history are kept. Old mention notices do not return. Some older versions may have expired.';
export function lifecycleRequest(expectedCycle:number,requestId=crypto.randomUUID()) {
  if(!Number.isSafeInteger(expectedCycle)||expectedCycle<0)throw Error('Invalid lifecycle cycle');
  return Object.freeze({requestId,expectedCycle});
}
export function uniqueTrash(rows:TrashRow[]) { return [...new Map(rows.map(row=>[row.boardId,row])).values()]; }
