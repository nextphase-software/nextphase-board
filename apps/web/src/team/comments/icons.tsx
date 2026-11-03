// SPDX-License-Identifier: Apache-2.0
export function CommentIcon({ name }: { name: "bubble" | "send" | "check" | "reopen" | "unlink" | "more" | "filter" | "close" }) {
  const size = { bubble: 20, send: 16, check: 18, reopen: 18, unlink: 14, more: 18, filter: 18, close: 16 }[name];
  return <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor">
    {name === "bubble" && <path strokeWidth="1.6" strokeLinejoin="round" d="M10 3.2c-4 0-7 2.6-7 6 0 1.6.7 3 1.9 4.1L4.3 17l3.6-1.6c.7.2 1.4.3 2.1.3 4 0 7-2.6 7-6.2s-3-6.3-7-6.3Z" />}
    {(name === "check" || name === "reopen") && <><circle cx="10" cy="10" r={name === "reopen" ? 8 : 7.2}
      fill={name === "reopen" ? "#16a34a" : "none"} stroke={name === "reopen" ? "none" : "currentColor"} strokeWidth="1.6" />
      <path d="m6.8 10.2 2.2 2.2 4.2-4.6" fill="none" stroke={name === "reopen" ? "white" : "currentColor"}
        strokeWidth={name === "reopen" ? 1.8 : 1.6} strokeLinecap="round" strokeLinejoin="round" /></>}
    {name === "close" && <path d="m5 5 10 10M15 5 5 15" strokeWidth="1.8" strokeLinecap="round" />}
    {name === "more" && [4.5, 10, 15.5].map((x) => <circle key={x} cx={x} cy="10" r="1.5" fill="currentColor" stroke="none" />)}
    {name === "send" && <path d="M10 16V4M5 9l5-5 5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    {name === "filter" && <path d="M3 5.5h14M5.5 10h9M8 14.5h4" strokeWidth="1.6" strokeLinecap="round" />}
    {name === "unlink" && <path d="M8 12 6.5 13.5a2.5 2.5 0 0 1-3.5-3.5L5 8M12 8l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L15 12M3 3l14 14" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>;
}
