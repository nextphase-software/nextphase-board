// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject, ReactNode } from "react";
import type { BoardV8 as Board, ItemV8 as Item } from "../document";
import { ALIGNMENTS, COLORS, TEXT_SIZES, type Style } from "../styles";
import { objectLabel } from "../sections";
import { ADD_OPTIONS, isContainer, sectionIdea, hasRectangle } from "../objects/registry";
import { FLAGS, FLAG_LABELS, type Flag } from "../marks";
import { Icon } from "../icons";
import type { Rectangle } from "../resize";
import type { ArrangeCommand } from "../arrange";
import { clipboardReason, type ClipboardCommand, type Snapshot } from "../clipboard";
import type { View } from "../view";
import { FOLLOW_REASON } from "../connectors";
import { ArrangeControls } from "./arrange-controls";
import { ShapeFields, GrowButton, type ShapeControlProps } from "./shape-controls";
import { StrokeFields, type StrokeControlProps } from "./stroke-controls";
import { FormatPreview } from "./format-preview";

type Props = {
  strokeSelection: StrokeControlProps["selection"]; strokeCommands: StrokeControlProps["commands"];
  duplicateReason: string;
  shapeSelection: ShapeControlProps["selection"];
  shapeCommands: ShapeControlProps["commands"];
  growAvailable: boolean;
  board: Board;
  busy: boolean;
  richText: boolean;
  setSection: (id: string | null) => void;
  composing: boolean;
  setPanel: Dispatch<SetStateAction<string>>;
  objectsButton: RefObject<HTMLButtonElement | null>;
  selector: RefObject<HTMLSelectElement | null>;
  selected: Set<string>;
  finishTextSession: () => void;
  select: (value: string | Iterable<string>) => void;
  numbers: Map<string, number>;
  drafts: Record<string, string>;
  nativeEditor: ReactNode;
  item: Item | undefined;
  text: string;
  selectionColor: Style["color"] | "";
  selectionSize: Style["textSize"] | "";
  selectionAlign: Style["align"] | "";
  selectionFormats: Record<Flag, boolean>;
  toggleFormat: (flag: Flag) => void;
  selectionReason: string;
  changeStyle: <K extends keyof Style>(key: K, value: Style[K]) => void;
  command: (name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut") => void;
  readOnly: boolean;
  move: (dx: number, dy: number) => void;
  bounds: Rectangle | null;
  resizeBy: (dx: number, dy: number) => void;
  arrange: (name: ArrangeCommand, native?: boolean) => void;
  arrangementReason: (name: ArrangeCommand) => string;
  objectClipboard: Snapshot | null;
  clipboardState: Parameters<typeof clipboardReason>[3];
  clipboardCommand: (name: ClipboardCommand) => void;
  create: (tool: string, x: number, y: number, native?: boolean) => void;
  view: View;
};

export function ObjectsPanel({
  strokeSelection, strokeCommands, duplicateReason, shapeSelection, shapeCommands, growAvailable, board, richText, setSection, busy, composing, setPanel, objectsButton, selector, selected, finishTextSession, select,
  numbers, drafts, nativeEditor, item, text, selectionColor, selectionSize, selectionAlign, selectionReason,
  selectionFormats, toggleFormat, changeStyle, command, readOnly, move, bounds, resizeBy, arrange, arrangementReason,
  objectClipboard, clipboardState, clipboardCommand, create, view
}: Props) {
  const ideas = board.objects.filter((o) => selected.has(o.id) && sectionIdea(o));
  const geometryReason = !selected.size || readOnly || composing || busy ? selectionReason : board.objects.some((o) => selected.has(o.id) && hasRectangle(o)) ? "" : FOLLOW_REASON;
  const sections = board.objects.filter(isContainer);
  const sharedSection = ideas.length && ideas.every((o) => o.section === ideas[0].section) ? ideas[0].section ?? "" : "mixed";
  return (
    <section
      className="objects floating"
      aria-label="Objects and keyboard editing"
    >
      <header>
        <h2>Objects {board.objects.length} / 250</h2>
        <button
          disabled={busy || composing}
          onClick={() => {
            setPanel("");
            objectsButton.current?.focus();
          }}
        >
          Close
        </button>
      </header>
      <label htmlFor="selection">Selected objects</label>
      <select
        disabled={composing || busy}
        ref={selector}
        id="selection"
        multiple
        size={5}
        value={[...selected]}
        onChange={(e) => {
          finishTextSession();
          select(Array.from(e.currentTarget.selectedOptions, (o) => o.value));
        }}
      >
        {board.objects.map((o) => (
          <option key={o.id} value={o.id}>
            {objectLabel(board, o, numbers, drafts)}
          </option>
        ))}
      </select>
      {selected.size > 1 ? <p>{selected.size} objects selected</p> : nativeEditor}
      {richText && selected.size === 1 && item && <FormatPreview item={item} text={text} />}
      <StrokeFields selection={strokeSelection} commands={strokeCommands} reason={selectionReason} />
      <ShapeFields selection={shapeSelection} commands={shapeCommands} reason={selectionReason} />
      {selected.size > 0 && <div className="object-styles">
        {shapeSelection.hasOther && <><label htmlFor="object-colour">Colour</label>
        <select id="object-colour" value={selectionColor} disabled={!!selectionReason}
          title={selectionReason || "Colour"} aria-describedby="selection-reason"
          onChange={(e) => changeStyle("color", e.target.value as Style["color"])}>
          {!selectionColor && <option value="" disabled>Mixed</option>}
          {COLORS.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
        </select>
        </>}
        {ideas.length > 0 && <>
          <label htmlFor="object-section">Section</label>
          <select id="object-section" value={sharedSection} disabled={!!selectionReason}
            title={selectionReason || "Section"} aria-describedby="selection-reason"
            onChange={(e) => setSection(e.target.value || null)}>
            {sharedSection === "mixed" && <option value="mixed" disabled>Mixed</option>}
            <option value="">None</option>
            {sections.map((o) => <option key={o.id} value={o.id}>
              {objectLabel(board, o, numbers, drafts).replace(/ · \d+ items?$/, "")}
            </option>)}
          </select>
        </>}
        {richText && <>
        <label htmlFor="object-size">Text size</label>
        <select id="object-size" value={selectionSize} disabled={!!selectionReason}
          title={selectionReason || "Text size"} aria-describedby="selection-reason"
          onChange={(e) => changeStyle("textSize", e.target.value as Style["textSize"])}>
          {!selectionSize && <option value="" disabled>Mixed</option>}
          {TEXT_SIZES.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
        </select>
        <label htmlFor="object-align">Alignment</label>
        <select id="object-align" value={selectionAlign} disabled={!!selectionReason}
          title={selectionReason || "Alignment"} aria-describedby="selection-reason"
          onChange={(e) => changeStyle("align", e.target.value as Style["align"])}>
          {!selectionAlign && <option value="" disabled>Mixed</option>}
          {ALIGNMENTS.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
        </select>
        <span id="object-formats-label">Formatting</span>
        <span className="object-formats" role="group" aria-labelledby="object-formats-label">
          {FLAGS.map((flag) => <button key={flag} aria-pressed={selectionFormats[flag]}
            disabled={!!selectionReason} title={selectionReason || FLAG_LABELS[flag]}
            aria-describedby="selection-reason"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              if (!(document.activeElement instanceof HTMLTextAreaElement)) e.currentTarget.focus();
              toggleFormat(flag);
            }}>{FLAG_LABELS[flag]}</button>)}
        </span>
        </>}
      </div>}
      <div className="object-commands">
        {(["Duplicate", "Delete"] as const).map((name) => (
          <button key={name} disabled={!!(name === "Duplicate" ? duplicateReason : selectionReason)} title={(name === "Duplicate" ? duplicateReason : selectionReason) || name}
            aria-describedby={name === "Duplicate" && duplicateReason !== selectionReason ? "duplicate-reason" : "selection-reason"} onClick={() => command(name)}>
            <Icon name={name} />{name}
          </button>
        ))}
      </div>
      {geometryReason === FOLLOW_REASON && <span className="sr-only" id="geometry-reason">{geometryReason}</span>}
      <div className="moves">
        {[
          ["left", -10, 0, "←"],
          ["up", 0, -10, "↑"],
          ["down", 0, 10, "↓"],
          ["right", 10, 0, "→"],
        ].map(([name, x, y, s]) => (
          <button
            key={name}
            aria-label={(selected.size > 1 ? "Move objects " : "Move object ") + name}
            disabled={!!geometryReason} title={geometryReason === FOLLOW_REASON ? geometryReason : undefined} aria-describedby={geometryReason === FOLLOW_REASON ? "geometry-reason" : undefined}
            onClick={() => move(Number(x), Number(y))}
          >
            {s}
          </button>
        ))}
      </div>
      <small>
        X {bounds?.x ?? "—"} · Y {bounds?.y ?? "—"} · 10 units per step
      </small>
      <small>W {bounds ? Math.round(bounds.width) : "—"} · H {bounds ? Math.round(bounds.height) : "—"}</small>
      <div className="sizes">
        {[
          ["Wider", 10, 0], ["Narrower", -10, 0], ["Taller", 0, 10], ["Shorter", 0, -10],
        ].map(([name, x, y]) => <button key={name}
          aria-label={(selected.size > 1 ? "Make objects " : "Make object ") + String(name).toLowerCase()}
          disabled={!!geometryReason} title={geometryReason === FOLLOW_REASON ? geometryReason : undefined} aria-describedby={geometryReason === FOLLOW_REASON ? "geometry-reason" : undefined}
          onClick={() => resizeBy(Number(x), Number(y))}>{name}</button>)}
      </div>
      <GrowButton available={growAvailable} grow={shapeCommands.grow} />
      {selected.size > 0 && <div className="objects-arrange" role="group" aria-label="Arrange">
        <h2>Arrange</h2>
        <ArrangeControls prefix="objects-arrange" choose={(name) => arrange(name, true)} arrangementReason={arrangementReason} />
      </div>}
      <div className="object-commands" role="group" aria-label="Clipboard">
        {(["Copy", "Cut", "Paste"] as const).map((name) => {
          const reason = clipboardReason(name, selected, objectClipboard, clipboardState, board.objects);
          const description = "clipboard-" + name.toLowerCase() + "-reason";
          return <span key={name}>
            <button disabled={!!reason} title={reason || name}
              aria-describedby={reason ? description : undefined}
              onClick={(e) => { e.currentTarget.focus(); clipboardCommand(name); }}>{name}</button>
            {reason && <span className="sr-only" id={description}>{reason}</span>}
          </span>;
        })}
      </div>
      <div>
        {ADD_OPTIONS.map(({ tool, label }) => (
          <button
            key={tool}
            disabled={readOnly || composing || busy}
            onClick={() => {
              const offset = 24 * (board.objects.length % 10);
              create(tool, view.x + offset, view.y + offset, true);
            }}
          >
            Add {label}
          </button>
        ))}
      </div>
    </section>
  );
}
