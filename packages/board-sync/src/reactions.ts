// SPDX-License-Identifier: Apache-2.0
export const REACTIONS = [
  ['thumbs-up', 'Thumbs up'], ['plus-one', 'Plus one'], ['star', 'Star'], ['question', 'Question'],
  ['thumbs-down', 'Thumbs down'], ['dot', 'Dot'], ['me', 'Me'], ['heart', 'Heart'],
] as const;
export type ReactionId = typeof REACTIONS[number][0];
export type Reaction = { kind: 'react'; reaction: ReactionId; x: number; y: number };
export type Reacted = Omit<Reaction, 'kind'> & { kind: 'reacted'; connection: string };
export type ReactionEvent = Reacted | { kind: 'reactions_clear' };
export const REACTION_UP_LIMIT = 256, REACTION_DOWN_LIMIT = 512;
export const reactionBytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const reactionId = (v: unknown): v is ReactionId => REACTIONS.some(([id]) => id === v);
const point = (v: Record<string, unknown>) => ['x', 'y'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && Math.abs(v[k] as number) <= 1000000);
export function checkReaction(v: unknown, size: number): Reaction | 'reaction_too_large' | 'bad_reaction' {
  if (size > REACTION_UP_LIMIT) return 'reaction_too_large';
  if (!record(v) || Object.keys(v).sort().join() !== 'kind,reaction,x,y' || v.kind !== 'react' || !reactionId(v.reaction) || !point(v)) return 'bad_reaction';
  return v as Reaction;
}
export function checkReacted(v: unknown, size: number): v is Reacted {
  return size <= REACTION_DOWN_LIMIT && record(v) && Object.keys(v).sort().join() === 'connection,kind,reaction,x,y' &&
    v.kind === 'reacted' && typeof v.connection === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v.connection) && reactionId(v.reaction) && point(v);
}
export function reactionBudget(times: readonly number[] | undefined, now: number, limit = 5): number[] | null {
  const live = (times ?? []).filter(at => at > now - 1000);
  return live.length >= limit ? null : [...live, now];
}
