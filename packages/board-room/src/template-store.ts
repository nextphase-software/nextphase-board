// SPDX-License-Identifier: Apache-2.0
import { assetEntries, held, readAsset, writeAsset, UPLOAD_IDLE, PICTURE_BYTES, type AssetEntry, type AssetType } from "./pictures.ts";
import { RoomError, type Person } from "./protocol.ts";
import { setMeta, type Storage } from "./storage.ts";
import type { RoomEnvironment } from "./interfaces.ts";

export type Lease = { token: string; until: number };
export type Staging = { workspace: string; person: string; assets: AssetEntry[]; touched: number; lease: Lease | null };
export const STAGING_LEASE = 600_000;
export const stagingDeadline = (staging: Staging, claim?: Lease | null) =>
  Math.max(staging.touched + UPLOAD_IDLE, staging.lease?.until ?? 0, claim?.until ?? 0);
export class StagingExpired extends RoomError {
  readonly discard: boolean;
  constructor(discard = false) { super(410, "upload_expired"); this.discard = discard; }
}
export function stagingEntry(staging: Staging, hash: string, type?: AssetType, bytes?: number) {
  const entry = staging.assets.find(asset => asset.hash === hash);
  if (!entry || type !== undefined && type !== entry.type || bytes !== undefined && bytes !== entry.bytes) {
    throw new RoomError(400, "bad_request");
  }
}
export function stagingOwner(staging: Staging, person: Person, workspace: string) {
  if (staging.workspace !== workspace) throw new StagingExpired();
  if (staging.person !== person.id) throw new RoomError(403, "role_too_low", "editor");
}
export function stagingMeta<T>(storage: Storage, key: string): T | undefined {
  let value;
  try { value = storage.all("SELECT value FROM meta WHERE key = ?", key)[0]?.value; }
  catch (error) {
    if (error instanceof Error && error.message.includes("no such table: meta")) return undefined;
    throw error;
  }
  return typeof value === "string" ? JSON.parse(value) : undefined;
}

type Store = Staging & { state: "staging" | "committed" };
type StoreEnvironment = Pick<RoomEnvironment, "storage" | "now" | "schedule" | "randomId">;
export class TemplateStore {
  private tail: Promise<unknown> = Promise.resolve();
  private erased = false;
  private readonly env: StoreEnvironment;
  constructor(env: StoreEnvironment) {
    this.env = env;
    env.storage.transaction(() => {
      env.storage.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)");
      env.storage.exec("CREATE TABLE IF NOT EXISTS pictures (hash TEXT PRIMARY KEY, type TEXT NOT NULL, bytes INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, parts INTEGER NOT NULL, uploaded_at INTEGER NOT NULL, captured_ordinal INTEGER)");
      env.storage.exec("CREATE TABLE IF NOT EXISTS picture_parts (hash TEXT NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY(hash, part))");
    });
  }
  private ordered<T>(operation: () => Promise<T>) {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result;
  }
  private get() { return stagingMeta<Store>(this.env.storage, "store"); }
  private async update(store: Store) {
    store.touched = this.env.now();
    setMeta(this.env.storage, "store", JSON.stringify(store));
    await this.env.schedule(store.state === "staging" ? stagingDeadline(store) : null);
  }
  private async admission(person: Person, workspace: string) {
    const store = this.get();
    if (!store || this.erased) { this.erased = true; throw new StagingExpired(true); }
    if (store.state !== "staging") throw new StagingExpired();
    const deadline = stagingDeadline(store);
    if (deadline <= this.env.now()) {
      await this.env.schedule(deadline);
      throw new StagingExpired();
    }
    stagingOwner(store, person, workspace);
    return store;
  }
  reopen() {
    return this.ordered(async () => {
      const store = this.get();
      if (store?.state === "staging") await this.env.schedule(stagingDeadline(store));
    });
  }
  open(person: Person, workspace: string, assets: AssetEntry[]) {
    return this.ordered(async () => {
      if (this.get() || this.erased) throw new RoomError(409, "room_exists");
      if (assets.reduce((sum, asset) => sum + asset.bytes, 0) > PICTURE_BYTES) throw new RoomError(413, "template_too_large");
      await this.update({ person: person.id, workspace, assets, touched: this.env.now(), lease: null, state: "staging" });
    });
  }
  begin(person: Person, workspace: string, hash: string) {
    return this.ordered(async () => {
      const store = await this.admission(person, workspace);
      if (store.lease) throw new RoomError(409, "upload_in_progress");
      stagingEntry(store, hash);
      const token = this.env.randomId();
      store.lease = { token, until: this.env.now() + STAGING_LEASE };
      await this.update(store);
      return token;
    });
  }
  end(person: Person, workspace: string, token: string) {
    return this.ordered(async () => {
      const store = await this.admission(person, workspace);
      if (store.lease?.token === token) {
        store.lease = null;
        await this.update(store);
      }
    });
  }
  stage(person: Person, workspace: string, token: string, hash: string, type: AssetType, bytes: Uint8Array, width: number, height: number) {
    return this.ordered(async () => {
      const store = await this.admission(person, workspace);
      if (!store.lease || store.lease.token !== token) throw new RoomError(409, "upload_in_progress");
      const { storage } = this.env;
      try {
        stagingEntry(store, hash, type, bytes.length);
        return storage.transaction(() => {
          if (held(storage, hash)) return "exists" as const;
          writeAsset(storage, this.env.now(), hash, bytes, type, width, height);
          return "created" as const;
        });
      } finally {
        store.lease = null;
        await this.update(store);
      }
    });
  }
  commit(person: Person, workspace: string) {
    return this.ordered(async () => {
      const store = await this.admission(person, workspace);
      if (store.lease) throw new RoomError(409, "upload_in_progress");
      const inventory = this.assets();
      await this.update({ ...store, state: "committed" });
      return inventory;
    });
  }
  private assets() {
    const { storage } = this.env;
    return assetEntries(storage, storage.all("SELECT hash FROM pictures ORDER BY hash").map(row => String(row.hash)));
  }
  inventory() {
    return this.ordered(async () => {
      if (this.erased || !this.get()) { this.erased = true; return { discard: true as const }; }
      return this.assets();
    });
  }
  read(hash: string) {
    return this.ordered(async () => !this.erased && this.get()?.state === "committed" ? readAsset(this.env.storage, hash) : null);
  }
  alarm() {
    return this.ordered(async () => {
      const store = this.get();
      if (store?.state !== "staging") return;
      const deadline = stagingDeadline(store);
      if (deadline <= this.env.now()) return this.erase();
      await this.env.schedule(deadline);
    });
  }
  private async erase() {
    this.erased = true;
    await this.env.schedule(null);
    return { discard: true as const };
  }
  discard() { return this.ordered(() => this.erase()); }
}
