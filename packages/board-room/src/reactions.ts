// SPDX-License-Identifier: Apache-2.0
import { checkReaction, reactionBudget, reactionBytes, REACTION_DOWN_LIMIT } from 'nextphase-board-sync/reactions.ts';
import { closeCode } from './access.ts';
import { endPresence } from './presence.ts';
import { meta } from './storage.ts';
import { send, type Connection, type Role } from './protocol.ts';
import type { Room } from './room.ts';
type Admission = { generation: number; open: ReadonlySet<string>; grants: ReadonlyMap<string, { role: Role; epoch: number }> };
// Only bounded connection budgets survive reconstruction. Bursts are never retained.
export class Reactions {
  private host: Room;
  constructor(host: Room) { this.host = host; }
  private roomCurrent(generation: number) {
    return !this.host.access.locked && !this.host.lifecycle.discarded && !this.host.history.active() &&
      !meta(this.host.env.storage, 'explicit_recovery_pending') && !meta(this.host.env.storage, 'restore_pending') &&
      meta(this.host.env.storage, 'restore_generation') === generation && !this.host.voting.running();
  }
  // Called only after this frame's strict replay, with no await between this
  // read and send. No admission result is kept for another frame or recipient.
  admitted(c: Connection, admission: Admission) {
    const a = c.attachment(), now = this.host.env.now(), generation = admission.generation;
    if (!admission.open.has(a.connectionId)) return false;
    const grant = admission.grants.get(a.id);
    const code = a.expiresAt <= now ? 4401 : a.restoreGeneration !== generation ? 4423 :
      !grant || grant.epoch !== a.epoch || grant.role !== a.role ? closeCode(grant?.role ?? null, a.role) : null;
    if (code !== null) {
      this.host.spotlight.closed(c, code); endPresence(c, this.host.env.connections()); c.close(code); return false;
    }
    return !!a.presence && (a.presenceAt ?? 0) + 30000 > now;
  }
  async receive(c: Connection, message: unknown, size: number) {
    const a = c.attachment(), budget = reactionBudget(a.reactionTimes, this.host.env.now());
    if (!budget) return;
    c.attach({ ...a, reactionTimes: budget });
    const value = checkReaction(message, size);
    if (typeof value === 'string') { send(c, { kind: 'refused', reason: value }); return; }
    if (this.host.voting.running()) { send(c, { kind: 'refused', reason: 'reactions_voting' }); return; }
    let admission: Admission;
    let peers: Connection[];
    // The shared strict authority boundary replays access once, brackets the
    // await with lifecycle/fence checks, and fails closed on required-source I/O.
    try {
      const generation = await this.host.timer.authority();
      if (!this.roomCurrent(generation)) return;
      peers = this.host.env.connections();
      const grants = this.host.env.storage.all('SELECT person_id, role, epoch FROM grants');
      admission = { generation, open: new Set(peers.map(p => p.attachment().connectionId)),
        grants: new Map(grants.map(g => [String(g.person_id), { role: g.role as Role, epoch: Number(g.epoch) }])) };
      if (!this.admitted(c, admission)) return;
    } catch { return; }
    const frame = { ...value, kind: 'reacted', connection: c.attachment().connectionId };
    if (reactionBytes(frame) > REACTION_DOWN_LIMIT) return;
    // This context is local to one frame. No await separates the snapshot,
    // current attachment checks and sends, so ordered changes cannot interleave.
    for (const peer of peers) {
      if (peer.attachment().connectionId === frame.connection) continue;
      try { if (!this.admitted(c, admission)) return; } catch { return; }
      // Independent current reads isolate a failed recipient without undoing
      // earlier deliveries. There is no service I/O, queue or retry in this loop.
      let admitted: boolean;
      try { admitted = this.admitted(peer, admission); } catch { continue; }
      if (admitted) send(peer, frame);
    }
  }
}
