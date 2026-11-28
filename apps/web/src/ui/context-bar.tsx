// SPDX-License-Identifier: Apache-2.0
import type { ComponentProps, Dispatch, SetStateAction, RefObject } from "react";
import { clamp, count, type BoardV14 as Board, type ItemV14 as Item } from "nextphase-board-rules/document.ts";
import { ALIGNMENTS, COLORS, TEXT_SIZES, colorEntry, type Style } from "nextphase-board-rules/styles.ts";
import { objectType, hasText, isMindNode, isTable } from "nextphase-board-rules/objects/registry.ts";
import { children, type MapCommand } from "../mind-map";
import { FLAGS, FLAG_LABELS, type Flag } from "nextphase-board-rules/marks.ts";
import { Icon } from "../icons";
import type { ArrangeCommand } from "../arrange";
import { ShapeControls, type ShapeControlProps, type ShapePopup } from "./shape-controls";
import type { ConnectorMenuProps } from "./connector-menu";
import { ConnectorControls } from "./connector-controls";
import { StrokeControls, type StrokeControlProps } from "./stroke-controls";
import { TapeControls, type TapeSelection, type TapeCommands } from "./tape-controls";
import type { TidyUI } from "./tidy-up-bar";
import { ArrangeControls } from "./arrange-controls";

import { ImageControls, type DescriptionControl } from "./image-controls";

import { TableControls } from "./table-controls";
import { anchorCell, type TableSelection, type TableAction } from "../table";
import type { CellAddress } from "nextphase-board-rules/objects/registry.ts";
import type { TableItem } from "nextphase-board-rules/document.ts";

import type { LinkBar } from "../link-cards";
import { LinkControls } from "./link-controls";
import { LINK_WORDS, type LinkControls as TextLinkControls } from "../text-links";
import { LinkBar as TextLinkBar, LinkGlyph } from "./link-bar";

