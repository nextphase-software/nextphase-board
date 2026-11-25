// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createServer } from "node:http";

const server = "../apps/server/src/";
const moduleAt = name => import(new URL(server + name, import.meta.url));
const synthetic = "https://fieldnotes.test/";
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=", "base64"));
const ascii = value => typeof value === "string" ? new TextEncoder().encode(value) : value;
function reply(value, { status = 200, headers = {}, chunks, cancelled = () => {} } = {}) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks ?? [value]) controller.enqueue(ascii(chunk));
    },
    cancel: cancelled,
  });
  return { status, header: name => headers[name] ?? (name === "content-type" ? "text/html" : null), body };
}
function finiteReply(value, init = {}) {
  const response = new Response(value, { ...init, headers: { "Content-Type": "text/html", ...init.headers } });
  return { status: response.status, body: response.body, header: name => response.headers.get(name) };
}
const redirect = (location, status = 302, cancelled) => reply("", { status, headers: location === undefined ? {} : { location }, cancelled });
function environment({ get = () => finiteReply("<title>Fixture title</title></head>"), dns = () => ["192.0.2.10"], allowed = ["192.0.2.10"], start = 0, denyPrefixes } = {}) {
  let now = start;
  const timers = [], addresses = [], requests = [];
  const transport = {
    testAllow: new Set(allowed),
    async resolve(host, signal) { addresses.push(host); return dns(host, signal); },
    async request(url, address, headers, signal) { requests.push({ url, address, headers }); return get(url, address, headers, signal); },
  };
  const options = { startedAt: 0, transport, now: () => now,
    abortAfter(ms) { const control = new AbortController(); timers.push({ at: now + ms, control }); return control.signal; },
    denyPrefixes };
  return { options, requests, addresses,
    async to(at) {
      now = at;
      for (const timer of timers.filter(timer => timer.at <= now)) timer.control.abort();
      await setImmediate();
    },
  };
}
const refusal = (status, reason) => error => error.status === status && error.message === reason;
const unavailable = refusal(422, "preview_unavailable");
const refused = refusal(422, "address_refused");
const failed = refusal(502, "preview_failed");
const checked = (name, fn) => test(name, fn);

checked("X10-U10 metadata priority, cleaning, encodings and head boundary", async () => {
  const { fetchLinkPreview } = await moduleAt("link-preview/fetcher.ts");
  const result = await fetchLinkPreview(synthetic, environment({
    get: () => reply("", { chunks: [
      '<head><!-- </hea', 'd><meta property="og:title" content="ignored"> -->',
      '<script>const x = "</head>";</script><style></head></style><template></head></template><noscript></head></noscript>',
      '<meta NAME="twitter:title" CONTENT="fallback"><title>ignored</title>',
      '<META Property=og:title Content="<b>A</b> &amp; B &lt; &gt; &quot; &apos; &#0; &#xD800; &#1114112; &unknown;">',
      '<meta property=og:title content="duplicate"><meta name=description content="fallback">',
      '<meta name=twitter:description content="Twitter"><meta property=og:description content="   ">',
      '<meta property=og:site_name content="Fixture&#160;\nsite"></he', 'ad><meta property=og:image content=/late>',
    ] }),
  }).options);
  assert.deepEqual(result, { url: synthetic, title: "A & B < > \" ' � � � &unknown;", description: "Twitter", site: "Fixture site", picture: null });
  const long = value => "<head><meta property=og:title content=\"" + value.repeat(350) + "\"><meta name=description content=\"" +
    value.repeat(550) + "\"><meta property=og:site_name content=\"" + value.repeat(150) + "\"></head>";
  const emoji = "📘", trimmed = await fetchLinkPreview(synthetic, environment({ get: () => finiteReply(long(emoji)) }).options);
  assert.deepEqual([trimmed.title, trimmed.description, trimmed.site], [emoji.repeat(300), emoji.repeat(500), emoji.repeat(100)]);
  const legacy = new Uint8Array([...ascii("<title>"), 0xe9, ...ascii("</title>")]);
  const windows = environment({ get: () => finiteReply(legacy, { headers: { "Content-Type": "Text/HTML; charset=windows-1252" } }) });
  assert.equal((await fetchLinkPreview(synthetic, windows.options)).title, "é");
  assert.equal((await fetchLinkPreview(synthetic, environment({ get: () => finiteReply('<title>Early</title>' + " ".repeat(1_100_000)) }).options)).title, "Early");
  await assert.rejects(fetchLinkPreview(synthetic, environment({ get: () => finiteReply(" ".repeat(1_048_576) + "<title>Late</title>") }).options), unavailable);
  await assert.rejects(fetchLinkPreview(synthetic, environment({ get: () => finiteReply("<title> ") }).options), unavailable);
  await assert.rejects(fetchLinkPreview(synthetic, environment({ get: () => finiteReply("<title>Encoding</title>", { headers: { "Content-Encoding": "x-fixture" } }) }).options), unavailable);
});

