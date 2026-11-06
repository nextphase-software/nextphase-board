// SPDX-License-Identifier: Apache-2.0
import * as Y from 'yjs';
import { readBoard } from 'nextphase-board-sync/codec.ts';
import { Adapter } from 'nextphase-board-sync/document-adapter.ts';
import { canonical, validate, type BoardV10 } from 'nextphase-board-rules/document.ts';
import { HISTORY_AGE, HISTORY_CHUNK, HISTORY_INTERVAL, HISTORY_LIMIT, historyId, historyInteger,
  historyReasons, wellFormed, metadataValid, versionValid, versionHeading, type Version, type HistoryReason, type SaveVersion,
  type RestoreVersion, type RestoreResult } from 'nextphase-board-sync/history.ts';
import type { RoomEnvironment } from './interfaces.ts';
import type { Room } from './room.ts';
import { meta, setMeta, type Row, type Storage } from './storage.ts';
import { bytes, RoomError, type Person } from './protocol.ts';
import { labelOf } from './tickets.ts';
import { keepAnchors } from './comments.ts';
import { snapshot } from './snapshots.ts';

type Prepared = { data: Uint8Array; sha256: string };
type Reference = { chunks: number; bytes: number; sha256: string };
type Intent = { phase: 'intent' | 'reserved' | 'replaced'; selected: Reference; replaced: Reference;
  version: Version; actor: string; expectedRevision: number; oldGeneration: number; generation: number; carryGeneration?: number;
  result?: RestoreResult };
