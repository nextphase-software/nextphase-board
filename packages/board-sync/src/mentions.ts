// SPDX-License-Identifier: Apache-2.0
import type { Candidate, Mention } from './comments.ts';
export type MentionDraft = { text: string; mentions?: Mention[] };
export function mentionProblem(text: string, input: unknown): string | null {
  if (!Array.isArray(input)) return 'bad_mentions';
  if (input.length > 20) return 'mention_limit';
  const points = [...text]; let end = 0;
  for (const m of input) {
    if (!m || typeof m !== 'object' || Object.keys(m).sort().join() !== 'end,label,person,start' ||
      !Number.isSafeInteger(m.start) || !Number.isSafeInteger(m.end) || m.start < end || m.end <= m.start || m.end > points.length ||
      typeof m.person !== 'string' || !/^[0-9a-f]{32}$/.test(m.person) || typeof m.label !== 'string' || !m.label ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(m.label) ||
      new TextEncoder().encode(m.label).length > 256 || points.slice(m.start, m.end).join('') !== '@' + m.label) return 'bad_mentions';
    end = m.end;
  }
  return null;
}
export function replaceRange(draft: MentionDraft, start: number, end: number, text: string, insert?: Mention): MentionDraft {
  const points = [...draft.text], delta = [...text].length - (end - start);
  const mentions = (draft.mentions ?? []).filter(m => m.end <= start || m.start >= end && !(start === end && start > m.start && start < m.end))
    .map(m => m.start >= end ? { ...m, start: m.start + delta, end: m.end + delta } : m);
  if (insert) mentions.push(insert);
  return { text: points.slice(0, start).join('') + text + points.slice(end).join(''), mentions: mentions.sort((a,b) => a.start-b.start) };
}
export function changedText(draft: MentionDraft, text: string): MentionDraft {
  const a = [...draft.text], b = [...text]; let start = 0, end = a.length, nextEnd = b.length;
  while (start < end && start < nextEnd && a[start] === b[start]) start++;
  while (end > start && nextEnd > start && a[end-1] === b[nextEnd-1]) { end--; nextEnd--; }
  return replaceRange(draft, start, end, b.slice(start, nextEnd).join(''));
}
export function triggerAt(draft: MentionDraft, caret: number) {
  if (draft.mentions?.some(m => caret > m.start && caret <= m.end)) return null;
  const before = [...draft.text].slice(0, caret).join(''), match = /(?:^|\s)@([^\s@]*)$/u.exec(before);
  return match ? { start: caret - [...match[1]].length - 1, end: caret, query: match[1] } : null;
}
export function candidatePage<T extends Candidate>(candidates: T[], query: string, page = 0) {
  const matching = candidates.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) || (a.person < b.person ? -1 : a.person > b.person ? 1 : 0));
  return { candidates: matching.slice(page*20, page*20+20), more: matching.length > (page+1)*20 };
}
export function duplicateSuffixes<T extends { person: string; label: string }>(people: T[]) {
  return people.map(p => {
    const equal = people.filter(q => q.label === p.label); let length = 8;
    while (length < 32 && equal.some(q => q.person !== p.person && q.person.slice(0,length) === p.person.slice(0,length))) length++;
    return { ...p, suffix: equal.length > 1 ? p.person.slice(0,length) : '' };
  });
}
