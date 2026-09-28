import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { commitLink, rangeLink, repoUrl } from "./cite.ts";

// The citation shape `pnpm check:evidence` resolves (scripts/check-evidence.ts).
const CITATION = /\[`?([0-9a-f]{7,40}(?:\.\.\.[0-9a-f]{7,40})?)`?\]\(/;

describe("cite", () => {
  it("normalises https and ssh origins to the repo's web URL", () => {
    expect(repoUrl("https://github.com/org/repo.git")).toBe("https://github.com/org/repo");
    expect(repoUrl("git@github.com:org/repo.git")).toBe("https://github.com/org/repo");
  });

  it("links a commit in the shape check:evidence resolves", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const link = commitLink("https://github.com/org/repo", head);
    expect(link).toBe(`[\`${head.slice(0, 7)}\`](https://github.com/org/repo/commit/${head.slice(0, 7)})`);
    const cited = link.match(CITATION)?.[1] as string;
    expect(() => execFileSync("git", ["cat-file", "-e", `${cited}^{commit}`])).not.toThrow();
  });

  it("links a range as a compare URL", () => {
    const link = rangeLink("https://github.com/org/repo", "a".repeat(40), "b".repeat(40));
    expect(link).toBe("[`aaaaaaa...bbbbbbb`](https://github.com/org/repo/compare/aaaaaaa...bbbbbbb)");
    expect(link).toMatch(CITATION);
  });
});
