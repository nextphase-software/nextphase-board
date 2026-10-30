// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { SHAPE_KINDS, kindForTool } from "nextphase-board-rules/objects/registry.ts";
import { Icon } from "../icons";

export function ShapesPanel({ tool, setTool, scene, disabled }: {
  tool: string; setTool: Dispatch<SetStateAction<string>>;
  scene: RefObject<HTMLDivElement | null>; disabled: boolean;
}) {
  if (!kindForTool(tool)) return null;
  return <section className="shapes-panel floating" aria-label="Shapes">
    <header><h2>Shapes</h2><button disabled={disabled} onClick={() => { setTool("Select"); scene.current?.focus(); }}>Close</button></header>
    <h3>Basic</h3>
    <div className="shape-tiles">{SHAPE_KINDS.map((k) => <button key={k.kind} disabled={disabled}
      title={k.tool + " · " + k.key} aria-pressed={tool === k.tool}
      onClick={() => { setTool(k.tool); scene.current?.focus(); }}><Icon name={k.tool} />{k.tool}</button>)}</div>
    <p>Drag on the board to draw, or click for a 180 × 180 shape.</p>
  </section>;
}
