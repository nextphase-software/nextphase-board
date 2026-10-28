// SPDX-License-Identifier: Apache-2.0
import type { ItemV8 as Item } from "../document";
import { hasText } from "../objects/registry";
import { remap, segments } from "../marks";

export function FormatPreview({ item, text }: { item: Item; text: string }) {
  if (!hasText(item)) return null;
  const marks = text === item.text ? item.marks : remap(item.marks, item.text, text);
  if (!marks.length) return null;
  return <p className="format-preview" aria-hidden="true">
    {segments(text, marks).map((run, i) => <span key={i} style={{
      ...(run.bold ? { fontWeight: 700 } : {}),
      ...(run.italic ? { fontStyle: "italic" } : {}),
      ...(run.strike ? { textDecoration: "line-through" } : {}),
    }}>{run.text}</span>)}
  </p>;
}
