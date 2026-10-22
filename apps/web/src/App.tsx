// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import {
  Adapter,
  add,
  type Board,
  clamp,
  count,
  empty,
  type Item,
  validText,
} from "./document";
import { decode, LocalStore, readPair } from "./storage";
type View = { x: number; y: number; z: number };
export function App() {
  const [board, setBoard] = useState<Board>(empty),
    [title, setTitle] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [selected, select] = useState(""),
    [tool, setTool] = useState("Select"),
    [panel, setPanel] = useState(""),
    [inline, setInline] = useState(false),
    [readOnly, setReadOnly] = useState(true),
    [message, setMessage] = useState("Opening local board…"),
    [status, setStatus] = useState("Unsaved"),
    [view, setView] = useState<View>({ x: 0, y: 0, z: 1 }),
    [size, setSize] = useState({ w: innerWidth, h: innerHeight }),
    [busy, setBusy] = useState(false),
    [composing, setComposing] = useState(false),
    [snapshots, setSnapshots] = useState<{ board: Board; revision: number }[]>(
      [],
    );
  const model = useRef(board),
    revision = useRef(0),
    ack = useRef(-1),
    store = useRef<LocalStore | null>(null),
    adapter = useRef<Adapter | null>(null),
    release = useRef<(() => void) | null>(null),
    scene = useRef<HTMLDivElement>(null),
    editor = useRef<HTMLTextAreaElement>(null),
    selector = useRef<HTMLSelectElement>(null),
    objectsButton = useRef<HTMLButtonElement>(null),
    drag = useRef<
      {
        id: string;
        x: number;
        y: number;
        cx: number;
        cy: number;
        view: View;
        pan: boolean;
        cancelled?: boolean;
      } | null
    >(null),
    alive = useRef(true);
  if (!adapter.current) adapter.current = new Adapter();
  const item = board.objects.find((o) => o.id === selected),
    text = item ? (drafts[item.id] ?? item.text) : "";
  const lockTask = useRef<Promise<void> | null>(null),
    fallbackFocus = useRef(false);
  const boardButton = useRef<HTMLButtonElement>(null),
    navButton = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState({ notice: 80, panel: 130 });
  useEffect(() => {
    const file = document.querySelector(".file")!,
      actions = document.querySelector(".actions")!,
      notice = document.querySelector(".notice")!;
    const update = () => {
      const top = scene.current?.getBoundingClientRect().top ?? 0;
      const n = Math.max(
        file.getBoundingClientRect().bottom,
        actions.getBoundingClientRect().bottom,
      ) - top + 12;
      setLayout({
        notice: n,
        panel: n + notice.getBoundingClientRect().height + 12,
      });
    };
    const observer = new ResizeObserver(update);
    [file, actions, notice].forEach((el) => observer.observe(el));
    update();
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  const invalidFields = [
    ...(!validText(title, 120, true)
      ? ["Board name requires 1–120 code points and cannot be blank."]
      : []),
    ...board.objects.flatMap((o, i) =>
      !validText(drafts[o.id] ?? o.text, 1000)
        ? [
          "Object " + (i + 1) +
          " exceeds 1,000 code points or contains invalid Unicode. Correct it in Objects.",
        ]
        : []
    ),
  ];
  const invalid = invalidFields.length > 0;
  const pending = useRef({ invalid: true, composing: false, busy: false });
  pending.current = { invalid, composing, busy };
  function commit(next: Board) {
    if (readOnly) return;
    if (JSON.stringify(next) === JSON.stringify(model.current)) return;
    model.current = next;
    adapter.current!.set(next);
    revision.current++;
    setBoard(next);
    setStatus("Unsaved");
  }
  function adopt(b: Board, saved: boolean) {
    model.current = b;
    setBoard(b);
    adapter.current?.destroy();
    adapter.current = new Adapter();
    adapter.current.set(b);
    setTitle(b.title);
    setDrafts({});
    select("");
    setInline(false);
    setView({ x: 0, y: 0, z: 1 });
    revision.current = 0;
    ack.current = saved ? 0 : -1;
    setStatus(saved ? "Locally saved" : "Unsaved");
  }
  async function start() {
    if (release.current || store.current) return;
    setReadOnly(true);
    setMessage("Checking local storage and writer ownership…");
    let own = false;
    let writerReason = "Another tab is editing. This board is read-only.";
    try {
      if (!navigator.locks) {
        writerReason = "Web Locks unavailable. This board is read-only; editing is disabled.";
      } else try {
        await new Promise<void>((resolve, reject) => {
        lockTask.current = navigator.locks.request(
          "nextphase-board/writer/v1",
          { mode: "exclusive", ifAvailable: true },
          async (lock) => {
            own = !!lock;
            if (!lock) {
              resolve();
              return;
            }
            await new Promise<void>((done) => {
              release.current = done;
              resolve();
            });
          },
        ).catch(reject);
        });
      } catch (error) {
        writerReason = "Writer ownership unavailable. This board is read-only. " + String(error);
      }
      const s = new LocalStore();
      store.current = s;
      const pair = await s.open(() => {
        setReadOnly(true);
        setMessage("Storage version changed. Reload explicitly to retry.");
        release.current?.();
        release.current = null;
      });
      try {
        const loaded = await readPair(pair);
        if (!alive.current) return;
        adopt(loaded?.board ?? empty(), !!loaded);
        setReadOnly(!own);
        setMessage(
          own
            ? "Stored only in this browser profile. Browser storage is not a backup."
            : writerReason,
        );
      } catch (error) {
        const valid = [];
        for (const raw of pair) {
          try {
            const x = await decode(raw);
            valid.push({
              board: x.board,
              revision: x.envelope.storageRevision,
            });
          } catch {}
        }
        setSnapshots(valid);
        setReadOnly(true);
        setMessage(
          "Saved data is unsupported, damaged or inconsistent. Original records are preserved. " +
            String(error),
        );
      }
    } catch (error) {
      setReadOnly(true);
      setMessage("Storage unavailable. " + String(error));
    }
  }
  useEffect(() => {
    alive.current = true;
    void start();
    const resize = () =>
      setSize({
        w: scene.current?.clientWidth ?? innerWidth,
        h: scene.current?.clientHeight ?? innerHeight,
      });
    resize();
    window.addEventListener("resize", resize);
    const hide = () => {
      store.current?.close();
      store.current = null;
      release.current?.();
      release.current = null;
      setReadOnly(true);
    };
    const show = () => {
      if (!store.current) {
        setMessage(
          "Editing paused. Retry editing to reacquire ownership and reload.",
        );
      }
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      alive.current = false;
      hide();
      adapter.current?.destroy();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, []);
  useEffect(() => {
    if (inline && !composing) editor.current?.focus();
  }, [inline, selected]);
  useEffect(() => {
    if (panel === "Objects") {
      if (fallbackFocus.current) {
        fallbackFocus.current = false;
        editor.current?.focus();
      } else selector.current?.focus();
    }
  }, [panel]);
  const pos = (o: Item) => ({
    left: size.w / 2 + (o.x - view.x) * view.z,
    top: size.h / 2 + (o.y - view.y) * view.z,
  });
  function changeText(value: string) {
    if (!item || readOnly) return;
    setDrafts((d) => ({ ...d, [item.id]: value }));
    setStatus("Unsaved");
    if (validText(value, 1000) && !composing) {
      commit({
        ...model.current,
        objects: model.current.objects.map((o) =>
          o.id === item.id ? { ...o, text: value } : o
        ),
      });
    }
  }
  function fallbackEditor() {
    fallbackFocus.current = true;
    setPanel("Objects");
    setInline(false);
  }
  function edit() {
    if (!item || readOnly || busy || composing) return;
    setPanel("");
    setInline(true);
  }
  useEffect(() => {
    if (!inline || !item || composing) return;
    const p = pos(item), rect = editor.current?.getBoundingClientRect();
    const obscured = rect &&
      Array.from(
        document.querySelectorAll(".file,.actions,.palette,.zoom,.notice"),
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return rect.left < r.right && rect.right > r.left &&
          rect.top < r.bottom && rect.bottom > r.top;
      });
    if (
      size.w < 768 || p.left < 0 || p.top < 0 ||
      p.left + item.width * view.z > size.w ||
      p.top + item.height * view.z > size.h ||
      (item.width - 40) * view.z < 120 || (item.height - 40) * view.z < 60 ||
      18 * view.z < 12 || obscured
    ) fallbackEditor();
  }, [inline, selected, view, size, composing]);
  function create(type: Item["type"], x: number, y: number, native = false) {
    if (readOnly || busy || composing) return;
    try {
      const next = add(model.current, type, x, y);
      commit(next);
      select(next.objects.at(-1)!.id);
      setTool("Select");
      setPanel(native ? "Objects" : "");
      setInline(!native);
      if (native) setTimeout(() => editor.current?.focus(), 0);
    } catch (e) {
      setMessage(String(e));
    }
  }
  function save() {
    if (invalid || readOnly || busy || composing || !store.current) return;
    const captured = revision.current;
    setStatus("Saving");
    store.current.save(model.current, captured).then((receipt) => {
      ack.current = receipt.draftRevision;
      setStatus(
        revision.current === captured && !pending.current.invalid &&
          !pending.current.composing && !pending.current.busy
          ? "Locally saved"
          : "Unsaved",
      );
      setMessage(
        "Local revision " + receipt.storageRevision +
          " acknowledged after transaction completion.",
      );
    }).catch((error) => {
      setStatus("Save failed");
      setMessage(String(error));
      if (String(error).includes("changed")) setReadOnly(true);
    });
  }
  async function reopen() {
    if (composing || busy) return;
    if (
      (revision.current !== ack.current || invalid) &&
      !confirm("Discard unsaved drafts and reload the saved board?")
    ) return;
    store.current?.close();
    store.current = null;
    release.current?.();
    release.current = null;
    await lockTask.current;
    setSnapshots([]);
    await start();
  }
  function move(dx: number, dy: number) {
    if (!item || readOnly || composing || busy) return;
    commit({
      ...model.current,
      objects: model.current.objects.map((o) =>
        o.id === item.id
          ? {
            ...o,
            x: clamp(o.x + dx, -1e6, 1e6 - o.width),
            y: clamp(o.y + dy, -1e6, 1e6 - o.height),
          }
          : o
      ),
    });
  }
  function toggle(name: string) {
    if (composing || busy) return;
    setInline(false);
    setPanel((p) => p === name ? "" : name);
    if (panel === name) {
      (name === "Objects"
        ? objectsButton
        : name === "Board"
        ? boardButton
        : navButton).current?.focus();
    }
  }
  function point(e: React.PointerEvent) {
    const r = scene.current!.getBoundingClientRect();
    return {
      x: view.x + (e.clientX - r.left - size.w / 2) / view.z,
      y: view.y + (e.clientY - r.top - size.h / 2) / view.z,
    };
  }
  function cancel() {
    if (drag.current?.pan) setView(drag.current.view);
    drag.current = null;
    setBusy(false);
    setTool("Select");
    setBoard({ ...model.current });
  }
  useEffect(() => {
    const blur = () => cancel();
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, []);
  const nativeEditor = (
    <>
      <label htmlFor="content">Content</label>
      <textarea
        id="content"
        ref={editor}
        aria-label={inline ? "Edit selected object on canvas" : "Content"}
        value={text}
        readOnly={readOnly || busy}
        disabled={!item}
        onChange={(e) => changeText(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false);
          const value = e.currentTarget.value;
          setDrafts((d) => ({ ...d, [selected]: value }));
          if (item && validText(value, 1000) && !readOnly) {
            commit({
              ...model.current,
              objects: model.current.objects.map((o) =>
                o.id === selected ? { ...o, text: value } : o
              ),
            });
          }
        }}
        onBlur={() => {
          if (!composing) setInline(false);
        }}
      />
      <small>{count(text)} / 1,000 code points</small>
    </>
  );
  useEffect(() => {
    if (readOnly) cancel();
  }, [readOnly]);
  return (
    <main
      style={{
        "--notice-top": layout.notice + "px",
        "--panel-top": layout.panel + "px",
      } as React.CSSProperties}
      onKeyDown={(e) => {
        if (
          e.key !== "Escape" || composing ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) return;
        cancel();
        setInline(false);
        if (panel) {
          setPanel("");
          (panel === "Objects"
            ? objectsButton
            : panel === "Board"
            ? boardButton
            : navButton).current?.focus();
        }
      }}
    >
      <div
        ref={scene}
        className="scene"
        style={{
          backgroundSize: `${24 * view.z}px ${24 * view.z}px`,
          backgroundPosition: `${size.w / 2 - view.x * view.z}px ${
            size.h / 2 - view.y * view.z
          }px`,
        }}
        tabIndex={0}
        aria-label="Board canvas. Use Objects to read and edit. Enter places an armed tool or edits the selection."
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || composing) return;
          if (e.key === "Escape") {
            cancel();
            setInline(false);
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (tool === "Sticky" || tool === "Text") {
              create(
                tool === "Sticky" ? "sticky" : "text",
                view.x,
                view.y,
              );
            } else edit();
          }
        }}
        onPointerDown={(e) => {
          if (
            e.target !== e.currentTarget &&
              !(e.target instanceof HTMLCanvasElement) || composing || inline
          ) return;
          if (e.button !== 0) return;
          const p = point(e);
          const hit = [...model.current.objects].reverse().find((o) =>
            p.x >= o.x && p.x <= o.x + o.width && p.y >= o.y &&
            p.y <= o.y + o.height
          );
          if (tool === "Pan") {
            drag.current = {
              id: "",
              x: view.x,
              y: view.y,
              cx: e.clientX,
              cy: e.clientY,
              view: { ...view },
              pan: true,
            };
          } else if (tool === "Select" || hit) {
            select(hit?.id ?? "");
            if (hit && !readOnly && tool === "Select") {
              drag.current = {
                id: hit.id,
                x: hit.x,
                y: hit.y,
                cx: e.clientX,
                cy: e.clientY,
                view: { ...view },
                pan: false,
              };
            } else if (tool === "Pan" && !hit) {
              drag.current = {
                id: "",
                x: view.x,
                y: view.y,
                cx: e.clientX,
                cy: e.clientY,
                view: { ...view },
                pan: true,
              };
            }
            if (hit) setTool("Select");
          } else {drag.current = {
              id: tool,
              x: p.x,
              y: p.y,
              cx: e.clientX,
              cy: e.clientY,
              view: { ...view },
              pan: tool === "Pan",
            };}
          if (drag.current) {
            e.currentTarget.setPointerCapture(e.pointerId);
            setBusy(true);
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if ((d.id === "Sticky" || d.id === "Text") &&
            Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
            d.cancelled = true;
          }
          const dx = (e.clientX - d.cx) / d.view.z,
            dy = (e.clientY - d.cy) / d.view.z;
          if (d.pan) {
            setView({
              x: clamp(d.x - dx, -1e6, 1e6),
              y: clamp(d.y - dy, -1e6, 1e6),
              z: d.view.z,
            });
          } else if (d.id !== "Sticky" && d.id !== "Text") {
            setBoard({
              ...model.current,
              objects: model.current.objects.map((o) =>
                o.id === d.id
                  ? {
                    ...o,
                    x: clamp(d.x + dx, -1e6, 1e6 - o.width),
                    y: clamp(d.y + dy, -1e6, 1e6 - o.height),
                  }
                  : o
              ),
            });
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setBusy(false);
          if (!d) return;
          const delta = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
          if (!d.pan && (d.id === "Sticky" || d.id === "Text")) {
            if (delta < 3 && !d.cancelled) {
              try {
                const next = add(
                  model.current,
                  d.id === "Sticky" ? "sticky" : "text",
                  d.x,
                  d.y,
                );
                commit(next);
                select(next.objects.at(-1)!.id);
                setTool("Select");
                setPanel("");
                setInline(true);
              } catch (error) {
                setMessage(String(error));
              }
            } else setTool("Select");
          } else if (!d.pan) {
            if (delta >= 3) {
              commit({
                ...model.current,
                objects: model.current.objects.map((o) =>
                  o.id === d.id
                    ? {
                      ...o,
                      x: clamp(
                        d.x + (e.clientX - d.cx) / d.view.z,
                        -1e6,
                        1e6 - o.width,
                      ),
                      y: clamp(
                        d.y + (e.clientY - d.cy) / d.view.z,
                        -1e6,
                        1e6 - o.height,
                      ),
                    }
                    : o
                ),
              });
            } else setBoard({ ...model.current });
          }
        }}
        onDoubleClick={() => {
          if (selected) edit();
        }}
        onPointerCancel={() => {
          const d = drag.current;
          if (d?.pan) setView(d.view);
          cancel();
        }}
        onLostPointerCapture={() => {
          if (drag.current) {
            const d = drag.current;
            if (d.pan) setView(d.view);
            cancel();
          }
        }}
      >
        <Stage width={size.w} height={size.h} listening={false}>
          <Layer
            x={size.w / 2 - view.x * view.z}
            y={size.h / 2 - view.y * view.z}
            scaleX={view.z}
            scaleY={view.z}
          >
            {board.objects.map((o) => (
              <Group key={o.id}>
                <Rect
                  x={o.x}
                  y={o.y}
                  width={o.width}
                  height={o.height}
                  fill={o.type === "sticky" ? "#f2dce5" : undefined}
                  stroke={selected === o.id
                    ? "#518de0"
                    : o.type === "sticky"
                    ? "#e8cdd7"
                    : undefined}
                  strokeWidth={selected === o.id ? 2 / view.z : 1}
                />
                {!(inline && selected === o.id) && (
                  <Text
                    x={o.x + 20}
                    y={o.y + 20}
                    width={o.width - 40}
                    height={o.height - 40}
                    text={o.text}
                    fontFamily="system-ui"
                    fontSize={18}
                    lineHeight={1.45}
                    fill="#28272c"
                  />
                )}
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>
      <section className="file floating">
        <button
          ref={boardButton}
          disabled={composing || busy}
          onClick={() => toggle("Board")}
          aria-expanded={panel === "Board"}
        >
          <b className="brand">N</b> {title || "Untitled board"} ⌄
        </button>
        <small>Local</small>
      </section>
      <section className="actions floating">
        <button
          ref={objectsButton}
          onClick={() => toggle("Objects")}
          aria-expanded={panel === "Objects"}
          disabled={composing || busy}
        >
          ▤ Objects
        </button>
        <span role="status">{status}{invalid ? " · Invalid draft" : ""}</span>
        <button
          className="primary"
          onClick={save}
          disabled={readOnly || invalid || composing || busy}
        >
          {status === "Save failed" ? "Retry save" : "Save"}
        </button>
        <button onClick={reopen} disabled={busy || composing}>Reopen</button>
      </section>
      <aside className="notice" role="status">
        {message}
        {invalidFields.map((s) => <div key={s}>{s}</div>)}
        {busy && (
          <div>
            Gesture in progress. Save, selection and view controls are paused
            until release or cancellation.
          </div>
        )}
        {(tool === "Sticky" || tool === "Text") && (
          <div>
            Click empty canvas or press Enter to place one {tool.toLowerCase()}
            {" "}
            object. Escape cancels.
          </div>
        )}
        {readOnly && !snapshots.length && (
          <button onClick={reopen}>Retry editing</button>
        )}
        {snapshots.map((s) => (
          <button
            key={s.revision}
            onClick={() => {
              adopt(s.board, true);
              setReadOnly(true);
              setMessage(
                "Viewing valid snapshot revision " + s.revision +
                  " · read-only. Original saved records are preserved.",
              );
            }}
          >
            View valid snapshot {s.revision}
          </button>
        ))}
      </aside>
      {panel === "Board" && (
        <section className="details floating">
          <label htmlFor="title">Board name</label>
          <input
            id="title"
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              if (validText(e.currentTarget.value, 120, true)) {
                commit({ ...model.current, title: e.currentTarget.value });
              }
            }}
            value={title}
            readOnly={readOnly}
            onChange={(e) => {
              const value = e.target.value;
              setTitle(value);
              setStatus("Unsaved");
              if (validText(value, 120, true) && !composing) {
                commit({ ...model.current, title: value });
              }
            }}
          />
          <small>{count(title)} / 120 · nonblank name required</small>
          <p>
            One board in this browser origin/profile. Browser storage is not a
            backup.
          </p>
          <button
            disabled={composing || busy}
            onClick={() => {
              setPanel("");
              boardButton.current?.focus();
            }}
          >
            Close board details
          </button>
        </section>
      )}
      {panel === "Objects" && (
        <section
          className="objects floating"
          aria-label="Objects and keyboard editing"
        >
          <header>
            <h2>Objects {board.objects.length} / 250</h2>
            <button
              onClick={() => {
                setPanel("");
                objectsButton.current?.focus();
              }}
            >
              Close
            </button>
          </header>
          <label htmlFor="selection">Selected object</label>
          <select
            disabled={composing || busy}
            ref={selector}
            id="selection"
            value={selected}
            onChange={(e) => select(e.target.value)}
          >
            <option value="">Choose an object</option>
            {board.objects.map((o, i) => (
              <option key={o.id} value={o.id}>
                {o.type} {i + 1} ·{" "}
                {(drafts[o.id] ?? o.text).slice(0, 36) || "Empty"}
              </option>
            ))}
          </select>
          {nativeEditor}
          <div className="moves">
            {[
              ["left", -10, 0, "←"],
              ["up", 0, -10, "↑"],
              ["down", 0, 10, "↓"],
              ["right", 10, 0, "→"],
            ].map(([name, x, y, s]) => (
              <button
                key={name}
                aria-label={"Move object " + name}
                disabled={!item || readOnly || composing || busy}
                onClick={() => move(Number(x), Number(y))}
              >
                {s}
              </button>
            ))}
          </div>
          <small>
            X {item?.x ?? "—"} · Y {item?.y ?? "—"} · 10 units per step
          </small>
          <div>
            {(["sticky", "text"] as const).map((type) => (
              <button
                key={type}
                disabled={readOnly || composing || busy}
                onClick={() => {
                  const offset = 24 * (board.objects.length % 10);
                  create(type, view.x + offset, view.y + offset, true);
                }}
              >
                Add {type}
              </button>
            ))}
          </div>
        </section>
      )}
      {item && (
        <section
          className="context"
          style={{
            left: clamp(pos(item).left, 12, Math.max(12, size.w - 260)),
            top: clamp(pos(item).top - 50, 120, size.h - 140),
          }}
        >
          <span>{item.type}</span>
          <button
            disabled={readOnly || composing || busy}
            onMouseDown={(e) => {
              if (inline) e.preventDefault();
            }}
            onClick={() => {
              if (inline) {
                setInline(false);
                scene.current?.focus();
              } else edit();
            }}
          >
            {inline ? "Done" : "Edit text"}
          </button>
          <small>{count(text)} / 1,000</small>
        </section>
      )}
      {inline && item && (
        <section
          className="inline"
          style={{
            left: pos(item).left + 20 * view.z,
            top: pos(item).top + 20 * view.z,
            width: (item.width - 40) * view.z,
            height: (item.height - 40) * view.z,
            fontSize: 18 * view.z,
          }}
        >
          {nativeEditor}
        </section>
      )}
      <nav className="palette floating" aria-label="Board tools">
        {[["Select", "↖"], ["Pan", "✋"], ["Sticky", "▰"], ["Text", "T"]].map((
          [name, glyph],
        ) => (
          <button
            key={name}
            title={name}
            aria-label={name + " tool"}
            aria-pressed={tool === name}
            disabled={busy || composing ||
              (readOnly && ["Sticky", "Text"].includes(name))}
            onClick={() => {
              setTool(name);
              setInline(false);
              scene.current?.focus();
            }}
          >
            {glyph}
            <span>{name}</span>
          </button>
        ))}
      </nav>
      <nav className="zoom floating">
        <button
          aria-label="Zoom out"
          disabled={busy || composing}
          onClick={() => setView((v) => ({ ...v, z: clamp(v.z - .25, .5, 2) }))}
        >
          −
        </button>
        <span>{Math.round(view.z * 100)}%</span>
        <button
          aria-label="Zoom in"
          disabled={busy || composing}
          onClick={() => setView((v) => ({ ...v, z: clamp(v.z + .25, .5, 2) }))}
        >
          +
        </button>
        <button
          ref={navButton}
          onClick={() => toggle("Navigation")}
          disabled={busy || composing}
        >
          Navigation
        </button>
      </nav>
      {panel === "Navigation" && (
        <section className="navigation floating">
          <h2>Move around the board</h2>
          {[["left", -100, 0], ["right", 100, 0], ["up", 0, -100], [
            "down",
            0,
            100,
          ]].map(([s, x, y]) => (
            <button
              key={s}
              onClick={() =>
                setView((v) => ({
                  ...v,
                  x: clamp(v.x + Number(x), -1e6, 1e6),
                  y: clamp(v.y + Number(y), -1e6, 1e6),
                }))}
            >
              Pan {s}
            </button>
          ))}
          <button onClick={() => setView({ x: 0, y: 0, z: 1 })}>
            Reset view
          </button>
          <button
            onClick={() => {
              setPanel("");
              navButton.current?.focus();
            }}
          >
            Close navigation
          </button>
        </section>
      )}
    </main>
  );
}
