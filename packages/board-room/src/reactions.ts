// SPDX-License-Identifier: Apache-2.0
import { checkReaction, reactionBudget, reactionBytes, REACTION_DOWN_LIMIT } from 'nextphase-board-sync/reactions.ts';
import { send, type Connection } from './protocol.ts';
import type { Room } from './room.ts';
// Only bounded connection budgets survive reconstruction. Bursts are never retained.
export class Reactions {
  private host: Room;
  constructor(host: Room) { this.host = host; }
  private open(c: Connection) {
    const a = c.attachment();
    return !!a.presence && (a.presenceAt ?? 0) + 30000 > this.host.env.now() && a.expiresAt > this.host.env.now() && this.host.env.connections().some(p => p.attachment().connectionId === a.connectionId);
  }
  async receive(c: Connection, message: unknown, size: number) {
    const a = c.attachment(), budget = reactionBudget(a.reactionTimes, this.host.env.now());
    if (!budget) return;
    c.attach({ ...a, reactionTimes: budget });
    const value = checkReaction(message, size);
    if (typeof value === 'string') { send(c, { kind: 'refused', reason: value }); return; }
    if (this.host.voting.running()) { send(c, { kind: 'refused', reason: 'reactions_voting' }); return; }
    try { await this.host.spotlight.authority(c); } catch { return; }
    if (!this.open(c) || this.host.voting.running()) return;
    const frame = { ...value, kind: 'reacted', connection: c.attachment().connectionId };
    if (reactionBytes(frame) > REACTION_DOWN_LIMIT) return;
    for (const peer of this.host.env.connections()) {
      if (peer.attachment().connectionId === frame.connection || !this.open(peer)) continue;
      try { await this.host.spotlight.authority(peer); } catch { continue; }
      // Authority awaits can close sockets; never deliver against a stale attachment.
      if (!this.open(c) || this.host.voting.running()) return;
      if (this.open(peer)) send(peer, frame);
    }
  }
}
