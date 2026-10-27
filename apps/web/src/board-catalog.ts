// SPDX-License-Identifier: Apache-2.0
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const LIST_KEY = "board-list/v1";
export type BoardKey = string;
export type BoardEntry = {
  key: BoardKey; boardId: string | null; title: string; savedAt: number | null;
  fromFile: boolean; head: string | null; state: "valid" | "damaged" | "newer";
};
export function isBoardKey(key: unknown): key is BoardKey {
  return typeof key === "string" && (key === "original" || uuid.test(key));
}
export function boardKeys(key: BoardKey) {
  if (!isBoardKey(key)) throw Error("Invalid board key");
  return key === "original"
    ? { head: "head", previous: "previous", lock: "nextphase-board/writer/v1" }
    : { head: `board/${key}/head`, previous: `board/${key}/previous`, lock: `nextphase-board/writer/v1/${key}` };
}
export function recordBoardKey(key: unknown): BoardKey | null {
  if (key === "head" || key === "previous") return "original";
  if (typeof key !== "string") return null;
  const match = /^board\/(.+)\/(head|previous)$/.exec(key);
  return match && uuid.test(match[1]) ? match[1] : null;
}
export function fingerprint(raw: unknown): string | null {
  try {
    const e = typeof raw === "string" ? JSON.parse(raw) : null;
    return e && Number.isSafeInteger(e.storageRevision) && typeof e.sha256 === "string"
      ? `${e.storageRevision}:${e.sha256}` : null;
  } catch { return null; }
}
export function entryDefaults(key: BoardKey): BoardEntry {
  return { key, boardId: null, title: "", savedAt: null, fromFile: false, head: null, state: "damaged" };
}
export function serializeList(boards: readonly BoardEntry[]) {
  return JSON.stringify({ formatVersion: 1, boards: [...boards].sort((a, b) => compareKeys(a.key, b.key)).map((e) => ({
    key: e.key, boardId: e.boardId, title: e.title, savedAt: e.savedAt,
    fromFile: e.fromFile, head: e.head, state: e.state,
  })) });
}
export function parseList(raw: unknown): BoardEntry[] {
  try {
    if (typeof raw !== "string") return [];
    const value = JSON.parse(raw), seen = new Set<string>();
    if (value?.formatVersion !== 1 || !Array.isArray(value.boards)) return [];
    for (const e of value.boards) {
      if (!e || !isBoardKey(e.key) || seen.has(e.key) ||
        !(e.boardId === null || typeof e.boardId === "string" && uuid.test(e.boardId)) ||
        typeof e.title !== "string" || !(e.savedAt === null || Number.isSafeInteger(e.savedAt) && e.savedAt >= 0) ||
        typeof e.fromFile !== "boolean" || !(e.head === null || typeof e.head === "string") ||
        !["valid", "damaged", "newer"].includes(e.state)) return [];
      seen.add(e.key);
    }
    return serializeList(value.boards) === raw ? value.boards : [];
  } catch { return []; }
}
const compareKeys = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function orderedBoards(boards: readonly BoardEntry[]) {
  return [...boards].sort((a, b) => (b.savedAt ?? -1) - (a.savedAt ?? -1) || compareKeys(a.key, b.key));
}
export function savedTime(time: number | null, now = new Date()): string | null {
  if (time === null) return null;
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return null;
  const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (date <= now) {
    if (date.toDateString() === now.toDateString()) return `today ${clock}`;
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `yesterday ${clock}`;
  }
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
  return `${date.getDate()} ${month}${date > now || date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ""} ${clock}`;
}
export function boardStatus(entry: BoardEntry, current: boolean, anotherTab: boolean, readOnly: boolean, now = new Date()) {
  const time = savedTime(entry.savedAt, now);
  const parts = [current ? "open here" : "", anotherTab && (!current || readOnly) ? "open in another tab" : "",
    entry.state === "valid" ? time ? `saved ${time}` : "saved time unavailable"
      : `${current ? "" : "can't be opened: "}${entry.state === "damaged" ? "damaged" : "made by a newer version of Board"}`,
    entry.state === "valid" && entry.fromFile ? "from file" : ""].filter(Boolean).join(" · ");
  return parts[0].toUpperCase() + parts.slice(1);
}