type Props = {
  links: LinkBar;
  textLinks: TextLinkControls;
  tableSelection?: TableSelection;
  tableDraft?: string;
  tableResizing: boolean;
  tableCells: number;
  cellInvalidNotice: string;
  setMessage: (value: string) => void;
  tableAction: (action: TableAction) => void;
  exportTable: NonNullable<ComponentProps<typeof TableControls>["exportTable"]>;
  tableSize: (size: Style["textSize"]) => void;
  editCell: (table: TableItem, cell: CellAddress) => void;
  moveToPage: React.ReactNode;
  tapeSelection: TapeSelection; tidy: TidyUI;
  board: Board;
  imageCount: number; imagesOnly: boolean; description: DescriptionControl;
  strokeSelection: StrokeControlProps["selection"]; strokeCommands: StrokeControlProps["commands"] & TapeCommands;
  connectorObjects: ConnectorMenuProps["objects"]; connectorCommands: ConnectorMenuProps["commands"]; connectorPopup: ConnectorMenuProps["popup"];
  connectorOnly: boolean;
  connectorCount: number;
  duplicateReason: string;
  shapeSelection: ShapeControlProps["selection"];
  shapeCommands: ShapeControlProps["commands"];
  shapePopup: ShapePopup;
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
  command: (name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut" | MapCommand) => void;
};

export function ContextBar({ tableSelection, tableDraft, tableResizing, tableCells, cellInvalidNotice, setMessage, tableAction, tableSize, editCell, exportTable,
  moveToPage, links, textLinks, tapeSelection, tidy, board, imageCount, imagesOnly, description, strokeSelection, strokeCommands, connectorObjects, connectorCommands, connectorPopup, connectorOnly, connectorCount, duplicateReason, shapeSelection, shapeCommands, shapePopup, contextBar, contextFits, contextLeft, contextTop, item, selected, readOnly, composing, busy,
  inline, richText, finishTextSession, setInline, scene, edit, text, colourControl, colourButton,
  selectionReason, colourLabel, swatchOpen, setArrangeFor, setSwatchFor, selectionKey,
  selectionColor, swatches, contextWidth, size, closeSwatches, changeStyle, selectionSize,
  selectionAlign, selectionFormats, toggleFormat, arrangeControl, arrangeButton, arrangeOpen, arrangeMenu, arrangeHeight,
  closeArrange, arrange, arrangementReason, command
}: Props) {
  // A node's bar: no text size, alignment, formatting or Arrange; a non-root
  // node with children adds Collapse or Expand.
  const tidyReason = selectionReason || tidy.reason({readOnly,composing,pointerGesture:busy,invalidObjectText:false});
  const nodes = board.objects.filter((o) => selected.has(o.id) && isMindNode(o));
  const branch = item && isMindNode(item) && item.parent !== null && children(board.objects, item.id).length ? item : undefined;
  const arrangeTools = <>{!nodes.length && <span className="arrange-control" ref={arrangeControl}>
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
          <ArrangeControls prefix="menu-arrange" choose={(name) => { if (name === "Connect") { closeArrange(); arrange(name); } else { arrange(name); closeArrange(); } }} arrangementReason={arrangementReason} />
        </div>}
      </span>}</>;
  const copyLink = textLinks?.copy.shown && <button className="icon-button" aria-label={textLinks.copy.label}
    onMouseDown={e => e.preventDefault()} onClick={textLinks.copy.run}>
    <LinkGlyph name="copy-object" size={20} /><span className="tooltip">{textLinks.copy.label}</span>
  </button>;
  const objectCommands = <>{moveToPage}{copyLink}{(["Duplicate", "Delete"] as const).map((name) => (
        <button key={name} className="icon-button" aria-label={name}
          aria-describedby={name === "Duplicate" && duplicateReason !== selectionReason ? "duplicate-reason" : "selection-reason"} disabled={!!(name === "Duplicate" ? duplicateReason : selectionReason)}
          onClick={() => command(name)}>
          <Icon name={name} /><span className="tooltip">{(name === "Duplicate" ? duplicateReason : selectionReason) || name}</span>
        </button>
      ))}</>;
  const table = item && isTable(item) && tableSelection && selected.size === 1 ? item : undefined;
  // Keep the measured element mounted while hiding the table bar during a drag.
  const linkBar = textLinks?.bar;
  const visible = contextFits && !(table && tableResizing) && !linkBar;
  return (
    <>
    <section
      ref={contextBar}
      className="context"
      aria-hidden={!visible}
      inert={!visible}
      style={{
        left: contextLeft,
        top: contextTop,
        visibility: visible ? "visible" : "hidden",
      }}
    >
      {table && tableSelection ? <TableControls key={JSON.stringify(tableSelection)} table={table} selection={tableSelection} cells={tableCells}
        edit={() => editCell(table, anchorCell(table, tableSelection))} done={() => {
          if (cellInvalidNotice) { setMessage(cellInvalidNotice); return; }
          finishTextSession(); setInline(false); scene.current?.focus();
        }} draft={inline ? tableDraft : undefined} invalid={!!cellInvalidNotice} readOnly={readOnly} composing={composing}
        reason={selectionReason} action={tableAction} size={tableSize} exportTable={exportTable} copyLink={copyLink}>{arrangeTools}{objectCommands}</TableControls> : tapeSelection.only ? <><TapeControls selection={tapeSelection} commands={strokeCommands} reason={selectionReason} />{moveToPage}{copyLink}{(["Duplicate","Delete"] as const).map(name=><button key={name} className="icon-button" aria-label={name} disabled={!!(name==="Duplicate"?duplicateReason:selectionReason)} onClick={()=>command(name)}><Icon name={name} /><span className="tooltip">{name}</span></button>)}</> : strokeSelection.only ? <StrokeControls moveToPage={<>{moveToPage}{copyLink}</>} selection={strokeSelection} commands={strokeCommands} reason={selectionReason} remove={() => command("Delete")} /> : connectorOnly ? <ConnectorControls moveToPage={<>{moveToPage}{copyLink}</>} objects={connectorObjects} commands={connectorCommands} popup={connectorPopup} count={selected.size} empty={!text} reason={selectionReason} edit={edit} remove={() => command("Delete")} /> : <>
      {links.only ? <LinkControls bar={links} reason={selectionReason} /> : imagesOnly ? <ImageControls count={imageCount} control={description} /> : <>
      <ShapeControls part="kind" selection={shapeSelection} commands={shapeCommands} reason={selectionReason} popup={shapePopup} />
      {(!shapeSelection.objects.length || connectorCount > 0 || strokeSelection.objects.length > 0 || tapeSelection.objects.length > 0) && <span>{item ? objectType(item.type).label : selected.size + " objects"}</span>}
      <span className="divider" aria-hidden="true" />
      {item && hasText(item) && <>
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
        <Icon name="pencil" />{inline ? "Done" : richText || isMindNode(item) ? "Edit text" : "Edit name"}
      </button>
      <span className="divider" aria-hidden="true" />
      <small>{count(text)} / {objectType(item.type).textLimit.toLocaleString("en-US")}</small>
      </>}
      <ShapeControls part="paint" selection={shapeSelection} commands={shapeCommands} reason={selectionReason} popup={shapePopup} />
      {shapeSelection.hasOther && <span className="colour-control" ref={colourControl}>
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
      </span>}
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
        {textLinks && <button className="icon-button link-button" aria-label={LINK_WORDS.link}
          aria-pressed={textLinks.link.pressed} disabled={textLinks.link.disabled}
          aria-describedby={textLinks.link.disabled ? textLinks.link.own ? "link-reason" : "selection-reason" : undefined}
          onMouseDown={e => e.preventDefault()} onClick={textLinks.link.run}>
          <LinkGlyph name="link" size={20} /><span className="tooltip">{textLinks.link.tooltip}</span>
        </button>}
      </span>
      </>}
      </>}
      {branch && <>
      <span className="divider" aria-hidden="true" />
      <button aria-label={branch.collapsed ? "Expand branch" : "Collapse branch"} disabled={!!selectionReason}
        aria-describedby="selection-reason" onClick={() => command(branch.collapsed ? "Expand" : "Collapse")}>
        <Icon name={branch.collapsed ? "Expand" : "Collapse"} />{branch.collapsed ? "Expand" : "Collapse"}
      </button>
      </>}
      {arrangeTools}
      {!links.only && !imagesOnly && selected.size >= 2 && <><button className="icon-button" aria-label="Tidy up" title={tidyReason || 'Tidy up'} disabled={!!tidyReason}
        onClick={()=>tidy.start({readOnly,composing,pointerGesture:busy,invalidObjectText:false})}><Icon name="Tidy up" /><span className="tooltip">Tidy up · {/Mac|iPhone|iPad/.test(navigator.platform)?'⌥⇧T':'Alt+Shift+T'}</span></button><span className="divider" aria-hidden="true" /></>}
      {objectCommands}
      </>}
    </section>
    {linkBar && <TextLinkBar bar={{ ...linkBar, left: clamp(contextLeft + contextWidth / 2 - 178, 12, size.w - 368) }} top={contextTop} />}
    </>
  );
}
