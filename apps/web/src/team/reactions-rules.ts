// SPDX-License-Identifier: Apache-2.0
import type { ReactionId, Reacted } from './hosted-board';
export const REACTIONS = [
  ['thumbs-up', 'Thumbs up'], ['plus-one', 'Plus one'], ['star', 'Star'], ['question', 'Question'],
  ['thumbs-down', 'Thumbs down'], ['dot', 'Dot'], ['me', 'Me'], ['heart', 'Heart'],
] as const;
export type Point = { x: number; y: number };
export function reactionFrame(reaction: ReactionId, x: number, y: number) {
  return { kind: 'react' as const, reaction, x, y };
}
export function validReaction(v: unknown): v is ReturnType<typeof reactionFrame> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const f = v as Record<string, unknown>;
  return Object.keys(f).sort().join() === 'kind,reaction,x,y' && f.kind === 'react' && REACTIONS.some(([id]) => id === f.reaction) &&
    ['x', 'y'].every(k => typeof f[k] === 'number' && Number.isFinite(f[k]) && Math.abs(f[k] as number) <= 1000000) && new TextEncoder().encode(JSON.stringify(v)).length <= 256;
}
export function validReacted(v: Reacted) {
  return Object.keys(v).sort().join() === 'connection,kind,reaction,x,y' && v.kind === 'reacted' && typeof v.connection === 'string' &&
    new TextEncoder().encode(JSON.stringify(v)).length <= 512 && validReaction(reactionFrame(v.reaction, v.x, v.y));
}
export function clientBudget(times: readonly number[], now: number) {
  const live = times.filter(at => at > now - 1000);
  return live.length < 4 ? [...live, now] : null;
}
export function wheelPlacement(width: number, height: number, button: { left: number; width: number }, paletteTop: number, pointer?: Point) {
  return { left: Math.max(12, Math.min(width - 236, pointer ? pointer.x - 112 : button.left + button.width / 2 - 112)),
    top: Math.max(12, Math.min(height - 236, pointer ? pointer.y - 112 : paletteTop - 236)) };
}
export function slotPosition(index: number) {
  const angle = -Math.PI / 2 + index * Math.PI / 4;
  return { left: 112 + 80 * Math.cos(angle) - 24, top: 112 + 80 * Math.sin(angle) - 24 };
}
export const BURST_COPIES = [[32,-2,0],[26,14,40],[22,-16,80],[18,6,110],[16,-10,140],[14,20,170],[12,-22,200]] as const;
export function burstCopies(origin: Point, age: number, reduced = false) {
  return (reduced ? [[32, 0, 0]] : BURST_COPIES).flatMap(([size, offset, delay]) => {
    const p = (age - delay) / 1400;
    if (p < 0 || p >= 1) return [];
    const e = 1 - (1 - p) ** 2;
    return [{ size, left: origin.x + (reduced ? 0 : offset * 1.1 * e) - size / 2,
      top: origin.y - 8 - (reduced ? 0 : 160 * e) - size / 2, opacity: reduced ? 1 - p : Math.min(1, (1 - p) * 1.6) }];
  });
}
export const capBursts = <T>(bursts: readonly T[]) => bursts.slice(-20);
export function reactionDisabled(locked: boolean, joined: boolean, preview: boolean, voting: boolean) {
  return locked ? 'Reactions are off while the board is being restored' : !joined ? 'Reactions are off until the board reconnects' :
    preview ? 'Reactions are off while viewing history' : voting ? 'Reactions are off while voting' : '';
}
export function reactionKeyAllowed(target: Element | null, canvas: Element | null, body: Element, composing: boolean) {
  return !composing && (target === canvas || target === body) && !target?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),dialog,[role="dialog"],[role="alertdialog"]');
}
