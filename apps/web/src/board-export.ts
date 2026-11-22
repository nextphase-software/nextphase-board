// SPDX-License-Identifier: Apache-2.0
import type { BoardV14, ItemV14 } from "nextphase-board-rules/document.ts";
import { isContainer, isTable, typeForTool } from "nextphase-board-rules/objects/registry.ts";
import { boundingBox, type DisplayObject } from "./selection.ts";
import { TABLE_LEVEL, type TableSelection } from "./table.ts";
import { boardFileName } from "./board-file.ts";
import { csvField, tableCsvBody } from "./table-csv.ts";

export const fileTypes = ["PNG", "JPG", "PDF", "CSV"] as const;
export const backgrounds = ["Grid", "Transparent", "Solid"] as const;
export const qualities = ["High", "Medium", "Low"] as const;
export const csvTypes = ["Tables", "Stickies"] as const;
export const exportAreas = ["Selection only", "Entire page"] as const;

type FileType = typeof fileTypes[number];
type Background = typeof backgrounds[number];
type Quality = typeof qualities[number];
type ExportArea = typeof exportAreas[number];
export type ExportChoices = {
  type: FileType;
  pngBackground: Background;
  jpgBackground: Exclude<Background, "Transparent">;
  jpgQuality: Quality;
  pdfQuality: Quality;
  csvType: typeof csvTypes[number];
  area: ExportArea;
};

export const defaultExportChoices: Readonly<ExportChoices> = {
  type: "PNG", pngBackground: "Solid", jpgBackground: "Solid", jpgQuality: "High",
  pdfQuality: "Medium", csvType: "Tables", area: "Selection only",
};

export const exportGroups = {
  PNG: { background: "pngBackground" },
  JPG: { quality: "jpgQuality", background: "jpgBackground", disabledBackground: "Transparent" },
  PDF: { quality: "pdfQuality", white: true },
  CSV: { content: "csvType" },
} as const;

export function rememberExport(stored: ExportChoices, draft: ExportChoices, hasSelection: boolean): ExportChoices {
  const next = { ...stored, type: draft.type, area: hasSelection ? draft.area : stored.area };
  switch (draft.type) {
    case "PNG": return { ...next, pngBackground: draft.pngBackground };
    case "JPG": return { ...next, jpgBackground: draft.jpgBackground, jpgQuality: draft.jpgQuality };
    case "PDF": return { ...next, pdfQuality: draft.pdfQuality };
    case "CSV": return { ...next, csvType: draft.csvType };
  }
}

type Access = { hosted: boolean; role?: "owner" | "editor" | "viewer" };
export const allowedToExport = ({ hosted, role }: Access) => !hosted || role === "owner" || role === "editor";
export const exportReason = ({ hosted, role }: Access) =>
  hosted && role === "viewer" ? "Only owners and editors can export this board." : "";

export function exportOpening({ voting, busy, composing, tidyOpen, dialogOpen, running, historyLocked, ...access }: Access & {
  voting: boolean; busy: boolean; composing: boolean; tidyOpen: boolean;
  dialogOpen: boolean; running: boolean; historyLocked: boolean;
}) {
  const reason = exportReason(access);
  const disabled = voting || busy || composing || tidyOpen || dialogOpen || running || access.hosted && historyLocked;
  return { disabled, shown: !reason, reason: disabled ? "" : reason };
}

export type DrawnObject = ItemV14 & DisplayObject;

export function includedObjects(objects: readonly DrawnObject[], page: string, area: ExportArea, selected: ReadonlySet<string>) {
  const drawn = objects.filter(o => o.page === page);
  if (area === "Entire page") return drawn;
  const sections = new Set(drawn.filter(o => selected.has(o.id) && isContainer(o)).map(o => o.id));
  return drawn.filter(o => selected.has(o.id) || (o.section != null && sections.has(o.section)));
}

export function wholeTables(objects: readonly DrawnObject[], area: ExportArea, selection?: TableSelection) {
  const partial = area === "Selection only" && selection?.kind !== TABLE_LEVEL ? selection?.id : undefined;
  return objects.filter(isTable).filter(o => o.id !== partial);
}

export function exportStickies(objects: readonly DrawnObject[]) {
  return objects.filter(o => o.type === typeForTool("Sticky") && "text" in o);
}

export const tablesCsv = (tables: ReturnType<typeof wholeTables>) => "\uFEFF" + tables.map(tableCsvBody).join("\r\n");
export const stickiesCsv = (stickies: ReturnType<typeof exportStickies>) =>
  "\uFEFFContent\r\n" + stickies.map(o => csvField(o.text ?? "") + "\r\n").join("");

export const exportFileName = (title: string, type: FileType) =>
  boardFileName(title).slice(0, -".nextboard".length) + "." + type.toLowerCase();

type PictureBox = NonNullable<ReturnType<typeof boundingBox>>;
type PixelSize = { width: number; height: number };
type PictureFit = { scale: number; pixels: PixelSize };

export function pictureBox(objects: readonly DrawnObject[]): PictureBox | null {
  const bounds = boundingBox(objects);
  return bounds && { x: bounds.x - 128, y: bounds.y - 128, width: bounds.width + 256, height: bounds.height + 256 };
}

