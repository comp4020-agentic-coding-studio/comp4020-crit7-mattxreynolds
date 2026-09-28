import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The harness's blocking hooks, driven the way Claude Code and git drive them.
// A hook that fails to block (wrong exit code, missing interpreter) fails
// silently in use, so its exits are asserted here instead.
const root = process.cwd();

function guard(tool_name: string, tool_input: Record<string, unknown>): number | null {
  return spawnSync("node", [".claude/hooks/guard.mjs"], {
    input: JSON.stringify({ tool_name, tool_input, cwd: root }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  }).status;
}

describe("guard.mjs blocks with exit 2", () => {
  it.each([
    ["Edit", { file_path: "fly.toml", old_string: "syd", new_string: "iad" }],
    ["Write", { file_path: resolve(root, "spec/invariants.test.ts"), content: "" }],
    ["Edit", { file_path: "Dockerfile", old_string: "a", new_string: "b" }],
    ["Edit", { file_path: ".github/workflows/checks.yml", old_string: "a", new_string: "b" }],
    ["Edit", { file_path: "drizzle/0000_dry_captain_flint.sql", old_string: "a", new_string: "b" }],
    ["Write", { file_path: "drizzle/meta/_journal.json", content: "{}" }],
    [
      "Edit",
      {
        file_path: "src/lib/db.ts",
        old_string: 'migrate(db, { migrationsFolder: "./drizzle" });',
        new_string: "",
      },
    ],
    ["Write", { file_path: "astro.config.ts", content: "security: { checkOrigin: false } // **.fly.dev" }],
  ])("%s %j", (tool, input) => {
    expect(guard(tool, input)).toBe(2);
  });

  it.each([
    "gh issue close 3",
    "gh api repos/o/r/issues/3 -X PATCH -f state=closed",
    "git commit --amend --no-edit",
    "git rebase -i HEAD~3",
    "git push --force origin main",
    "git push origin +main",
    "git reset --hard HEAD~1",
    'git commit --no-verify -m "x"',
    "git config core.hooksPath /dev/null",
    "sed -i 's/syd/iad/' fly.toml",
    "echo '' > spec/readme.test.ts",
    "rm -rf drizzle",
    "cp /tmp/other Dockerfile",
    "git rm scripts/check-evidence.ts",
  ])("Bash: %s", (command) => {
    expect(guard("Bash", { command })).toBe(2);
  });
});

describe("guard.mjs allows ordinary work with exit 0", () => {
  it.each([
    ["Edit", { file_path: "src/lib/schema.ts", old_string: "a", new_string: "b" }],
    ["Edit", { file_path: "spec/routes.ts", old_string: "a", new_string: "b" }],
    ["Write", { file_path: "spec/swap.test.ts", content: "" }],
    ["Write", { file_path: "drizzle/9999_uncommitted.sql", content: "" }],
    [
      "Edit",
      {
        file_path: "src/lib/db.ts",
        old_string: "export type { Message };",
        new_string: "export type { Message };\nexport const extra = 1;",
      },
    ],
  ])("%s %j", (tool, input) => {
    expect(guard(tool, input)).toBe(0);
  });

  it.each([
    "cat fly.toml",
    "cat fly.toml > /tmp/fly-copy",
    "git restore fly.toml drizzle/meta/_journal.json",
    "rm drizzle/9999_uncommitted.sql",
    "pnpm check && pnpm db:check",
    'git commit -m "feat: x" -m "Refs #1"',
    "git reset",
    "git push origin main",
    "gh issue comment 1 --body-file .scratch/evidence.md",
    "gh issue edit 1 --add-label ready-for-human",
  ])("Bash: %s", (command) => {
    expect(guard("Bash", { command })).toBe(0);
  });
});

describe(".githooks/commit-msg", () => {
  const dir = mkdtempSync(join(tmpdir(), "commit-msg-"));
  const run = (message: string): number | null => {
    const file = join(dir, "MSG");
    writeFileSync(file, message);
    return spawnSync("sh", [".githooks/commit-msg", file]).status;
  };

  it.each([
    "feat: x\n\nFixes #1\n",
    "feat: x\n\ncloses: #12\n",
    "Resolved owner/repo#3\n",
    "x\n\nfix https://github.com/a/b/issues/4\n",
    "Fixed #9\n",
  ])("rejects %j", (message) => {
    expect(run(message)).toBe(1);
  });

  it.each([
    "feat: x\n\nRefs #1\n",
    "fix: handle #1 edge\n\nRefs #1\n",
    "x\n# Fixes #1 only in a git comment line\nRefs #2\n",
  ])("accepts %j", (message) => {
    expect(run(message)).toBe(0);
  });
});
