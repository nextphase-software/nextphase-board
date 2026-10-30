// SPDX-License-Identifier: Apache-2.0
import type { Message, Peer } from "./driver-types.ts";
// Both ws and workerd WebSockets expose EventTarget. Keep message collection in
// one place so the shared suite observes the same ordering on both transports.
let observed = 0;
export function peer(socket: any): Peer {
  const messages: Message[] = [], consumed = new Set<Message>();
  let closed: number | null = null;
  const waiters = new Set<() => void>();
  const notify = () => { for (const waiter of [...waiters]) waiter(); };
  socket.addEventListener("message", (event: any) => { const message = JSON.parse(String(event.data));
    Object.defineProperty(message, "observed", { value: ++observed });
    messages.push(message); notify(); });
  socket.addEventListener("close", (event: any) => { closed = event.code; notify(); });
  socket.addEventListener("error", () => {});
  return {
    messages, get closed() { return closed; },
    send(value) { socket.send(typeof value === "string" ? value : JSON.stringify(value)); },
    async next(kind) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiters.delete(check); reject(Error("Timed out waiting for " + kind + "; got " + messages.map((m) => m.kind + ":" + (m.reason ?? "")).join(","))); }, 10000);
        function check() {
          const message = messages.find((m) => m.kind === kind && !consumed.has(m));
          if (message) { consumed.add(message); clearTimeout(timer); waiters.delete(check); resolve(message); }
          else if (closed !== null) { clearTimeout(timer); waiters.delete(check); reject(Error("Connection closed " + closed + " while waiting for " + kind)); }
        }
        waiters.add(check); check();
      });
    },
    async close() {
      if (closed !== null) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 500);
        socket.addEventListener("close", () => { clearTimeout(timer); resolve(); }, { once: true });
        socket.close(1000);
      });
    },
  };
}
