// SPDX-License-Identifier: Apache-2.0
import type { HostedBoard, ReactionEvent, ReactionId } from './hosted-board';
import { capBursts, clientBudget, reactionDisabled, reactionFrame, validReaction, validReacted, type Point } from './reactions-rules.ts';
export type Burst = Point & { id: number; reaction: ReactionId; label: string; colour: string; started: number };
export class BoardReactions {
  armed?: ReactionId;
  wheel?: { left: number; top: number };
  pointer?: Point;
  spaceHeld = false;
  bursts: Burst[] = [];
  private times: number[] = [];
  private serial = 0;
  private revision = 0;
  private listeners = new Set<() => void>();
  private host: HostedBoard;
  private setTool?: (tool: string) => void;
  private connection?: string;
  constructor(host: HostedBoard) { this.host = host; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.revision;
  private changed() { this.revision++; for (const listener of this.listeners) listener(); }
  get disabledReason() { return reactionDisabled(this.host.history.locked, this.host.snapshot.connected, this.host.history.previewing, this.host.voting.running); }
  bindTool(set: (tool: string) => void) { this.setTool = set; return () => { this.setTool = undefined; }; }
  toolChanged(tool: string) {
    if (tool !== 'Reactions' && (this.armed || this.wheel)) { this.armed = undefined; this.wheel = undefined; this.changed(); }
  }
  sync() {
    const connection = this.host.presence.self?.connection;
    if (connection !== this.connection) { this.connection = connection; this.times = []; this.clear(); }
    if (this.disabledReason) this.clear();
  }
  open(position: { left: number; top: number }) { if (!this.disabledReason) { this.wheel = position; this.changed(); } }
  closeWheel() { if (this.wheel) { this.wheel = undefined; this.changed(); } }
  arm(id: ReactionId) { if (!this.disabledReason) { this.armed = id; this.wheel = undefined; this.setTool?.('Reactions'); this.changed(); } }
  disarm() { const armed = this.armed; this.armed = undefined; this.wheel = undefined; if (armed) this.setTool?.('Select'); this.changed(); }
  clear() {
    if (!this.bursts.length && !this.armed && !this.wheel) return;
    this.bursts = []; this.disarm();
  }
  track(pointer?: Point) { this.pointer = pointer; this.changed(); }
  expire(now: number, reduced = false) {
    const live = this.bursts.filter(b => now - b.started < (reduced ? 1400 : 1600));
    if (live.length !== this.bursts.length) { this.bursts = live; this.changed(); }
  }
  private burst(reaction: ReactionId, x: number, y: number, sender: { label: string; colour: string }, now: number) {
    this.expire(now); this.bursts = capBursts([...this.bursts, { id: ++this.serial, reaction, x, y, label: sender.label, colour: sender.colour, started: now }]); this.changed();
  }
  send(x: number, y: number, now = Date.now()) {
    const id = this.armed, self = this.host.presence.self;
    if (!id || !self || this.disabledReason || !validReaction(reactionFrame(id, x, y))) return false;
    const times = clientBudget(this.times, now); if (!times) return false;
    this.times = times;
    if (!this.host.sendReaction(id, x, y)) return false;
    this.burst(id, x, y, self, now); return true;
  }
  receive(event: ReactionEvent, now = Date.now()) {
    if (event.kind === 'reactions_clear') { this.clear(); return; }
    if (this.disabledReason || !validReacted(event)) return;
    const sender = this.host.presence.others.find(p => p.connection === event.connection);
    if (sender) this.burst(event.reaction, event.x, event.y, sender, now);
  }
  // Spotlight uses this before its existing leave handlers. Event capture itself
  // remains in the reaction layer, ahead of the canvas editing handlers.
  ownsEvent(event: { type: string; target: EventTarget | null; key?: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean; button?: number }) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.reactions-tool,.reactions-wheel')) return true;
    if (event.type === 'pointerdown') return !!this.armed && event.button === 0 && !this.spaceHeld && !!target?.closest('.scene') && !target.closest('button,input,textarea,[contenteditable=true]');
    if (event.isComposing || target?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),dialog,[role=dialog],[role=alertdialog]')) return false;
    if (event.key === 'Escape') return !!this.armed || !!this.wheel;
    if (event.key === 'Enter') return !!this.armed && !!target?.matches('.scene');
    return event.key?.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey && !event.altKey && !this.disabledReason && !!target?.matches('.scene,body');
  }
}
