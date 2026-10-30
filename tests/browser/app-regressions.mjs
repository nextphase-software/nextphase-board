// SPDX-License-Identifier: Apache-2.0
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { App } from "../../apps/web/src/App";
import { add, empty } from "../../packages/board-rules/src/document.ts";
import { LocalStore, readPair } from "../../apps/web/src/storage";

// Integration regressions use real App/IndexedDB, with synthetic DOM input and
// pointer capture stubbed at the browser boundary. These are not native IME or
// trusted pointer acceptance evidence. Never open this test at the app origin.
const output = document.createElement("pre");
document.body.append(output);
const host = document.getElementById("root");
host.style.cssText = "width:1440px;height:900px;position:relative";
const open = indexedDB.open.bind(indexedDB);
const locks = Object.getOwnPropertyDescriptor(navigator, "locks");
let database = "", root;
const results = [];
const pause = () => new Promise((resolve) => setTimeout(resolve, 20));
async function until(check, label) {
  const end = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > end) throw Error("Timed out: " + label);
    await pause();
  }
}
function assert(value, message) {
  if (!value) throw Error(message);
}
function click(name) {
  const button = Array.from(host.querySelectorAll("button")).find((b) =>
    b.getAttribute("aria-label") === name || b.textContent?.trim() === name ||
    (name === "Objects" && b.textContent?.includes("Objects"))
  );
  assert(button && !button.disabled, "Enabled action missing: " + name);
  button.click();
}
function count() {
  return host.querySelectorAll("#selection option").length;
}
async function mount(noLocks = false) {
  if (noLocks) Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  root = createRoot(host);
  root.render(createElement(App));
  await until(() => noLocks
    ? !!host.querySelector(".notice")?.textContent?.includes("Web Locks")
    : host.querySelector('[aria-label="Sticky tool"]')?.disabled === false,
    "app load and writer disposition");
}
async function clean() {
  root?.unmount(); root = undefined;
  if (locks) Object.defineProperty(navigator, "locks", locks);
  else delete navigator.locks;
  await pause();
  await new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(database);
    r.onsuccess = () => resolve(); r.onerror = () => reject(r.error);
    r.onblocked = () => reject(Error("Fixture cleanup blocked"));
  });
}
async function run(name, check) {
  database = "nextphase-board-regression-" + crypto.randomUUID();
  try { await check(); results.push("PASS: " + name); }
  catch (error) { results.push("FAIL: " + name + ": " + String(error)); }
  finally { await clean(); output.textContent = results.join("\n"); }
}
// Redirect only the App's default database into this case's unique disposable DB.
indexedDB.open = ((name, version) =>
  open(name === "nextphase-board" ? database : name, version));
