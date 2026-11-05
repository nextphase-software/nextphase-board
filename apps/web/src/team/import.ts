// SPDX-License-Identifier: Apache-2.0
import { readBoardBundle, FILE_REASONS } from "../board-file.ts";
import { canonical, upgrade, type BoardV10 } from "nextphase-board-rules/document.ts";
import { isImage } from "nextphase-board-rules/objects/registry.ts";

export const PICTURES_REASON = "it holds pictures, which team boards can't hold yet";
export type ImportBody = { title: string; document: BoardV10 };
export async function importBoard<T>(file: Parameters<typeof readBoardBundle>[0], send: (body: ImportBody) => Promise<T>): Promise<T> {
  const { board } = await readBoardBundle(file);
  if (board.objects.some(isImage)) throw Error(PICTURES_REASON);
  const document = upgrade(board);
  try { canonical(document); }
  catch { throw Error(FILE_REASONS[3]); }
  return send({ title: document.title, document });
}
