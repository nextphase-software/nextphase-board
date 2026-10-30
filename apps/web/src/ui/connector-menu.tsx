// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import type { ConnectorItem } from "nextphase-board-rules/document.ts";
import { HEADS, HEAD_LABELS, LINE_SHAPES, LINE_SHAPE_LABELS, SHAPE_COLORS, shapeColor, shapeColorLabel, type ConnectorStyle, type End } from "nextphase-board-rules/objects/registry.ts";
import { Icon } from "../icons";
import { CustomColour } from "./shape-controls";
import { HeadIcon, LineShapeIcon, LineStyleIcon } from "./connector-icons";
export type ConnectorMenuName = "colour" | "line" | "start" | "route" | "end";
export type ConnectorPopup = {
  open: string; toggle: (name: ConnectorMenuName) => void; close: () => void;
  controls: Record<ConnectorMenuName, RefObject<HTMLSpanElement | null>>;
  buttons: Record<ConnectorMenuName, RefObject<HTMLButtonElement | null>>;
  menu: RefObject<HTMLDivElement | null>;
};
export type ConnectorCommands = {
  style: <K extends keyof ConnectorStyle>(key: K, value: ConnectorStyle[K]) => void;
  reconnect: (id: string, end: "from" | "to", target: End) => void;
};
export type ConnectorMenuProps = { objects: readonly ConnectorItem[]; commands: ConnectorCommands; popup: ConnectorPopup; reason: string };
export function ConnectorMenu({ objects, commands, popup, reason, name }: ConnectorMenuProps & { name: ConnectorMenuName }) {
  const first = objects[0];
  if (!first) return null;
  const common = <K extends keyof ConnectorStyle>(key: K) => objects.every((o) => o[key] === first[key]) ? first[key] : "";
  const choose = <K extends keyof ConnectorStyle>(key: K, value: ConnectorStyle[K]) => { commands.style(key, value); popup.close(); };
  const colour = common("lineColor"), weight = common("lineWeight"), dash = common("lineDash");
  const headKey = name === "start" ? "startHead" : "endHead", head = common(headKey), shape = common("lineShape");
  const title = { colour: "Colour", line: "Line style", start: "Start point", route: "Line shape", end: "End point" }[name];
  const headLabel = head ? HEAD_LABELS[HEADS.indexOf(head)] : "Mixed";
  const label = name === "colour" ? colour ? shapeColorLabel(colour) : "Mixed"
    : name === "line" ? (weight ? weight === "thin" ? "Thin" : "Thick" : "Mixed") + ", " + (dash ? dash === "solid" ? "Solid" : "Dashed" : "Mixed")
    : name === "route" ? shape ? LINE_SHAPE_LABELS[LINE_SHAPES.indexOf(shape)] : "Mixed" : headLabel;
  const opened = popup.open === name;
  return <span className="connector-control" ref={popup.controls[name]}
    onKeyDown={(e) => { if (e.key === "Escape" && opened) { e.preventDefault(); e.stopPropagation(); popup.close(); } }}>
    <button ref={popup.buttons[name]} disabled={!!reason} aria-describedby="selection-reason" aria-label={title + ": " + label}
      title={reason || title + ": " + label} aria-expanded={opened} aria-controls={opened ? "connector-" + name + "-popup" : undefined}
      onClick={() => popup.toggle(name)}>
      {name === "colour" ? <span className="colour-dot" style={{ background: shapeColor(colour || first.lineColor) }} />
        : name === "line" ? <LineStyleIcon /> : name === "route" ? <LineShapeIcon shape={shape || first.lineShape} />
        : <HeadIcon head={head || first[headKey]} start={name === "start"} />}<Icon name="chevron" />
    </button>
    {opened && <div ref={popup.menu} id={"connector-" + name + "-popup"}
      className={"connector-popup " + (name === "colour" ? "shape-paint-panel" : "shape-menu")}
      role={name === "colour" || name === "line" ? "group" : "menu"} aria-label={title}>
      {name === "colour" ? <div className="shape-swatches">
        {SHAPE_COLORS.map((c) => <button key={c.name} className="icon-button" title={c.label} aria-label={c.label} aria-pressed={colour === c.name}
          onClick={() => choose("lineColor", c.name)}><span className="colour-dot" style={{ background: c.value }} /></button>)}
        <span className="custom-colour" title="Custom colour" data-pressed={colour.startsWith("#")}>
          <CustomColour value={colour || first.lineColor} pressed={colour.startsWith("#")} disabled={!!reason} choose={(value) => choose("lineColor", value)} />
        </span>
      </div> : name === "line" ? <>
        <div className="paint-modes">{(["thin", "thick"] as const).map((value, i) => <button key={value} aria-pressed={weight === value} onClick={() => choose("lineWeight", value)}>{i ? "Thick" : "Thin"}</button>)}</div>
        <div className="paint-modes">{(["solid", "dashed"] as const).map((value, i) => <button key={value} aria-pressed={dash === value} onClick={() => choose("lineDash", value)}>{i ? "Dashed" : "Solid"}</button>)}</div>
      </> : name === "route" ? LINE_SHAPES.map((value, i) => <button key={value} role="menuitemradio" aria-checked={shape === value}
        onClick={() => choose("lineShape", value)}><LineShapeIcon shape={value} />{LINE_SHAPE_LABELS[i]}</button>)
        : HEADS.map((value, i) => <button key={value} role="menuitemradio" aria-checked={head === value}
          onClick={() => choose(headKey, value)}><HeadIcon head={value} start={name === "start"} />{HEAD_LABELS[i]}</button>)}
    </div>}
  </span>;
}
