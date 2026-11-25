// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [cloudflareTest(({ inject }) => {
    const context = inject<any>("board");
    return { main: "tests/server/worker-test.ts", miniflare: {
      compatibilityDate: "2026-10-30", compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
      bindings: { SUPABASE_URL: context.proxyUrl, SUPABASE_ISSUER: context.issuer,
        SUPABASE_SERVICE_KEY: context.serviceKey, JWKS: JSON.stringify(context.jwks),
        ALLOWED_ORIGIN: context.origin, OPERATOR_KEY: context.operatorKey,
        LINK_PREVIEW_ORIGINS: context.linkPreviewOrigin, LINK_FIXTURE_PORT: String(context.linkFixtures.http) },
      durableObjects: { ROOMS: { className: "BoardRoom", useSQLite: true }, FENCES: { className: "RestoreFence", useSQLite: true },
        LINK_LIMITS: { className: "LinkLimits", useSQLite: true }, TEMPLATE_MEDIA: { className: "TemplateMedia", useSQLite: true }, CONTROLS: { className: "TestControls", useSQLite: true } },
    } };
  })],
  resolve: { alias: { "board-test-driver": fileURLToPath(new URL("tests/server/driver-workerd.ts", import.meta.url)) } },
  test: { provide: { runner: "workerd" }, include: ["tests/server/link-preview.test.ts", "tests/server/imports.test.ts", "tests/server/videos.test.ts", "tests/server/pictures.test.ts", "tests/server/team-pages.test.ts", "tests/server/tables.test.ts", "tests/server/pages.test.ts", "tests/server/templates.test.ts", "tests/server/reactions.test.ts", "tests/server/spotlight.test.ts", "tests/server/voting.test.ts", "tests/server/timer.test.ts", "tests/server/lifecycle.test.ts", "tests/server/history.test.ts", "tests/server/suite.test.ts", "tests/server/lists.test.ts", "tests/server/removal.test.ts", "tests/server/shared.test.ts", "tests/server/mentions.test.ts", "tests/server/mind-maps.test.ts", "tests/server/drawing-layout.test.ts"], globalSetup: ["tests/server/setup.ts"],
    fileParallelism: false, testTimeout: 120000, hookTimeout: 120000, reporters: ["default"] },
});
