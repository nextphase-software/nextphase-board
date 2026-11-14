// SPDX-License-Identifier: Apache-2.0
import type { ReactElement } from "react";
import type { BoardV11 as Board } from "nextphase-board-rules/document.ts";
import { isMindNode } from "nextphase-board-rules/objects/registry.ts";
import type { ResolvedItem } from "../geometry";
import { descendants, outerSides, MAP_WORDS, type MapCommand } from "../mind-map";

const mac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const keys = (sibling: boolean) => mac() ? sibling ? "⌘⇧↩" : "⌘↩" : sibling ? "Ctrl+Shift+Enter" : "Ctrl+Enter";

function AddButton({ x, y, name, sibling, run }: { x: number; y: number; name: string; sibling: boolean; run: () => void }) {
  return <button className="mind-map-add" aria-label={name} style={{ left: x, top: y }} onClick={run}>
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M1 5h8M5 1v8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
    <span className="mind-map-tip" aria-hidden="true">{(sibling ? "Add sibling " : "Add child ") + keys(sibling)}</span>
  </button>;
}

// The add buttons of a selected node and every visible collapse badge: DOM
// buttons with 28 × 28 hits, placed with pos like the connection dots.
export function MindMapButtons({ board, objects, selected, inline, pos, zoom, busy, composing, readOnly, command }: {
  board: Board; objects: readonly ResolvedItem[]; selected: ReadonlySet<string>; inline: boolean;
  pos: (point: { x: number; y: number }) => { left: number; top: number }; zoom: number;
  busy: boolean; composing: boolean; readOnly: boolean; command: (name: MapCommand, id?: string) => unknown;
}) {
  const nodes = objects.filter(isMindNode), sides = outerSides(board.objects);
  const counts = new Map(nodes.filter((o) => o.collapsed).map((o) => [o.id, descendants(board.objects, o.id).length]));
  const box = (o: ResolvedItem) => { const p = pos(o); return { left: p.left, top: p.top, width: o.width * zoom, height: o.height * zoom }; };
  const node = selected.size === 1 ? nodes.find((o) => selected.has(o.id)) : undefined;
  const buttons: ReactElement[] = [];
  if (node && !inline && !busy && !composing && !readOnly) {
    const b = box(node), middle = b.top + b.height / 2;
    if (node.parent === null) {
      buttons.push(<AddButton key="left" x={b.left - 20} y={middle} name="Add child on the left" sibling={false} run={() => command("Add child left")} />,
        <AddButton key="right" x={b.left + b.width + 20} y={middle} name="Add child on the right" sibling={false} run={() => command("Add child right")} />);
    } else {
      const out = 20 + (counts.get(node.id) ? 28 : 0), right = sides.get(node.id) !== "left";
      buttons.push(<AddButton key="child" x={right ? b.left + b.width + out : b.left - out} y={middle} name="Add child" sibling={false} run={() => command("Add child")} />,
        <AddButton key="sibling" x={b.left + b.width / 2} y={b.top + b.height + 20} name="Add sibling" sibling run={() => command("Add sibling")} />);
    }
  }
  return <>
    {buttons}
    {nodes.filter((o) => counts.get(o.id)).map((o) => {
      const b = box(o), right = sides.get(o.id) !== "left", count = counts.get(o.id)!;
      return <button key={"badge" + o.id} className="mind-map-badge" aria-label={MAP_WORDS.badge(o.text, count)} disabled={readOnly}
        style={{ left: right ? b.left + b.width + 16 : b.left - 16, top: b.top + b.height / 2 }}
        onClick={() => command("Expand", o.id)}>{MAP_WORDS.count(count)}</button>;
    })}
  </>;
}
