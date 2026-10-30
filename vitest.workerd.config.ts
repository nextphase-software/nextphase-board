// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [cloudflareTest(({ inject }) => {
    const context = inject<any>("board");
    return { main: "tests/server/worker-test.ts", miniflare: {
      compatibilityDate: "2026-10-30", compatibilityFlags: ["nodejs_compat"],
      bindings: { SUPABASE_URL: context.proxyUrl, SUPABASE_ISSUER: context.issuer,
        SUPABASE_SERVICE_KEY: context.serviceKey, JWKS: JSON.stringify(context.jwks),
        ALLOWED_ORIGIN: context.origin, OPERATOR_KEY: context.operatorKey },
      durableObjects: { ROOMS: { className: "BoardRoom", useSQLite: true }, FENCES: { className: "RestoreFence", useSQLite: true },
        CONTROLS: { className: "TestControls", useSQLite: true } },
    } };
  })],
  resolve: { alias: { "board-test-driver": fileURLToPath(new URL("tests/server/driver-workerd.ts", import.meta.url)) } },
  test: { provide: { runner: "workerd" }, include: ["tests/server/suite.test.ts", "tests/server/lists.test.ts"], globalSetup: ["tests/server/setup.ts"],
    fileParallelism: false, testTimeout: 120000, hookTimeout: 120000, reporters: ["default"] },
});
