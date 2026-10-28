// SPDX-License-Identifier: Apache-2.0
import type { ChangeEvent, KeyboardEvent } from "react";
import type { StrokeItem } from "../document";
import { inkColors, inkColor, INK_WEIGHTS, typeWithPoints, type InkWeight } from "../objects/registry";
export type StrokeSelection = { objects: StrokeItem[]; only: boolean; sameKind: boolean };
export type StrokeCommands = { color: (color: string) => void; weight: (weight: InkWeight) => void };
export type StrokeControlProps = { selection: StrokeSelection; commands: StrokeCommands; reason: string };
function selectKey(e: KeyboardEvent<HTMLSelectElement>, choose: (value: string) => void) {
  const select = e.currentTarget, options = Array.from(select.options).filter((o) => !o.disabled);
  let index = options.findIndex((o) => o.value === select.value);
  if (e.key === "Home") index = 0;
  else if (e.key === "End") index = options.length - 1;
  else if (e.key === "ArrowUp") index = Math.max(0, index - 1);
  else if (e.key === "ArrowDown") index = Math.min(options.length - 1, index + 1);
  else return;
  e.preventDefault(); e.stopPropagation();
  if (options[index]) choose(options[index].value);
}
export function StrokeFields({ selection: s, commands: c, reason }: StrokeControlProps) {
  if (!s.objects.length) return null;
  const first = s.objects[0], color = s.objects.every((o) => o.color === first.color) ? first.color : "", weight = s.objects.every((o) => o.weight === first.weight) ? first.weight : "";
  const colorReason = reason || (!s.sameKind ? "Select strokes of one kind to change colour." : "");
  return <div className="object-styles">
    <label htmlFor="stroke-colour">Stroke colour</label>
    <select id="stroke-colour" value={s.sameKind ? color : ""} disabled={!!colorReason} title={colorReason || "Stroke colour"} aria-describedby={colorReason ? "stroke-colour-reason" : undefined}
      onChange={(e) => c.color(e.target.value)} onKeyDown={(e) => selectKey(e, c.color)}>
      {(!color || !s.sameKind) && <option value="" disabled>Mixed</option>}
      {inkColors(first).map((color) => <option key={color.name} value={color.name}>{color.label}</option>)}
    </select>
    {colorReason && <span className="sr-only" id="stroke-colour-reason">{colorReason}</span>}
    <label htmlFor="stroke-weight">Stroke weight</label>
    <select id="stroke-weight" value={weight} disabled={!!reason} title={reason || "Stroke weight"} onChange={(e: ChangeEvent<HTMLSelectElement>) => c.weight(e.target.value as InkWeight)} onKeyDown={(e) => selectKey(e, (value) => c.weight(value as InkWeight))}>
      {!weight && <option value="" disabled>Mixed</option>}{INK_WEIGHTS.map((weight, i) => <option key={weight} value={weight}>{i ? "Thick" : "Thin"}</option>)}
    </select>
  </div>;
}
// Native details owns disclosure state; screen parts keep no React state/effects.
export function StrokeControls({ selection: s, commands: c, reason, remove }: StrokeControlProps & { remove: () => void }) {
  const first = s.objects[0];
  if (!first) return null;
  const close = (element: HTMLElement) => { const details = element.closest("details"); if (details) { details.open = false; details.querySelector("summary")?.focus(); } };
  return <>
    <span>{s.objects.length === 1 ? typeWithPoints().contextLabel(first) : s.objects.length + " strokes"}</span>
    {(["Colour", "Weight"] as const).map((name) => {
      const disabled = !!reason || name === "Colour" && !s.sameKind;
      return <details key={name} className="stroke-control" onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(e.target as HTMLElement); }
      }}>
        <summary role="button" aria-label={name} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
          onClick={(e) => { if (disabled) e.preventDefault(); }}>
          {name === "Colour" && <span className="colour-dot" style={{ background: inkColor(first) }} />}{name}
        </summary>
        <div className="ink-menu" role="group" aria-label={name}>
          {(name === "Colour" ? inkColors(first).map((color) => ({ value: color.name, label: color.label, fill: color.value }))
            : INK_WEIGHTS.map((weight, i) => ({ value: weight, label: i ? "Thick" : "Thin", fill: "" }))).map((entry) => <button key={entry.value} disabled={disabled} aria-pressed={s.objects.every((o) => (name === "Colour" ? o.color : o.weight) === entry.value)} onClick={(e) => {
              name === "Colour" ? c.color(entry.value) : c.weight(entry.value as InkWeight); close(e.currentTarget);
            }}>{entry.fill && <span className="colour-dot" style={{ background: entry.fill }} />}{entry.label}</button>)}
        </div>
      </details>;
    })}
    <button aria-label="Delete" disabled={!!reason} onClick={remove}>Delete</button>
  </>;
}