export function versionRow(row: Row): Version {
  return { id: String(row.id), ordinal: Number(row.ordinal), capturedAt: Number(row.captured_at), revision: Number(row.revision),
    generation: Number(row.generation), reason: row.reason as HistoryReason, name: String(row.name), description: String(row.description),
    actor: row.actor === null ? null : String(row.actor), namedBy: row.named_by === null ? null : String(row.named_by), sourceName: String(row.source_name) };
}
export function documentBytes(rows: Row[], board: string): { board: BoardV10; data: Uint8Array } {
  if (!rows.length || rows.some((r, i) => r.chunk_index !== i || !(r.bytes instanceof Uint8Array) || !r.bytes.length || r.bytes.length > HISTORY_CHUNK)) throw Error('bad_chunks');
  const data = new Uint8Array(rows.reduce((n, r) => n + (r.bytes as Uint8Array).length, 0));
  if (data.length > 2097152) throw Error('document_too_large');
  let at = 0; for (const row of rows) { data.set(row.bytes as Uint8Array, at); at += (row.bytes as Uint8Array).length; }
  const text = new TextDecoder().decode(data), value = validate(JSON.parse(text));
  if (value.schemaVersion !== 10 || value.boardId !== board || value.objects.some(o => o.type === 'image') || canonical(value) !== text) throw Error('bad_document');
  return { board: value as BoardV10, data };
}
export class History {
  private host: Room;
  constructor(host: Room) { this.host = host; }
  get env() { return this.host.env; }
  get s() { return this.env.storage; }
  async prepare(board: BoardV10): Promise<Prepared> {
    const data = bytes(canonical(board)); return { data, sha256: await this.env.hash(data) };
  }
  prune() {
    const keep = this.s.all('SELECT id FROM versions WHERE captured_at > ? ORDER BY ordinal DESC LIMIT ?', this.env.now() - HISTORY_AGE, HISTORY_LIMIT);
    const ids = new Set(keep.map(r => r.id));
    for (const row of this.s.all('SELECT id FROM versions')) if (!ids.has(row.id)) {
      this.s.exec('DELETE FROM version_chunks WHERE version_id = ?', row.id); this.s.exec('DELETE FROM versions WHERE id = ?', row.id);
    }
  }
  // Caller owns the room transaction; hashing has already succeeded outside it.
  capture(prepared: Prepared, revision: number, generation: number, reason: HistoryReason, actor: string | null = null,
    name = '', description = '', sourceName = ''): Version {
    const id = this.env.randomId(), ordinal = meta(this.s, 'history_ordinal') + 1, capturedAt = this.env.now();
    this.s.exec('INSERT INTO versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', id, ordinal, capturedAt, revision, generation, reason, name, description, actor, name || description ? actor : null, sourceName);
    for (let at = 0, index = 0; at < prepared.data.length; at += HISTORY_CHUNK, index++)
      this.s.exec('INSERT INTO version_chunks VALUES (?, ?, ?)', id, index, prepared.data.slice(at, at + HISTORY_CHUNK));
    setMeta(this.s, 'history_ordinal', ordinal); setMeta(this.s, 'history_revision', revision);
    setMeta(this.s, 'history_capture_sha256', prepared.sha256); setMeta(this.s, 'history_capture_bytes', prepared.data.length);
    this.prune();
    return { id, ordinal, capturedAt, revision, generation, reason, name, description, actor, namedBy: name || description ? actor : null, sourceName };
  }
  async automatic(reason: 'checkpoint' | 'last_close') {
    if (this.host.access.locked) return;
    const next = meta(this.s, 'history_next_at'), now = this.env.now();
    if (reason === 'checkpoint' && now < next) return;
    const prepared = await this.prepare(this.host.board);
    const same = this.s.all("SELECT value FROM meta WHERE key = 'history_capture_sha256'")[0]?.value === prepared.sha256 && meta(this.s, 'history_capture_bytes') === prepared.data.length;
    this.s.transaction(() => {
      if (!same) this.capture(prepared, meta(this.s, 'revision'), meta(this.s, 'restore_generation'), reason);
      this.prune();
      if (reason === 'checkpoint') setMeta(this.s, 'history_next_at', next + (Math.floor((now - next) / HISTORY_INTERVAL) + 1) * HISTORY_INTERVAL);
    });
  }
  async authorize(person: Person, mutate = false) {
    let role;
    try { role = await this.env.access.role(person.id, this.host.boardId); }
    catch { throw new RoomError(503, 'service_unavailable'); }
    if (!role) throw new RoomError(404, 'not_found');
    if (mutate && role === 'viewer') throw new RoomError(403, 'role_too_low');
  }
  async ready(person: Person, mutate = false) {
    await this.authorize(person, mutate);
    await this.host.refresh(true);
    if (this.host.access.locked) throw new RoomError(503, this.active() ? 'restore_pending' : 'service_unavailable');
    await this.authorize(person, mutate);
  }
  selected(id: string) {
    const row = this.s.all('SELECT * FROM versions WHERE id = ? AND captured_at > ?', id, this.env.now() - HISTORY_AGE)[0];
    if (!historyId(id) || !row) throw new RoomError(404, 'not_found');
    return versionRow(row);
  }
  read(id: string) {
    return documentBytes(this.s.all('SELECT * FROM version_chunks WHERE version_id = ? ORDER BY chunk_index', id), this.host.boardId);
  }
  async list(person: Person) {
    await this.ready(person);
    return { versions: this.s.all('SELECT * FROM versions WHERE captured_at > ? ORDER BY ordinal DESC LIMIT ?', this.env.now() - HISTORY_AGE, HISTORY_LIMIT).map(versionRow),
      head: { revision: meta(this.s, 'revision'), generation: meta(this.s, 'restore_generation') } };
  }
  async preview(person: Person, id: string) {
    await this.ready(person); const version = this.selected(id); return { version, document: this.read(id).board };
  }
  private assignment(value: any) {
    if (!metadataValid(value.name, 100) || !metadataValid(value.description, 500)) throw new RoomError(400, 'bad_request');
  }
  private async digest(operation: string, value: unknown) { return this.env.hash(bytes(JSON.stringify([operation, value]))); }
  private receipt(person: Person, request: string, digest: string) {
    const row = this.s.all('SELECT * FROM history_requests WHERE person_id = ? AND request_id = ?', person.id, request)[0];
    if (row && row.digest !== digest) throw new RoomError(409, 'request_id_reused');
    return row;
  }
  private result(person: string, request: string, digest: string, operation: string, result: unknown) {
    const text = JSON.stringify(result);
    if (bytes(text).length > 65536) throw Error('journal_too_large');
    this.s.exec('INSERT INTO history_requests VALUES (?, ?, ?, ?, ?) ON CONFLICT(person_id, request_id) DO UPDATE SET result=excluded.result', person, request, digest, operation, text);
  }
  async save(person: Person, value: SaveVersion) {
    await this.ready(person, true); this.assignment(value);
    if (!historyId(value.requestId)) throw new RoomError(400, 'bad_request');
    const digest = await this.digest('save', value), old = this.receipt(person, value.requestId, digest);
    if (old) return JSON.parse(String(old.result));
    const prepared = await this.prepare(this.host.board);
    return this.s.transaction(() => {
      const result = { version: this.capture(prepared, meta(this.s, 'revision'), meta(this.s, 'restore_generation'), 'manual', labelOf(person.email), value.name, value.description) };
      this.result(person.id, value.requestId, digest, 'save', result); return result;
    });
  }
  async name(person: Person, id: string, value: { name: string; description: string }) {
    await this.ready(person, true); this.assignment(value); this.selected(id);
    this.s.transaction(() => this.s.exec('UPDATE versions SET name = ?, description = ?, named_by = ? WHERE id = ?', value.name, value.description, labelOf(person.email), id));
    return { version: this.selected(id) };
  }
  active() { return this.s.all("SELECT * FROM history_requests WHERE operation = 'restore' ORDER BY rowid").find(r => JSON.parse(String(r.result)).phase); }
  private writeIntent(person: string, request: string, kind: string, prepared: Prepared): Reference {
    let chunks = 0; for (let at = 0; at < prepared.data.length; at += HISTORY_CHUNK)
      this.s.exec('INSERT INTO history_intent_chunks VALUES (?, ?, ?, ?, ?)', person, request, kind, chunks++, prepared.data.slice(at, at + HISTORY_CHUNK));
    return { chunks, bytes: prepared.data.length, sha256: prepared.sha256 };
  }
  private async intentDocument(row: Row, kind: 'selected' | 'replaced', reference: Reference) {
    const rows = this.s.all('SELECT * FROM history_intent_chunks WHERE person_id = ? AND request_id = ? AND kind = ? ORDER BY chunk_index', row.person_id, row.request_id, kind);
    const value = documentBytes(rows, this.host.boardId);
    if (rows.length !== reference.chunks || value.data.length !== reference.bytes || await this.env.hash(value.data) !== reference.sha256) throw Error('intent_corrupt');
    return { ...value, sha256: reference.sha256 };
  }
  async restore(person: Person, id: string, value: RestoreVersion) {
    await this.authorize(person, true);
    await this.host.load();
    if (!historyId(value.requestId) || !historyInteger(value.expectedRevision) || !historyInteger(value.expectedGeneration)) throw new RoomError(400, 'bad_request');
    const digest = await this.digest('restore:' + id, value), old = this.receipt(person, value.requestId, digest);
    if (old) {
      const result = JSON.parse(String(old.result));
      if (!result.phase) return result as RestoreResult;
      try { return await this.resume(old); } catch { throw new RoomError(503, 'restore_pending'); }
    }
    await this.ready(person, true);
    const version = this.selected(id), selected = this.read(id);
    this.validateIdentity(selected.board);
    if (value.expectedRevision !== meta(this.s, 'revision') || value.expectedGeneration !== meta(this.s, 'restore_generation')) throw new RoomError(409, 'head_changed');
    const selectedPrepared = await this.prepare(selected.board), replaced = await this.prepare(this.host.board);
    await this.authorize(person, true);
    try {
      this.s.transaction(() => {
        const intent: Intent = { phase: 'intent', selected: this.writeIntent(person.id, value.requestId, 'selected', selectedPrepared),
          replaced: this.writeIntent(person.id, value.requestId, 'replaced', replaced), version, actor: labelOf(person.email),
          expectedRevision: value.expectedRevision, oldGeneration: value.expectedGeneration, generation: value.expectedGeneration };
        this.result(person.id, value.requestId, digest, 'restore', intent);
        setMeta(this.s, 'restore_pending', 1);
      });
    } catch {
      // Only a positively absent intent proves a rollback. An unreadable or
      // committed local journal is uncertain and must keep the room locked.
      let rolledBack = false;
      try { rolledBack = !this.s.all('SELECT * FROM history_requests WHERE person_id = ? AND request_id = ?', person.id, value.requestId).length; } catch { /* Unknown local outcome. */ }
      if (rolledBack) throw new RoomError(503, 'restore_failed');
      this.host.access.locked = true;
      throw new RoomError(503, 'restore_pending');
    }
    this.host.access.locked = true;
    this.host.historyPause(labelOf(person.email));
    try { return await this.resume(this.receipt(person, value.requestId, digest)!); }
    catch { throw new RoomError(503, 'restore_pending'); }
  }
  validateIdentity(board: BoardV10) {
    for (const o of board.objects) {
      const rows = this.s.all('SELECT * FROM identifiers WHERE object_id = ? AND generation = ?', o.id, o.generation);
      if (rows.length !== 1) throw new RoomError(400, 'bad_request');
      // Type is established by the retained canonical document, never a browser upload.
      const current = this.host.board.objects.find(p => p.id === o.id);
      if (current && current.type !== o.type) throw new RoomError(400, 'bad_request');
    }
  }
  async resume(row = this.active()): Promise<RestoreResult | undefined> {
    if (!row) return;
    const intent: Intent = JSON.parse(String(row.result));
    if (!intent.phase) return intent as unknown as RestoreResult;
    this.host.access.locked = true;
    const selected = await this.intentDocument(row, 'selected', intent.selected), replaced = await this.intentDocument(row, 'replaced', intent.replaced);
    if (this.env.mentions && (!this.env.mentions.documentGeneration || !this.env.mentions.mentionGeneration || !this.env.mentions.carryNotices)) throw Error('checkpoint_unavailable');
    const independent = await this.env.fence();
    const documentGeneration = await this.env.mentions?.documentGeneration?.(this.host.boardId) ?? 0;
    const mentionGeneration = await this.env.mentions?.mentionGeneration?.(this.host.boardId) ?? 0;
    const floors = [independent, intent.oldGeneration, documentGeneration, mentionGeneration];
    if (!floors.every(historyInteger)) throw Error('bad_generation');
    if (intent.phase !== 'intent' && Math.max(...floors) > intent.generation) {
      // A supported volume rewind may leave live checkpoints ahead of the intent.
      // It is still user completion: carry the proven live checkpoint, never clear.
      const generation = await this.env.raiseFence(Math.max(...floors));
      if (!historyInteger(generation) || generation <= Math.max(...floors)) throw Error('bad_generation');
      intent.generation = generation; intent.carryGeneration = mentionGeneration;
      if (intent.result) intent.result.generation = generation;
      this.s.transaction(() => {
        this.result(String(row!.person_id), String(row!.request_id), String(row!.digest), 'restore', intent);
        if (intent.phase === 'replaced') setMeta(this.s, 'restore_generation', generation);
      });
    }
    if (intent.phase === 'intent') {
      const values = floors;
      if (!values.every(historyInteger) || Math.max(...values) >= Number.MAX_SAFE_INTEGER) throw Error('bad_generation');
      intent.generation = await this.env.raiseFence(Math.max(...values));
      if (!historyInteger(intent.generation) || intent.generation <= Math.max(...values)) throw Error('bad_generation');
      intent.carryGeneration = mentionGeneration;
      intent.phase = 'reserved';
      this.s.transaction(() => this.result(String(row.person_id), String(row.request_id), String(row.digest), 'restore', intent));
    }
    this.host.generation = intent.generation;
    if (intent.phase === 'reserved') {
      const adapter = new Adapter(); adapter.set(selected.board);
      try {
        this.s.transaction(() => {
          const before = this.capture(replaced, intent.expectedRevision, intent.oldGeneration, 'before_restore');
          const restored = this.capture(selected, intent.expectedRevision + 1, intent.generation, 'restored', intent.actor, '', '', versionHeading(intent.version));
          keepAnchors(this.env, replaced.board, selected.board);
          this.s.exec('DELETE FROM waiting'); this.s.exec('DELETE FROM tickets'); this.s.exec('DELETE FROM edits');
          snapshot(this.s, adapter.doc, selected.board, intent.expectedRevision + 1);
          setMeta(this.s, 'revision', intent.expectedRevision + 1); setMeta(this.s, 'restore_generation', intent.generation);
          setMeta(this.s, 'last_edit_at', this.env.now());
          intent.result = { requestId: String(row!.request_id), revision: intent.expectedRevision + 1, generation: intent.generation, beforeVersionId: before.id, restoredVersionId: restored.id };
          intent.phase = 'replaced';
          this.result(String(row!.person_id), String(row!.request_id), String(row!.digest), 'restore', intent);
        });
        this.host.doc.destroy(); this.host.doc = adapter.doc; this.host.board = selected.board;
      } catch (error) { adapter.destroy(); throw error; }
    }
    if (this.env.mentions) {
      if (!this.env.mentions.carryNotices) throw Error('carry_unavailable');
      await this.env.mentions.carryNotices(this.host.boardId, intent.carryGeneration ?? intent.oldGeneration, intent.generation);
    }
    // Replay may update grants/watermark, but cannot remove the durable user lock.
    await this.host.access.replay(this.host.boardId, intent.generation, true);
    if (this.host.access.reason === 'access_log_pruned') throw Error('access_log_pruned');
    this.s.transaction(() => {
      this.result(String(row!.person_id), String(row!.request_id), String(row!.digest), 'restore', intent.result);
      this.s.exec('DELETE FROM history_intent_chunks WHERE person_id = ? AND request_id = ?', row!.person_id, row!.request_id);
      setMeta(this.s, 'restore_pending', 0);
    });
    this.host.access.locked = false; this.host.saved();
    return intent.result;
  }
}

