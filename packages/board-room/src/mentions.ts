// SPDX-License-Identifier: Apache-2.0
import { mentionProblem } from 'nextphase-board-sync/mentions.ts';
import type { Mention } from 'nextphase-board-sync/comments.ts';
import type { MentionPerson, RoomEnvironment } from './interfaces.ts';
import { meta, setMeta, type Row } from './storage.ts';
import { RoomError } from './protocol.ts';
export class Mentions {
  private env: RoomEnvironment;
  private host: { boardId: string; generation: number };
  constructor(env: RoomEnvironment, host: { boardId: string; generation: number }) { this.env=env; this.host=host; }
  async prepare(author: string, text: string, mentions: Mention[], previous?: Row) {
    const problem = mentionProblem(text, mentions); if (problem) throw new RoomError(400, problem);
    const old: Mention[] = previous ? JSON.parse(String(previous.mentions)) : [];
    const introduced = mentions.filter(m => !old.some(p => p.person === m.person && p.label === m.label));
    const roster = introduced.length && this.env.mentions ? await this.env.mentions.roster(this.host.boardId, author) : [];
    const current = previous ? this.env.storage.all('SELECT * FROM mention_targets WHERE comment_id = ?', String(previous.id)) : [];
    const targets: MentionPerson[] = [];
    for (const m of introduced) {
      const candidate = roster.find(p => p.person === m.person && p.label === m.label);
      if (!candidate) throw new RoomError(409, 'mention_unavailable');
      if (!current.some(t => t.person === m.person) && !targets.some(t => t.person === m.person)) targets.push(candidate);
    }
    const removed = current.filter(t => !mentions.some(m => m.person === t.person));
    const pending = this.env.storage.all('SELECT * FROM mention_pending');
    const creates = targets.filter(t => t.id !== author);
    if (pending.length - removed.filter(t => pending.some(p => p.comment_id === t.comment_id && p.recipient === t.recipient)).length + creates.length > 1000) throw new RoomError(409, 'mention_pending_limit');
    return { targets: creates, removed };
  }
  save(comment: string, thread: string, plan: Awaited<ReturnType<Mentions['prepare']>>, now: number) {
    if (!plan.targets.length && !plan.removed.length) return;
    const s = this.env.storage, order = meta(s, 'mention_order') + 1;
    for (const t of plan.removed) {
      s.exec('DELETE FROM mention_targets WHERE comment_id = ? AND recipient = ?', comment, t.recipient);
      s.exec('DELETE FROM mention_pending WHERE comment_id = ? AND recipient = ?', comment, t.recipient);
    }
    for (const t of plan.targets) {
      s.exec('INSERT INTO mention_targets VALUES (?, ?, ?, ?, ?, ?, ?, ?)', comment, t.id, t.person, t.lease, this.env.randomId(), order, thread, now);
      s.exec('INSERT INTO mention_pending VALUES (?, ?, ?)', comment, t.id, order);
    }
    this.dirty(order);
  }
  dirty(order = meta(this.env.storage, 'mention_order') + 1) {
    setMeta(this.env.storage, 'mention_order', order); setMeta(this.env.storage, 'mention_cleanup', 1);
  }
  cleanDeleted() {
    const s = this.env.storage;
    s.exec('DELETE FROM mention_pending WHERE comment_id NOT IN (SELECT id FROM comments)');
    s.exec('DELETE FROM mention_targets WHERE comment_id NOT IN (SELECT id FROM comments)');
    this.dirty();
  }
  async prune() {
    const source=this.env.mentions, s=this.env.storage;
    if (!source) return;
    const targets=s.all('SELECT * FROM mention_targets'); if (!targets.length) return;
    const valid=new Set(await source.validTargets(this.host.boardId,targets.map(t=>({recipient:t.recipient,lease:t.lease,occurrence:t.occurrence}))));
    const removed=targets.filter(t=>!valid.has(String(t.occurrence)));if(!removed.length)return;
    s.transaction(()=>{for(const t of removed){s.exec('DELETE FROM mention_pending WHERE comment_id=? AND recipient=?',t.comment_id,t.recipient);s.exec('DELETE FROM mention_targets WHERE occurrence=?',t.occurrence);}this.dirty();});
  }
  async deliver() {
    const source = this.env.mentions, s = this.env.storage;
    if (!source || !meta(s, 'mention_cleanup')) return;
    const order = meta(s, 'mention_order'), generation = meta(s, 'restore_generation');
    const active = s.all('SELECT * FROM mention_targets');
    const pending = s.all('SELECT * FROM mention_pending');
    const creates = active.filter(t => pending.some(p => p.comment_id === t.comment_id && p.recipient === t.recipient));
    await source.project(this.host.boardId, generation, order, active, creates);
    s.transaction(() => { s.exec('DELETE FROM mention_pending WHERE source_order <= ?', order); setMeta(s, 'mention_cleanup', 0); });
  }
  async restore(generation: number) {
    // External checkpoint is raised before replacing the source. A held old batch is fenced.
    await this.env.mentions?.clearNotices(this.host.boardId, generation);
    this.env.storage.transaction(() => {
      this.env.storage.exec('DELETE FROM mention_pending');
      this.env.storage.exec('DELETE FROM mention_targets');
      setMeta(this.env.storage, 'mention_cleanup', 0);
      setMeta(this.env.storage, 'mention_order', 0);
    });
  }
}
