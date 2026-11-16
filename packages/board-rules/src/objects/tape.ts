// SPDX-License-Identifier: Apache-2.0
import type { InkPoint } from './stroke.ts';
export const TAPE_PATTERNS = [
  { value: 'stripes', name: 'Stripes' }, { value: 'dots', name: 'Dots' },
  { value: 'grid', name: 'Grid' }, { value: 'zigzag', name: 'Zigzag' },
  { value: 'checks', name: 'Checks' }, { value: 'kraft', name: 'Kraft' },
] as const;
export type TapePattern = typeof TAPE_PATTERNS[number]['value'];
export type TapeKeys = { pattern: TapePattern; points: InkPoint[] };
export const TAPE_BAND = 28, TAPE_PAD = 14, TAPE_MIN = 16, TAPE_MAX = 2000;
export function validTape(value: object): boolean {
  const o = value as TapeKeys & { width: number; height: number };
  if (!TAPE_PATTERNS.some(p => p.value === o.pattern) || !Number.isSafeInteger(o.width) || !Number.isSafeInteger(o.height) ||
    !Array.isArray(o.points) || o.points.length !== 2 || !o.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isSafeInteger) &&
      p[0] >= 0 && p[0] <= o.width && p[1] >= 0 && p[1] <= o.height)) return false;
  const [a,b] = o.points, length = Math.hypot(b[0]-a[0], b[1]-a[1]);
  return Math.min(a[0],b[0]) === TAPE_PAD && Math.min(a[1],b[1]) === TAPE_PAD &&
    Math.max(a[0],b[0])+TAPE_PAD === o.width && Math.max(a[1],b[1])+TAPE_PAD === o.height && length >= TAPE_MIN && length <= TAPE_MAX;
}
export const tape = {
  voting: false, type: 'tape', label: 'Washi tape', tool: null, validFrom: 12, body: 'tape-body',
  points: false, text: false, ends: false, container: false, richText: false, kinds: [],
  extraKeys: ['pattern','points'] as readonly string[],
  savedKeys: ['id','generation','type','page','pattern','group','section','x','y','width','height','points','order'],
  validExtras: validTape, sizeRange: { min: 28, max: 2028 }, shapePaint: false, growsWithText: false,
  labelPrefix: (_o: object) => 'washi tape', contextLabel: (_o: object) => 'Washi tape',
} as const;
