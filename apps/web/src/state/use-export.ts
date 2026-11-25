// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { BoardV14 } from "nextphase-board-rules/document.ts";
import { videoFrame } from "../video.ts";
import { isMedia, isVideo } from "nextphase-board-rules/objects/registry.ts";
import {
  allowedToExport, defaultExportChoices, exportContent, EXPORT_FAILURE, exportFileName,
  exportOpening, fitPicture, gridDots, gridRadius, includedObjects, lowerScaleMessage,
  pdfBytes, pictureOptions, pictureProblem, rememberExport, validJpegFrame,
  type DrawExport, type DrawnObject, type ExportChoices,
} from "../board-export";
import type { TableSelection } from "../table";
import type { HostedBoard } from "../team/hosted-board";

let storedChoices: ExportChoices = { ...defaultExportChoices };

type Input<Layouts> = {
  page: string;
  board: BoardV14;
  objects: readonly DrawnObject[];
  objectLayouts: Layouts;
  selected: ReadonlySet<string>;
  tableSelection?: TableSelection;
  bitmaps: ReadonlyMap<string, ImageBitmap>;
  hosted?: HostedBoard;
  busy: boolean;
  composing: boolean;
  tidyOpen: boolean;
  setMessage: (message: string) => void;
  scene: RefObject<HTMLDivElement | null>;
  setPanel: (panel: string) => void;
  boardButton: RefObject<HTMLButtonElement | null>;
  draw: DrawExport<Layouts>;
};

type Dialog = { choices: ExportChoices; hasSelection: boolean; returnFocus: HTMLElement | null };
type ExportBox = Parameters<typeof gridDots>[0];

function fillGrid(context: CanvasRenderingContext2D, box: ExportBox, scale: number) {
  const radius = gridRadius * scale;
  context.fillStyle = "#C8C8C8";
  // A pixel belongs to the dot when its centre lies inside the circle.
  for (const dot of gridDots(box)) {
    const x = (dot.x - box.x) * scale, y = (dot.y - box.y) * scale;
    for (let row = Math.ceil(y - radius - 0.5); row <= Math.floor(y + radius - 0.5); row++) {
      const dy = row + 0.5 - y;
      const reach = Math.sqrt(radius * radius - dy * dy);
      const start = Math.ceil(x - reach - 0.5), end = Math.floor(x + reach - 0.5);
      if (start <= end) context.fillRect(start, row, end - start + 1, 1);
    }
  }
}

async function encodePicture<Layouts>(draw: DrawExport<Layouts>, drawing: Parameters<DrawExport<Layouts>>[0],
  options: ReturnType<typeof pictureOptions>) {
  const { box, fit } = drawing, { width, height } = fit.pixels;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw Error("Could not create the export canvas.");
    if (options.background !== "Transparent") {
      context.fillStyle = options.background === "Grid" ? "#F5F5F5" : "#FFFFFF";
      context.fillRect(0, 0, width, height);
      if (options.background === "Grid") fillGrid(context, box, fit.scale);
    }
    const rendered = draw(drawing);
    try {
      context.drawImage(rendered, 0, 0);
    } finally {
      rendered.width = rendered.height = 0;
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, options.mime, options.quality));
    if (blob?.type !== options.mime) throw Error("Could not encode the export canvas.");
    return blob;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const access = (hosted?: HostedBoard) => ({ hosted: !!hosted, role: hosted?.snapshot.role });
const boardIdentity = ({ board, hosted }: Pick<Input<unknown>, "board" | "hosted">) => hosted?.boardId ?? board.boardId;

