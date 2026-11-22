// SPDX-License-Identifier: Apache-2.0
import { useImages } from "./state/use-images"; import { ImageNames } from "./scene/image-body";
import { screenPoint } from "./view";
import { useSessionStatus } from "./state/use-session-status";
import { useGestureState } from "./state/use-gesture-state";
import { useTextEntry } from "./state/use-text-entry";
import { useValidity } from "./state/use-validity";
import { useCommandReasons } from "./state/use-command-reasons";
import { useMessages } from "./state/use-messages";
import { useBoardDocument } from "./state/use-board-document";
import { useStorageSession } from "./state/use-storage-session";
import { useEditingCommands } from "./state/use-editing-commands";
import { useGeometryEdits } from "./state/use-geometry-edits";
import { useCanvasInput } from "./state/use-canvas-input";
import { usePageKeys } from "./state/use-page-keys";
import { usePanelLayout } from "./state/use-panel-layout";
import { useContextBar } from "./state/use-context-bar";
import { useViewport } from "./state/use-viewport";
import { useSceneSize } from "./state/use-scene-size";
import { useSelection } from "./state/use-selection";
import { useObjectLayouts } from "./state/use-object-layouts"; import { useTidyUp } from "./state/use-tidy-up"; import { useFind } from "./state/use-find"; import { usePages } from "./state/use-pages";
import { useEditorPlacement } from "./state/use-editor-placement"; import { useExport } from "./state/use-export"; import { drawExport } from "./scene/export-drawing";
import { BoardDrawing } from "./scene/board-drawing";
import { Overlays } from "./scene/overlays"; import { ConnectionDots } from "./scene/connection-dots"; import { MindMapButtons } from "./scene/mind-map-buttons"; import { TableButtons, TableCellStatus } from "./scene/table-buttons"; import { TidyUpLayer } from "./scene/tidy-up-layer"; import { TidyUpBar } from "./ui/tidy-up-bar"; import { FindRings } from "./scene/find-rings"; import { FindBar } from "./ui/find-bar"; import { PagesPanel } from "./ui/pages-panel"; import { MoveToPage } from "./ui/move-to-page";
import { InlineEditor } from "./scene/inline-editor";
import { ShapesPanel } from "./ui/shapes-panel";
import { GrowButton } from "./ui/shape-controls";
import { FileBar } from "./ui/file-bar";
import { SaveArea } from "./ui/save-area";
import { Notice } from "./ui/notice";
import { BoardPanel } from "./ui/board-panel";
import { ObjectsPanel } from "./ui/objects-panel";
import { ContentField } from "./ui/content-field";
import { ContextBar } from "./ui/context-bar";
import { Palette } from "./ui/palette";
import { ZoomControls } from "./ui/zoom-controls";
import { InformationControls } from "./ui/information-controls";
import { BoardQuestion } from "./ui/board-question"; import { ExportDialog } from "./ui/export-dialog";
import { NavigationPanel } from "./ui/navigation-panel";
import type { TeamParts } from "./team/team-app";
import { useHostedBoard } from "./state/use-hosted-board";
export function App({ team }: { team?: TeamParts } = {}) {
  const { readOnly, setReadOnly, status, setStatus } = useSessionStatus();
  const {
    selectionBox, setSelectionBox, tool, setTool, busy: gestureBusy, setBusy, spacePan, setSpacePan,
    scene, spacePanRef, drag, drawing, selectionStarted,
  } = useGestureState(() => select(""), () => finishTextSession(), () => setInline(false));
  const { tableEntry, inline, setInline, composing, setComposing, textSelection, setTextSelection } = useTextEntry();
  const { setMessage, messageSequence, latestAcknowledgement, visibleMessage } = useMessages();
  const {
    stepPage, connectorStyle, shapeSession, board, setBoard, title, setTitle, drafts, setDrafts, history,
    model, historyRef, textSession, revision, adapter,
    updateHistory, clearHistory, beginTextSession, finishTextSession, beginNameEntry, finishNameEntry, commit, load,
  } = useBoardDocument({ readOnly, setStatus, hosted: team?.hosted, nameSent: team?.nameSent }); const pages = usePages({ board, model, stepPage, hosted: !!team?.hosted, team: team?.hosted, canEdit: !team?.hosted || !readOnly, commit, finishTextSession, select, setMessage, getView: () => view, setView: (value, following) => following ? setFollowView(value) : setView(value), getObjects: () => allDisplayedObjects, openingReason: () => busy || composing || tidy.open ? "Finish the current action first." : "", editingReason: () => commandReason || (tidy.open ? "Apply or cancel Tidy up first." : "") });
  const {
    tableSelection, tableAnnouncement, chooseTable, tableName, tapeSelection, strokeSelection, connectorOnly, connectors, shapeSelection, selected, setSelected, selectionKey, selectedId, item, text,
    selectionColor, selectionSize, selectionAlign, colourLabel, selectionFormats, richText,
  } = useSelection({ board: pages.canvas(), drafts, textSelection }); const tidy = useTidyUp({ board, objects: pages.objects(), selected, commit, tool, setMessage, hosted: team?.hosted, scene, readOnly });
  const { cellInvalidNotice, invalidObjectText, invalidFields, invalid, pending } = useValidity({
    board, drafts, title, composing, busy: gestureBusy, cellDraft: tableEntry.draft?.text,
  });
  const images = useImages({ page: pages.id, board, model, selected, readOnly: readOnly || !!team?.hosted, busy: gestureBusy, composing, invalidObjectText, pending,
    commit, finishTextSession, select, setTool, setPanel: (value) => setPanel(value), setInline, setComposing, setMessage, scene,
    getView: () => view, getStore: () => store.current, isAlive: () => alive.current, barVisible: () => size.w >= 768 && contextFits || panel === "Objects" });
  const busy = images.busy; const {
    tableMeasure, growTableRows, resolvedTable, editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, allDisplayedObjects, bounds, selectedGroups, numbers,
    handlesVisible, handlePoints, itemHeight, measureNode,
  } = useObjectLayouts({
    tableDraft: tableEntry.draft, tableSelection, board: tidy.board, objects: pages.objects(tidy.board), selected: tidy.selected, selectedId, item, text, inline, textEditing: !!textSelection, invalidObjectText, tool, readOnly, composing, busy, drag,
  });
  const layout = usePanelLayout(scene);
  const { view, setView, setFollowView, trackPointer, inlineSurface } = useViewport({ scene, inline, drag, pending, ownViewChange: team?.hosted?.stopFollowing });
  function select(value: string | Iterable<string>) {
    finishTextSession();
    setInline(false);
    setSwatchFor("");
    setArrangeFor("");
    const ids = new Set(typeof value === "string" ? value ? [value] : [] : value); if (ids.size) selectionStarted(); setSelected(ids);
  }
  const { store, snapshots, alive, adopt, save, reopen, boardFiles, boardQuestion } = useStorageSession({
    readOnly, setReadOnly, setStatus, setMessage, load, clearHistory, model,
    revision, adapter, select, setInline, setView, invalid, busy, composing, pending, title, hosted: team?.hosted,
  });
  const size = useSceneSize(scene);
  const pos = (o: { x: number; y: number }) => screenPoint(o, view, size); const find = useFind({ board, pages, allDisplayedObjects, boardId: board.boardId, displayedObjects, selected, select, view, setView, size, scene, composing, busy, tidy, finishTextSession, setInline });
  const {
    tableEditorBox, revealCell, panel, setPanel, edit, toggle, editor, selector, templatesButton, firstTemplateButton, objectsButton, boardButton, navButton, infoButton,
  } = useEditorPlacement({
    finishTextSession, setTool, scene, view, size, selected, item: resolvedItem, text, itemHeight, inline, setInline,
    composing, busy, readOnly, pos, tableCell: tableEntry.draft?.cell, setView,
  });
  const {
    tableGeometry, commitText, changeText, create, movedBoard, move, resizeStart,
    resizeStillValid, resizedBoard, resizeBy,
  } = useGeometryEdits({
    page: pages.id, tableEntry, tableMeasure, growTableRows, chooseTable, revealCell, shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
    item, selected, select, objectLayouts, readOnly, busy, composing,
    setStatus, setTool, setPanel, setInline, editor, lineCount, measureNode,
  });
  const {
    tableGesture, preview, drawingCursor, dots, dotsVisible, connection, cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick,
    pointerCancel, lostPointerCapture,
  } = useCanvasInput({
    page: pages.id, tableSelection, chooseTable, tableGeometry, tableAction: (action) => tableAction(action), voting: team?.hosted?.voting, drawing, tidy, find, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,
    setMessage, create, resizeStart, resizeStillValid, resizedBoard, movedBoard,
    scene, view, size, drag, busy, setBusy, spacePanRef, setSpacePan, setSelectionBox,
    selected, select, tool, setTool, readOnly, composing, inline, setInline, setPanel,
    handlesVisible, handlePoints, objectLayouts, displayedObjects, edit, textEditing: !!textSession.current, invalidObjectText,
  });
  const {
    commandReason, undoReason, redoReason, selectionReason, duplicateReason, clipboardState,
    showNotice, editingState, arrangementMembers,
  } = useCommandReasons({
    readOnly, composing, busy, tool, invalidObjectText, invalid, textSession, model,
    history, selected, visibleMessage, snapshots, displayedObjects, tidy, hosted: team?.hosted,
  });
  const {
    connectorPopup, shapePopup, contextWidth, contextLeft, contextTop, contextFits, swatchOpen, arrangeOpen,
    arrangeHeight, setSwatchFor, setArrangeFor, closeSwatches, closeArrange,
    contextBar, colourControl, colourButton, swatches, arrangeControl, arrangeButton, arrangeMenu,
  } = useContextBar({
    selectionKey, selected, selectionReason, bounds, pos, view, size, layout, inline,
    item: resolvedItem, itemHeight, dotsVisible, editorBox,
  });
  const exporter = useExport({ page: pages.id, board: pages.canvas(tidy.board), objects: displayedObjects, objectLayouts, selected, tableSelection, bitmaps: images.bitmaps, hosted: team?.hosted, busy, composing, tidyOpen: tidy.open, setMessage, scene, setPanel, boardButton, draw: drawExport }); const { tableAction, tableSize, tableData, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({
    pages, tableSelection, chooseTable, growTableRows, tableMeasure, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,
    setMessage, messageSequence, alive, select, selected, setInline, scene, view, setView,
    displayedObjects, commandReason, selectionReason, clipboardState, editingState,
    arrangementMembers, lineCount, measureNode, editor, selector, setPanel, setTool, hosted: team?.hosted,
  });
  const { pageKeyDown } = usePageKeys({
    page: pages.id, voting: team?.hosted?.voting, chooseImages: images.chooseImages,
    command, clipboardCommand, openExport: exporter.open, toggleFormat, model, cancel, scene, busy, composing, select,
    setInline, panel, setPanel, templatesButton, objectsButton, boardButton, infoButton, navButton,
  });
  const hostedPaste = useHostedBoard({ hosted: team?.hosted, model, load, onChange: pages.changed, tables: { selection: tableSelection, entry: tableEntry, choose: chooseTable, setMessage, cancelDrag: tableGesture.cancelDrag, focus: tableGesture.focus, finish: finishTextSession, endComposition: tableEntry.endComposition }, setBoard, setTitle, setDrafts, setReadOnly, setTool, setInline, select, paste: () => clipboardCommand("Paste"), composing });
  const nativeEditor = <ContentField
    tableEntry={tableEntry} tableName={tableName} cellInvalidNotice={cellInvalidNotice} setMessage={setMessage} editCell={tableGeometry.editCell} changeCell={tableGeometry.changeCell} finishCellComposition={tableGeometry.finishCellComposition} editor={editor} inline={inline} text={text} readOnly={readOnly} busy={busy} item={item}
    selectedId={selectedId} composing={composing} beginTextSession={beginTextSession}
    changeText={changeText} setComposing={setComposing} setDrafts={setDrafts}
    commitText={commitText} finishTextSession={finishTextSession} setInline={setInline}
    setTextSelection={setTextSelection} toggleFormat={toggleFormat}
  />;
  return (
    <main
      style={{ "--notice-top": layout.notice + "px", "--panel-top": layout.panel + "px" } as React.CSSProperties}
      onKeyDown={pageKeyDown} onKeyDownCapture={images.guardGesture}
    >
      {team?.hosted && team.banner}
      <div
        ref={scene} onPointerDownCapture={images.guardGesture} onPaste={tableData.paste(hostedPaste ?? images.paste(() => clipboardCommand("Paste")))} onDragOver={images.dragOver} onDrop={tableData.drop(images.drop)}
        className={"scene" + (spacePan ? busy ? " grabbing" : " grab" : "")}
        style={{
          cursor: drag.current?.corner ? (drag.current.corner === "nw" || drag.current.corner === "se"
            ? "nwse-resize" : "nesw-resize") : drawingCursor,
          backgroundSize: `${24 * view.z}px ${24 * view.z}px`, backgroundImage: view.z < .5 ? "none" : undefined,
          backgroundPosition: `${size.w / 2 - view.x * view.z}px ${
            size.h / 2 - view.y * view.z
          }px`,
        }}
        tabIndex={0}
        aria-label="Board canvas. Use Objects to read and edit. Enter places an armed tool or edits the selection."
        onPointerEnter={trackPointer}
        onKeyDown={sceneKeyDown}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onDoubleClick={doubleClick}
        onPointerCancel={pointerCancel}
        onLostPointerCapture={lostPointerCapture}
      >
        <BoardDrawing
          tableSelection={tableSelection} tableCell={tableEntry.draft?.cell} tableGesture={tableGesture} faded={find.faded} bitmaps={images.bitmaps} connection={connection} preview={preview} size={size} view={view} board={pages.canvas(tidy.board)} objectLayouts={objectLayouts} selected={tidy.selected} inline={inline} movingIds={busy && drag.current?.crossed ? drag.current.ids ?? [] : []}
        />
        <Overlays
          selectedGroups={selectedGroups} pos={pos} view={view} handlesVisible={handlesVisible}
          handlePoints={handlePoints} spacePan={spacePan} selectionBox={selectionBox} tool={tool}
        />
        <GrowButton available={growAvailable} grow={shapeCommands.grow} style={resolvedItem ? { left: pos(resolvedItem).left + resolvedItem.width * view.z / 2, top: pos(resolvedItem).top + resolvedItem.height * view.z } : undefined} />
        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={pages.canvas()} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TableButtons object={resolvedTable} selection={tableSelection} editing={inline} busy={busy || composing || tool !== "Select" || tidy.open} readOnly={readOnly} zoom={view.z} pos={pos} size={size} ghost={tableGesture.ghost} action={tableAction} select={chooseTable} focus={tableGesture.focus} /><TableCellStatus announcement={tableAnnouncement} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} page={pages.id} pos={pos} zoom={view.z} />
      </div>
      {team?.commentsLayer && team.hosted && <team.commentsLayer page={pages.id} openPage={pages.openPage} hosted={team.hosted} board={board} objects={displayedObjects} view={view} size={size} tool={tool} setTool={setTool} setView={setView} scene={scene} select={select} setInline={setInline} />}{team?.presenceLayer && team.hosted && <team.presenceLayer page={pages.id} hosted={team.hosted} scene={scene} selected={selected} objects={displayedObjects} view={view} size={size} setFollowView={setFollowView} />}
      {team?.votingLayer && team.hosted && <team.votingLayer page={pages.id} openPage={pages.openPage} allObjects={allDisplayedObjects} hosted={team.hosted} objects={displayedObjects} view={view} size={size} finishTextSession={finishTextSession} cancel={cancel} setInline={setInline} setTool={setTool} select={select} setView={setView} />}
      <ImageNames board={pages.canvas()} /><PagesPanel pages={pages} /><FileBar team={team} pages={pages}
        boardButton={boardButton} composing={composing} busy={busy} toggle={toggle} panel={panel}
        title={title} objectsButton={objectsButton} undoReason={undoReason} redoReason={redoReason}
        command={command}
      />
      <SaveArea team={team}
        latestAcknowledgement={latestAcknowledgement} status={status} invalid={invalid} save={tableEntry.exitBefore(save, finishTextSession)}
        readOnly={readOnly} composing={composing} busy={busy}
      />
      <span id="undo-reason" className="sr-only">{undoReason}</span>
      <span id="redo-reason" className="sr-only">{redoReason}</span>
      <span id="selection-reason" className="sr-only">{selectionReason}</span>{duplicateReason !== selectionReason && <span id="duplicate-reason" className="sr-only">{duplicateReason}</span>}
      {(!team?.hosted || !!visibleMessage) && <Notice pages={pages} hosted={!!team?.hosted}
        showNotice={showNotice} visibleMessage={visibleMessage} invalidFields={invalidFields}
        busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen}
        composing={composing} adopt={adopt} setReadOnly={setReadOnly} setMessage={setMessage}
      />}
      {panel === "Board" && (
        <BoardPanel team={team}
          setComposing={setComposing} commit={commit} model={model} title={title} readOnly={readOnly}
          busy={busy} setTitle={setTitle} setStatus={setStatus} composing={composing} reopen={reopen}
          setPanel={setPanel} boardButton={boardButton} boardFiles={boardFiles} importTable={tableData.importButton} exportButton={exporter.button} beginNameEntry={beginNameEntry} finishNameEntry={finishNameEntry}
        />
      )}
      {panel === "Objects" && (
        <ObjectsPanel
          tapeSelection={tapeSelection} tidy={tidy} description={images.description} connectorCommands={connectorCommands} strokeSelection={strokeSelection} strokeCommands={strokeCommands} shapeSelection={shapeSelection} shapeCommands={shapeCommands} growAvailable={growAvailable} selectionFormats={selectionFormats} toggleFormat={toggleFormat} richText={richText}
          duplicateReason={duplicateReason} board={pages.canvas()} busy={busy} composing={composing} setPanel={setPanel}
          objectsButton={objectsButton} selector={selector} selected={selected}
          finishTextSession={finishTextSession} select={select} numbers={numbers} drafts={drafts}
          nativeEditor={nativeEditor} item={item} text={text} selectionColor={selectionColor} selectionSize={selectionSize}
          selectionAlign={selectionAlign} selectionReason={selectionReason} changeStyle={changeStyle}
          command={command} readOnly={readOnly} move={move} bounds={bounds} resizeBy={resizeBy}
          arrange={arrange} arrangementReason={arrangementReason} objectClipboard={objectClipboard}
          clipboardState={clipboardState} clipboardCommand={clipboardCommand} create={create} view={view} setSection={setSection}
        />
      )}
      {tidy.open && <TidyUpBar tidy={tidy} pos={pos} view={view} size={size} layout={layout} />}{selected.size > 0 && !tidy.open && (
        <ContextBar
          tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage={<MoveToPage pages={pages} selected={selected} reason={duplicateReason} />} description={images.description} imageCount={images.count} imagesOnly={images.only} connectorCommands={connectorCommands} strokeSelection={strokeSelection} strokeCommands={strokeCommands} shapeSelection={shapeSelection} shapeCommands={shapeCommands} shapePopup={shapePopup} selectionFormats={selectionFormats} toggleFormat={toggleFormat} richText={richText}
          connectorObjects={connectors} connectorPopup={connectorPopup} connectorOnly={connectorOnly} connectorCount={connectors.length} duplicateReason={duplicateReason} contextBar={contextBar} contextFits={contextFits} contextLeft={contextLeft}
          tableSelection={tableSelection} tableDraft={tableEntry.draft?.text} tableResizing={tableGesture.resizing} cellInvalidNotice={cellInvalidNotice} setMessage={setMessage} tableAction={tableAction} tableSize={tableSize} exportTable={tableData.exportTable} editCell={tableGeometry.editCell} contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}
          composing={composing} busy={busy} inline={inline} finishTextSession={finishTextSession}
          setInline={setInline} scene={scene} edit={edit} text={text} colourControl={colourControl}
          colourButton={colourButton} selectionReason={selectionReason} colourLabel={colourLabel}
          swatchOpen={swatchOpen} setArrangeFor={setArrangeFor} setSwatchFor={setSwatchFor}
          selectionKey={selectionKey} selectionColor={selectionColor} swatches={swatches}
          contextWidth={contextWidth} size={size} closeSwatches={closeSwatches} changeStyle={changeStyle}
          selectionSize={selectionSize} selectionAlign={selectionAlign} arrangeControl={arrangeControl}
          arrangeButton={arrangeButton} arrangeOpen={arrangeOpen} arrangeMenu={arrangeMenu}
          arrangeHeight={arrangeHeight} closeArrange={closeArrange} arrange={arrange}
          arrangementReason={arrangementReason} command={command}
        />
      )}
      {inline && resolvedItem && (
        <InlineEditor
          inlineSurface={inlineSurface} trackPointer={trackPointer} pos={pos} item={resolvedItem}
          tableEditorBox={tableEditorBox} view={view} itemHeight={itemHeight} text={text} nativeEditor={nativeEditor}
        />
      )}
      <ShapesPanel tool={tool} setTool={setTool} scene={scene} disabled={busy || composing || readOnly} />
      <Palette team={team}
        imagePicker={images.picker} drawing={drawing} tool={tool} busy={busy} composing={composing} readOnly={readOnly} setTool={setTool}
        setInline={setInline} scene={scene} loadTemplates={loadTemplates} panel={panel} toggle={toggle} templatesButton={templatesButton} firstTemplateButton={firstTemplateButton} templateCommands={templateCommands} templatePreviews={templatePreviews}
      />
      {find.open && <FindBar find={find} />}<ZoomControls
        busy={busy} composing={composing} setView={setView} view={view} panel={panel}
        navButton={navButton} toggle={toggle}
      />
      <BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} />
      <InformationControls
        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}
      />
      {panel === "Navigation" && (
        <NavigationPanel
          busy={busy} composing={composing} setView={setView} setPanel={setPanel} navButton={navButton} find={find}
        />
      )}
    </main>
  );
}
