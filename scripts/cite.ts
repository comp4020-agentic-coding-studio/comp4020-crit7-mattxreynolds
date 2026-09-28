#!/usr/bin/env node
// Prints PROCESS.md-ready citations: markdown links whose text is the short
// SHA (or sha...sha range) and whose target is this repo's commit or compare
// URL, the exact shape `pnpm check:evidence` resolves.
//
//   pnpm cite 3            every commit whose message cites #3, oldest first
//   pnpm cite a1b2c3d      one commit
//   pnpm cite a1b2c3d..e4f5a6b   a range (compare link)
//
// A commit that no remote branch contains yet is flagged: its link 404s for a
// marker until it is pushed.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trim();

/** https://github.com/<owner>/<repo> from an https or ssh origin URL. */
export function repoUrl(origin: string): string {
  const path = origin
    .trim()
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "")
    .replace(/^https?:\/\/github\.com\//, "");
  return `https://github.com/${path}`;
}

export function commitLink(url: string, sha: string): string {
  const short = sha.slice(0, 7);
  return `[\`${short}\`](${url}/commit/${short})`;
}

export function rangeLink(url: string, from: string, to: string): string {
  const range = `${from.slice(0, 7)}...${to.slice(0, 7)}`;
  return `[\`${range}\`](${url}/compare/${range})`;
}

/** Full SHAs of commits whose message cites #n (e.g. "Refs #3"), oldest first. */
export function issueCommits(n: number): string[] {
  const out = git("log", "--reverse", "--format=%H", "-E", `--grep=(^|[^0-9A-Za-z/])#${n}([^0-9]|$)`);
  return out ? out.split("\n") : [];
}

function pushed(sha: string): boolean {
  return git("branch", "-r", "--contains", sha) !== "";
}

function main(arg: string | undefined): void {
  if (!arg) {
    console.error("usage: pnpm cite <issue-number | sha | sha..sha>");
    process.exit(64);
  }
  const url = repoUrl(git("config", "--get", "remote.origin.url"));
  const unpushed: string[] = [];
  const line = (sha: string): string => {
    if (!pushed(sha)) unpushed.push(sha.slice(0, 7));
    return `- ${commitLink(url, sha)} ${git("log", "-1", "--format=%s", sha)}`;
  };

  if (/^\d+$/.test(arg)) {
    const shas = issueCommits(Number(arg));
    if (shas.length === 0) {
      console.error(`no commits cite #${arg}`);
      process.exit(1);
    }
    console.log(`Commits citing #${arg}:\n`);
    for (const sha of shas) console.log(line(sha));
    if (shas.length > 1) {
      const from = git("rev-parse", `${shas[0]}^`);
      const span = Number(git("rev-list", "--count", `${from}..${shas.at(-1)}`));
      const extra = span - shas.length;
      console.log(`\nSpan: ${rangeLink(url, from, shas.at(-1) as string)}${extra > 0 ? ` (includes ${extra} commit(s) not citing #${arg})` : ""}`);
    }
  } else {
    const range = arg.match(/^([^.]+)\.\.\.?([^.]+)$/);
    if (range) {
      const [from, to] = [git("rev-parse", range[1]), git("rev-parse", range[2])];
      if (!pushed(to)) unpushed.push(to.slice(0, 7));
      console.log(rangeLink(url, from, to));
    } else {
      console.log(line(git("rev-parse", "--verify", `${arg}^{commit}`)));
    }
  }
  if (unpushed.length > 0) {
    console.error(`\n! not on any remote branch yet (links 404 until pushed): ${unpushed.join(", ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]);
}
