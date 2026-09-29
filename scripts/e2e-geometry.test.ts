import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// e2e geometry is read through boxes() in e2e/geometry.ts, never a raw
// Playwright boundingBox. The board and post page swap their whole fragment on
// any live refetch (src/scripts/live.ts), and in `pnpm e2e` six workers share
// one server, so another test's change refetches this test's page at any
// moment. A boundingBox resolves the element and measures it in two round
// trips; a swap between them gives null, and two of them can measure two
// different renders. It failed that way in #40 (harness fix #41).
describe("e2e geometry", () => {
  it("no e2e file calls boundingBox(): use boxes() from e2e/geometry.ts", () => {
    const offenders = readdirSync("e2e")
      .filter((file) => file.endsWith(".ts"))
      .flatMap((file) =>
        readFileSync(join("e2e", file), "utf8")
          .split("\n")
          .flatMap((line, i) => (/\.boundingBox\s*\(/.test(line) ? [`e2e/${file}:${i + 1}`] : [])),
      );
    expect(offenders).toEqual([]);
  });
});
