// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { Adapter } from "nextphase-board-sync/document-adapter.ts";
import { readBoard } from "nextphase-board-sync/codec.ts";
import { canonical, type BoardV10 } from "nextphase-board-rules/document.ts";
import { Copies } from "./copies.ts";
import { Access, closeCode } from "./access.ts";
import { backup, decodeBackup, replace } from "./backups.ts";
import { EditSession } from "./edit-session.ts";
import type { RoomEnvironment } from "./interfaces.ts";
import { base64, bytes, MESSAGE_LIMIT, rank, RoomError, send, type Attachment, type Connection, type Person } from "./protocol.ts";
import { loadDocument, newestSnapshot, snapshot } from "./snapshots.ts";
import { initialize, meta, setMeta } from "./storage.ts";
import { consumeTicket, issueTicket } from "./tickets.ts";
import { Presences, currentAttachment, endPresence } from "./presence.ts";

export class Room {
  boardId: string;
  env: RoomEnvironment;
  access: Access;
  edits: EditSession;
  presence: Presences;
  doc = new Y.Doc();
  board!: BoardV10;
  initialized = false;
  generation = 0;
  private copies?: Copies;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(boardId: string, env: RoomEnvironment) {
    this.boardId = boardId;
    this.env = env;
    initialize(env.storage);
    this.access = new Access(env.storage, env.access, env.connections);
    this.edits = new EditSession(env, this.access, this);
    this.presence = new Presences(env, boardId);
    if (env.rows && env.background) this.copies = new Copies(env.storage, env.rows, env.now,
      () => this.ordered(() => this.schedule()));
  }
  // Includes async work in the queue: a slow lookup can never overtake an edit
  // or an access change that arrived after it.
  ordered<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result;
  }
  async load() {
    this.closeLegacy();
    initialize(this.env.storage);
    if (this.initialized) return;
    const { storage, access } = this.env;
    if (!meta(storage, "storage_version")) {
      let details, page;
      try {
        details = await access.board(this.boardId);
        if (details) page = await access.changes(this.boardId, 0);
      } catch { /* Without a stored role an outage must not reveal a board. */ }
      if (!details || !page) throw new RoomError(404, "not_found");
      const adapter = new Adapter();
      const board: BoardV10 = { schemaVersion: 10, boardId: this.boardId, title: details.title, objects: [], retiredGenerations: [] };
      adapter.set(board);
      storage.transaction(() => {
        setMeta(storage, "storage_version", 2);
        storage.exec("INSERT INTO meta VALUES ('board_id', ?)", this.boardId);
        setMeta(storage, "last_edit_at", Date.parse(details.createdAt));
        setMeta(storage, "revision", 0);
        setMeta(storage, "watermark", page.latest);
        setMeta(storage, "restore_generation", 0);
        setMeta(storage, "restore_pending", 0);
        snapshot(storage, adapter.doc, board, 0);
      });
      adapter.destroy();
    }
    await this.creationTime();
    this.copies?.suspend();
    this.doc.destroy();
    this.doc = loadDocument(storage);
    this.board = readBoard(this.doc);
    this.initialized = true;
    try {
      this.generation = await this.env.fence();
      this.access.locked = this.generation > meta(storage, "restore_generation") || !!meta(storage, "restore_pending");
      if (this.access.locked) {
        this.closeAll(4423);
        storage.exec("DELETE FROM tickets");
        storage.exec("DELETE FROM waiting");
      }
    } catch { this.access.locked = true; return; }
    try { await this.access.replay(this.boardId, this.generation); } catch { /* Ordinary wakes use their stored copy. */ }
    this.saved();
  }
  private closeLegacy() {
    for (const peer of this.env.connections()) if (!currentAttachment(peer.attachment())) this.close(peer, 1012);
  }
  private close(connection: Connection, code: number) {
    if (code !== 1012) endPresence(connection, this.env.connections());
    this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", connection.attachment().connectionId);
    connection.close(code);
  }
  private closeAll(code: number) {
    const peers = this.env.connections();
    // All departures must reach every socket before any close starts.
    for (const peer of peers) endPresence(peer, peers);
    for (const peer of peers) this.close(peer, code);
  }
  private async creationTime() {
    if (this.env.storage.all("SELECT value FROM meta WHERE key = 'last_edit_at'").length) return;
    try {
      const details = await this.env.access.board(this.boardId);
      if (details) setMeta(this.env.storage, "last_edit_at", Date.parse(details.createdAt));
    } catch { /* A legacy room can still serve cached access during an outage. */ }
  }
  async refresh(strict = false) {
    await this.load();
    await this.creationTime();
    try { this.generation = await this.env.fence(); }
    catch { this.access.locked = true; if (strict) throw new RoomError(503, "room_locked"); return; }
    if (this.generation > meta(this.env.storage, "restore_generation") || meta(this.env.storage, "restore_pending")) {
      this.access.locked = true;
    }
    try { await this.access.replay(this.boardId, this.generation); }
    catch (error) { if (strict) throw error; /* A restore remains locked until replay succeeds. */ }
    this.saved();
  }
  ticket(person: Person) {
    return this.ordered(async () => {
      await this.refresh();
      await this.access.lookup(person.id, this.boardId);
      const result = await issueTicket(this.env, person);
      const openedAt = this.env.now();
      this.background(() => this.env.rows?.opened(person.id, this.boardId, openedAt) ?? Promise.resolve());
      await this.schedule();
      return result;
    });
  }
  private background(operation: () => Promise<void>) {
    if (!this.env.background) return;
    // The continuation runs after the current ordered operation has finished.
    const task = this.tail.then(operation).catch(() => {});
    try { this.env.background.run(task); } catch { /* Background failures never affect replies. */ }
  }
  saved(alarm = false) {
    if (this.access.locked || !this.copies || !this.env.storage.all("SELECT value FROM meta WHERE key = 'last_edit_at'").length) return;
    this.copies.offer({ boardId: this.boardId, title: this.board.title,
      editedAt: meta(this.env.storage, "last_edit_at"), generation: this.generation,
      revision: meta(this.env.storage, "revision") });
    this.background(() => this.copies!.start(alarm));
  }
  rename(person: Person, title: string) {
    return this.ordered(async () => {
      await this.refresh();
      const grant = await this.access.lookup(person.id, this.boardId);
      if (rank(grant.role) < rank("editor")) throw new RoomError(403, "role_too_low", "editor");
      if (this.board.title === title) return { id: this.boardId, title, revision: meta(this.env.storage, "revision") };
      const candidate = new Y.Doc();
      let update: Uint8Array;
      try {
        Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.doc));
        const vector = Y.encodeStateVector(candidate);
        candidate.getMap("board").set("title", title);
        update = Y.encodeStateAsUpdate(candidate, vector);
      } finally { candidate.destroy(); }
      let reply: Record<string, any> = {};
      const requestId = this.env.randomId();
      const attachment: Attachment = { ...person, role: grant.role, epoch: grant.epoch, connectionId: this.env.randomId() };
      const connection: Connection = { attachment: () => attachment, attach: () => {}, close: () => {},
        send: (text) => { reply = JSON.parse(text); } };
      const message = { requestId, epoch: grant.epoch, update: base64(update) };
      await this.edits.handle(connection, message, JSON.stringify(message));
      if (reply.kind !== "saved") throw new RoomError(reply.reason === "document_too_large" ? 413 : 409, reply.reason);
      await this.schedule();
      return { id: this.boardId, title, revision: reply.revision as number };
    });
  }
  join(ticket: string): Promise<Attachment> {
    return this.ordered(async () => {
      // Only ticket issuance creates a room. An upgrade with no stored ticket
      // never needs a board lookup, even for a never-opened board ID.
      if (!meta(this.env.storage, "storage_version")) throw new RoomError(401, "ticket_invalid");
      await this.load();
      const person = await consumeTicket(this.env, ticket);
      await this.refresh();
      const grant = await this.access.lookup(person.id, this.boardId);
      if (person.expiresAt <= this.env.now()) throw new RoomError(401, "ticket_invalid");
      const attachment = await this.presence.reserve(person, grant.role, grant.epoch);
      await this.schedule();
      return attachment;
    });
  }
  connected(connection: Connection) {
    return this.ordered(async () => {
      await this.load();
      const attachment = connection.attachment();
      if (!currentAttachment(attachment)) { this.close(connection, 1012); return; }
      if (!this.presence.open(connection)) return;
      await this.expire();
      if (attachment.expiresAt <= this.env.now()) return;
      const grant = this.access.get(attachment.id);
      if (!grant || attachment.epoch !== grant.epoch) { this.close(connection, closeCode(grant?.role ?? null, attachment.role)); return; }
      send(connection, { kind: "joined", role: grant.role, epoch: grant.epoch,
        restoreGeneration: meta(this.env.storage, "restore_generation"),
        revision: meta(this.env.storage, "revision"), update: base64(Y.encodeStateAsUpdate(this.doc)),
        self: connection.attachment().presence, present: this.presence.list(attachment.connectionId) });
      this.presence.relay(connection);
      await this.schedule();
    });
  }
  export(person: Person) {
    return this.ordered(async () => {
      await this.refresh();
      await this.access.lookup(person.id, this.boardId);
      return canonical(this.board);
    });
  }
  changed() {
    return this.ordered(async () => {
      // Delivery must not initialize a board that nobody has opened.
      if (!meta(this.env.storage, "storage_version")) {
        return (await this.env.access.changes(this.boardId, 0)).latest;
      }
      await this.refresh(true);
      if (this.access.locked) throw new RoomError(503, this.access.reason);
      return meta(this.env.storage, "watermark");
    });
  }
  message(connection: Connection, text: string) {
    return this.ordered(async () => {
      await this.load();
      if (!this.env.connections().some((peer) => peer.attachment().connectionId === connection.attachment().connectionId)) return;
      await this.expire();
      if (connection.attachment().expiresAt <= this.env.now()) return;
      if (this.access.locked) { this.close(connection, 4423); return; }
      if (bytes(text).length > MESSAGE_LIMIT) { send(connection, { kind: "refused", reason: "message_too_large" }); return; }
      let message;
      try { message = JSON.parse(text); } catch { send(connection, { kind: "refused", reason: "bad_message" }); return; }
      if (message?.kind === "renew" && typeof message.token === "string") {
        try {
          const person = await this.env.verify(message.token);
          if (connection.attachment().expiresAt <= this.env.now() || person.id !== connection.attachment().id || person.expiresAt <= this.env.now()) throw Error();
          connection.attach({ ...connection.attachment(), expiresAt: person.expiresAt });
          send(connection, { kind: "renewed", expiresAt: person.expiresAt });
        } catch { this.close(connection, 4401); }
        await this.schedule();
        return;
      }
      if (message?.kind === "presence") {
        await this.presence.receive(connection, message, bytes(text).length);
        await this.schedule();
        return;
      }
      if (message?.kind !== "edit" || typeof message.requestId !== "string" || !message.requestId.length ||
        [...message.requestId].length > 100 || !Number.isSafeInteger(message.epoch) || typeof message.update !== "string") {
        send(connection, { kind: "refused", reason: "bad_message" }); return;
      }
      await this.edits.handle(connection, message, text);
      await this.schedule();
    });
  }
  private async expire() {
    for (const connection of this.env.connections()) {
      if (connection.attachment().expiresAt <= this.env.now()) {
        this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", connection.attachment().connectionId);
        this.close(connection, 4401);
      } else if (this.env.storage.all("SELECT sequence FROM waiting WHERE connection_id = ? AND deadline <= ?",
        connection.attachment().connectionId, this.env.now()).length) this.edits.resync(connection, "waiting_timeout");
    }
    this.presence.expire();
    this.env.storage.exec("DELETE FROM tickets WHERE expires_at <= ?", this.env.now());
  }
  private async schedule() {
    const deadlines = this.env.connections().map((connection) => connection.attachment().expiresAt);
    deadlines.push(...this.presence.deadlines());
    for (const peer of this.env.connections()) if (peer.attachment().presence) deadlines.push(peer.attachment().presenceAt! + 30000);
    const waiting = this.env.storage.all("SELECT MIN(deadline) AS at FROM waiting")[0]?.at;
    if (waiting !== null && waiting !== undefined) deadlines.push(Number(waiting));
    const ticket = this.env.storage.all("SELECT MIN(expires_at) AS at FROM tickets")[0]?.at;
    if (ticket !== null && ticket !== undefined) deadlines.push(Number(ticket));
    if (meta(this.env.storage, "revision") > newestSnapshot(this.env.storage)) {
      deadlines.push(meta(this.env.storage, "last_edit_at") + 60000);
    }
    const copyAt = this.copies?.deadline();
    if (copyAt !== null && copyAt !== undefined) deadlines.push(copyAt);
    await this.env.schedule(deadlines.length ? Math.min(...deadlines) : null);
  }
  closed(connection: Connection) {
    return this.ordered(async () => {
      await this.load();
      endPresence(connection, this.env.connections());
      this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", connection.attachment().connectionId);
      if (!this.env.connections().length) this.env.storage.transaction(() => snapshot(this.env.storage, this.doc, this.board, meta(this.env.storage, "revision")));
      await this.schedule();
    });
  }
  alarm() {
    return this.ordered(async () => {
      await this.load();
      await this.expire();
      this.saved(true);
      const revision = meta(this.env.storage, "revision");
      if (revision > newestSnapshot(this.env.storage) && this.env.now() >= meta(this.env.storage, "last_edit_at") + 60000) {
        this.env.storage.transaction(() => snapshot(this.env.storage, this.doc, this.board, revision));
      }
      await this.schedule();
    });
  }
  backup() { return this.ordered(async () => { await this.load(); return backup(this.env, this.boardId); }); }
  restore(value: unknown) {
    return this.ordered(async () => {
      const envelope = decodeBackup(value, this.boardId);
      const generation = await this.env.raiseFence();
      this.copies?.suspend();
      this.closeAll(4423);
      replace(this.env, envelope);
      setMeta(this.env.storage, "restore_pending", 1);
      this.initialized = false;
      this.access.locked = true;
      return { boardId: this.boardId, restoreGeneration: generation, locked: true };
    });
  }
  lock() {
    return this.ordered(async () => {
      const generation = await this.env.raiseFence();
      this.copies?.suspend();
      this.closeAll(4423);
      this.env.storage.exec("DELETE FROM tickets");
      this.env.storage.exec("DELETE FROM waiting");
      setMeta(this.env.storage, "restore_pending", 1);
      this.access.locked = true;
      return generation;
    });
  }
}
