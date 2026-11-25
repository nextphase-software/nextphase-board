// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type ClipboardEvent, type RefObject } from "react";
import Konva from "konva";
import type { BoardV16, ItemV16, LinkItem } from "nextphase-board-rules/document.ts";
import { isLink } from "nextphase-board-rules/objects/registry.ts";
import {
  aboutLine, cardToText, finishCard, linkLook, makeThumbnail, pasteCard, pastedAddress, pasteText, textObject,
  withLayout, amendHistory, LINK_LOADING_MS, LINK_REQUEST_MS, LINK_LOOK, type LinkBar, type LinkResult,
} from "../link-cards.ts";
import { previewConfigured, requestLinkPreview } from "../link-preview-client.ts";
import { boardPictures, pictureBytes, storePicture, PICTURE_LIMIT, tabPictures } from "../image-assets.ts";
import { isCanvasPasteTarget } from "../table-csv.ts";
import { savedHeight } from "../geometry.ts";
import type { HostedBoard } from "../team/hosted-board";
import type { History } from "../history.ts";
import type { LocalStore } from "../storage";
import type { View } from "../view";

type Finish = Exclude<LinkResult, null>;
type Dimensions = Pick<Finish, "title" | "description">;
export type LinkCardsInput = {
  hosted?: HostedBoard;
  page: string;
  board: BoardV16;
  model: RefObject<BoardV16>;
  commit: (next: BoardV16, record?: boolean, orderIds?: readonly string[], opens?: string, movedPages?: readonly string[],
    tableHint?: undefined, arrivalOf?: string) => void;
  select: (id: string) => void;
  selected: ReadonlySet<string>;
  commandReason: string; tidyOpen: boolean; busy: boolean; composing: boolean; readOnly: boolean;
  editing: () => boolean; ownCopy: (text: string) => boolean;
  historyRef: RefObject<History>; updateHistory: (history: History) => void;
  lineCount: (item: ItemV16, text?: string) => number;
  getView: () => View; scene: RefObject<HTMLElement | null>; getStore: () => LocalStore | null; isAlive: () => boolean;
};

type Opening = { boardId: string; hosted?: HostedBoard; store: LocalStore | null };
type Arrival = {
  opening: Opening; id: string; url: string; at: number;
  controller: AbortController; result: LinkResult; thumbnail?: NonNullable<Awaited<ReturnType<typeof makeThumbnail>>>;
  stage: "preparing" | "upload" | "uploading" | "finish" | "committed";
  retried: boolean;
};

export function arrivalGate(input: Pick<LinkCardsInput, "isAlive" | "model" | "board" | "hosted" | "readOnly" | "getStore">,
  arrival: Pick<Arrival, "opening" | "id" | "url" | "at">, now: number, retrying = false): LinkItem | "hold" | null {
  const { opening, id, url, at } = arrival;
  if (!input.isAlive() || input.board.boardId !== opening.boardId || input.model.current.boardId !== opening.boardId ||
      input.hosted !== opening.hosted) return null;
  if (input.hosted) {
    const { role } = input.hosted.snapshot;
    if (role !== "owner" && role !== "editor") return null;
    if (input.hosted.history.previewing) return now < at + LINK_REQUEST_MS ? "hold" : null;
    if (retrying && !input.hosted.canEdit) return "hold";
  } else {
    const store = input.getStore();
    if (!store?.active || store !== opening.store || input.readOnly) return null;
  }
  const card = input.model.current.objects.find(o => o.id === id);
  return card && isLink(card) && card.url === url && card.requestedAt === at && card.state === "loading" ? card : null;
}

export function linkPasteCandidate(event: ClipboardEvent<HTMLDivElement>, input: Pick<LinkCardsInput,
  "editing" | "ownCopy" | "composing" | "readOnly" | "commandReason" | "tidyOpen" | "hosted">) {
  if (event.defaultPrevented || !isCanvasPasteTarget(event) || input.composing || input.editing() ||
    input.readOnly || input.commandReason || input.tidyOpen || input.hosted?.canEdit === false ||
    input.hosted?.voting.running || event.clipboardData.files.length ||
    Array.from(event.clipboardData.items ?? []).some(item => item.kind === "file")) return null;
  const raw = event.clipboardData.getData("text/plain");
  return input.ownCopy(raw) ? null : pastedAddress(raw);
}

