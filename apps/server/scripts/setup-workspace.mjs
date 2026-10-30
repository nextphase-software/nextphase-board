// SPDX-License-Identifier: Apache-2.0
import { Supabase } from "../src/supabase.ts";
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, BOARD_OWNER_EMAIL, BOARD_WORKSPACE_NAME } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BOARD_OWNER_EMAIL || !BOARD_WORKSPACE_NAME) {
  throw Error("Set SUPABASE_URL, SUPABASE_SERVICE_KEY, BOARD_OWNER_EMAIL and BOARD_WORKSPACE_NAME");
}
const url = new URL(SUPABASE_URL);
if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "host.docker.internal"].includes(url.hostname))) throw Error("HTTPS is required");
const db = new Supabase(SUPABASE_URL, SUPABASE_SERVICE_KEY);
if ((await db.rows("workspaces", { name: BOARD_WORKSPACE_NAME })).length) throw Error("Workspace already has an owner");
const owner = await db.account(BOARD_OWNER_EMAIL.toLowerCase());
const id = await db.rpc("bootstrap_workspace", { name: BOARD_WORKSPACE_NAME, owner_id: owner.id, owner_email: owner.email });
console.log(JSON.stringify({ workspaceId: id, ownerId: owner.id }));
