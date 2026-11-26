// SPDX-License-Identifier: Apache-2.0
import type { ItemV12 as Item } from "nextphase-board-rules/document.ts";
import { hasText } from "nextphase-board-rules/objects/registry.ts";
import { FLAGS, remap, segments } from "nextphase-board-rules/marks.ts";

export function FormatPreview({ item, text }: { item: Item; text: string }) {
  if (!hasText(item)) return null;
  const marks = text === item.text ? item.marks : remap(item.marks, item.text, text);
  if (!marks.some(mark => FLAGS.some(flag => mark[flag]))) return null;
  const runs: ReturnType<typeof segments> = [];
  for (const { link: _link, ...run } of segments(text, marks)) {
    const previous = runs.at(-1);
    if (previous && FLAGS.every(flag => previous[flag] === run[flag])) previous.text += run.text;
    else runs.push(run);
  }
  return <p className="format-preview" aria-hidden="true">
    {runs.map((run, i) => <span key={i} style={{
      ...(run.bold ? { fontWeight: 700 } : {}),
      ...(run.italic ? { fontStyle: "italic" } : {}),
      ...(run.strike ? { textDecoration: "line-through" } : {}),
    }}>{run.text}</span>)}
  </p>;
}