checked("X10-U11 picture priority, forbidden hops, signature and 5 MiB limit", async () => {
  const { fetchLinkPreview } = await moduleAt("link-preview/fetcher.ts");
  const doc = '<title>Picture</title><meta property="og:image" content="/picture"><meta name=twitter:image content=/unused>';
  let stopped = 0;
  for (const data of [png, new Uint8Array(5_242_881), ascii("<svg/>")]) {
    const f = environment({ get: url => url.pathname === "/picture" ? reply(data, { cancelled: () => stopped++,
      ...(data === png || data.length < 10 ? { headers: { "content-length": String(data.length) } } : {}) })
      : finiteReply(doc) });
    // The fixture closes its body for known-length payloads to exercise the
    // body budget independently of the phase clock.
    const request = f.options.transport.request;
    if (data.length <= png.length) f.options.transport.request = (...args) =>
      args[0].pathname === "/picture" ? Promise.resolve(finiteReply(data, { headers: { "Content-Type": "application/octet-stream" } })) : request(...args);
    const result = await fetchLinkPreview(synthetic, f.options);
    assert.deepEqual(result.picture, data === png ? { type: "image/png", bytes: Buffer.from(png).toString("base64") } : null);
    assert.deepEqual(f.requests.map(r => r.url.pathname), data.length <= png.length ? ["/"] : ["/", "/picture"]);
  }
  assert.equal(stopped, 1);
  for (const target of ["http://[", "ftp://fieldnotes.test/p", "https://private.test/image"]) {
    const f = environment({
      dns: host => host === "private.test" ? ["10.0.0.5"] : ["192.0.2.10"],
      get: () => finiteReply(`<title>Fallback</title><meta property=og:image content="${target}"><meta name=twitter:image content=/unused>`),
    });
    assert.equal((await fetchLinkPreview(synthetic, f.options)).picture, null);
    assert.equal(f.requests.length, 1);
  }
  const f = environment({ get: url => url.pathname === "/picture" ? redirect("http://127.0.0.1/") : finiteReply(doc) });
  assert.equal((await fetchLinkPreview(synthetic, f.options)).picture, null);
  assert.equal(f.requests.length, 2);
});

