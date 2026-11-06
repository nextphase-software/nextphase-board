// SPDX-License-Identifier: Apache-2.0
export const HISTORY_AGE = 2592000000;
export const HISTORY_INTERVAL = 1800000;
export const HISTORY_LIMIT = 50;
export const HISTORY_CHUNK = 1048576;
export const HISTORY_DOCUMENT_LIMIT = 2097152;
export const historyReasons = ['initial', 'checkpoint', 'last_close', 'manual', 'before_restore', 'restored'] as const;
export type HistoryReason = typeof historyReasons[number];
export type Version = { id: string; ordinal: number; capturedAt: number; revision: number; generation: number;
  reason: HistoryReason; name: string; description: string; actor: string | null; namedBy: string | null; sourceName: string };
export type Head = { revision: number; generation: number };
export type SaveVersion = { requestId: string; name: string; description: string };
export type RestoreVersion = { requestId: string; expectedRevision: number; expectedGeneration: number };
export type RestoreResult = { requestId: string; revision: number; generation: number; beforeVersionId: string; restoredVersionId: string };
export const historyId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
export const historyInteger = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export const wellFormed = (v: string) => ![...v].some(c => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff);
export function metadataValid(v: unknown, limit: number): v is string {
  return typeof v === 'string' && wellFormed(v) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(v) && [...v].length <= limit;
}
export const retained = (v: Version, now: number) => now < v.capturedAt + HISTORY_AGE;
export function versionHeading(v: Version): string {
  if (v.name) return v.name;
  return v.reason === 'initial' ? 'Initial version' : v.reason === 'manual' ? 'Manual version'
    : v.reason === 'before_restore' ? 'Before restore' : v.reason === 'restored' ? `Restored from ${v.sourceName}` : 'Automatic version';
}
export function versionSubtitle(v: Version): string {
  if (v.name && v.namedBy) return `Named by ${v.namedBy} · Automatic checkpoint`;
  if (v.reason === 'initial') return 'Initial capture';
  if (v.reason === 'manual') return v.actor === null ? '' : `Saved by ${v.actor}`;
  if (v.reason === 'before_restore') return 'Replaced state · Automatic checkpoint';
  if (v.reason === 'restored') return `${v.actor === null ? '' : `Restored by ${v.actor} · `}Current version`;
  return v.reason === 'last_close' ? 'Last collaborator left' : 'Checkpoint';
}
export const confirmationAuthor = (v: Version) => v.namedBy ?? v.actor;

export function versionValid(value: unknown): value is Version {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Version;
  if (Object.keys(v).sort().join() !== ['id','ordinal','capturedAt','revision','generation','reason','name','description','actor','namedBy','sourceName'].sort().join()) return false;
  const label = (a: unknown) => a === null || typeof a === 'string' && a.length > 0 && wellFormed(a) && new TextEncoder().encode(a).length <= 256;
  return historyId(v.id) && historyInteger(v.ordinal) && v.ordinal > 0 && historyInteger(v.capturedAt) &&
    historyInteger(v.revision) && historyInteger(v.generation) && historyReasons.includes(v.reason) && metadataValid(v.name,100) && metadataValid(v.description,500) &&
    label(v.actor) && label(v.namedBy) && typeof v.sourceName === 'string' && wellFormed(v.sourceName);
}
