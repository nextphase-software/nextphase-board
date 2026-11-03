// SPDX-License-Identifier: Apache-2.0
export type BoardRole = "owner" | "editor" | "viewer";
export type Workspace = { id: string; name: string; role: BoardRole | "guest" };
export type BoardRow = {
  id: string; workspaceId: string; title: string; role: BoardRole;
  createdAt: string; editedAt: string; openedAt: string | null; workspaceName?: string;
};
export type Sort = "title" | "created" | "edited";
export type Order = "asc" | "desc";
export type HeldName = { title: string; replaced: Set<string>; heldAt: number };
export type HeldNames = Map<string, HeldName>;

export const roleWords = { owner: "Owner", editor: "Can edit", viewer: "Can view", guest: "Guest" };
export const sortWords = { title: "Alphabetical", created: "Date created", edited: "Last modified" };
export const canCreate = (role: Workspace["role"]) => role === "owner" || role === "editor";
export const canRename = (role: BoardRole) => role === "owner" || role === "editor";

export function joinPages(first: BoardRow[], next: BoardRow[]): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  for (const row of [...first, ...next]) rows.set(row.id, row);
  return [...rows.values()];
}

export function editedWords(time: string, now = Date.now()): string {
  const elapsed = now - Date.parse(time);
  if (!Number.isFinite(elapsed)) return "Edited time unavailable";
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  const hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  const ago = (value: number, unit: string) => `Edited ${value} ${unit}${value === 1 ? "" : "s"} ago`;
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return ago(minutes, "minute");
  if (hours < 24) return ago(hours, "hour");
  if (days < 2) return "Edited yesterday";
  if (days < 7) return ago(days, "day");
  if (days < 30) return ago(Math.floor(days / 7), "week");
  if (days < 60) return "Edited last month";
  if (days < 365) return ago(Math.floor(days / 30), "month");
  return ago(Math.floor(days / 365), "year");
}

export function holdName(names: HeldNames, id: string, title: string, replaced: Iterable<string>, now = Date.now()) {
  const older = names.get(id);
  names.set(id, { title, heldAt: now,
    replaced: new Set([...replaced, ...(older ? [older.title, ...older.replaced] : [])]) });
}

export function applyHeldNames(rows: BoardRow[], names: HeldNames, now = Date.now()): BoardRow[] {
  return rows.map((row) => {
    const held = names.get(row.id);
    if (!held) return row;
    if (now - held.heldAt >= 120000 || row.title === held.title || !held.replaced.has(row.title)) {
      names.delete(row.id);
      return row;
    }
    return { ...row, title: held.title };
  });
}

export function placeMenu(point: { x: number; y: number }, size: { width: number; height: number },
  windowSize: { width: number; height: number }) {
  return {
    left: Math.max(4, Math.min(point.x, windowSize.width - size.width - 8)),
    top: Math.max(4, Math.min(point.y, windowSize.height - size.height - 8)),
  };
}