checked("X10-U12 redirect count, cancellation and absolute deadlines", async () => {
  const { fetchLinkPreview } = await moduleAt("link-preview/fetcher.ts");
  let cancels = 0;
  for (const max of [3, 4]) {
    const f = environment({ get: url => Number(url.pathname.slice(1)) < max
      ? redirect(String(Number(url.pathname.slice(1)) + 1), 302, () => cancels++)
      : finiteReply("<title>Redirects</title>") });
    const result = fetchLinkPreview(synthetic + "0", f.options);
    if (max === 3) assert.equal((await result).url, synthetic + "0");
    else await assert.rejects(result, unavailable);
    assert.deepEqual(f.requests.map(r => r.url.pathname), ["/0", "/1", "/2", "/3"]);
  }
  assert.equal(cancels, 7);
  for (const [location, status, expected] of [[undefined, 302, unavailable], ["http://[", 302, unavailable],
    ["/target", 300, unavailable], ["ftp://fieldnotes.test/", 302, refused], ["http://fieldnotes.test:22/", 302, refused]]) {
    const f = environment({ get: () => redirect(location, status) });
    await assert.rejects(fetchLinkPreview(synthetic, f.options), expected);
    assert.equal(f.addresses.length, 1);
  }

  for (const [start, deadline, expected] of [[0, 2000, failed], [11000, 12000, unavailable]]) {
    let finish;
    const f = environment({ start, dns: () => new Promise(resolve => { finish = resolve; }) });
    const result = assert.rejects(fetchLinkPreview(synthetic, f.options), expected);
    await f.to(deadline);
    await result;
    finish(["192.0.2.10"]);
    await setImmediate();
    assert.equal(f.requests.length, 0);
  }
  let pageCancelled = false;
  const stalled = environment({ get: () => reply("<title>Yet incomplete</title>", { cancelled: () => { pageCancelled = true; } }) });
  const missing = assert.rejects(fetchLinkPreview(synthetic, stalled.options), unavailable);
  await setImmediate(); await stalled.to(4999); assert.equal(pageCancelled, false);
  await stalled.to(5000); await missing; assert.equal(pageCancelled, true);

  let pictureCancelled = false, page;
  const ceiling = environment({ start: 3000, get: url => url.pathname === "/picture"
    ? reply(png, { cancelled: () => { pictureCancelled = true; } })
    : { status: 200, header: () => "text/html", body: new ReadableStream({ start(c) { page = c; } }) } });
  // The page advances under its own deadline and leaves less than 5 seconds for the picture.
  ceiling.options.transport.request = async (url, ...rest) => {
    if (url.pathname === "/picture") return reply(png, { cancelled: () => { pictureCancelled = true; } });
    return { ...(await environment().options.transport.request(url, ...rest)), body: new ReadableStream({ start(c) { page = c; } }) };
  };
  const within = fetchLinkPreview(synthetic, ceiling.options);
  await setImmediate();
  for (const at of [3900, 4800, 5700, 6600]) { await ceiling.to(at); page.enqueue(ascii(" ")); }
  await ceiling.to(7500); page.enqueue(ascii('<title>Drip</title><meta property=og:image content=/picture></head>'));
  await setImmediate(); await ceiling.to(11999); assert.equal(pictureCancelled, false);
  await ceiling.to(12000);
  assert.equal((await within).picture, null); assert.equal(pictureCancelled, true);
});

checked("link preview body and limiter deadlines discard late outcomes", async () => {
  const { readPreviewUrl, checkLimit } = await moduleAt("routes/link-preview.ts");
  let cancel = false;
  const stream = new ReadableStream({ cancel() { cancel = true; } });
  const f = environment({ start: 0 }), context = { req: { header: () => "application/json", raw: { body: stream } } };
  const body = assert.rejects(readPreviewUrl(context, f.options), refusal(400, "bad_request"));
  await f.to(12000); await body;
  assert.equal(cancel, true);
  let late;
  const clock = environment(), result = assert.rejects(checkLimit({ take: () => new Promise(r => { late = r; }) },
    "address:unknown", clock.options), refusal(503, "service_unavailable"));
  await clock.to(1000); await result; late(true);
});

