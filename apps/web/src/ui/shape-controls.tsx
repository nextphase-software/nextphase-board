// SPDX-License-Identifier: Apache-2.0
import type { CSSProperties, RefObject } from "react";
import type { ItemV9 as Item } from "../document";
import { SHAPE_KINDS, SHAPE_COLORS, FILL_MODES, BORDER_STYLES, shapeColor, shapeColorLabel, darkened, kindInfo, type ShapeKeys } from "../objects/registry";
import { Icon } from "../icons";

type Name = "kind" | "fill" | "border";
export type ShapeSelection = {
  objects: Item[]; hasOther: boolean; kind: ShapeKeys["shape"] | "";
  fillMode: ShapeKeys["fill"]["mode"] | ""; fillColor: string;
  borderStyle: ShapeKeys["border"]["style"] | ""; borderColor: string;
};
export type ShapeCommands = {
  changeShape: (kind: ShapeKeys["shape"]) => void;
  changeFill: (change: Partial<ShapeKeys["fill"]>) => void;
  changeBorder: (change: Partial<ShapeKeys["border"]>) => void;
  grow: () => void;
};
export type ShapePopup = {
  open: string; toggle: (name: Name) => void; close: () => void;
  controls: Record<Name, RefObject<HTMLSpanElement | null>>;
  buttons: Record<Name, RefObject<HTMLButtonElement | null>>;
  menu: RefObject<HTMLDivElement | null>;
};
export type ShapeControlProps = { selection: ShapeSelection; commands: ShapeCommands; reason: string };

export function CustomColour({ value, pressed, hidden = false, disabled, choose }: {
  value: string; pressed?: boolean; hidden?: boolean; disabled: boolean; choose: (color: string) => void;
}) {
  return <input className="custom-colour-input" type="color" aria-label="Custom colour" disabled={disabled}
    defaultValue={shapeColor(value)} key={value} aria-pressed={hidden ? undefined : pressed}
    tabIndex={hidden ? -1 : undefined} aria-hidden={hidden ? true : undefined}
    ref={(field) => {
      if (!field) return;
      field.onchange = () => choose(field.value.toLowerCase());
      return () => { field.onchange = null; };
    }} />;
}

export function ShapeControls({ selection: s, commands: c, reason, popup, part }: ShapeControlProps & { popup: ShapePopup; part: "kind" | "paint" }) {
  if (!s.objects.length) return null;
  const first = s.objects[0];
  const kind = s.kind ? kindInfo({ shape: s.kind }) : null;
  const fillLabel = !s.fillMode || !s.fillColor ? "Mixed" : s.fillMode === "none" ? "None" : shapeColorLabel(s.fillColor);
  const borderLabel = !s.borderStyle || !s.borderColor ? "Mixed" : (BORDER_STYLES.find((b) => b.value === s.borderStyle)!.label + ", " + shapeColorLabel(s.borderColor));
  const names: Name[] = part === "kind" ? ["kind"] : ["fill", "border"];
  return <>{names.map((name) => {
    const opened = popup.open === name;
    const title = name === "kind" ? "Shape" : name === "fill" ? "Fill" : "Border";
    const value = name === "fill" ? s.fillColor : s.borderColor;
    const initial = name === "fill" ? first.fill!.color : first.border!.color;
    const chooseColour = (color: string) => { (name === "fill" ? c.changeFill : c.changeBorder)({ color }); popup.close(); };
    return <span className="shape-control" ref={popup.controls[name]} key={name}
      onKeyDown={(e) => { if (e.key === "Escape" && opened) { e.preventDefault(); e.stopPropagation(); popup.close(); } }}>
      <button ref={popup.buttons[name]} disabled={!!reason} aria-describedby="selection-reason"
        aria-label={title + ": " + (name === "kind" ? kind?.tool ?? "Mixed" : name === "fill" ? fillLabel : borderLabel)}
        aria-expanded={opened} aria-controls={opened ? "shape-" + name + "-popup" : undefined}
        onClick={() => popup.toggle(name)}>
        {name === "kind" ? <><Icon name={kind?.tool ?? kindInfo(first).tool} />{kind?.tool ?? "Mixed"}</>
          : name === "fill" ? <span className={"colour-dot" + ((s.fillMode || first.fill!.mode) === "none" ? " no-fill" : "")} style={{ background: shapeColor(s.fillColor || first.fill!.color) }} />
          : <Icon name="Border" />}<Icon name="chevron" />
      </button>
      {opened && <div ref={popup.menu} id={"shape-" + name + "-popup"} className={name === "kind" ? "shape-menu" : "shape-paint-panel"}
        role={name === "kind" ? "menu" : "group"} aria-label={title}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); popup.close(); } }}>
        {name === "kind" ? SHAPE_KINDS.map((k) => <button key={k.kind} role="menuitemradio" aria-checked={s.kind === k.kind}
          onClick={() => { c.changeShape(k.kind); popup.close(); }}><Icon name={k.tool} />{k.tool}</button>) : <>
          <div className="paint-modes">{(name === "fill" ? FILL_MODES : BORDER_STYLES).map((mode) => <button key={mode.value}
            aria-pressed={(name === "fill" ? s.fillMode : s.borderStyle) === mode.value}
            onClick={() => name === "fill" ? c.changeFill({ mode: mode.value as ShapeKeys["fill"]["mode"] })
              : c.changeBorder({ style: mode.value as ShapeKeys["border"]["style"] })}>{mode.label}</button>)}</div>
          <div className="shape-swatches">{SHAPE_COLORS.map((colour) => <button key={colour.name} className="icon-button"
            title={colour.label} aria-label={colour.label} aria-pressed={value === colour.name} onClick={() => chooseColour(colour.name)}>
            <span className="colour-dot" style={{ background: colour.value }} /></button>)}
            <span className="custom-colour" title="Custom colour" data-pressed={!!value && value.startsWith("#")}>
              <CustomColour value={value || initial} pressed={!!value && value.startsWith("#")} disabled={!!reason} choose={chooseColour} />
            </span>
          </div>
        </>}
      </div>}
    </span>;
  })}</>;
}