function measure(text: string, style: typeof LINK_LOOK.title | typeof LINK_LOOK.description) {
  if (!text) return 0;
  const node = new Konva.Text({ text, fontFamily: LINK_LOOK.fontFamily, fontSize: style.size, fontStyle: style.style,
    lineHeight: style.line / style.size, width: LINK_LOOK.vertical.textWidth, wrap: "word" });
  try { return Math.min(2, node.textArr.length); }
  finally { node.destroy(); }
}
const linesOf = (value: Dimensions) => ({
  title: Math.max(1, measure(value.title, LINK_LOOK.title)), description: measure(value.description, LINK_LOOK.description),
});
function fits(board: BoardV16, thumbnail: NonNullable<Arrival["thumbnail"]>) {
  const extra = boardPictures(board).has(thumbnail.hash) && tabPictures.has(thumbnail.hash) ? 0 : thumbnail.picture.bytes.byteLength;
  return pictureBytes(board) + extra <= PICTURE_LIMIT;
}
function textHeight(input: LinkCardsInput, text: string) {
  const object = textObject(input.model.current, text, input.page);
  if (!("height" in object)) return 120;
  return savedHeight({ y: 0, height: object.height }, input.lineCount(object));
}

export function useLinkCards(input: LinkCardsInput) {
  const latest = useRef(input); latest.current = input;
  const arrivals = useRef(new Map<string, Arrival>());
  const [, redraw] = useState(0);

  function end(arrival: Arrival) {
    arrival.controller.abort();
    arrivals.current.delete(arrival.id);
  }

  async function holdPicture(arrival: Arrival) {
    const i = latest.current, thumbnail = arrival.thumbnail!;
    const { hash, picture } = thumbnail;
    arrival.stage = "uploading";
    try {
      if (i.hosted) {
        const answer = await i.hosted.pictures.upload(hash, picture.bytes, arrival.controller.signal);
        if (!arrivals.current.has(arrival.id) || arrival.stage !== "uploading") return;
        if (!answer.ok && answer.kind !== "full") arrival.result = null;
        if (answer.ok && arrival.result) {
          tabPictures.set(hash, picture);
          arrival.result.asset = hash;
        }
      } else {
        const store = arrival.opening.store!;
        if (store.db && fits(i.model.current, thumbnail)) {
          await storePicture(store.db, hash, picture, store.transactions);
          if (!arrivals.current.has(arrival.id) || arrival.stage !== "uploading") return;
          tabPictures.set(hash, picture);
          if (arrival.result) arrival.result.asset = hash;
        } else if (!store.db) arrival.result = null;
      }
    } catch {
      if (!arrivals.current.has(arrival.id) || arrival.stage !== "uploading") return;
      arrival.result = null;
    }
    arrival.stage = "finish";
    advance(arrival);
  }

  function advance(arrival: Arrival) {
    const i = latest.current, now = Date.now();
    if (arrival.stage === "committed") {
      if (!arrival.opening.hosted?.arrivalRefused(arrival.id)) {
        if (!i.isAlive() || i.hosted !== arrival.opening.hosted || i.board.boardId !== arrival.opening.boardId) end(arrival);
        return;
      }
      if (arrival.retried) { end(arrival); return; }
      arrival.retried = true;
      arrival.result = null;
      arrival.stage = "finish";
    }
    if (now >= arrival.at + LINK_LOADING_MS && (arrival.stage !== "finish" || arrival.result)) {
      arrival.controller.abort();
      arrival.result = null;
      arrival.stage = "finish";
    }
    if (arrival.stage === "preparing" || arrival.stage === "uploading") return;
    const card = arrivalGate(i, arrival, now, arrival.retried);
    if (card === "hold") return;
    if (!card) { end(arrival); return; }
    if (arrival.stage === "upload") {
      void holdPicture(arrival);
      return;
    }
    if (i.busy || i.composing || i.editing() || i.tidyOpen || i.commandReason || i.hosted?.canEdit === false) return;
    let result = arrival.result;
    if (!i.hosted && result?.asset && arrival.thumbnail && !fits(i.model.current, arrival.thumbnail)) result = { ...result, asset: undefined };
    const finished = finishCard(card, result, result?.asset ? linesOf(result) : undefined);
    const next = { ...i.model.current, objects: i.model.current.objects.map(o => o.id === card.id ? finished : o) };
    if (i.hosted) {
      arrival.stage = "committed";
      i.commit(next, false, undefined, undefined, undefined, undefined, card.id);
      arrival.thumbnail = undefined;
      arrival.result = null;
    } else {
      i.commit(next);
      i.updateHistory(amendHistory(i.historyRef.current, finished));
      end(arrival);
    }
  }

  async function request(arrival: Arrival) {
    try {
      const signal = AbortSignal.any([arrival.controller.signal, AbortSignal.timeout(LINK_REQUEST_MS)]);
      const answer = arrival.opening.hosted
        ? await arrival.opening.hosted.pictures.linkPreview(arrival.url, signal)
        : await requestLinkPreview(arrival.url, signal);
      if (!arrivals.current.has(arrival.id) || arrival.stage !== "preparing") return;
      if (answer && !signal.aborted) {
        arrival.result = { title: answer.title, site: answer.site, description: answer.description };
        if (answer.picture) arrival.thumbnail = await makeThumbnail(answer.picture.bytes) ?? undefined;
      }
    } catch { arrival.result = null; }
    if (!arrivals.current.has(arrival.id) || arrival.stage !== "preparing") return;
    arrival.stage = arrival.thumbnail ? "upload" : "finish";
    advance(arrival);
  }

  useEffect(() => {
    const active = arrivals.current;
    const cancel = () => {
      for (const arrival of active.values()) arrival.controller.abort();
      active.clear();
    };
    window.addEventListener("pagehide", cancel);
    return () => { window.removeEventListener("pagehide", cancel); cancel(); };
  }, []);
  useEffect(() => {
    const now = Date.now();
    const deadlines: number[] = [];
    for (const card of input.board.objects.filter(isLink)) if (card.state === "loading") deadlines.push(card.requestedAt + LINK_LOADING_MS);
    for (const arrival of arrivals.current.values()) {
      advance(arrival);
      deadlines.push(arrival.at + LINK_LOADING_MS);
      if (arrival.opening.hosted?.history.previewing) deadlines.push(arrival.at + LINK_REQUEST_MS);
    }
    const next = Math.min(...deadlines.filter(at => at > now));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => redraw(n => n + 1), Math.min(2 ** 31 - 1, Math.max(0, next - Date.now())));
    return () => clearTimeout(timer);
  });

  const cards = input.board.objects.filter(isLink).filter(card => input.selected.has(card.id));
  const only = cards.length > 0 && cards.length === input.selected.size;
  const selected = only && cards.length === 1 ? cards[0] : undefined;
  const liveSelected = () => {
    const i = latest.current;
    const card = selected && i.model.current.objects.find(o => o.id === selected.id);
    return card && isLink(card) ? card : undefined;
  };
  const blocked = () => {
    const i = latest.current;
    return i.readOnly || i.commandReason || i.busy || i.composing || i.editing() || i.tidyOpen || i.hosted?.canEdit === false;
  };
  const bar: LinkBar = {
    only, count: cards.length, look: selected && linkLook(selected, Date.now()), layout: selected?.layout,
    open() { if (selected) window.open(selected.url, "_blank", "noopener,noreferrer"); },
    setLayout(layout) {
      const card = liveSelected(), i = latest.current;
      if (!card || blocked() || card.layout === layout) return;
      const next = withLayout(card, layout, card.asset && layout === "vertical" ? linesOf(card) : undefined);
      if (next !== card) i.commit({ ...i.model.current, objects: i.model.current.objects.map(o => o === card ? next : o) }, true);
    },
    toText() {
      const card = liveSelected(), i = latest.current;
      if (!card || blocked() || i.model.current.retiredGenerations.length >= 10_000) return;
      const next = cardToText(i.model.current, card.id, textHeight(i, card.url));
      i.commit(next.board, true);
      i.select(next.id);
      i.scene.current?.focus();
    },
  };
  const service = previewConfigured();
  return {
    bar, aboutLine: aboutLine(!!input.hosted, service),
    paste: (next: (event: ClipboardEvent<HTMLDivElement>) => void | Promise<void>) => (event: ClipboardEvent<HTMLDivElement>) => {
      const i = latest.current, candidate = linkPasteCandidate(event, i);
      if (!candidate) return next(event);
      event.preventDefault();
      if (i.model.current.objects.length >= 250) return;
      const board = i.model.current, at = Date.now(), centre = i.getView(), configured = !!i.hosted || service;
      const made = "text" in candidate
        ? pasteText(board, candidate.text, centre, i.page, textHeight(i, candidate.text))
        : pasteCard(board, candidate.url, centre, i.page, at, configured);
      i.commit(made.board, true);
      i.select(made.id);
      if (!("url" in candidate) || !configured) return;
      const arrival: Arrival = {
        id: made.id, url: candidate.url, at, opening: { boardId: board.boardId, hosted: i.hosted, store: i.getStore() },
        controller: new AbortController(), result: null, stage: "preparing", retried: false,
      };
      arrivals.current.set(made.id, arrival);
      void request(arrival);
    },
  };
}
