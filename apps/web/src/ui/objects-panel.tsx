// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject, ReactNode } from "react";
import type { BoardV4 as Board, ItemV4 as Item } from "../document";
import { ALIGNMENTS, COLORS, TEXT_SIZES, type Style } from "../styles";
import { OBJECT_TYPES } from "../objects/registry";
import { FLAGS, FLAG_LABELS, type Flag } from "../marks";
import { Icon } from "../icons";
import type { Rectangle } from "../resize";
import type { ArrangeCommand } from "../arrange";
import { clipboardReason, type ClipboardCommand, type Snapshot } from "../clipboard";
import type { View } from "../view";
import { ArrangeControls } from "./arrange-controls";

type Props = {
  board: Board;
  busy: boolean;
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
  arrange: (name: ArrangeCommand) => void;
  arrangementReason: (name: ArrangeCommand) => string;
  objectClipboard: Snapshot | null;
  clipboardState: Parameters<typeof clipboardReason>[3];
  clipboardCommand: (name: ClipboardCommand) => void;
  create: (type: Item["type"], x: number, y: number, native?: boolean) => void;
  view: View;
};

export function ObjectsPanel({
  board, busy, composing, setPanel, objectsButton, selector, selected, finishTextSession, select,
  numbers, drafts, nativeEditor, selectionColor, selectionSize, selectionAlign, selectionReason,
  selectionFormats, toggleFormat, changeStyle, command, readOnly, move, bounds, resizeBy, arrange, arrangementReason,
  objectClipboard, clipboardState, clipboardCommand, create, view
}: Props) {
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
        {board.objects.map((o, i) => (
          <option key={o.id} value={o.id}>
            {o.type} {i + 1}{o.group !== null ? " · Group " + numbers.get(o.group) : ""} ·{" "}
            {(drafts[o.id] ?? o.text).slice(0, 36) || "Empty"}
          </option>
        ))}
      </select>
      {selected.size > 1 ? <p>{selected.size} objects selected</p> : nativeEditor}
      {selected.size > 0 && <div className="object-styles">
        <label htmlFor="object-colour">Colour</label>
        <select id="object-colour" value={selectionColor} disabled={!!selectionReason}
          title={selectionReason || "Colour"} aria-describedby="selection-reason"
          onChange={(e) => changeStyle("color", e.target.value as Style["color"])}>
          {!selectionColor && <option value="" disabled>Mixed</option>}
          {COLORS.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
        </select>
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
            onClick={(e) => { e.currentTarget.focus(); toggleFormat(flag); }}>{FLAG_LABELS[flag]}</button>)}
        </span>
      </div>}
      <div className="object-commands">
        {(["Duplicate", "Delete"] as const).map((name) => (
          <button key={name} disabled={!!selectionReason} title={selectionReason || name}
            aria-describedby="selection-reason" onClick={() => command(name)}>
            <Icon name={name} />{name}
          </button>
        ))}
      </div>
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
            disabled={!selected.size || readOnly || composing || busy}
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
          disabled={!selected.size || readOnly || composing || busy}
          onClick={() => resizeBy(Number(x), Number(y))}>{name}</button>)}
      </div>
      {selected.size > 0 && <div className="objects-arrange" role="group" aria-label="Arrange">
        <h2>Arrange</h2>
        <ArrangeControls prefix="objects-arrange" choose={arrange} arrangementReason={arrangementReason} />
      </div>}
      <div className="object-commands" role="group" aria-label="Clipboard">
        {(["Copy", "Cut", "Paste"] as const).map((name) => {
          const reason = clipboardReason(name, selected, objectClipboard, clipboardState);
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
        {OBJECT_TYPES.map((t) => t.type).map((type) => (
          <button
            key={type}
            disabled={readOnly || composing || busy}
            onClick={() => {
              const offset = 24 * (board.objects.length % 10);
              create(type, view.x + offset, view.y + offset, true);
            }}
          >
            Add {type}
          </button>
        ))}
      </div>
    </section>
  );
}
