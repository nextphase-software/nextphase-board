// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { clamp, count, type ItemV5 as Item } from "../document";
import { ALIGNMENTS, COLORS, TEXT_SIZES, colorEntry, type Style } from "../styles";
import { objectType } from "../objects/registry";
import { FLAGS, FLAG_LABELS, type Flag } from "../marks";
import { Icon } from "../icons";
import type { ArrangeCommand } from "../arrange";
import { ArrangeControls } from "./arrange-controls";

type Props = {
  contextBar: RefObject<HTMLElement | null>;
  contextFits: boolean;
  contextLeft: number;
  contextTop: number;
  item: Item | undefined;
  selected: Set<string>;
  readOnly: boolean;
  composing: boolean;
  busy: boolean;
  inline: boolean;
  richText: boolean;
  finishTextSession: () => void;
  setInline: Dispatch<SetStateAction<boolean>>;
  scene: RefObject<HTMLDivElement | null>;
  edit: () => void;
  text: string;
  colourControl: RefObject<HTMLSpanElement | null>;
  colourButton: RefObject<HTMLButtonElement | null>;
  selectionReason: string;
  colourLabel: string;
  swatchOpen: boolean;
  setArrangeFor: Dispatch<SetStateAction<string>>;
  setSwatchFor: Dispatch<SetStateAction<string>>;
  selectionKey: string;
  selectionColor: Style["color"] | "";
  swatches: RefObject<HTMLDivElement | null>;
  contextWidth: number;
  size: { w: number; h: number };
  closeSwatches: () => void;
  changeStyle: <K extends keyof Style>(key: K, value: Style[K]) => void;
  selectionSize: Style["textSize"] | "";
  selectionAlign: Style["align"] | "";
  selectionFormats: Record<Flag, boolean>;
  toggleFormat: (flag: Flag) => void;
  arrangeControl: RefObject<HTMLSpanElement | null>;
  arrangeButton: RefObject<HTMLButtonElement | null>;
  arrangeOpen: boolean;
  arrangeMenu: RefObject<HTMLDivElement | null>;
  arrangeHeight: number;
  closeArrange: () => void;
  arrange: (name: ArrangeCommand) => void;
  arrangementReason: (name: ArrangeCommand) => string;
  command: (name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut") => void;
};

export function ContextBar({
  contextBar, contextFits, contextLeft, contextTop, item, selected, readOnly, composing, busy,
  inline, richText, finishTextSession, setInline, scene, edit, text, colourControl, colourButton,
  selectionReason, colourLabel, swatchOpen, setArrangeFor, setSwatchFor, selectionKey,
  selectionColor, swatches, contextWidth, size, closeSwatches, changeStyle, selectionSize,
  selectionAlign, selectionFormats, toggleFormat, arrangeControl, arrangeButton, arrangeOpen, arrangeMenu, arrangeHeight,
  closeArrange, arrange, arrangementReason, command
}: Props) {
  return (
    <section
      ref={contextBar}
      className="context"
      aria-hidden={!contextFits}
      inert={!contextFits}
      style={{
        left: contextLeft,
        top: contextTop,
        visibility: contextFits ? "visible" : "hidden",
      }}
    >
      <span>{item ? objectType(item.type).label : selected.size + " objects"}</span>
      <span className="divider" aria-hidden="true" />
      {item && <>
      <button
        disabled={readOnly || composing || busy}
        onMouseDown={(e) => {
          if (inline) e.preventDefault();
        }}
        onClick={() => {
          if (inline) {
            finishTextSession();
            setInline(false);
            scene.current?.focus();
          } else edit();
        }}
      >
        <Icon name="pencil" />{inline ? "Done" : richText ? "Edit text" : "Edit name"}
      </button>
      <span className="divider" aria-hidden="true" />
      <small>{count(text)} / {objectType(item.type).textLimit.toLocaleString("en-US")}</small>
      </>}
      <span className="colour-control" ref={colourControl}>
        <button ref={colourButton} className="icon-button" disabled={!!selectionReason}
          aria-label={"Colour: " + colourLabel}
          title={"Colour: " + colourLabel}
          aria-describedby="selection-reason" aria-expanded={swatchOpen}
          aria-controls={swatchOpen ? "colour-swatches" : undefined}
          onClick={(e) => {
            e.currentTarget.focus();
            setArrangeFor("");
            setSwatchFor(swatchOpen ? "" : selectionKey);
          }}>
          <span className={"colour-dot" + (!selectionColor ? " mixed" : "")} style={selectionColor ? { background: colorEntry(selectionColor).fill } : undefined} />
          <span className="tooltip">Colour: {colourLabel}</span>
        </button>
        {swatchOpen && <div id="colour-swatches" ref={swatches} className="swatches"
          role="group" aria-label="Colour" style={{
            left: clamp(colourButton.current?.offsetLeft ?? 0, 0, contextWidth - 196),
            top: clamp(48, 12 - contextTop, size.h - 120 - contextTop),
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              closeSwatches();
            }
          }}>
          {COLORS.map((c) => <button key={c.name} className="icon-button"
            aria-label={c.label} title={c.label} aria-pressed={selectionColor === c.name}
            onClick={() => { changeStyle("color", c.name); closeSwatches(); }}>
            <span className="colour-dot" style={{ background: c.fill }} />
            <span className="tooltip">{c.label}</span>
          </button>)}
        </div>}
      </span>
      {richText && <>
      <select className="context-size" aria-label="Text size" title={selectionReason || "Text size"}
        value={selectionSize} disabled={!!selectionReason} aria-describedby="selection-reason"
        onChange={(e) => changeStyle("textSize", e.target.value as Style["textSize"])}>
        {!selectionSize && <option value="" disabled>Mixed</option>}
        {TEXT_SIZES.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
      </select>
      <span className="alignments" role="group" aria-label="Alignment">
        {ALIGNMENTS.map((a) => <button key={a.name} className="icon-button"
          aria-label={a.action} title={selectionReason || a.action} aria-pressed={selectionAlign === a.name}
          disabled={!!selectionReason} aria-describedby="selection-reason"
          onClick={(e) => { e.currentTarget.focus(); changeStyle("align", a.name); }}>
          <Icon name={a.name} /><span className="tooltip">{selectionReason || a.action}</span>
        </button>)}
      </span>
      <span className="formats" role="group" aria-label="Formatting">
        {FLAGS.map((flag) => <button key={flag} className="icon-button"
          aria-label={FLAG_LABELS[flag]} title={selectionReason || FLAG_LABELS[flag]}
          aria-pressed={selectionFormats[flag]} disabled={!!selectionReason} aria-describedby="selection-reason"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            if (!(document.activeElement instanceof HTMLTextAreaElement)) e.currentTarget.focus();
            toggleFormat(flag);
          }}>
          <Icon name={flag} /><span className="tooltip">{selectionReason || FLAG_LABELS[flag]}</span>
        </button>)}
      </span>
      </>}
      <span className="arrange-control" ref={arrangeControl}>
        <button ref={arrangeButton} className="icon-button" disabled={!!selectionReason}
          aria-label="Arrange" title={selectionReason || "Arrange"}
          aria-describedby="selection-reason" aria-expanded={arrangeOpen}
          aria-controls={arrangeOpen ? "arrange-menu" : undefined}
          onClick={(e) => {
            e.currentTarget.focus();
            setSwatchFor("");
            setArrangeFor(arrangeOpen ? "" : selectionKey);
          }}>
          <Icon name="Arrange" /><span className="tooltip">{selectionReason || "Arrange"}</span>
        </button>
        {arrangeOpen && <div id="arrange-menu" ref={arrangeMenu} className="arrange-menu"
          role="group" aria-label="Arrange" style={{
            left: clamp(arrangeButton.current?.offsetLeft ?? 0, 12 - contextLeft,
              size.w - 280 - contextLeft),
            top: clamp(48, 12 - contextTop, size.h - 12 - arrangeHeight - contextTop),
            maxHeight: size.h - 24,
          }} onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              closeArrange();
            }
          }}>
          <ArrangeControls prefix="menu-arrange" choose={(name) => { arrange(name); closeArrange(); }} arrangementReason={arrangementReason} />
        </div>}
      </span>
      {(["Duplicate", "Delete"] as const).map((name) => (
        <button key={name} className="icon-button" aria-label={name}
          aria-describedby="selection-reason" disabled={!!selectionReason}
          onClick={() => command(name)}>
          <Icon name={name} /><span className="tooltip">{selectionReason || name}</span>
        </button>
      ))}
    </section>
  );
}
