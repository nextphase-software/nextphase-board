// SPDX-License-Identifier: Apache-2.0
import { readBoardBundle, FILE_REASONS } from "../board-file.ts";
import { canonical, upgrade, type BoardV12 } from "nextphase-board-rules/document.ts";
import { isImage, isMedia, isVideo, pictureOf } from "nextphase-board-rules/objects/registry.ts";

export type ImportBody = { title: string; document: BoardV12 };
export type ImportMedia = { hash: string; type: string; bytes: number; blob: Blob };
export type StagedBoard = ImportBody & { media: ImportMedia[] };
export async function importBoard<T>(file: Parameters<typeof readBoardBundle>[0], send: (body: ImportBody) => Promise<T>): Promise<T | StagedBoard> {
  const { board, pictures, videos } = await readBoardBundle(file);
  const document = upgrade(board);
  try { canonical(document); }
  catch { throw Error(FILE_REASONS[3]); }
  const title = document.title;
  if (!board.objects.some(isMedia)) return send({ title, document });
  const media: ImportMedia[] = [], seen = new Set<string>();
  for (const object of board.objects) {
    const picture = pictureOf(object);
    if (picture && !pictures.has(picture)) throw Error("a picture is unavailable");
    if (isVideo(object) && !videos.has(object.asset)) throw Error("a video is unavailable");
  }
  try {
    for (const picture of pictures.values()) {
      const bitmap = await createImageBitmap(new Blob([picture.bytes], { type: picture.mime }));
      const matches = bitmap.width === picture.pixelWidth && bitmap.height === picture.pixelHeight;
      bitmap.close();
      if (!matches) throw Error();
    }
  } catch { throw Error(FILE_REASONS[2]); }
  if ([...pictures.values()].some(picture => picture.bytes.byteLength > 20_971_520)) throw Error("a picture is larger than 20 MiB");
  if ([...videos.values()].some(video => video.bytes.byteLength > 52_428_800)) throw Error("a video is larger than 50 MiB");
  if (pictures.size + videos.size > 1_000) throw Error("it holds too many pictures and videos");
  const add = (hash: string, record: { mime: string; bytes: ArrayBuffer }) => {
    if (seen.has(hash)) return;
    seen.add(hash);
    media.push({ hash, type: record.mime, bytes: record.bytes.byteLength, blob: new Blob([record.bytes], { type: record.mime }) });
  };
  for (const object of board.objects) {
    if (isVideo(object)) { add(object.poster, pictures.get(object.poster)!); add(object.asset, videos.get(object.asset)!); }
    else if (isImage(object)) add(object.asset, pictures.get(object.asset)!);
  }
  return { title, document, media };
}
