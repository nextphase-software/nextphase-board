// SPDX-License-Identifier: Apache-2.0
import { Reactions } from "./reactions.ts";
import { Spotlight } from "./spotlight.ts";
import { WorkshopVoting, resetVoting } from "./voting.ts";
import { WorkshopTimer, resetTimer, markExplicitRecovery } from "./timer.ts";
import { RoomLifecycle, type Lifecycle, type LifecycleRequest } from "./lifecycle.ts";
import * as Y from "yjs";
import { Adapter, convertPages } from "nextphase-board-sync/document-adapter.ts";
import { readBoard } from "nextphase-board-sync/codec.ts";
import { canonical, upgrade, validate, type BoardV13, type BoardV14 } from "nextphase-board-rules/document.ts";
import { History, validateHistoryBackup } from "./history.ts";
import { HISTORY_INTERVAL } from "nextphase-board-sync/history.ts";
import { Copies } from "./copies.ts";
import { Access, closeCode } from "./access.ts";
import { backup, decodeBackup, replace } from "./backups.ts";
import { Comments, commentRow, storedAnchor } from "./comments.ts";
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
  reactions: Reactions;
  comments: Comments;
  history: History;
  lifecycle: RoomLifecycle;
  timer: WorkshopTimer;
  voting: WorkshopVoting;
  spotlight: Spotlight;
  doc = new Y.Doc();
  board!: BoardV14;
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
    this.presence = new Presences(env, boardId, () => this.voting.running());
    this.history = new History(this);
    this.lifecycle = new RoomLifecycle(this);
    this.timer = new WorkshopTimer(this);
    this.voting = new WorkshopVoting(this);
    this.spotlight = new Spotlight(this);
    this.reactions = new Reactions(this);
    this.access.closing=(c,code)=>this.spotlight.closed(c,code);
    this.presence.gate=(c,accepted)=>this.spotlight.spatial(c,accepted);
    this.presence.recipient=(from,to)=>this.spotlight.relayTo(from,to);
    this.presence.expired=c=>this.spotlight.expired(c);
    this.presence.visible=id=>this.spotlight.visible(id);
    this.presence.currentPage=id=>this.board?.pages.some(p=>p.id===id) ?? false;
    this.presence.firstPage=()=>this.board.pages[0].id;
    this.comments = new Comments(env, this.access, this);
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
  create(document: BoardV13 | BoardV14) {
    return this.ordered(async () => {
      if (meta(this.env.storage, "storage_version")) throw new RoomError(409, "room_exists");
      await this.load(document);
    });
  }
  async load(document?: BoardV13 | BoardV14) {
    await this.lifecycle.active();
    this.closeLegacy();
    initialize(this.env.storage);
    if (this.initialized) return;
    const { storage, access } = this.env;
    if (!meta(storage, "storage_version")) {
      let details, page;
      try {
        details = await access.board(this.boardId);
        if (details) page = await access.changes(this.boardId, 0);
      } catch { throw new RoomError(503, "service_unavailable"); }
      if (!details) throw new RoomError(404, "not_found");
      if (!page) throw new RoomError(503, "service_unavailable");
      const adapter = new Adapter();
      const input = document ?? { schemaVersion: 14 as const, boardId: this.boardId, title: details.title, pages: [{ id: this.boardId, name: "Page 1" }], objects: [], retiredGenerations: [] };
      try {
        if (![13, 14].includes(validate(input).schemaVersion)) throw Error();
      } catch { throw new RoomError(400, "invalid_document"); }
      const board = upgrade(input);
      adapter.set(board);
      try {
        const prepared = await this.history.prepare(board);
        storage.transaction(() => {
          setMeta(storage, "storage_version", 8);
          resetTimer(storage);
          resetVoting(storage);
          storage.exec("INSERT INTO meta VALUES ('board_id', ?)", this.boardId);
          setMeta(storage, "last_edit_at", Date.parse(details.createdAt));
          setMeta(storage, "revision", 0);
          setMeta(storage, "watermark", page.latest);
          setMeta(storage, "restore_generation", 0);
          setMeta(storage, "restore_pending", 0);
          setMeta(storage, "mention_order", 0);
          setMeta(storage, "mention_cleanup", 0);
          snapshot(storage, adapter.doc, board, 0);
          this.history.capture(prepared, 0, 0, "initial");
          setMeta(storage, "history_next_at", this.env.now() + HISTORY_INTERVAL);
          for (const object of board.objects) {
            storage.exec("INSERT INTO identifiers VALUES (?, ?, 0)", object.id, object.generation);
          }
        });
      } finally { adapter.destroy(); }
    }
    await this.creationTime();
    this.copies?.suspend();
    this.doc.destroy();
    this.doc = loadDocument(storage);
    const legacy = meta(storage, "storage_version") === 7;
    this.board = readBoard(this.doc, legacy);
    if (legacy || this.board.schemaVersion !== 14) storage.transaction(() => {
      if (legacy) resetVoting(storage);
      this.upgradeStored(legacy);
      snapshot(storage, this.doc, this.board, meta(storage, "revision"));
      if (legacy) setMeta(storage, "storage_version", 8);
    });
    this.voting.validate();
    this.initialized = true;
    try {
      await this.timer.recover();
      this.generation = await this.env.fence();
      this.access.locked = this.generation > meta(storage, "restore_generation") || !!meta(storage, "restore_pending");
      if (this.access.locked) {
        this.closeAll(4423);
        storage.exec("DELETE FROM tickets");
        storage.exec("DELETE FROM waiting");
      }
    } catch { this.access.locked = true; return; }
    if (this.history.active()) { try { await this.history.resume(); } catch { return; } }
    this.voting.reconcileTargets();
    if(this.voting.running())this.presence.clearSpatial(false);
    if (this.access.locked) { try { await this.comments.mentions.restore(this.generation); } catch { return; } }
    try { await this.access.replay(this.boardId, this.generation); } catch { /* Ordinary wakes use their stored copy. */ }
    if (!this.access.locked) { try { await this.comments.mentions.prune(); } catch { /* Delivery retries require a successful prune. */ } }
    try { await this.timer.completeRecovery(); } catch { this.access.locked = true; return; }
    this.saved();
    this.background(() => this.deliverNotices());
  }
  // Snapshot the upgraded map at the existing revision, without a person's edit.
  private upgradeStored(legacy: boolean) {
    validate(this.board);
    const version = Number(this.board.schemaVersion);
    if (![10, 11, 12, 13, 14].includes(version) || legacy && version === 14) throw Error("invalid_document");
    this.doc.transact(() => {
      if (version < 13) {
        convertPages(this.doc, upgrade(this.board).pages);
        for (const value of this.doc.getMap<Y.Map<unknown>>("objects").values()) value.set("page", this.boardId);
      } else if (legacy && this.doc.getMap("board").has("pages")) convertPages(this.doc, this.board.pages);
      this.doc.getMap("board").set("schemaVersion", 14);
    });
    this.board = readBoard(this.doc); validate(this.board);
  }
  private closeLegacy() {
    for (const peer of this.env.connections()) if (!currentAttachment(peer.attachment())) this.close(peer, 1012);
  }
  private close(connection: Connection, code: number) {
    this.spotlight.closed(connection,code);
    if (code !== 1012) endPresence(connection, this.env.connections());
    this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", connection.attachment().connectionId);
    connection.close(code);
  }
  private closeAll(code: number) {
    this.spotlight.end(code===4423?"recovery":"lifecycle");
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
    try { await this.timer.recover(); this.generation = await this.env.fence(); }
    catch { this.access.locked = true; if (strict) throw new RoomError(503, "room_locked"); return; }
    if (this.history.active()) {
      try { await this.history.resume(); } catch { if (strict) throw new RoomError(503, "restore_pending"); return; }
    }
    if (this.generation > meta(this.env.storage, "restore_generation") || meta(this.env.storage, "restore_pending")) {
      this.access.locked = true;
      try { await this.comments.mentions.restore(this.generation); } catch { if (strict) throw new RoomError(503, "room_locked"); return; }
    }
    try { await this.access.replay(this.boardId, this.generation); }
    catch (error) { if (strict) throw error; /* A restore remains locked until replay succeeds. */ }
    if (!this.access.locked) { try { await this.comments.mentions.prune(); } catch (error) { if (strict) throw error; } }
    try { await this.timer.completeRecovery(); } catch { this.access.locked = true; if(strict)throw new RoomError(503,"restore_pending");return; }
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
    const task = this.tail.then(async () => { if (!this.lifecycle.discarded) { await this.lifecycle.active(); await operation(); } }).catch(() => {});
    try { this.env.background.run(task); } catch { /* Background failures never affect replies. */ }
  }
  saved(alarm = false) {
    if(this.initialized&&!this.lifecycle.discarded){try{this.voting.reconcileTargets();}catch{/* Voting revalidates before every protected projection. */}}
    if (this.lifecycle.discarded || this.access.locked || !this.copies || !this.env.storage.all("SELECT value FROM meta WHERE key = 'last_edit_at'").length) return;
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
      const message = { requestId, epoch: grant.epoch, update: base64(update), restoreGeneration: meta(this.env.storage, "restore_generation") };
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
      try { await this.lifecycle.active(); } catch (error) { if (error instanceof RoomError && error.status === 404) throw new RoomError(401, "ticket_invalid"); throw error; }
      await this.load();
      const storedTicket = this.env.storage.all("SELECT * FROM tickets WHERE digest = ?",await this.env.hash(bytes(ticket)))[0];
      if(!storedTicket || Number(storedTicket.expires_at)<=this.env.now() || Number(storedTicket.token_expires_at)<=this.env.now())throw new RoomError(401,"ticket_invalid");
      try { await this.refresh(true); await this.timer.authority(); this.timer.snapshot(); await this.voting.authority(); this.voting.validate(); } catch(error) { if(error instanceof RoomError)throw error;throw new RoomError(503,"service_unavailable"); }
      const person = await consumeTicket(this.env, ticket);
      const grant = await this.access.lookup(person.id, this.boardId);
      if (person.expiresAt <= this.env.now()) throw new RoomError(401, "ticket_invalid");
      const attachment = await this.presence.reserve(person, grant.role, grant.epoch);
      await this.schedule();
      return { ...attachment, restoreGeneration: meta(this.env.storage,"restore_generation"), timerTimes: [], timerReadTimes: [], voteTimes: [], voteReadTimes: [] };
    });
  }
  connected(connection: Connection) {
    return this.ordered(async () => {
      await this.load();
      const attachment = connection.attachment();
      if (!currentAttachment(attachment)) { this.close(connection, 1012); return; }
      await this.timer.authority(connection);
      await this.timer.normalize();
      if (!this.presence.open(connection)) return;
      await this.expire();
      if (attachment.expiresAt <= this.env.now()) return;
      const grant = this.access.get(attachment.id);
      if (!grant || attachment.epoch !== grant.epoch) { this.close(connection, closeCode(grant?.role ?? null, attachment.role)); return; }
      await this.timer.authority(connection);
      await this.voting.authority(connection);
      await this.spotlight.recover();await this.spotlight.expire();
      this.voting.reconcileTargets();
      const voting = await this.voting.stamp(connection);
      const spotlight=await this.spotlight.stamp(connection);
      if(this.voting.running())this.presence.clearSpatial(false);
      send(connection, { kind: "joined", role: grant.role, epoch: grant.epoch,
        restoreGeneration: meta(this.env.storage, "restore_generation"),
        spotlight:spotlight.spotlight, timer: this.timer.snapshot(), serverNowMs: this.env.now(), voting: voting.voting,
        revision: meta(this.env.storage, "revision"), update: base64(Y.encodeStateAsUpdate(this.doc)),
        self: connection.attachment().presence, present: this.presence.list(attachment.connectionId) });
      this.comments.snapshot(connection);
      await this.presence.relay(connection);
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
      await this.spotlight.flush();
      return meta(this.env.storage, "watermark");
    });
  }
  deliverNotices() {
    return this.ordered(async () => {
      if (!meta(this.env.storage, "storage_version") || !meta(this.env.storage, "mention_cleanup")) return;
      await this.refresh(true);
      if (this.access.locked) throw new RoomError(503, this.access.reason);
      await this.comments.mentions.deliver();
    });
  }
  discussion(person: Person, commentId: string, occurrence?: string) {
    return this.ordered(async () => {
      await this.refresh(true);
      await this.access.lookup(person.id, this.boardId, true);
      if (this.access.locked) throw new RoomError(503, this.access.reason);
      const target = this.env.storage.all("SELECT * FROM mention_targets WHERE comment_id = ? AND recipient = ?", commentId, person.id)[0];
      const row = this.env.storage.all("SELECT * FROM comments WHERE id = ?", commentId)[0];
      if (!target || occurrence && target.occurrence !== occurrence || !row) throw new RoomError(404, "not_found");
      const thread = this.env.storage.all("SELECT * FROM threads WHERE id = ?", String(row.thread_id))[0];
      if (!thread) throw new RoomError(404, "not_found");
      return { boardId: this.boardId, title: this.board.title, threadId: row.thread_id,
        comment: commentRow(row), anchor: storedAnchor(thread, this.board), resolved: !!thread.resolved };
    });
  }
  message(connection: Connection, text: string) {
    return this.ordered(async () => {
      try { await this.load(); }
      catch (error) {
        if (this.spotlight.refuseLoadFailure(connection,text,error))return;
        if (this.voting.refuseLoadFailure(connection,text,error)) return;
        throw error;
      }
      if (!this.env.connections().some((peer) => peer.attachment().connectionId === connection.attachment().connectionId)) return;
      await this.expire();
      if (connection.attachment().expiresAt <= this.env.now()) return;
      if (this.access.locked) { this.close(connection, 4423); return; }
      if (bytes(text).length > MESSAGE_LIMIT) { send(connection, { kind: "refused", reason: "message_too_large" }); return; }
      let message;
      try { message = JSON.parse(text); } catch { send(connection, { kind: "refused", reason: "bad_message" }); return; }
      if (message?.kind === "spotlight_command" || message?.kind === "spotlight_read") {
        await this.spotlight.handle(connection,message,bytes(text).length);await this.schedule();return;
      }
      if (message?.kind === "vote_command" || message?.kind === "vote_read") {
        await this.voting.handle(connection,message,bytes(text).length); return;
      }
      if (message?.kind === "timer_command" || message?.kind === "timer_read") {
        await this.timer.handle(connection,message,bytes(text).length);
        await this.schedule(); return;
      }
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
      if (message?.kind === "react") {
        await this.reactions.receive(connection, message, bytes(text).length); return;
      }
      if (message?.kind === "presence") {
        await this.presence.receive(connection, message, bytes(text).length);
        await this.schedule();
        return;
      }
      if (message?.kind === "comment") {
        await this.comments.handle(connection, message);
        this.background(() => this.deliverNotices());
        return;
      }
      if (message?.kind !== "edit" || typeof message.requestId !== "string" || !message.requestId.length ||
        [...message.requestId].length > 100 || !Number.isSafeInteger(message.epoch) || typeof message.update !== "string" || !Number.isSafeInteger(message.restoreGeneration) || message.restoreGeneration < 0 ||
        Object.keys(message).sort().join() !== ["kind", "epoch", "requestId", "update", "restoreGeneration"].sort().join()) {
        send(connection, { kind: "refused", reason: "bad_message" }); return;
      }
      await this.edits.handle(connection, message, text);
      try{this.voting.reconcileTargets();await this.voting.flushTargets();}catch{/* Voting storage failure cannot change a committed edit receipt. */}
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
    await this.spotlight.expire();
    this.env.storage.exec("DELETE FROM tickets WHERE expires_at <= ?", this.env.now());
  }
  scheduleSpotlight(){return this.schedule();}
  private async schedule(historyRetry = false) {
    const historyAt = meta(this.env.storage, "history_next_at");
    const deadlines = [historyRetry ? Math.max(historyAt, this.env.now() + 1000) : historyAt, ...this.env.connections().map((connection) => connection.attachment().expiresAt)];
    const spotlightAt=this.spotlight.deadline();if(spotlightAt!==null)deadlines.push(spotlightAt);
    const timerAt = this.timer.deadline(); if(timerAt !== null)deadlines.push(timerAt);
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
  closed(connection: Connection, code: number = 1006, reason: string = "") {
    return this.ordered(async () => {
      this.spotlight.closed(connection,code,reason);
      if (this.lifecycle.discarded || this.access.locked) return;
      await this.load();
      await this.spotlight.flush();
      endPresence(connection, this.env.connections());
      this.env.storage.exec("DELETE FROM waiting WHERE connection_id = ?", connection.attachment().connectionId);
      if (!this.env.connections().length && !this.access.locked) await this.history.automatic("last_close");
      if (!this.env.connections().length && !this.access.locked) this.env.storage.transaction(() => snapshot(this.env.storage, this.doc, this.board, meta(this.env.storage, "revision")));
      await this.schedule();
    });
  }
  alarm() {
    return this.ordered(async () => {
      await this.load();
      await this.expire();
      try { await this.timer.normalize(); } catch { await this.env.schedule(this.env.now()+1000); return; }
      try { await this.history.automatic("checkpoint"); }
      catch (error) { await this.schedule(true); throw error; }
      this.saved(true);
      const revision = meta(this.env.storage, "revision");
      if (revision > newestSnapshot(this.env.storage) && this.env.now() >= meta(this.env.storage, "last_edit_at") + 60000) {
        this.env.storage.transaction(() => snapshot(this.env.storage, this.doc, this.board, revision));
      }
      await this.schedule();
    });
  }
  lifecyclePause() {
    this.spotlight.end("lifecycle");
    this.copies?.suspend();
    this.closeAll(4403);
    this.env.storage.exec("DELETE FROM tickets"); this.env.storage.exec("DELETE FROM waiting");
  }
  admitLifecycle(request: LifecycleRequest) {
    if (request.operation === "move" && this.history.active()) return Promise.reject(new RoomError(503,"restore_pending"));
    return this.ordered(() => this.lifecycle.admit(request));
  }
  fenceLifecycle(row: Lifecycle, ready = false) { return this.ordered(() => ready ? this.lifecycle.accessReady(row) : this.lifecycle.fence(row)); }
  discardLifecycle() { return this.ordered(async () => { this.lifecycle.freeze(); this.lifecycle.discarded = true; await this.env.schedule(null); }); }
  historyPause(actor: string) {
    this.spotlight.end("recovery");
    this.copies?.suspend();
    for (const peer of this.env.connections()) send(peer, { kind: "history_restoring", actor });
    this.closeAll(4423);
    this.env.storage.exec("DELETE FROM tickets"); this.env.storage.exec("DELETE FROM waiting");
  }
  versions(person: Person) { return this.ordered(() => this.history.list(person)); }
  version(person: Person, id: string) { return this.ordered(() => this.history.preview(person, id)); }
  saveVersion(person: Person, value: import("nextphase-board-sync/history.ts").SaveVersion) { return this.ordered(() => this.history.save(person, value)); }
  nameVersion(person: Person, id: string, value: { name: string; description: string }) { return this.ordered(() => this.history.name(person, id, value)); }
  restoreVersion(person: Person, id: string, value: import("nextphase-board-sync/history.ts").RestoreVersion) { return this.ordered(() => this.history.restore(person, id, value)); }
  backup() { return this.ordered(async () => { await this.load(); return backup(this.env, this.boardId); }); }
  restore(value: unknown) {
    return this.ordered(async () => {
      await this.lifecycle.active();
      const envelope = decodeBackup(value, this.boardId);
      try { await validateHistoryBackup(this.env, envelope.tables, this.boardId); } catch { throw new RoomError(400, "bad_request"); }
      if (this.history.active()) throw new RoomError(503, "restore_pending");
      this.spotlight.end("recovery");
      const generation = await this.env.raiseFence();
      this.copies?.suspend();
      this.closeAll(4423);
      replace(this.env, envelope);
      this.env.storage.transaction(() => {
        this.env.storage.exec("DELETE FROM mention_pending"); this.env.storage.exec("DELETE FROM mention_targets");
        setMeta(this.env.storage, "mention_cleanup", 0); setMeta(this.env.storage, "mention_order", 0);
      });
      setMeta(this.env.storage, "restore_pending", 1);
      this.initialized = false;
      this.access.locked = true;
      return { boardId: this.boardId, restoreGeneration: generation, locked: true };
    });
  }
  lock(reserve?: () => Promise<number>) {
    return this.ordered(async () => {
      await this.lifecycle.active();
      this.spotlight.end("recovery");
      const generation = await (reserve ? reserve() : this.env.raiseFence());
      this.copies?.suspend();
      this.closeAll(4423);
      this.env.storage.exec("DELETE FROM tickets");
      this.env.storage.exec("DELETE FROM waiting");
      markExplicitRecovery(this.env.storage);
      this.access.locked = true;
      return generation;
    });
  }
}
