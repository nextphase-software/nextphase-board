// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "board-test-driver": fileURLToPath(new URL("tests/server/driver-node.ts", import.meta.url)) } },
  test: { provide: { runner: "node" }, include: ["tests/server/link-preview.test.ts", "tests/server/imports.test.ts", "tests/server/videos.test.ts", "tests/server/pictures.test.ts", "tests/server/team-pages.test.ts", "tests/server/tables.test.ts", "tests/server/pages.test.ts", "tests/server/templates.test.ts", "tests/server/reactions.test.ts", "tests/server/spotlight.test.ts", "tests/server/voting.test.ts", "tests/server/timer.test.ts", "tests/server/lifecycle.test.ts", "tests/server/history.test.ts", "tests/server/suite.test.ts", "tests/server/lists.test.ts", "tests/server/removal.test.ts", "tests/server/shared.test.ts", "tests/server/mentions.test.ts", "tests/server/mind-maps.test.ts", "tests/server/drawing-layout.test.ts"], globalSetup: ["tests/server/setup.ts"],
    setupFiles: ["tests/server/setup-node-warnings.ts"],
    fileParallelism: false, testTimeout: 120000, hookTimeout: 120000, reporters: ["default"] },
});
