// SPDX-License-Identifier: Apache-2.0
import { canonical, validate, type Board } from "./document.ts";
import { digest } from "./storage.ts";
export const FILE_LIMIT = 4194304;
export const FILE_REASONS = ["it is larger than 4 MB", "it is not a Board file", "it is damaged", "it is not a valid board", "it was made by a newer version of Board"] as const;
export function boardFileName(title: string) {
  let name = title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/[ .]+$/, "_");
  if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(name)) name = "_" + name;
  return (name || "Untitled board") + ".nextboard";
}
export async function writeBoardFile(shown: Board, unchanged?: Board) {
  const payload = canonical(unchanged ?? shown);
  const raw = JSON.stringify({ format: "nextphase-board", fileVersion: 1, payload, sha256: await digest(payload) });
  if (new TextEncoder().encode(raw).length > FILE_LIMIT) throw Error(FILE_REASONS[0]);
  return raw;
}
export async function readBoardFile(file: { size: number; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<Board> {
  const refuse = (reason: string): never => { throw Error(reason); };
  if (file.size > FILE_LIMIT) refuse(FILE_REASONS[0]);
  let text: string, value;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
    value = JSON.parse(text);
  } catch { return refuse(FILE_REASONS[1]); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).join("|") !== "format|fileVersion|payload|sha256" || JSON.stringify(value) !== text) refuse(FILE_REASONS[1]);
  if (value.format !== "nextphase-board") refuse(FILE_REASONS[1]);
  if (Number.isSafeInteger(value.fileVersion) && value.fileVersion > 1) refuse(FILE_REASONS[4]);
  if (value.fileVersion !== 1 || typeof value.payload !== "string" || typeof value.sha256 !== "string") refuse(FILE_REASONS[1]);
  if (!/^[a-f0-9]{64}$/.test(value.sha256) || await digest(value.payload) !== value.sha256) refuse(FILE_REASONS[2]);
  let board;
  try { board = JSON.parse(value.payload); } catch { return refuse(FILE_REASONS[3]); }
  if (Number.isSafeInteger(board?.schemaVersion) && board.schemaVersion > 8) refuse(FILE_REASONS[4]);
  try {
    validate(board);
    if (canonical(board) !== value.payload) refuse(FILE_REASONS[3]);
  } catch { return refuse(FILE_REASONS[3]); }
  return board;
}
