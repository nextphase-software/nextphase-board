# 0001 — Web app modules

Note version: 40 (for 0010-W1 brief v1, 2026-11-15). Status: Draft.
Replaces [web modules v39](0001-web-modules-v39.md), whose registry, import, composition,
one-state-owner and team guards remain word for word except as below. [Interaction v42](0001-interaction-v42.md)
adds the zoom range 10–200%, the fit and show rules, Find on board and the Navigation panel's new rows
with exactly these four new source modules and one new test file. [Document v17](0001-document-v17.md)
is unchanged: nothing here touches the document, the packages or the server.

| Module | Responsibility |
| --- | --- |
| `apps/web/src/find.ts` | Pure rules: the searchable objects of the displayed objects (types with text, non-empty text; hidden mind-map nodes are already absent from the displayed objects), the query and match rule, the results in reading order (through `readingOrder` from `tidy-up.ts`), the boxes of interaction v42 (a section's name band, a connector's label box), the current result after a query change, Next and Previous with wrapping, the place of a removed current result and the result Next or Previous goes to from it, the counter text and the removed line, the faded ids, and the sections list (ids and labels in reading order). No Konva, React or DOM |
| `apps/web/src/state/use-find.ts` | The one owner of Find state: open or closed, the query (kept for the tab while the bar is closed), the current result id and the last known box of the current result; the ⌘F / Ctrl+F listener (one `document` keydown listener in the capture phase, its only effect); opening (ending a text edit first), closing (selecting the current result and focusing the canvas), Next and Previous; the free area measured at the moment of each move from the scene, the board tools bar (`nav.palette`) and an open Navigation panel (`.navigation`); and the moves: show the current result, fit a section, Zoom to fit, Zoom to selection, through `setView` and the pure functions of `view.ts` |
| `apps/web/src/ui/find-bar.tsx` | The find bar of interaction v42 (icon, field, counter and removed line in one polite live region, Previous result, Next result, Close find), its keys (Return, Shift+Return, Escape) |
| `apps/web/src/scene/find-rings.tsx` | The result rings (DOM elements placed with `pos` and the zoom, like the mind-map buttons, `pointer-events: none`), current and other looks |
| `tests/find.test.mjs` | The unit test file named in the brief |

Counts: the rules package stays exactly **15** files; exactly **10** object-type modules; exactly **16**
scene parts (15 + `find-rings.tsx`); exactly **30** screen parts (29 + `find-bar.tsx`); exactly **24**
state hooks (23 + `use-find.ts`, with its own effect count of exactly **1**); every other effect count
unchanged.

**The view module.** `apps/web/src/view.ts` keeps its exports and their signatures and changes these:
`clampView` and `zoomView` clamp the zoom to 0.1–2; `stepZoom` steps through `ZOOM_STEPS`
(`[.1, .25, .5, .75, 1, 1.25, 1.5, 1.75, 2]`, exported) by interaction v42's rule; and it gains three pure
functions: `freeArea(size, paletteTop, panelLeft?)` (the free area, with the small-window fallback),
`fitView(box, area, size)` and `showView(box, view, area, size)` (the fit and show rules; `showView`
returns the same view object when nothing moves). `team/presence.ts`'s `fitFollow` keeps calling
`clampView`, so following a presenter takes the new range with no change to that file.
`activities.ts`'s own activity view (0.5–1.75 in quarter steps) is unchanged.

**App.tsx** remains composition-only and at most 264 lines, with **no added line**. Its only
permitted changes are these nine substitutions on existing lines (4f53e7f line numbers):
1. imports: `useFind` appended to the line importing `useObjectLayouts` and `useTidyUp` (21);
2. imports: `FindRings` and `FindBar` appended to the line importing `Overlays` … `TidyUpBar` (24);
3. the line defining `pos` (85) gains, after it on the same line, `const find = useFind({ … });`
   passing only values App already has at that point (for example `displayedObjects`, `selected`,
   `select`, `view`, `setView`, `size`, `scene`, `composing`, `busy`, `tidy`, `finishTextSession`);
   `useFind` returns at least `open`, `faded` and the commands the parts below use;
4. the `useCanvasInput` argument line that passes `tidy` (104) gains `find`;
5. the `backgroundSize` line of the scene's style (156) gains, on the same line,
   `backgroundImage: view.z < .5 ? "none" : undefined,` so the dot grid is hidden below 50%;
6. the `BoardDrawing` props line (173) gains `faded={find.faded}`;
7. the `ConnectionDots` … `TidyUpLayer` line (180) gains `<FindRings … />` after `<TidyUpLayer … />`,
   passing only values App already has (`find`, `pos`, the zoom);
8. the line opening `<ZoomControls` (249) becomes `{find.open && <FindBar find={find} />}<ZoomControls`;
9. the `NavigationPanel` props line (259) gains `find={find}`.
The existing "0009-W3 App composition" test in `tests/modules.test.mjs` (588–648) is rewritten (not kept
beside a new one) as "0010-W1 App composition": it derives the expected App from 4f53e7f's App with
exactly these nine substitutions (each `from` text occurring exactly once) and asserts the same line count.

Seams, and only these:
- `state/use-canvas-input.ts`: Shift+`Digit1` and Shift+`Digit2` in `sceneKeyDown` (interaction v42's
  conditions) call `find`'s Zoom to fit and Zoom to selection; nothing else changes there.
- `scene/board-drawing.tsx`: draws every object whose id is in `faded` at opacity 0.4; nothing else.
- `ui/navigation-panel.tsx`: the rows of interaction v42 (Find on board, Zoom to fit, Zoom to selection,
  Sections, the Move heading and the 2 × 2 pan grid), reading `find`; its pan, Reset view and Close
  behaviour unchanged. Its props stay those App passes today plus `find`.
- `ui/zoom-controls.tsx`: only if `stepZoom`'s new steps need a change there (none is expected).
- `icons.tsx`: the search, chevron-up and close icons.
- `team/reactions-layer.tsx`, `team/comments/layer.tsx`, `team/spotlight-layer.tsx` and
  `state/use-presence.ts`: each keydown
  listener gains one guard that returns at once for an event whose target is inside the find bar
  (`.find-bar`, the bar's class); nothing else changes in them.
- `apps/web/style.css`: the find bar, the rings, the panel's new rows and pan grid, and the find bar's
  narrow-window rule; the find bar is drawn above the notices row (later in the page and
  `z-index: 4`).

No package, dependency, font, image file, service, import exception, stored value or server change.