export async function validateHistoryBackup(env: RoomEnvironment, tables: Record<string, Row[]>, board: string) {
  const get = (key: string) => tables.meta.find(r => r.key === key)?.value;
  if (new Set(tables.meta.map(r => r.key)).size !== tables.meta.length || get('board_id') !== board) throw Error('bad_meta');
  for (const key of ['revision','restore_generation','watermark','last_edit_at','mention_order','mention_cleanup']) if (!historyInteger(get(key))) throw Error('bad_meta');
  if (![0,1].includes(Number(get('mention_cleanup')))) throw Error('bad_meta');
  const identity = new Map<string,string>(), generations = new Set<string>();
  for (const r of tables.identifiers) {
    if (!historyId(r.object_id) || !historyId(r.generation) || identity.has(r.object_id) || generations.has(r.generation) ||
      !historyInteger(r.first_revision) || r.first_revision > Number(get('revision'))) throw Error('bad_identifier');
    identity.set(r.object_id,r.generation); generations.add(r.generation);
  }
  const snapshots = [...new Set(tables.snapshot_chunks.map(r => r.snapshot_revision))].sort((a,b)=>Number(a)-Number(b));
  if (!snapshots.length || snapshots.length > 2) throw Error('bad_snapshot');
  const doc = new Y.Doc();
  try {
    for (const revision of snapshots) {
      if (!historyInteger(revision) || revision > Number(get('revision'))) throw Error('bad_snapshot');
      const json = documentBytes(tables.snapshot_chunks.filter(r=>r.snapshot_revision===revision&&r.kind==='json').sort((a,b)=>Number(a.chunk_index)-Number(b.chunk_index)),board);
      const parts = tables.snapshot_chunks.filter(r=>r.snapshot_revision===revision&&r.kind==='yjs').sort((a,b)=>Number(a.chunk_index)-Number(b.chunk_index));
      if (!parts.length || parts.some((r,i)=>r.chunk_index!==i || !(r.bytes instanceof Uint8Array) || !r.bytes.length || r.bytes.length>HISTORY_CHUNK)) throw Error('bad_snapshot');
      const data = new Uint8Array(parts.reduce((n,r)=>n+(r.bytes as Uint8Array).length,0)); let at=0;
      for (const r of parts) {data.set(r.bytes as Uint8Array,at);at+=(r.bytes as Uint8Array).length;}
      const candidate = new Y.Doc();
      try {Y.applyUpdate(candidate,data); if (canonical(readBoard(candidate))!==canonical(json.board)) throw Error('bad_snapshot');} finally {candidate.destroy();}
      if (revision===snapshots.at(-1)) Y.applyUpdate(doc,data);
    }
    for (const r of [...tables.edits].sort((a,b)=>Number(a.revision)-Number(b.revision))) {
      if (!historyInteger(r.revision) || r.revision>Number(get('revision')) || !(r.update instanceof Uint8Array)) throw Error('bad_edit');
      if (Number(r.revision)>Number(snapshots.at(-1))) Y.applyUpdate(doc,r.update);
    }
    const head=readBoard(doc); validate(head); canonical(head);
    if (head.boardId!==board || head.schemaVersion!==10 || head.objects.some(o=>o.type==='image'||identity.get(o.id)!==o.generation)) throw Error('bad_head');
  } finally {doc.destroy();}
  if (tables.snapshot_chunks.some(r=>!['json','yjs'].includes(String(r.kind)))) throw Error('bad_snapshot');
  const comments = new Map(tables.comments.map(r=>[r.id,r])), threads = new Map(tables.threads.map(r=>[r.id,r]));
  if (comments.size!==tables.comments.length || threads.size!==tables.threads.length || comments.size>2000 || tables.comments.reduce((n,r)=>n+bytes(String(r.text)).length,0)>4194304) throw Error('bad_discussion');
  for (const r of tables.threads) {
    const anchor=JSON.parse(String(r.anchor));
    if (!historyId(r.id) || !comments.has(r.first_comment) || comments.get(r.first_comment)!.thread_id!==r.id ||
      !anchor || ![anchor.x,anchor.y,anchor.u,anchor.v].every(n=>typeof n==='number'&&Number.isFinite(n)) || typeof anchor.detached!=='boolean' ||
      anchor.objectId!==null&&!historyId(anchor.objectId) || ![0,1].includes(Number(r.resolved))) throw Error('bad_thread');
  }
  for (const r of tables.comments) if (!historyId(r.id) || !threads.has(r.thread_id) || !historyId(r.author_id) ||
    !historyInteger(r.created_at) || !historyInteger(r.sequence) || r.edited_at!==null&&!historyInteger(r.edited_at)) throw Error('bad_comment');
  if (tables.mention_targets.length>40000 || tables.mention_pending.length>1000) throw Error('bad_mentions');
  const occurrences=new Set(),pairs=new Set();
  for (const r of tables.mention_targets) {
    const pair=JSON.stringify([r.comment_id,r.recipient]), comment=comments.get(r.comment_id);
    if (!comment || comment.thread_id!==r.thread_id || !historyId(r.recipient) || !historyId(r.lease) || !historyId(r.occurrence) ||
      typeof r.person!=='string' || !/^[0-9a-f]{32}$/.test(r.person) || !historyInteger(r.source_order) || r.source_order>Number(get('mention_order')) || !historyInteger(r.created_at) ||
      occurrences.has(r.occurrence) || pairs.has(pair) || !JSON.parse(String(comment.mentions)).some((m:any)=>m.person===r.person)) throw Error('bad_target');
    occurrences.add(r.occurrence);pairs.add(pair);
  }
  const pending=new Set();
  for (const r of tables.mention_pending) {
    const pair=JSON.stringify([r.comment_id,r.recipient]);
    if (!pairs.has(pair) || pending.has(pair) || !tables.mention_targets.some(t=>t.comment_id===r.comment_id&&t.recipient===r.recipient&&t.source_order===r.source_order)) throw Error('bad_pending');
    pending.add(pair);
  }
  const ordinal = get('history_ordinal'), revision = get('history_revision'), count = get('history_capture_bytes'), hash = get('history_capture_sha256');
  if (!historyInteger(ordinal) || ordinal < 1 || !historyInteger(revision) || revision > Number(get('revision')) ||
    !historyInteger(count) || count < 1 || count > 2097152 || typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) ||
    !historyInteger(get('history_next_at')) || get('restore_pending') !== 0 || tables.history_intent_chunks.length) throw Error('bad_history');
  if (tables.versions.length > 50) throw Error('bad_history');
  const ids = new Set(), ordinals = new Set();
  for (const row of tables.versions) {
    const v = versionRow(row);
    if (!['ordinal','captured_at','revision','generation'].every(key=>historyInteger(row[key])) || !versionValid(v) || !historyId(v.id) || ids.has(v.id) || !historyInteger(v.ordinal) || v.ordinal < 1 || v.ordinal > ordinal || ordinals.has(v.ordinal) ||
      !historyInteger(v.capturedAt) || !historyInteger(v.revision) || v.revision > Number(get('revision')) || !historyInteger(v.generation) ||
      !historyReasons.includes(v.reason) || !metadataValid(row.name, 100) || !metadataValid(row.description, 500) ||
      typeof row.source_name !== 'string' || [row.actor, row.named_by].some(a => a !== null && (typeof a !== 'string' || !wellFormed(a) || !a.length || bytes(a).length > 256))) throw Error('bad_version');
    ids.add(v.id); ordinals.add(v.ordinal);
    const value = documentBytes(tables.version_chunks.filter(c => c.version_id === v.id).sort((a,b) => Number(a.chunk_index)-Number(b.chunk_index)), board);
    for (const o of value.board.objects) if (!tables.identifiers.some(r => r.object_id === o.id && r.generation === o.generation)) throw Error('bad_identifier');
    if (v.ordinal === ordinal && (value.data.length !== count || await env.hash(value.data) !== hash || v.revision !== revision)) throw Error('bad_fingerprint');
  }
  if (tables.version_chunks.some(c => !ids.has(c.version_id))) throw Error('orphan_chunk');
  const requests = new Set();
  for (const r of tables.history_requests) {
    const identity = JSON.stringify([r.person_id,r.request_id]);
    if (!historyId(r.person_id) || !historyId(r.request_id) || requests.has(identity) || typeof r.digest !== 'string' || !/^[0-9a-f]{64}$/.test(r.digest) ||
      !['save','restore'].includes(String(r.operation)) || typeof r.result !== 'string' || bytes(r.result).length > 65536) throw Error('bad_request');
    requests.add(identity);
    const result = JSON.parse(r.result);
    if (r.operation === 'restore') {
      if (Object.keys(result).sort().join() !== ['requestId','revision','generation','beforeVersionId','restoredVersionId'].sort().join() || result.requestId !== r.request_id ||
        !historyInteger(result.revision) || !historyInteger(result.generation) || !historyId(result.beforeVersionId) || !historyId(result.restoredVersionId)) throw Error('bad_result');
    } else if (Object.keys(result).join() !== 'version' || !versionValid(result.version)) throw Error('bad_result');
  }
}
