// SPDX-License-Identifier: Apache-2.0

export type LimitRule = { window: number; max: number };
export type Counts = Record<string, { start: number; count: number }>;
export interface LinkLimitsClient { take(key: string): Promise<boolean>; }

const minute = 60_000;
const day = 86_400_000;
export function rulesFor(key: string): LimitRule[] {
  return key.startsWith("person:") ? [{ window: minute, max: 20 }]
    : [{ window: minute, max: 10 }, { window: day, max: 200 }];
}
function nextEnd(counts: Counts): number | null {
  const values = Object.entries(counts).map(([window, entry]) => entry.start + Number(window));
  return values.length ? Math.min(...values) : null;
}
export function prune(counts: Counts, now: number): { counts: Counts; next: number | null } {
  const current = Object.fromEntries(Object.entries(counts).filter(([window, entry]) => entry.start + Number(window) > now));
  return { counts: current, next: nextEnd(current) };
}
export function take(counts: Counts, rules: LimitRule[], now: number): { allowed: boolean; counts: Counts; next: number | null } {
  const windows = rules.map(rule => {
    const start = Math.floor(now / rule.window) * rule.window;
    const stored = counts[rule.window];
    return { ...rule, entry: stored && stored.start >= start ? stored : { start, count: 0 } };
  });
  if (windows.some(({ entry, max }) => entry.count >= max)) return { allowed: false, counts, next: nextEnd(counts) };
  const result = { ...counts };
  for (const { window, entry } of windows) result[window] = { start: entry.start, count: entry.count + 1 };
  return { allowed: true, counts: result, next: nextEnd(result) };
}
export function memoryLimits(now: () => number = Date.now): LinkLimitsClient {
  const keys = new Map<string, Counts>();
  let prunedAt = -Infinity;
  return {
    async take(key) {
      const time = now();
      if (time >= prunedAt + minute) {
        for (const [id, counts] of keys) {
          const current = prune(counts, time);
          if (current.next === null) keys.delete(id);
          else keys.set(id, current.counts);
        }
        prunedAt = time;
      }
      const result = take(keys.get(key) ?? {}, rulesFor(key), time);
      if (result.allowed) keys.set(key, result.counts);
      return result.allowed;
    },
  };
}
