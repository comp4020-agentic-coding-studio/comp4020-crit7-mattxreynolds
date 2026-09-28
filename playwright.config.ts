import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// Browser checks run against the BUILT server (`pnpm e2e` builds first) with
// a throwaway SQLite database, like spec/global-setup.ts: never the dev
// server, never your local .data/app.db. The config is evaluated again in
// each worker, so the database directory is pinned in an env var the workers
// inherit. Set E2E_DB_DIR yourself to inspect the database after a run.
process.env.E2E_DB_DIR ??= mkdtempSync(join(tmpdir(), "e2e-db-"));
const port = Number(process.env.E2E_PORT ?? 4329);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  // cleaned at the start of every run, so screenshots here are this run's
  outputDir: "test-results",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1920, height: 1080 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "node dist/server/entry.mjs",
    url: baseURL,
    // a server already on the port would be a different database: refuse it
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...(process.env as Record<string, string>),
      HOST: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: join(process.env.E2E_DB_DIR, "e2e.db"),
    },
  },
});