const workload = new URLSearchParams(location.search).get("workload");
if (workload && /^[a-z0-9-]{1,64}$/i.test(workload)) {
  database = "nextphase-board-workload-" + workload;
  host.style.cssText = "";
  const seed = new LocalStore(database);
  const pair = await seed.open(() => {});
  if (pair.every((value) => value === undefined)) {
    let board = { ...empty(), title: "250 object acceptance" };
    for (let i = 0; i < 250; i++) {
      board = add(board, i % 2 ? "text" : "sticky", (i % 20) * 350 - 3500, Math.floor(i / 20) * 200 - 1200);
      board.objects[i].text = ("Item " + i + " · 你好 🧭 ").padEnd(1000 - 1, "x");
    }
    await seed.save(board, 1);
  }
  seed.close();
  const started = performance.now();
  await mount();
  output.textContent = "Disposable 250-object fixture. JS mount-to-load observation: " +
    Math.round(performance.now() - started) + "ms (diagnostic; not input-to-paint).";
  const inspect = document.createElement("button");
  inspect.textContent = "Inspect saved fixture";
  inspect.onclick = async () => {
    const store = new LocalStore(database);
    try {
      const loaded = await readPair(await store.open(() => {}));
      output.textContent = JSON.stringify({ revision: loaded?.envelope.storageRevision,
        title: loaded?.board.title, count: loaded?.board.objects.length,
        first: loaded?.board.objects[0], second: loaded?.board.objects[1],
        last: loaded?.board.objects.at(-1) }, null, 2);
    } finally { store.close(); }
  };
  document.body.append(inspect);
} else try {
  await run("palette keyboard creation keeps exactly one writable editor", async () => {
    await mount(); click("Objects"); await pause(); click("Sticky tool"); await pause();
    host.querySelector(".scene").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await until(() => !!host.querySelector("textarea:not(:disabled)"), "created editor");
    assert(host.querySelectorAll("textarea:not(:disabled):not([readonly])").length === 1,
      "Creation mounted duplicate writable editors");
    assert(document.activeElement === host.querySelector("textarea"), "Created editor lacks focus");
  });
  await run("placement excursion returning to origin remains cancelled", async () => {
    await mount(); click("Sticky tool"); await pause();
    const scene = host.querySelector(".scene");
    scene.setPointerCapture = () => {}; // Synthetic pointers have no native capture.
    const r = scene.getBoundingClientRect();
    for (const [type, x] of [["pointerdown", 200], ["pointermove", 300], ["pointermove", 200], ["pointerup", 200]]) {
      scene.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1,
        pointerId: 1, clientX: r.left + x, clientY: r.top + 350 }));
      await pause();
    }
    click("Objects"); await pause();
    assert(count() === 0, "Cancelled pointer excursion inserted an object");
    assert(host.querySelector('[aria-label="Select tool"]')?.getAttribute("aria-pressed") === "true",
      "Cancelled placement did not return to Select");
  });
  await run("unavailable Web Locks retains readable validated saved content", async () => {
    const board = add({ ...empty(), title: "Readable fixture" }, "sticky", 0, 0);
    board.objects[0].text = "Readable 🧭";
    const seed = new LocalStore(database);
    await seed.open(() => {}); await seed.save(board, 1);
    const original = JSON.stringify(await seed.read()); seed.close();
    await mount(true); click("Objects"); await pause();
    assert(count() === 1, "Valid saved objects disappeared when locking unavailable");
    const selector = host.querySelector("#selection");
    selector.value = board.objects[0].id; selector.dispatchEvent(new Event("change", { bubbles: true }));
    await pause();
    const editor = host.querySelector("textarea");
    assert(editor.value === "Readable 🧭" && editor.readOnly, "Saved content not readable and readonly");
    assert(Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Save")?.disabled,
      "Save available without writer ownership");
    const inspect = new LocalStore(database); await inspect.open(() => {});
    try { assert(JSON.stringify(await inspect.read()) === original, "Readonly load rewrote records"); }
    finally { inspect.close(); }
  });
  await run("composition buffers input, commits once and cancellation changes no document revision", async () => {
    const board = add({ ...empty(), title: "Composition fixture" }, "text", 0, 0);
    board.objects[0].text = "Original";
    const seed = new LocalStore(database);
    await seed.open(() => {}); await seed.save(board, 1); seed.close();
    await mount(); click("Objects"); await pause();
    const selector = host.querySelector("#selection");
    selector.value = board.objects[0].id; selector.dispatchEvent(new Event("change", { bubbles: true }));
    await pause();
    const editor = host.querySelector("textarea"); editor.focus();
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    const input = (value) => {
      setValue.call(editor, value);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText" }));
    };
    const save = LocalStore.prototype.save, revisions = [];
    LocalStore.prototype.save = function(board, revision) {
      revisions.push(revision); return save.call(this, board, revision);
    };
    try {
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); await pause();
      input("nihao"); await pause();
      assert(host.querySelector("textarea") === editor && editor.value === "nihao", "Composition replaced editor/buffer");
      assert(host.querySelector('[aria-label="Sticky tool"]').disabled, "Tool enabled during composition");
      assert(Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Save").disabled, "Save enabled during composition");
      setValue.call(editor, "你好");
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "你好" })); await pause();
      input("你好"); input("你好"); await pause();
      click("Save");
      await until(() => host.querySelector(".actions [role=status]").textContent === "Locally saved", "composition receipt");
      assert(revisions.length === 1 && revisions[0] === 1, "Composition duplicated semantic transactions");
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); await pause();
      input("candidate"); await pause(); setValue.call(editor, "你好");
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "" })); await pause();
      click("Save");
      await until(() => revisions.length === 2 && host.querySelector(".actions [role=status]").textContent === "Locally saved", "cancel receipt");
      assert(revisions[1] === 1, "Cancelled composition changed document revision");
      const inspect = new LocalStore(database);
      try { assert((await readPair(await inspect.open(() => {}))).board.objects[0].text === "你好", "Wrong composed text stored"); }
      finally { inspect.close(); }
    } finally { LocalStore.prototype.save = save; }
  });
  await run("title composition commits once, retains invalid drafts and cancels without mutation", async () => {
    const seed = new LocalStore(database);
    await seed.open(() => {}); await seed.save({ ...empty(), title: "Original" }, 1); seed.close();
    await mount();
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent.includes("Original")).click();
    await pause();
    const input = host.querySelector("#title"); input.focus();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const value = (text) => { setValue.call(input, text); input.dispatchEvent(new InputEvent("input", { bubbles: true })); };
    const save = LocalStore.prototype.save, captures = [];
    LocalStore.prototype.save = function(board, revision) {
      captures.push({ title: board.title, revision }); return save.call(this, board, revision);
    };
    try {
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); await pause();
      value("candidate"); await pause();
      assert(document.activeElement === input && host.querySelector("#title") === input, "Title composition lost focus/identity");
      assert(Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Save").disabled, "Title composition allowed Save");
      setValue.call(input, "你好 title");
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "你好" })); await pause();
      value("你好 title"); value("你好 title"); await pause(); click("Save");
      await until(() => host.querySelector(".actions [role=status]").textContent === "Locally saved", "title receipt");
      assert(captures[0].revision === 1 && captures[0].title === "你好 title", "Title composition duplicated/adopted wrong value");
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); await pause();
      value("candidate"); await pause(); setValue.call(input, "你好 title");
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "" })); await pause(); click("Save");
      await until(() => captures.length === 2 && host.querySelector(".actions [role=status]").textContent === "Locally saved", "title cancel receipt");
      assert(captures[1].revision === 1, "Cancelled title composition advanced revision");
      value("x".repeat(121)); await pause(); click("Close board details"); click("Objects"); await pause();
      assert(Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Save").disabled, "Invalid title did not globally block Save");
      host.querySelector(".file button").click(); await pause();
      assert(host.querySelector("#title").value.length === 121, "Invalid title draft was truncated/lost");
    } finally { LocalStore.prototype.save = save; }
  });
  await run("older save receipt keeps newer draft unsaved; lifecycle pause requires explicit retry", async () => {
    const board = add({ ...empty(), title: "Lifecycle fixture" }, "text", 0, 0);
    const seed = new LocalStore(database);
    await seed.open(() => {}); await seed.save(board, 1); seed.close();
    await mount(); click("Objects"); await pause();
    const selector = host.querySelector("#selection"); selector.value = board.objects[0].id;
    selector.dispatchEvent(new Event("change", { bubbles: true })); await pause();
    const editor = host.querySelector("textarea");
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    const input = (value) => { setValue.call(editor, value); editor.dispatchEvent(new InputEvent("input", { bubbles: true })); };
    input("Earlier capture"); await pause();
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let unblock, started; const gate = new Promise((r) => unblock = r), preparing = new Promise((r) => started = r);
    let held = false;
    crypto.subtle.digest = (...args) => { if (!held) { held = true; started(); return gate.then(() => digest(...args)); } return digest(...args); };
    try {
      click("Save"); await preparing; input("Newer retained draft"); await pause(); unblock();
      await until(() => host.querySelector("#save-acknowledgement").textContent.includes("revision 2 acknowledged"), "older save acknowledgement");
      assert(host.querySelector(".actions [role=status]").textContent === "Unsaved" && editor.value === "Newer retained draft", "Older receipt marked newer edit saved");
      const inspect = new LocalStore(database);
      try { assert((await readPair(await inspect.open(() => {}))).board.objects[0].text === "Earlier capture", "Capture changed after Save"); }
      finally { inspect.close(); }
      click("Save"); await until(() => host.querySelector(".actions [role=status]").textContent === "Locally saved", "newer receipt");
      // Force the synthetic lifecycle state render without relying on a browser
      // scheduling a frame after the simulated pagehide. This is not a real BFCache event.
      let lifecycleEvents = 0;
      const observed = () => lifecycleEvents++;
      window.addEventListener("pagehide", observed);
      flushSync(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
      window.removeEventListener("pagehide", observed);
      assert(lifecycleEvents === 1, "Browser environment suppressed synthetic pagehide dispatch");
      flushSync(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))); await pause();
      await until(() => host.querySelector(".notice").textContent.includes("Editing paused"), "lifecycle pause disclosure: " + host.querySelector(".notice").textContent);
      assert(Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Save").disabled, "Lifecycle pause allowed writing");
      click("Retry editing");
      await until(() => !host.querySelector('[aria-label="Sticky tool"]').disabled, "explicit lifecycle retry");
      if (!host.querySelector("#selection")) click("Objects"); await pause();
      const resumed = host.querySelector("#selection"); resumed.value = board.objects[0].id;
      resumed.dispatchEvent(new Event("change", { bubbles: true })); await pause();
      assert(host.querySelector("textarea").value === "Newer retained draft", "Retry lost acknowledged content");
    } finally { unblock(); crypto.subtle.digest = digest; }
  });
  await run("narrow editing fallback retains content and focuses Content", async () => {
    const board = add({ ...empty(), title: "Narrow fixture" }, "text", 0, 0);
    board.objects[0].text = "Retained narrow text";
    const seed = new LocalStore(database);
    await seed.open(() => {}); await seed.save(board, 1); seed.close();
    await mount(); click("Objects"); await pause();
    const selector = host.querySelector("#selection"); selector.value = board.objects[0].id;
    selector.dispatchEvent(new Event("change", { bubbles: true })); await pause(); click("Close"); await pause();
    host.style.width = "375px"; window.dispatchEvent(new Event("resize")); await pause();
    host.querySelector(".scene").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    try {
      await until(() => document.activeElement === host.querySelector("textarea"), "fallback Content focus");
      assert(host.querySelector("textarea").value === "Retained narrow text", "Fallback lost content");
      assert(host.querySelectorAll("textarea:not([readonly]):not(:disabled)").length === 1, "Fallback duplicates editors");
    } finally { host.style.width = "1440px"; }
  });
  await run("damaged head is preserved and valid previous snapshot opens read-only", async () => {
    const board = add({ ...empty(), title: "Recovery fixture" }, "sticky", 0, 0);
    board.objects[0].text = "Recoverable previous content";
    const seed = new LocalStore(database);
    await seed.open(() => {}); await seed.save(board, 1); await seed.save({ ...board, title: "Later title" }, 2);
    await new Promise((resolve, reject) => {
      const tx = seed.db.transaction("boards", "readwrite");
      tx.objectStore("boards").put("unknown unsupported data", "head");
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    });
    const original = JSON.stringify(await seed.read()); seed.close();
    root = createRoot(host); root.render(createElement(App));
    await until(() => host.querySelector(".notice")?.textContent.includes("Original records are preserved"), "damaged-data disclosure");
    click("View valid snapshot 1"); await pause(); click("Objects"); await pause();
    const selector = host.querySelector("#selection"); selector.value = board.objects[0].id;
    selector.dispatchEvent(new Event("change", { bubbles: true })); await pause();
    assert(host.querySelector("textarea").value === board.objects[0].text && host.querySelector("textarea").readOnly, "Snapshot not readable readonly");
    assert(host.querySelector('[aria-label="Sticky tool"]').disabled, "Snapshot allowed creation");
    const inspect = new LocalStore(database);
    try { await inspect.open(() => {}); assert(JSON.stringify(await inspect.read()) === original, "Snapshot changed damaged/recoverable records"); }
    finally { inspect.close(); }
  });
} finally {
  indexedDB.open = open;
  host.remove();
  output.replaceChildren(...[...results, "Synthetic DOM integration input; unique disposable databases only."].map((line) => { const row = document.createElement("div"); row.textContent = line; return row; }));
}
