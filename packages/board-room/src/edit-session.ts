// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import type { Access } from "./access.ts";
import type { RoomEnvironment } from "./interfaces.ts";
import { evaluate } from "./edits.ts";
import { snapshot } from "./snapshots.ts";
import { meta, setMeta } from "./storage.ts";
import { base64, bytes, send, unbase64, type Connection } from "./protocol.ts";
type Edit = { requestId: string; epoch: number; update: string };
type LiveBoard = { doc: Y.Doc; board: BoardV10; saved(): void };

// Called only inside the room's queue. This module owns edit authorization,
// receipts and waiting edits; the room owns lifecycle and transport framing.
export class EditSession {
  env: RoomEnvironment;
  access: Access;
  host: LiveBoard;
  constructor(env: RoomEnvironment, access: Access, host: LiveBoard) {
    this.env = env; this.access = access; this.host = host;
  }
  async handle(connection: Connection, message: Edit, text: string) {
    const grant = this.access.get(connection.attachment().id);
    const refuse = (reason: string, needed?: string) => send(connection, {
      kind: "refused", requestId: message.requestId, reason, ...(needed ? { needed } : {}),
    });
    if (grant?.role === "viewer") { refuse("role_too_low", "editor"); return; }
    if (!grant || grant.epoch !== message.epoch || grant.epoch !== connection.attachment().epoch) { refuse("epoch_changed"); return; }
    let update: Uint8Array;
    try { update = unbase64(message.update); } catch { refuse("invalid_update"); return; }
    const digest = await this.env.hash(update);
    const receipt = this.env.storage.all("SELECT * FROM receipts WHERE person_id = ? AND request_id = ?", connection.attachment().id, message.requestId)[0];
    if (receipt) {
      if (receipt.digest !== digest) refuse("request_id_reused");
      else send(connection, { kind: "saved", requestId: message.requestId, revision: Number(receipt.revision) });
      return;
    }
    const samePerson = new Set(this.env.connections()
      .filter((peer) => peer.attachment().id === connection.attachment().id)
      .map((peer) => peer.attachment().connectionId));
    const pending = this.env.storage.all("SELECT * FROM waiting WHERE request_id = ?", message.requestId)
      .find((row) => samePerson.has(String(row.connection_id)));
    if (pending) {
      if (await this.env.hash(pending.update as Uint8Array) !== digest) refuse("request_id_reused");
      else send(connection, { kind: "received", requestId: message.requestId });
      return;
    }
    const result = await this.save(connection, message.requestId, update, digest);
    if (result === "waiting") {
      const id = connection.attachment().connectionId;
      const waiting = this.env.storage.all("SELECT * FROM waiting WHERE connection_id = ? ORDER BY sequence", id);
      const size = bytes(text).length;
      if (waiting.length >= 64) this.resync(connection, "waiting_count");
      else if (waiting.reduce((n, row) => n + Number(row.message_bytes), size) > 4194304) this.resync(connection, "waiting_bytes");
      else {
        const sequence = Number(this.env.storage.all("SELECT MAX(sequence) AS n FROM waiting")[0]?.n ?? 0) + 1;
        this.env.storage.exec("INSERT INTO waiting VALUES (?, ?, ?, ?, ?, ?, ?)", id, sequence, size,
          this.env.now(), this.env.now() + 30000, message.requestId, update);
        send(connection, { kind: "received", requestId: message.requestId });
      }
    } else if (result === "saved") await this.retryWaiting();
  }
  private async save(connection: Connection, requestId: string, update: Uint8Array, digest: string) {
    const result = evaluate(this.host.doc, this.host.board, update, this.env.storage);
    if (result.kind === "waiting") return "waiting";
    if (result.kind === "refused") { send(connection, { kind: "refused", requestId, reason: result.reason }); return "refused"; }
    const revision = meta(this.env.storage, "revision") + 1;
    try {
      this.env.storage.transaction(() => {
        this.env.storage.exec('INSERT INTO edits VALUES (?, ?, ?, ?)', revision, connection.attachment().id, requestId, update);
        this.env.storage.exec('INSERT INTO receipts VALUES (?, ?, ?, ?)', connection.attachment().id, requestId, digest, revision);
        setMeta(this.env.storage, "revision", revision);
        setMeta(this.env.storage, "last_edit_at", this.env.now());
        for (const object of result.board.objects) this.env.storage.exec(
          "INSERT OR IGNORE INTO identifiers VALUES (?, ?, ?)", object.id, object.generation, revision);
        if (revision % 100 === 0) snapshot(this.env.storage, result.doc, result.board, revision);
      });
    } catch (error) { result.doc.destroy(); throw error; }
    this.host.doc.destroy();
    this.host.doc = result.doc;
    this.host.board = result.board;
    send(connection, { kind: "saved", requestId, revision });
    for (const other of this.env.connections()) if (other.attachment().connectionId !== connection.attachment().connectionId) {
      send(other, { kind: "update", revision, update: base64(update) });
    }
    this.host.saved();
    return "saved";
  }
  private async retryWaiting() {
    let progress = true;
    while (progress) {
      progress = false;
      for (const row of this.env.storage.all("SELECT * FROM waiting ORDER BY sequence")) {
        const connection = this.env.connections().find((item) => item.attachment().connectionId === row.connection_id);
        if (!connection) { this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", row.connection_id); continue; }
        if (connection.attachment().expiresAt <= this.env.now()) {
          this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", row.connection_id);
          connection.close(4401);
          continue;
        }
        if (Number(row.deadline) <= this.env.now()) { this.resync(connection, "waiting_timeout"); continue; }
        const update = row.update as Uint8Array;
        const result = await this.save(connection, String(row.request_id), update, await this.env.hash(update));
        if (result !== "waiting") {
          this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ? AND sequence = ?", row.connection_id, row.sequence);
          progress ||= result === "saved";
        }
      }
    }
  }
  resync(connection: Connection, reason: string) {
    this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", connection.attachment().connectionId);
    send(connection, { kind: "resync", reason, stateVector: base64(Y.encodeStateVector(this.host.doc)) });
  }
}
