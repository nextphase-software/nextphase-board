// SPDX-License-Identifier: Apache-2.0
export const TIMER_LIMIT = 1024;
export const TIMER_MAX = 5999000;
export const TIMER_ZERO = 2500;
export const timerInteger = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
export const timerUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
export const timerRecord = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const timerKeys = (v: Record<string, any>, keys: string[]) => Object.keys(v).sort().join() === [...keys].sort().join();
export type TimerSnapshot = { status: 'idle'|'running'|'paused'; durationMs: number; endsAtServerMs: number|null; remainingMs: number|null; version: number; timerId: string|null };
export type TimerAction = 'start'|'pause'|'resume'|'extend'|'end';
export type TimerCause = TimerAction|'expire'|'reset';
export const timerCauses: TimerCause[] = ['start','pause','resume','extend','end','expire','reset'];
export const timerReasons = ['timer_bad_message','timer_message_too_large','timer_rate_limited','timer_stale','timer_state','timer_bounds','timer_unavailable','timer_access_changed'] as const;
export type TimerReason = typeof timerReasons[number];
export type TimerCommand = { kind: 'timer_command'; requestId: string; epoch: number; restoreGeneration: number; timerId: string|null; expectedVersion: number; action: TimerAction; durationMs?: number };
export type TimerRead = { kind: 'timer_read'; requestId: string; epoch: number; restoreGeneration: number };
type Stamped = { timer: TimerSnapshot; serverNowMs: number; restoreGeneration: number };
export type TimerFrame = Stamped & ({ kind: 'timer_result'; requestId: string; cause: TimerCause } | { kind: 'timer_state'; cause: TimerCause } | { kind: 'timer_sample'; requestId: string }) |
  ({ kind: 'timer_refused'; requestId: string|null; reason: TimerReason } & Partial<Stamped>);
export function idleTimer(version = 0): TimerSnapshot { return { status:'idle', durationMs:0, endsAtServerMs:null, remainingMs:null, version, timerId:null }; }
export function timerSnapshot(v: unknown): v is TimerSnapshot {
  if (!timerRecord(v) || !timerKeys(v,['status','durationMs','endsAtServerMs','remainingMs','version','timerId']) || !timerInteger(v.version) || !timerInteger(v.durationMs)) return false;
  if (v.status === 'idle') return v.durationMs === 0 && v.endsAtServerMs === null && v.remainingMs === null && v.timerId === null;
  if (!v.durationMs || !timerUuid(v.timerId)) return false;
  return v.status === 'running' ? timerInteger(v.endsAtServerMs) && v.remainingMs === null :
    v.status === 'paused' && v.endsAtServerMs === null && timerInteger(v.remainingMs) && v.remainingMs >= 1 && v.remainingMs <= TIMER_MAX;
}
export function checkTimerRequest(v: unknown, size: number): TimerCommand|TimerRead|TimerReason {
  if (size > TIMER_LIMIT) return 'timer_message_too_large';
  if (!timerRecord(v) || !timerUuid(v.requestId) || !timerInteger(v.epoch) || !timerInteger(v.restoreGeneration)) return 'timer_bad_message';
  const common = ['kind','requestId','epoch','restoreGeneration'];
  if (v.kind === 'timer_read') return timerKeys(v, common) ? v as TimerRead : 'timer_bad_message';
  if (v.kind !== 'timer_command' || !timerCauses.slice(0,5).includes(v.action) || !timerInteger(v.expectedVersion) || v.timerId !== null && !timerUuid(v.timerId) ||
    !timerKeys(v,[...common,'timerId','expectedVersion','action',...(v.action === 'start' ? ['durationMs'] : [])])) return 'timer_bad_message';
  if (v.action === 'start' && typeof v.durationMs !== 'number') return 'timer_bad_message';
  if (v.action === 'start' && (!timerInteger(v.durationMs) || v.durationMs < 1000 || v.durationMs > TIMER_MAX || v.durationMs % 1000)) return 'timer_bounds';
  return v as TimerCommand;
}
export function checkTimerFrame(v: unknown, size: number): v is TimerFrame {
  if (size > TIMER_LIMIT || !timerRecord(v)) return false;
  const stamped = ['timer','serverNowMs','restoreGeneration'];
  const validStamp = () => timerSnapshot(v.timer) && timerInteger(v.serverNowMs) && timerInteger(v.restoreGeneration);
  if (v.kind === 'timer_refused') return (v.requestId === null || timerUuid(v.requestId)) && timerReasons.includes(v.reason) &&
    (timerKeys(v,['kind','requestId','reason']) || timerKeys(v,['kind','requestId','reason',...stamped]) && validStamp());
  if (!validStamp()) return false;
  if (v.kind === 'timer_sample') return timerUuid(v.requestId) && timerKeys(v,['kind','requestId',...stamped]);
  if (v.kind !== 'timer_state' && v.kind !== 'timer_result' || !timerCauses.includes(v.cause)) return false;
  return timerKeys(v,['kind',...stamped,'cause',...(v.kind === 'timer_result' ? ['requestId'] : [])]) && (v.kind === 'timer_state' || timerUuid(v.requestId));
}
// Capped windows are carried with the socket, never a growing journal.
export function timerBudget(previous: unknown, now: number): number[]|null {
  if (!timerInteger(now) || previous !== undefined && (!Array.isArray(previous) || previous.length > 5 || previous.some(t => !timerInteger(t) || t > now))) return null;
  const times = ((previous ?? []) as number[]).filter(t => t > now - 1000);
  if (times.length >= 5) return null;
  return [...times,now];
}
