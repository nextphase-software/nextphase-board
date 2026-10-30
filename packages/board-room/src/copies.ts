// SPDX-License-Identifier: Apache-2.0
import type { BoardRows, SavedBoard } from "./interfaces.ts";
import type { Storage } from "./storage.ts";
export type Copied = SavedBoard & { timeCopiedAt: number };
export const COPY_INTERVAL = 60000;

export function copyDecision(saved: SavedBoard, copied: Copied | undefined, now: number) {
  const restored = !copied || saved.generation !== copied.generation;
  const pendingTime = restored || saved.editedAt !== copied.editedAt;
  const copyTime = pendingTime && (restored || now >= copied.timeCopiedAt + COPY_INTERVAL);
  return {
    needed: copyTime || saved.title !== copied?.title,
    editedAt: copyTime ? saved.editedAt : null,
    deadline: pendingTime && !copyTime ? copied!.timeCopiedAt + COPY_INTERVAL : null,
  };
}

// The room offers saved states; only the background runner calls start().
// A single flight folds intervening saves into the next decision.
export class Copies {
  private saved?: SavedBoard;
  private inFlight = false;
  private retryAt: number | null = null;
  private epoch = 0;
  private storage: Storage;
  private rows: BoardRows;
  private now: () => number;
  private settled: () => Promise<void>;
  constructor(storage: Storage, rows: BoardRows, now: () => number, settled: () => Promise<void>) {
    this.storage = storage;
    this.rows = rows;
    this.now = now;
    this.settled = settled;
  }
  offer(saved: SavedBoard) { this.saved = { ...saved, title: saved.title.replace(/\u0000/g, "\ufffd") }; }
  suspend() { this.epoch++; this.saved = undefined; this.retryAt = null; }
  checkpoint(): Copied | undefined {
    const value = this.storage.all("SELECT value FROM meta WHERE key = 'copied'")[0]?.value;
    return value ? JSON.parse(String(value)) as Copied : undefined;
  }
  deadline(): number | null {
    if (this.inFlight || !this.saved) return null;
    const at = this.retryAt ?? copyDecision(this.saved, this.checkpoint(), this.now()).deadline;
    return at === null ? null : Math.max(this.now() + 1, at);
  }
  async start(respectRetry = false) {
    if (this.inFlight || !this.saved || respectRetry && this.retryAt !== null && this.now() < this.retryAt) return;
    this.inFlight = true;
    try {
      for (;;) {
        const saved = this.saved;
        if (!saved) break;
        const copied = this.checkpoint();
        const decision = copyDecision(saved, copied, this.now());
        if (!decision.needed) break;
        const epoch = this.epoch, dispatchedAt = this.now();
        try {
          await this.rows.copy({ ...saved, editedAt: decision.editedAt });
          if (epoch !== this.epoch) continue;
          const checkpoint: Copied = { ...saved,
            editedAt: decision.editedAt ?? copied!.editedAt,
            timeCopiedAt: decision.editedAt === null ? copied!.timeCopiedAt : dispatchedAt };
          this.storage.exec("INSERT INTO meta(key, value) VALUES ('copied', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            JSON.stringify(checkpoint));
          this.retryAt = null;
        } catch {
          this.retryAt = this.now() + COPY_INTERVAL;
          break;
        }
      }
    } finally {
      this.inFlight = false;
      await this.settled();
    }
  }
}
