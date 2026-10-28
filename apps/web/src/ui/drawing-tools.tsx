// SPDX-License-Identifier: Apache-2.0
import { DRAWING_TOOLS, INK_KINDS, INK_WEIGHTS, drawingStyleFor, inkColors, isDrawingTool, isEraser, type DrawingStyle, type InkWeight } from "../objects/registry";
export type DrawingControls = { lastDrawingTool: string; style: DrawingStyle; change: (value: { color?: string; weight?: InkWeight }) => void };
export function DrawingIcon({ name }: { name: string }) {
  const index = DRAWING_TOOLS.findIndex((t) => t === name);
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {index === 2 ? <><path d="m4 15 9-10 7 6-9 10H8zM9 10l7 6M11 21h9" /></>
      : <><path d="m5 15 9-11 6 5-9 11zM5 15l-1 6 7-1M12 7l6 5" />{index === 1 && <path d="M3 22h17" strokeWidth="3" />}</>}
  </svg>;
}
export function DrawButton({ tool, drawing, disabled, arm }: { tool: string; drawing: DrawingControls; disabled: boolean; arm: (tool: string) => void }) {
  return <button className="icon-button" aria-label="Draw" title="Draw" aria-pressed={isDrawingTool(tool)} disabled={disabled} onClick={() => arm(drawing.lastDrawingTool)}>
    <DrawingIcon name={drawing.lastDrawingTool} /><span className="tooltip">Draw</span>
  </button>;
}
export function DrawingBar({ tool, drawing, disabled, arm }: { tool: string; drawing: DrawingControls; disabled: boolean; arm: (tool: string) => void }) {
  if (!isDrawingTool(tool)) return null;
  const eraser = isEraser(tool), style = drawingStyleFor(eraser ? INK_KINDS[0].tool : tool, drawing.style);
  return <div className="drawing-bar floating" role="toolbar" aria-label="Drawing tools">
    {DRAWING_TOOLS.map((name) => <button key={name} className="icon-button" aria-label={name} title={name} aria-pressed={tool === name} disabled={disabled} onClick={() => arm(name)}><DrawingIcon name={name} /></button>)}
    <span className="divider" aria-hidden="true" />
    {INK_WEIGHTS.map((weight, i) => <button key={weight} className="icon-button" aria-label={i ? "Thick" : "Thin"} title={i ? "Thick" : "Thin"} aria-pressed={!eraser && style.weight === weight} disabled={disabled || eraser} onClick={() => drawing.change({ weight })}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16Q7 3 12 12T21 8" fill="none" stroke="currentColor" strokeWidth={i ? 4 : 1.5} strokeLinecap="round" /></svg>
    </button>)}
    <span className="divider" aria-hidden="true" />
    {inkColors(style).map((color) => <button key={color.name} className="icon-button ink-dot" aria-label={color.label} title={color.label} aria-pressed={!eraser && style.color === color.name} disabled={disabled || eraser} onClick={() => drawing.change({ color: color.name })}>
      <span className="colour-dot" style={{ background: color.value }} />
    </button>)}
  </div>;
}
