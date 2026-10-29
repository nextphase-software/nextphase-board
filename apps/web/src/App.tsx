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
import { useObjectLayouts } from "./state/use-object-layouts";
import { useEditorPlacement } from "./state/use-editor-placement";
import { BoardDrawing } from "./scene/board-drawing";
import { Overlays } from "./scene/overlays";
import { ConnectionDots } from "./scene/connection-dots";
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
import { BoardQuestion } from "./ui/board-question";
import { NavigationPanel } from "./ui/navigation-panel";
export function App() {
  const { readOnly, setReadOnly, status, setStatus } = useSessionStatus();
  const {
    selectionBox, setSelectionBox, tool, setTool, busy: gestureBusy, setBusy, spacePan, setSpacePan,
    scene, spacePanRef, drag, drawing, selectionStarted,
  } = useGestureState(() => select(""), () => finishTextSession(), () => setInline(false));
  const { inline, setInline, composing, setComposing, textSelection, setTextSelection } = useTextEntry();
  const { setMessage, messageSequence, latestAcknowledgement, visibleMessage } = useMessages();
  const {
    connectorStyle, shapeSession, board, setBoard, title, setTitle, drafts, setDrafts, history,
    model, historyRef, textSession, revision, adapter,
    updateHistory, clearHistory, beginTextSession, finishTextSession, commit, load,
  } = useBoardDocument({ readOnly, setStatus });
  const {
    strokeSelection, connectorOnly, connectors, shapeSelection, selected, setSelected, selectionKey, selectedId, item, text,
    selectionColor, selectionSize, selectionAlign, colourLabel, selectionFormats, richText,
  } = useSelection({ board, drafts, textSelection });
  const { invalidObjectText, invalidFields, invalid, pending } = useValidity({
    board, drafts, title, composing, busy: gestureBusy,
  });
  const images = useImages({ board, model, selected, readOnly, busy: gestureBusy, composing, invalidObjectText, pending,
    commit, finishTextSession, select, setTool, setPanel: (value) => setPanel(value), setInline, setComposing, setMessage, scene,
    getView: () => view, getStore: () => store.current, isAlive: () => alive.current, barVisible: () => size.w >= 768 && contextFits || panel === "Objects" });
  const busy = images.busy; const {
    editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, bounds, selectedGroups, numbers,
    handlesVisible, handlePoints, itemHeight,
  } = useObjectLayouts({
    board, selected, selectedId, item, text, inline, textEditing: !!textSelection, invalidObjectText, tool, readOnly, composing, busy, drag,
  });
  const layout = usePanelLayout(scene);
  const { view, setView, trackPointer, inlineSurface } = useViewport({ scene, inline, drag, pending });
  function select(value: string | Iterable<string>) {
    finishTextSession();
    setInline(false);
    setSwatchFor("");
    setArrangeFor("");
    const ids = new Set(typeof value === "string" ? value ? [value] : [] : value); if (ids.size) selectionStarted(); setSelected(ids);
  }
  const { store, snapshots, alive, adopt, save, reopen, boardFiles, boardQuestion } = useStorageSession({
    readOnly, setReadOnly, setStatus, setMessage, load, clearHistory, model,
    revision, adapter, select, setInline, setView, invalid, busy, composing, pending, title,
  });
  const size = useSceneSize(scene);
  const pos = (o: { x: number; y: number }) => screenPoint(o, view, size);
  const {
    panel, setPanel, edit, toggle, editor, selector, templatesButton, firstTemplateButton, objectsButton, boardButton, navButton, infoButton,
  } = useEditorPlacement({
    finishTextSession, setTool, scene, view, size, selected, item: resolvedItem, text, itemHeight, inline, setInline,
    composing, busy, readOnly, pos,
  });
  const {
    commitText, changeText, create, movedBoard, move, resizeStart,
    resizeStillValid, resizedBoard, resizeBy,
  } = useGeometryEdits({
    shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
    item, selected, select, objectLayouts, readOnly, busy, composing,
    setStatus, setTool, setPanel, setInline, editor, lineCount,
  });
  const {
    preview, drawingCursor, dots, dotsVisible, connection, cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick,
    pointerCancel, lostPointerCapture,
  } = useCanvasInput({
    drawing, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,
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
    history, selected, visibleMessage, snapshots, displayedObjects,
  });
  const {
    connectorPopup, shapePopup, contextWidth, contextLeft, contextTop, contextFits, swatchOpen, arrangeOpen,
    arrangeHeight, setSwatchFor, setArrangeFor, closeSwatches, closeArrange,
    contextBar, colourControl, colourButton, swatches, arrangeControl, arrangeButton, arrangeMenu,
  } = useContextBar({
    selectionKey, selected, selectionReason, bounds, pos, view, size, layout, inline,
    item: resolvedItem, itemHeight, dotsVisible, editorBox,
  });
  const { connectorCommands, strokeCommands, loadTemplates, addActivity, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({
    tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,
    setMessage, messageSequence, alive, select, selected, setInline, scene, view, setView,
    displayedObjects, commandReason, selectionReason, clipboardState, editingState,
    arrangementMembers, lineCount, editor, selector, setPanel, setTool,
  });
  const { pageKeyDown } = usePageKeys({
    chooseImages: images.chooseImages,
    command, clipboardCommand, toggleFormat, model, cancel, scene, busy, composing, select,
    setInline, panel, setPanel, templatesButton, objectsButton, boardButton, infoButton, navButton,
  });
  const nativeEditor = <ContentField
    editor={editor} inline={inline} text={text} readOnly={readOnly} busy={busy} item={item}
    selectedId={selectedId} composing={composing} beginTextSession={beginTextSession}
    changeText={changeText} setComposing={setComposing} setDrafts={setDrafts}
    commitText={commitText} finishTextSession={finishTextSession} setInline={setInline}
    setTextSelection={setTextSelection} toggleFormat={toggleFormat}
  />;
  return (
    <main
      style={{
        "--notice-top": layout.notice + "px",
        "--panel-top": layout.panel + "px",
      } as React.CSSProperties}
      onKeyDown={pageKeyDown} onKeyDownCapture={images.guardGesture}
    >
      <div
        ref={scene} onPointerDownCapture={images.guardGesture} onPaste={images.paste(() => clipboardCommand("Paste"))} onDragOver={images.dragOver} onDrop={images.drop}
        className={"scene" + (spacePan ? busy ? " grabbing" : " grab" : "")}
        style={{
          cursor: drag.current?.corner ? (drag.current.corner === "nw" || drag.current.corner === "se"
            ? "nwse-resize" : "nesw-resize") : drawingCursor,
          backgroundSize: `${24 * view.z}px ${24 * view.z}px`,
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
          bitmaps={images.bitmaps} connection={connection} preview={preview} size={size} view={view} board={board} objectLayouts={objectLayouts} selected={selected} inline={inline} movingIds={busy && drag.current?.crossed ? drag.current.ids ?? [] : []}
        />
        <Overlays
          selectedGroups={selectedGroups} pos={pos} view={view} handlesVisible={handlesVisible}
          handlePoints={handlePoints} spacePan={spacePan} selectionBox={selectionBox} tool={tool}
        />
        <GrowButton available={growAvailable} grow={shapeCommands.grow} style={resolvedItem ? { left: pos(resolvedItem).left + resolvedItem.width * view.z / 2, top: pos(resolvedItem).top + resolvedItem.height * view.z } : undefined} />
        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} />
      </div>
      <ImageNames board={board} /><FileBar
        boardButton={boardButton} composing={composing} busy={busy} toggle={toggle} panel={panel}
        title={title} objectsButton={objectsButton} undoReason={undoReason} redoReason={redoReason}
        command={command}
      />
      <SaveArea
        latestAcknowledgement={latestAcknowledgement} status={status} invalid={invalid} save={save}
        readOnly={readOnly} composing={composing} busy={busy}
      />
      <span id="undo-reason" className="sr-only">{undoReason}</span>
      <span id="redo-reason" className="sr-only">{redoReason}</span>
      <span id="selection-reason" className="sr-only">{selectionReason}</span>{duplicateReason !== selectionReason && <span id="duplicate-reason" className="sr-only">{duplicateReason}</span>}
      <Notice
        showNotice={showNotice} visibleMessage={visibleMessage} invalidFields={invalidFields}
        busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen}
        composing={composing} adopt={adopt} setReadOnly={setReadOnly} setMessage={setMessage}
      />
      {panel === "Board" && (
        <BoardPanel
          setComposing={setComposing} commit={commit} model={model} title={title} readOnly={readOnly}
          busy={busy} setTitle={setTitle} setStatus={setStatus} composing={composing} reopen={reopen}
          setPanel={setPanel} boardButton={boardButton} boardFiles={boardFiles}
        />
      )}
      {panel === "Objects" && (
        <ObjectsPanel
          description={images.description} connectorCommands={connectorCommands} strokeSelection={strokeSelection} strokeCommands={strokeCommands} shapeSelection={shapeSelection} shapeCommands={shapeCommands} growAvailable={growAvailable} selectionFormats={selectionFormats} toggleFormat={toggleFormat} richText={richText}
          duplicateReason={duplicateReason} board={board} busy={busy} composing={composing} setPanel={setPanel}
          objectsButton={objectsButton} selector={selector} selected={selected}
          finishTextSession={finishTextSession} select={select} numbers={numbers} drafts={drafts}
          nativeEditor={nativeEditor} item={item} text={text} selectionColor={selectionColor} selectionSize={selectionSize}
          selectionAlign={selectionAlign} selectionReason={selectionReason} changeStyle={changeStyle}
          command={command} readOnly={readOnly} move={move} bounds={bounds} resizeBy={resizeBy}
          arrange={arrange} arrangementReason={arrangementReason} objectClipboard={objectClipboard}
          clipboardState={clipboardState} clipboardCommand={clipboardCommand} create={create} view={view} setSection={setSection}
        />
      )}
      {selected.size > 0 && (
        <ContextBar
          description={images.description} imageCount={images.count} imagesOnly={images.only} connectorCommands={connectorCommands} strokeSelection={strokeSelection} strokeCommands={strokeCommands} shapeSelection={shapeSelection} shapeCommands={shapeCommands} shapePopup={shapePopup} selectionFormats={selectionFormats} toggleFormat={toggleFormat} richText={richText}
          connectorObjects={connectors} connectorPopup={connectorPopup} connectorOnly={connectorOnly} connectorCount={connectors.length} duplicateReason={duplicateReason} contextBar={contextBar} contextFits={contextFits} contextLeft={contextLeft}
          contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}
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
          view={view} itemHeight={itemHeight} text={text} nativeEditor={nativeEditor}
        />
      )}
      <ShapesPanel tool={tool} setTool={setTool} scene={scene} disabled={busy || composing || readOnly} />
      <Palette
        imagePicker={images.picker} drawing={drawing} tool={tool} busy={busy} composing={composing} readOnly={readOnly} setTool={setTool}
        setInline={setInline} scene={scene} loadTemplates={loadTemplates} panel={panel} toggle={toggle} templatesButton={templatesButton} firstTemplateButton={firstTemplateButton} addActivity={addActivity} templatePreviews={templatePreviews}
      />
      <ZoomControls
        busy={busy} composing={composing} setView={setView} view={view} panel={panel}
        navButton={navButton} toggle={toggle}
      />
      <BoardQuestion {...boardQuestion} />
      <InformationControls
        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}
      />
      {panel === "Navigation" && (
        <NavigationPanel
          busy={busy} composing={composing} setView={setView} setPanel={setPanel} navButton={navButton}
        />
      )}
    </main>
  );
}
