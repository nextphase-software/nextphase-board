// SPDX-License-Identifier: Apache-2.0
import type { AccessSource } from "./interfaces.ts";
import { rank, RoomError, type Connection, type Role } from "./protocol.ts";
import { meta, setMeta, type Storage } from "./storage.ts";
export type Grant = { role: Role; epoch: number; changeNumber: number };
export class Access {
  storage: Storage;
  source: AccessSource;
  connections: () => Connection[];
  locked = false;
  reason = "room_locked";
  constructor(storage: Storage, source: AccessSource, connections: () => Connection[]) {
    this.storage = storage;
    this.source = source;
    this.connections = connections;
  }
  get(person: string): Grant | null {
    const row = this.storage.all("SELECT * FROM grants WHERE person_id = ?", person)[0];
    return row ? { role: row.role as Role, epoch: Number(row.epoch), changeNumber: Number(row.change_number) } : null;
  }
  apply(person: string, role: Role | null, number: number) {
    const old = this.get(person);
    if (old && number <= old.changeNumber) return;
    const changed = old && old.role !== role;
    if (role) this.storage.exec("INSERT INTO grants VALUES (?, ?, ?, ?) ON CONFLICT(person_id) DO UPDATE SET role=excluded.role, epoch=excluded.epoch, change_number=excluded.change_number",
      person, role, (old?.epoch ?? 0) + (changed ? 1 : 0), number);
    else this.storage.exec("DELETE FROM grants WHERE person_id = ?", person);
  }
  async replay(board: string, generation: number) {
    const watermark = meta(this.storage, "watermark");
    const page = await this.source.changes(board, watermark);
    if (page.lowestKept > watermark + 1) {
      this.locked = true;
      this.reason = "access_log_pruned";
      return;
    }
    const updates: { person: string; role: Role | null; number: number; old: Grant | null }[] = [];
    for (const change of page.changes) {
      const old = this.get(change.personId);
      if (old && change.number > old.changeNumber) updates.push({
        person: change.personId, number: change.number, old,
        role: await this.source.role(change.personId, board),
      });
    }
    this.storage.transaction(() => {
      for (const update of updates) this.apply(update.person, update.role, update.number);
      setMeta(this.storage, "watermark", page.latest);
      setMeta(this.storage, "restore_generation", generation);
      setMeta(this.storage, "restore_pending", 0);
    });
    for (const update of updates) {
      if (update.old?.role === update.role) continue;
      const code = rank(update.role) > rank(update.old?.role ?? null) ? 4409 : 4403;
      for (const connection of this.connections()) if (connection.attachment().id === update.person) connection.close(code);
    }
    this.locked = false;
    this.reason = "room_locked";
  }
  async lookup(person: string, board: string): Promise<Grant> {
    const stored = this.get(person);
    if (this.locked) throw new RoomError(stored ? 503 : 404, stored ? this.reason : "not_found");
    if (stored) return stored;
    try {
      // A database write may commit while a role lookup is in flight. Confirm
      // that no newer change for this person arrived before keeping its result.
      for (;;) {
        const baseline = await this.source.changes(board, meta(this.storage, "watermark"));
        const role = await this.source.role(person, board);
        const after = await this.source.changes(board, baseline.latest);
        if (after.changes.some((change) => change.personId === person)) continue;
        if (!role) break;
        this.apply(person, role, after.latest);
        return this.get(person)!;
      }
    } catch { /* No role is cached when its lookup could not be confirmed. */ }
    throw new RoomError(404, "not_found");
  }
}