checked("link preview address rules and every tested address block fail closed before transport", async () => {
  const { fetchLinkPreview, addressKey, testAllowlist } = await moduleAt("link-preview/fetcher.ts");
  const { checkSettings } = await moduleAt("settings.ts");
  for (const address of ["127.0.0.1", "[::1]", "0x7f.1", "localhost", "a.localhost", "intranet", "a.local.", "a.internal",
    "a.home.arpa", "user:pw@fieldnotes.test", "fieldnotes.test:22"]) {
    const f = environment();
    await assert.rejects(fetchLinkPreview("http://" + address + "/", f.options), refused);
    assert.deepEqual(f.addresses, []);
  }
  for (const input of ["ftp://fieldnotes.test/", "//fieldnotes.test", synthetic + "x".repeat(2049)]) {
    await assert.rejects(fetchLinkPreview(input, environment().options), refused);
  }
  for (const ip of ["0.2.3.4", "10.0.0.5", "100.64.0.1", "127.1.2.3", "169.254.1.1", "172.16.0.1",
    "192.0.0.9", "192.0.2.11", "192.88.99.1", "192.168.0.1", "198.18.0.2", "198.51.100.1", "203.0.113.1",
    "224.0.0.1", "240.0.0.1", "::", "::1", "::127.0.0.1", "::ffff:127.0.0.1", "0:0:0:0:0:ffff:7f00:1",
    "64:ff9b::7f00:1", "64:ff9b:1::1", "100::1", "100:0:0:1::1", "5f00::1", "fc00::1", "fe80::1",
    "ff00::1", "2001::1", "2001:db8::1", "2002:7f00:1::1", "3fff::1", "2600::1%lo0", "invalid"]) {
    const f = environment({ dns: () => ["192.0.2.10", ip] });
    await assert.rejects(fetchLinkPreview(synthetic, f.options), refused);
    assert.equal(f.requests.length, 0);
  }
  for (const ip of ["192.31.196.1", "2620:4f:8000::1", "8.8.8.8", "2606:4700::1", "::ffff:808:808", "192.0.2.10"]) {
    const f = environment({ dns: () => [ip] });
    assert.equal((await fetchLinkPreview(synthetic + "#local", f.options)).url, synthetic + "#local");
    assert.equal(f.requests[0].address, ip);
    assert.equal(f.requests[0].url.hash, "");
    assert.deepEqual(f.requests[0].headers, { "User-Agent": "NextPhaseBoard-LinkPreview/1",
      "Accept-Encoding": "identity", "Accept-Language": "en", Accept: "text/html,application/xhtml+xml" });
  }
  const rebound = environment({
    dns: () => rebound.addresses.length === 1 ? ["192.0.2.10"] : ["127.0.0.1"], get: () => redirect("next"),
  });
  await assert.rejects(fetchLinkPreview(synthetic, rebound.options), refused);
  assert.equal(rebound.requests.length, 1);
  assert.throws(() => testAllowlist(new Set(["127.0.0.1"])), /invalid_test_address/);
  for (const [ip, prefix] of [["8.8.8.8", "8.8.8.0/24"], ["2606:4700::1", "2606:4700::/32"],
    ["::ffff:808:808", "8.8.8.0/24"], ["192.0.2.10", "192.0.2.0/24"]]) {
    const f = environment({ dns: () => [ip], denyPrefixes: [prefix] });
    await assert.rejects(fetchLinkPreview(synthetic, f.options), refused);
    assert.equal(f.requests.length, 0);
  }
  for (const prefix of ["192.0.2.1/24", "2001:db8::/129", "a-fixture/4"]) {
    assert.throws(() => checkSettings({ supabaseUrl: "https://db.example", serviceKey: "synthetic", dataDir: ".", jwks: { keys: [] },
      allowedOrigin: "https://board.example", linkPreviewDenyPrefixes: [prefix] }));
  }
  assert.equal(addressKey("::ffff:cb00:7107"), "address:203.0.113.7");
  assert.equal(addressKey("2001:db8:1:2:3:4:5:6"), "address:2001:db8:1:2::/64");
  assert.equal(addressKey("invalid"), "address:unknown");
});

checked("link preview Worker DoH validates both families before any page request", async () => {
  const { createWorkerTransport } = await moduleAt("link-preview/transport-worker.ts");
  const { fetchLinkPreview } = await moduleAt("link-preview/fetcher.ts");
  for (const unusable of [
    new Response(null, { status: 302 }), new Response(" ".repeat(65537)), Response.json({ Status: 2 }),
    Response.json({ Status: 0, Answer: {} }), Response.json({ Status: 0, Answer: [{ type: 28, data: "not-an-address" }] }),
  ]) {
    const f = environment();
    const calls = [];
    f.options.transport = createWorkerTransport({ testAllow: new Set(["192.0.2.10"]), async fetch(input, init) {
      const url = new URL(input);
      assert.equal(url.hostname, "cloudflare-dns.com");
      assert.equal(init.redirect, "manual"); assert.equal(init.cache, "no-store"); assert.ok(init.signal);
      assert.equal(init.headers.accept, "application/dns-json");
      const type = url.searchParams.get("type"); calls.push(type);
      return type === "AAAA" ? unusable : Response.json({ Status: 0, Answer: [{ type: 1, data: "192.0.2.10" }] });
    } });
    await assert.rejects(fetchLinkPreview(synthetic, f.options), failed);
    assert.deepEqual(calls, ["A", "AAAA"]);
  }
  const calls = [];
  const transport = createWorkerTransport({ testAllow: new Set(["192.0.2.10"]), async fetch(input, init) {
    const url = new URL(input);
    calls.push(url.hostname === "cloudflare-dns.com" ? url.searchParams.get("type") : url.pathname);
    assert.equal(init.redirect, "manual");
    if (url.hostname === "cloudflare-dns.com") return Response.json(url.searchParams.get("type") === "A" ?
      { Status: 0, Answer: [{ type: 5, data: "alias.test." }, { type: 1, data: "192.0.2.10" }] } : { Status: 3 });
    return url.pathname === "/" ? new Response(null, { status: 302, headers: { Location: "/next" } }) :
      new Response("<title>Worker</title>", { headers: { "Content-Type": "text/html", "Content-Encoding": "gzip" } });
  } });
  const f = environment(); f.options.transport = transport;
  assert.equal((await fetchLinkPreview(synthetic, f.options)).title, "Worker");
  assert.deepEqual(calls, ["A", "AAAA", "/", "A", "AAAA", "/next"]);
});

