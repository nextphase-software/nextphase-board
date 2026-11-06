// SPDX-License-Identifier: Apache-2.0
export * from 'nextphase-board-sync/history.ts';
export function historyTime(at: number) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(at);
}
export function historyTool(preview: boolean, handoff: boolean, current: string) { return preview || handoff ? 'Pan' : current; }
