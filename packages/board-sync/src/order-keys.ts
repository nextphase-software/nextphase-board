// SPDX-License-Identifier: Apache-2.0
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const compareKeys = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const validOrderKey = (key: unknown): key is string =>
  typeof key === "string" && /^[0-9A-Za-z]{1,64}$/.test(key) && !key.endsWith("0");

// At each length, the lexical interval is an integer interval in base 62.
// Multiples of 62 end in 0 and are excluded. Search shortest lengths first.
export function between(low?: string, high?: string): string | undefined {
  if (low !== undefined && !validOrderKey(low) || high !== undefined && !validOrderKey(high) ||
    low !== undefined && high !== undefined && low >= high) return undefined;
  const rank = (key: string, length: number) => [...key.slice(0, length).padEnd(length, "0")]
    .reduce((n, c) => n * 62n + BigInt(alphabet.indexOf(c)), 0n);
  for (let length = 1; length <= 64; length++) {
    const min = low === undefined ? 0n : rank(low, length) + 1n;
    const max = high === undefined ? 62n ** BigInt(length) - 1n
      : rank(high, length) - (high.length > length ? 0n : 1n);
    if (min > max) continue;
    let mid = (min + max) / 2n;
    if (mid % 62n === 0n) mid = mid - 1n >= min ? mid - 1n : mid + 1n;
    if (mid < min || mid > max) continue;
    let key = "";
    for (let n = mid, i = 0; i < length; i++, n /= 62n) key = alphabet[Number(n % 62n)] + key;
    return key;
  }
  return undefined;
}
export function rebalance(ids: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  let previous: string | undefined;
  for (const id of ids) { previous = between(previous); result.set(id, previous!); }
  return result;
}
export function increasingPositions(keys: readonly (string | undefined)[]): number[] {
  const lengths = keys.map(() => 0);
  for (let i = keys.length - 1; i >= 0; i--) if (keys[i] !== undefined) {
    lengths[i] = 1;
    for (let j = i + 1; j < keys.length; j++) if (keys[j] !== undefined && keys[i]! < keys[j]!) {
      lengths[i] = Math.max(lengths[i], 1 + lengths[j]);
    }
  }
  const result: number[] = [];
  let remaining = Math.max(0, ...lengths), previous: string | undefined;
  for (let i = 0; remaining && i < keys.length; i++) if (keys[i] !== undefined &&
    (previous === undefined || keys[i]! > previous) && lengths[i] >= remaining) {
    result.push(i); previous = keys[i]; remaining--;
  }
  return result;
}
// Return only keys that need assignment. Equal keys already in reading order
// are deliberately retained until a step actually changes the order.
export function orderWrites(ids: readonly string[], stored: ReadonlyMap<string, string>, moved: readonly string[] = []) {
  if (ids.every(id => stored.has(id)) && [...ids].sort((a, b) =>
    compareKeys(stored.get(a)!, stored.get(b)!) || compareKeys(a, b)).every((id, i) => id === ids[i])) return new Map<string, string>();
  const keys = ids.map(id => stored.get(id)), stationary = ids.map((id, i) => moved.includes(id) ? -1 : i).filter(i => i >= 0);
  const keep = new Set(moved.length && stationary.every((i, j) => keys[i] !== undefined && (!j || keys[stationary[j - 1]]! < keys[i]!))
    ? stationary : increasingPositions(keys));
  const writes = new Map<string, string>();
  let previous: string | undefined;
  for (let i = 0; i < ids.length; i++) {
    if (keep.has(i)) { previous = keys[i]; continue; }
    const next = [...keep].find(j => j > i);
    const key = between(previous, next === undefined ? undefined : keys[next]);
    if (key === undefined) return rebalance(ids);
    if (key !== keys[i]) writes.set(ids[i], key);
    previous = key;
  }
  return writes;
}