export function fitPicture({ width, height }: PictureBox, requested: number): PictureFit | undefined {
  for (let scale = requested; scale >= 0.5; scale -= 0.25) {
    const wp = Math.round(width * scale), hp = Math.round(height * scale);
    if (wp <= 16_384 && hp <= 16_384 && wp * hp <= 268_435_456) {
      return { scale, pixels: { width: wp, height: hp } };
    }
  }
}

export const gridRadius = 1;
export function* gridDots({ x, y, width, height }: PictureBox) {
  for (let cy = Math.ceil(y / 16) * 16; cy <= y + height; cy += 16) {
    for (let cx = Math.ceil(x / 16) * 16; cx <= x + width; cx += 16) yield { x: cx, y: cy };
  }
}

const jpgQuality = { High: 0.92, Medium: 0.80, Low: 0.60 };
const pdfScale = { High: 3, Medium: 2, Low: 1 };
export function pictureOptions(choices: ExportChoices) {
  switch (choices.type) {
    case "PNG": return { requested: 2, background: choices.pngBackground, mime: "image/png" };
    case "JPG": return { requested: 2, background: choices.jpgBackground, mime: "image/jpeg", quality: jpgQuality[choices.jpgQuality] };
    case "PDF": return { requested: pdfScale[choices.pdfQuality], background: "Solid", mime: "image/jpeg", quality: 0.90 };
    case "CSV": throw Error("CSV has no picture.");
  }
}

export type DrawExport<Layouts> = (input: {
  board: BoardV14; only: ReadonlySet<string>; objectLayouts: Layouts; bitmaps: ReadonlyMap<string, ImageBitmap>;
  box: PictureBox; fit: PictureFit;
}) => HTMLCanvasElement;

const areaWords = (area: ExportArea) => area === "Entire page" ? "the page" : "the selection";
export const lowerScaleMessage = (area: ExportArea, used: number, requested: number) =>
  `Exported at ${used}× because ${areaWords(area)} is too large for ${requested}×.`;
export const EXPORT_FAILURE = "Could not export: the browser could not make the file.";

export function exportContent(objects: readonly DrawnObject[], choices: ExportChoices, area: ExportArea, selection?: TableSelection) {
  if (choices.type === "CSV") {
    if (choices.csvType === "Tables") {
      const tables = wholeTables(objects, area, selection);
      return tables.length ? { csv: tablesCsv(tables) } : { notice: "There are no tables to export." };
    }
    const stickies = exportStickies(objects);
    return stickies.length ? { csv: stickiesCsv(stickies) } : { notice: "There are no stickies to export." };
  }
  const box = pictureBox(objects);
  return box ? { box } : { notice: "There is nothing to export on this page." };
}

export function pictureProblem(imagesReady: boolean, fits: boolean, area: ExportArea) {
  if (!imagesReady) return "Could not export: an image on the board has not loaded yet.";
  if (fits) return "";
  return `Could not export: ${areaWords(area)} is too large for one picture.` +
    (area === "Entire page" ? " Export a selection instead." : "");
}

export function validJpegFrame(type: string, bytes: Uint8Array, { width, height }: PixelSize) {
  if (type !== "image/jpeg" || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  const word = (at: number) => bytes[at] * 256 + bytes[at + 1];
  let pos = 2;
  while (pos < bytes.length && bytes[pos++] === 0xff) {
    while (bytes[pos] === 0xff) pos++;
    const marker = bytes[pos++];
    if (marker === 0x01) continue;
    if (!marker || marker >= 0xd0 && marker <= 0xda || pos + 2 > bytes.length) return false;
    const length = word(pos);
    if (length < 2 || pos + length > bytes.length) return false;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return marker <= 0xc2 && length === 17 && bytes[pos + 2] === 8 &&
        word(pos + 3) === height && word(pos + 5) === width && bytes[pos + 7] === 3;
    }
    pos += length;
  }
  return false;
}

export function pdfBytes(jpeg: Uint8Array, pixels: PixelSize, { width, height }: PictureBox, title: string) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    size += bytes.byteLength;
  };
  const object = (dictionary: string, stream?: Uint8Array) => {
    offsets.push(size);
    append(`${offsets.length} 0 obj\n${dictionary}\n`);
    if (stream) {
      append("stream\n");
      append(stream);
      append("\nendstream\n");
    }
    append("endobj\n");
  };

  const factor = Math.min(1, 14_400 / Math.max(width, height));
  const points = (units: number) => String(Math.round(Number(`${units * factor}e2`)) / 100);
  const pw = points(width), ph = points(height);
  const content = encoder.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
  const hexTitle = title.split("").map(char => char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")).join("");

  append("%PDF-1.4\n");
  append(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a));
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  object(`<< /Length ${content.length} >>`, content);
  object(`<< /Type /XObject /Subtype /Image /Width ${pixels.width} /Height ${pixels.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  object(`<< /Producer (NextPhase Board) /Title <FEFF${hexTitle}> >>`);
  const xref = size;
  append("xref\n0 7\n0000000000 65535 f \n");
  for (const offset of offsets) append(`${String(offset).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const file = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    file.set(chunk, at);
    at += chunk.length;
  }
  return file;
}
