// SPDX-License-Identifier: Apache-2.0
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../apps/web/src/App";
import { add, empty } from "../../apps/web/src/document";
import { LocalStore } from "../../apps/web/src/storage";

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
  return host.querySelectorAll("#selection option").length - 1;
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
try {
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
} finally {
  indexedDB.open = open;
  host.remove();
  output.textContent = results.join("\n") + "\nSynthetic DOM integration input; unique disposable databases only.";
}
