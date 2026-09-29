import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every spec file shares one server (spec/global-setup.ts), and its board lists
// every open post the whole suite has made so far. A check whose cost grows
// with a page's size, like axe on the board, takes 0.4s or 10s depending on
// when its file happens to run, and times out on the slow runs. That is how
// `pnpm check` flaked in #35, #37, #38, #39 and #42 (harness fix #43). A spec
// file that runs axe boots its own server with spawnServer (spec/spawn-server.ts).
//
// spec/invariants.test.ts is exempt: it is a permanent starter check, and it
// runs axe only on logged-out pages, which never list the suite's posts.
//
// This checks intent, not every call: a file that spawns its own server but
// then lets one helper call default to the shared one still passes. The
// helpers in spec/helpers.ts take the server as their last argument.
const EXEMPT = new Set(["invariants.test.ts"]);

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("spec files on the shared server", () => {
  it("every spec file that runs axe gets its server from spawnServer, not the shared baseUrl", () => {
    const offenders = readdirSync("spec")
      .filter((file) => file.endsWith(".test.ts") && !EXEMPT.has(file))
      .filter((file) => {
        const source = withoutComments(readFileSync(join("spec", file), "utf8"));
        const runsAxe = /\baxe\.run\s*\(/.test(source);
        const sharedServer = /inject\(\s*["']baseUrl["']\s*\)|\bbaseUrl\b[^;]*from\s+["']\.\/helpers["']/s.test(source);
        return runsAxe && (sharedServer || !/\bspawnServer\s*\(/.test(source));
      })
      .map((file) => `spec/${file}`);
    expect(offenders).toEqual([]);
  });
});
