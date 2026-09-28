#!/usr/bin/env node
// PreToolUse guard. Exit 2 blocks the tool call and shows Claude the reason;
// exit 0 lets the normal permission flow decide. It protects what the starter
// ships as fixed (the permanent spec checks, the evidence check, CI and its
// probes, Fly configuration, committed migrations, boot-time migrations) and
// the process rules (only Matt closes issues; history is never rewritten).
//
// It is backpressure, not a sandbox: the Bash checks match common shapes of a
// write, and a determined command can get past them. Test it directly:
//   echo '{"tool_name":"Edit","tool_input":{"file_path":"fly.toml"}}' | node .claude/hooks/guard.mjs; echo $?
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const PROTECTED = {
  "spec/invariants.test.ts": "a permanent starter check (spec/README.md)",
  "spec/readme.test.ts": "a permanent starter check (spec/README.md)",
  "spec/global-setup.ts": "boots the built server for every spec check",
  "scripts/check-evidence.ts": "the course's process-evidence check",
  "scripts/check-evidence.test.ts": "the course's process-evidence check",
  ".github/workflows/checks.yml": "CI and its deploy probes",
  ".github/trufflehog.yml": "the course-key secret scan",
  ".githooks/pre-commit": "the starter's API-key guard",
  "fly.toml": "Fly configuration the course watches",
  Dockerfile: "the image Fly builds; it ships drizzle/ for boot-time migrations",
};

const MIGRATE_AT_BOOT = /migrate\(\s*db\s*,\s*\{\s*migrationsFolder:\s*["']\.\/drizzle["']\s*,?\s*\}\s*\)/;

function block(reason) {
  process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${reason}\n`);
  process.exit(2);
}

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const tool = input.tool_name ?? "";
const args = input.tool_input ?? {};

function committed(rel) {
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `HEAD:${rel.replace(/\/$/, "")}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function toRel(path) {
  const abs = isAbsolute(path) ? path : resolve(input.cwd || root, path);
  const rel = relative(root, abs);
  return rel.startsWith("..") || isAbsolute(rel) ? null : rel.split("\\").join("/");
}

// The file as it would be after this Edit / MultiEdit / Write.
function contentAfter(rel) {
  if (tool === "Write") return args.content ?? "";
  const abs = resolve(root, rel);
  let text = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  const edits = tool === "MultiEdit" ? (args.edits ?? []) : [args];
  for (const e of edits) {
    if (typeof e.old_string !== "string") continue;
    text = e.replace_all
      ? text.split(e.old_string).join(e.new_string ?? "")
      : text.replace(e.old_string, () => e.new_string ?? "");
  }
  return text;
}

function checkFile(rel) {
  if (PROTECTED[rel]) {
    const hint = rel.startsWith("spec/") ? " Add your own checks in a new spec/*.test.ts; routes go in spec/routes.ts." : "";
    block(`${rel} is ${PROTECTED[rel]} and stays as shipped.${hint} If it truly must change, stop and ask Matt.`);
  }
  if (rel.startsWith("drizzle/") && committed(rel)) {
    block(`${rel} is a committed migration. Migrations are history: change src/lib/schema.ts and run \`pnpm db:generate\` to add a new one.`);
  }
  if (rel === "src/lib/db.ts" && !MIGRATE_AT_BOOT.test(contentAfter(rel))) {
    block(`src/lib/db.ts must keep \`migrate(db, { migrationsFolder: "./drizzle" })\`: migrations run at boot on the machine holding the Fly volume.`);
  }
  if (rel === "astro.config.ts") {
    const text = contentAfter(rel);
    if (!text.includes("**.fly.dev") || /checkOrigin\s*:\s*false/.test(text)) {
      block("astro.config.ts must keep the **.fly.dev allowedDomains entry and CSRF origin checking; the deploy probes depend on both.");
    }
  }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A command in command position: at a line start or after ; & | ( or $(, so
// prose that merely mentions it (an issue body in a heredoc, a quoted string)
// does not trip the guard.
const run = (re) => new RegExp(String.raw`(?:^|[;&|(]|\$\()\s*` + re, "m");

function checkBash(cmd) {
  if (run(String.raw`gh\s+issue\s+close\b`).test(cmd) || run(String.raw`gh\s+api\b[^|;&\n]*state["']?\s*[=:]\s*["']?closed`).test(cmd)) {
    block("only Matt closes issues. Post the evidence, label the issue ready-for-human, and hand off.");
  }
  if (run(String.raw`git\s+(commit\b[^|;&\n]*--amend|rebase\b|filter-branch\b|filter-repo\b)`).test(cmd)) {
    block("history is never rewritten. Make a new commit instead.");
  }
  if (run(String.raw`git\s+push\b[^|;&\n]*(\s-f\b|--force|\s\+\S)`).test(cmd)) {
    block("force-pushing rewrites published history.");
  }
  if (run(String.raw`git\s+reset\b[^|;&\n]*(--hard|--soft|--keep|--merge|HEAD[~^]|@[~^])`).test(cmd)) {
    block("resetting commits rewrites history or discards work. Use `git restore <path>` to undo uncommitted changes, or make a new commit.");
  }
  if (run(String.raw`git\b[^|;&\n]*--no-verify\b`).test(cmd) || run(String.raw`git\s+config\b[^|;&\n]*(--unset[^|;&\n]*core\.hooksPath|core\.hooksPath\s+[^\s|;&])`).test(cmd)) {
    block("the git hooks (key guard, commit-message guard) are not bypassed.");
  }

  const targets = Object.keys(PROTECTED);
  for (const m of cmd.matchAll(/(?<=^|[\s"'=/])drizzle(\/[\w./-]*)?/g)) {
    if (committed(m[0])) targets.push(m[0]);
  }
  for (const rel of targets) {
    const p = `(?<=^|[\\s"'=/])(?:\\./)?${esc(rel)}(?=$|[\\s"';|&)])`;
    const writes = [
      `\\b(sed|perl)\\b[^|;&]*\\s-i[^|;&]*${p}`,
      `>>?\\s*["']?${p}`,
      `\\b(tee|truncate|rm|mv|unlink|chmod|ln|git\\s+rm|git\\s+mv)\\b[^|;&]*${p}`,
      `\\bcp\\b[^|;&]*${p}\\s*($|[|;&])`,
    ];
    if (writes.some((w) => new RegExp(w).test(cmd))) {
      checkFile(rel.replace(/\/$/, ""));
      block(`this command writes to ${rel}, which is protected.`);
    }
  }
}

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const rel = toRel(args.file_path ?? args.notebook_path ?? "");
  if (rel) checkFile(rel);
} else if (tool === "Bash") {
  checkBash(args.command ?? "");
}
process.exit(0);