export function ShapeFields({ selection: s, commands: c, reason }: ShapeControlProps) {
  if (!s.objects.length) return null;
  return <div className="object-styles">
    <label htmlFor="object-shape">Shape</label>
    <select id="object-shape" disabled={!!reason} value={s.kind} onChange={(e) => c.changeShape(e.target.value as ShapeKeys["shape"])}>
      {!s.kind && <option value="" disabled>Mixed</option>}{SHAPE_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.tool}</option>)}
    </select>
    {(["fill", "border"] as const).map((name) => {
      const label = name === "fill" ? "Fill" : "Border", value = name === "fill" ? s.fillMode : s.borderStyle;
      const color = name === "fill" ? s.fillColor : s.borderColor;
      const first = name === "fill" ? s.objects[0].fill!.color : s.objects[0].border!.color;
      const choose = (color: string) => (name === "fill" ? c.changeFill : c.changeBorder)({ color });
      const fromFill = name === "border" && s.fillColor && color === darkened(s.fillColor);
      return <div className="object-styles" key={name}>
        <label htmlFor={"object-" + name}>{label}</label>
        <select id={"object-" + name} disabled={!!reason} value={value}
          onChange={(e) => name === "fill" ? c.changeFill({ mode: e.target.value as ShapeKeys["fill"]["mode"] })
            : c.changeBorder({ style: e.target.value as ShapeKeys["border"]["style"] })}>
          {!value && <option value="" disabled>Mixed</option>}
          {(name === "fill" ? FILL_MODES : BORDER_STYLES).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <label htmlFor={"object-" + name + "-colour"}>{label} colour</label>
        <select id={"object-" + name + "-colour"} disabled={!!reason} value={color}
          onChange={(e) => {
            if (e.target.value === "custom") {
              const field = e.currentTarget.nextElementSibling as HTMLInputElement;
              field.click(); e.currentTarget.value = color;
            } else choose(e.target.value);
          }}>
          {!color && <option value="" disabled>Mixed</option>}
          {SHAPE_COLORS.map((col) => <option key={col.name} value={col.name}>{col.label}</option>)}
          {color.startsWith("#") && <option value={color}>{fromFill ? "Darker " + shapeColorLabel(s.fillColor) + " (from fill)" : color}</option>}
          <option value="custom">Custom…</option>
        </select>
        <CustomColour value={color || first} hidden disabled={!!reason} choose={choose} />
      </div>;
    })}
  </div>;
}

export function GrowButton({ available, grow, style }: { available: boolean; grow: () => void; style?: CSSProperties }) {
  if (!available) return null;
  return <button className={style ? "grow-shape" : ""} style={style} aria-label="Grow to fit text" title="Grow to fit text" onClick={grow}>
    {style ? <Icon name="chevron" /> : "Grow to fit text"}
  </button>;
}