export function useExport<Layouts>(input: Input<Layouts>) {
  const latest = useRef(input);
  latest.current = input;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [running, setRunning] = useState(false);
  const activeRun = useRef(false);
  const { hosted, busy, composing, tidyOpen, scene, boardButton, setPanel } = input;
  const opening = () => exportOpening({
    ...access(hosted), voting: !!hosted?.voting.mode, busy,
    composing: composing || !!scene.current?.querySelector(".inline textarea"),
    tidyOpen, dialogOpen: !!dialog, running: activeRun.current,
    historyLocked: !!(hosted?.history.previewing || hosted?.history.locked),
  });

  function openFrom(returnFocus: HTMLElement | null, fromPanel = false) {
    const gate = opening();
    if (gate.disabled) return false;
    if (gate.reason) {
      input.setMessage(gate.reason);
      return true;
    }
    const hasSelection = input.objects.some(o => o.page === input.page && input.selected.has(o.id));
    if (fromPanel) setPanel("");
    setDialog({ choices: { ...storedChoices }, hasSelection, returnFocus });
    return true;
  }

  function close() {
    if (!dialog) return;
    flushSync(() => setDialog(null));
    if (dialog.returnFocus?.isConnected) dialog.returnFocus.focus();
  }

  function change<K extends keyof ExportChoices>(key: K, value: ExportChoices[K]) {
    setDialog(current => current && { ...current, choices: { ...current.choices, [key]: value } });
  }

  async function run() {
    if (!dialog || activeRun.current) return;
    const frozen = latest.current;
    const surface = frozen.scene.current, id = boardIdentity(frozen);
    const stillCurrent = () => {
      const current = latest.current;
      return !!surface?.isConnected && surface === current.scene.current &&
        boardIdentity(current) === id && allowedToExport(access(current.hosted));
    };
    if (!stillCurrent()) { close(); return; }

    const { choices, hasSelection } = dialog;
    const area = hasSelection ? choices.area : "Entire page";
    const objects = includedObjects(frozen.objects, frozen.page, area, frozen.selected);
    const name = exportFileName(frozen.board.title, choices.type);
    const notice = (message: string) => { if (stillCurrent()) latest.current.setMessage(message); };
    const save = (file: Blob) => { if (stillCurrent()) download(file, name); };
    storedChoices = rememberExport(storedChoices, choices, hasSelection);
    activeRun.current = true;
    setRunning(true);
    try {
      close();
      const content = exportContent(objects, choices, area, frozen.tableSelection);
      if (content.notice !== undefined) { notice(content.notice); return; }
      if (content.csv !== undefined) {
        save(new Blob([content.csv], { type: "text/csv;charset=utf-8" }));
        return;
      }

      const box = content.box;
      const images = objects.filter(isMedia);
      const picturesReady = (pictures: ReadonlyMap<string, ImageBitmap>) => images.every(image => {
        const bitmap = isVideo(image) ? videoFrame(image, pictures) : pictures.get(image.asset);
        return bitmap?.width === image.pixelWidth && bitmap?.height === image.pixelHeight;
      });
      let pictures = frozen.bitmaps;
      if (!picturesReady(pictures)) {
        const deadline = Date.now() + 5000;
        let remaining = 5000;
        while (remaining > 0 && !picturesReady(pictures)) {
          await new Promise(resolve => setTimeout(resolve, Math.min(250, remaining)));
          if (!stillCurrent()) return;
          pictures = latest.current.bitmaps;
          remaining = deadline - Date.now();
        }
      }
      if (!picturesReady(pictures)) { notice(pictureProblem(false, false, area)); return; }
      const options = pictureOptions(choices);
      const fit = fitPicture(box, options.requested);
      if (!fit) { notice(pictureProblem(true, false, area)); return; }

      const picture = await encodePicture(frozen.draw, {
        board: frozen.board, only: new Set(objects.map(o => o.id)), objectLayouts: frozen.objectLayouts,
        bitmaps: pictures, box, fit,
      }, options);
      if (!stillCurrent()) return;
      let file = picture;
      if (choices.type === "PDF") {
        const jpeg = new Uint8Array(await picture.arrayBuffer());
        if (!validJpegFrame(picture.type, jpeg, fit.pixels)) throw Error("The JPEG frame does not match the export picture.");
        file = new Blob([pdfBytes(jpeg, fit.pixels, box, frozen.board.title)], { type: "application/pdf" });
      }
      save(file);
      if (fit.scale < options.requested) notice(lowerScaleMessage(area, fit.scale, options.requested));
    } catch {
      notice(EXPORT_FAILURE);
    } finally {
      activeRun.current = false;
      setRunning(false);
    }
  }

  const gate = opening();
  return {
    open: () => openFrom(scene.current),
    button: {
      shown: gate.shown,
      disabled: gate.disabled || running,
      open: (_clicked: HTMLButtonElement) => openFrom(boardButton.current, true),
    },
    dialog: { choices: dialog?.choices, hasSelection: dialog?.hasSelection ?? false, change, close, run },
  };
}
