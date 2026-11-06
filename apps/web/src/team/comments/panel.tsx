// SPDX-License-Identifier: Apache-2.0
import { useRef, useState } from "react";
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import { MentionText } from "./mention-editor";
import { CommentIcon } from "./icons";
import { CommentMenu } from "./card";
import { authorColour, onWords, replyCount, threadName, timeWords, words, type CommentThread } from "./rules";
export function CommentsPanel({ threads, board, current, showResolved, onlyYours, setResolved, setYours, open, close, sort, setSort, unread, landing }: {
  landing?: string; sort: boolean; setSort: (value: boolean) => void; unread: Map<string, Set<string>>;
  threads: CommentThread[]; board: BoardV10; current?: string; showResolved: boolean; onlyYours: boolean;
  setResolved: (value: boolean) => void; setYours: (value: boolean) => void;
  open: (thread: CommentThread) => void; close: () => void;
}) {
  const filter = useRef<HTMLButtonElement>(null), [menu, setMenu] = useState(false);
  const rect = filter.current?.getBoundingClientRect();
  const above = !!rect && rect.bottom + 100 > window.innerHeight - 12;
  return <aside className="comment-panel" aria-label="Comments" onKeyDown={(event) => {
    if (event.key === "Escape" && menu) { event.preventDefault(); event.stopPropagation(); setMenu(false); filter.current?.focus(); }
  }}>
    <div className="comment-panel-head"><span className="comment-title">Comments</span>
      <button ref={filter} className={"comment-icon" + (menu || onlyYours || sort ? " active" : "")} aria-label="Filter comments" aria-expanded={menu}
        onClick={() => setMenu(!menu)}><CommentIcon name="filter" /></button>
      <button className="comment-icon" aria-label="Close comments" onClick={close}><CommentIcon name="close" /></button>
    </div>
    {sort && <div className="comment-note neutral w2-short-note">Unread mentions first</div>}
    <div className="comment-list">{threads.length ? threads.map((thread) => <button key={thread.id}
      className={"comment-item" + (current === thread.id ? " current" : "")} aria-label={threadName(thread, board)} onClick={() => open(thread)}>
      <span className="comment-avatar" style={{ background: authorColour(thread.person) }}>{thread.label[0]?.toUpperCase()}</span>
      <span><span className="comment-name">{thread.label}</span> <span className="comment-time">{timeWords(thread.createdAt)}</span></span>
      <span className="comment-text"><MentionText text={thread.comments.find((comment) => comment.id === thread.firstComment)?.text ?? ""} mentions={thread.comments.find((comment) => comment.id === thread.firstComment)?.mentions}/></span>
      <span className={thread.anchor.detached ? "comment-detached" : "comment-on"}>{thread.anchor.detached && thread.id !== landing && <CommentIcon name="unlink" />}{onWords(thread, board)}</span>
      {replyCount(thread.comments.length - 1, thread.resolved) && <span className="comment-count">{replyCount(thread.comments.length - 1, thread.resolved)}</span>}
      {!!unread.get(thread.id)?.size && <span className="w2-unread-line"><span className="w2-unread-dot" style={{marginLeft:0,marginRight:6}}/>{unread.get(thread.id)!.size} unread {unread.get(thread.id)!.size===1?'mention':'mentions'}</span>}
    </button>) : <div className="comment-empty">{!onlyYours && <CommentIcon name="bubble" />}<span>{onlyYours ? words.onlyYours : showResolved ? words.noResolved : words.empty}</span></div>}</div>
    {menu && rect && <CommentMenu opener={filter.current!} close={() => setMenu(false)}
      style={{ position: "fixed", right: window.innerWidth >= 768 ? 20 : Math.max(12, window.innerWidth - rect.right),
        ...(window.innerWidth >= 768 ? { top: 118 } : above ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }), maxWidth: window.innerWidth - 24 }}
      items={[{ label: "Show resolved comments", checked: showResolved, run: () => setResolved(!showResolved) },
        { label: "Only your threads", checked: onlyYours, run: () => setYours(!onlyYours) },
        { label: "Sort by", heading: true, run: () => {} },
        { label: "Oldest first", radio: true, checked: !sort, run: () => setSort(false) },
        { label: "Unread mentions first", radio: true, checked: sort, run: () => setSort(true) }]} />}
  </aside>;
}