checked("link preview Node uses the vetted lookup on an in-process HTTP fixture", async t => {
  const { createNodeTransport } = await moduleAt("link-preview/transport-node.ts");
  const { fetchLinkPreview } = await moduleAt("link-preview/fetcher.ts");
  const observed = [], resolutions = [];
  const page = createServer((request, response) => {
    observed.push(request.headers.host);
    response.writeHead(200, { "Content-Type": "text/html" }).end("<title>Pinned</title></head>");
  });
  await new Promise((resolve, reject) => { page.once("error", reject); page.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => { page.closeAllConnections(); page.close(resolve); }));
  const port = page.address().port, sockets = [];
  const transport = createNodeTransport({ testAllow: new Set(["192.0.2.10"]),
    testDial(address, scheme) { assert.equal(address, "192.0.2.10"); assert.equal(scheme, "http:"); return { host: "127.0.0.1", port }; },
    resolver: { async resolve4(host) { resolutions.push(["A", host]); return ["192.0.2.10"]; },
      async resolve6(host) { resolutions.push(["AAAA", host]); throw Error("fixture family failure"); }, cancel() {} },
    onSocket(value) { sockets.push(value); },
  });
  const f = environment(); f.options.transport = transport;
  assert.equal((await fetchLinkPreview("http://fieldnotes.test/", f.options)).title, "Pinned");
  assert.deepEqual(observed, ["fieldnotes.test"]);
  assert.deepEqual(resolutions, [["A", "fieldnotes.test"], ["AAAA", "fieldnotes.test"]]);
  assert.deepEqual(sockets, [{ vetted: "192.0.2.10", remoteAddress: "127.0.0.1", remotePort: port, servername: undefined }]);
});

checked("link preview limiter preserves the active window across rollover", async () => {
  const { rulesFor, take, prune, memoryLimits } = await moduleAt("link-preview/limits.ts");
  const key = "address:fixture", rules = rulesFor(key), minute = 60000;
  let current = {};
  for (let i = 0; i < 10; i++) current = take(current, rules, minute - 1).counts;
  assert.equal(take(current, rules, minute - 1).allowed, false);
  const rolled = take(current, rules, minute);
  assert.equal(rolled.allowed, true); assert.equal(rolled.next, 2 * minute);
  assert.equal(take(rolled.counts, rules, minute - 1).counts[minute].start, minute);
  assert.equal(prune(rolled.counts, minute).counts[minute].count, 1);
  assert.equal(prune(rolled.counts, 86_400_000).next, null);
  let now = minute;
  const store = memoryLimits(() => now);
  const results = await Promise.all(Array.from({ length: 12 }, () => store.take(key)));
  assert.equal(results.filter(Boolean).length, 10);
  now += minute;
  assert.equal(await store.take(key), true);
});

checked("A3 only the exact public preview pathname matches Hono's decoded path", async () => {
  const { isPublicLinkPreview } = await moduleAt("routes/link-preview.ts");
  const { Hono } = await import("hono");
  const app = new Hono();
  app.use("*", c => c.json(isPublicLinkPreview(c.req.path, c.req.url)));
  for (const [path, expected] of [["/link-preview", true], ["/link-preview?q=1", true], ["/link%2Dpreview", false],
    ["/%6Cink-preview", false], ["/link-preview%2F", false], ["/link-preview/", false], ["/link-preview/x", false], ["/LINK-PREVIEW", false]]) {
    assert.equal(await (await app.request(path, { method: "POST" })).json(), expected, path);
  }
});
