import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// scripts/frontier.sh's filtering, fed saved GraphQL responses instead of the
// live tracker. The live query itself is exercised against the real issues.
type Child = {
  number: number;
  state?: "OPEN" | "CLOSED";
  labels: string[];
  assignees?: number;
  blockedBy?: [number, "OPEN" | "CLOSED"][];
};

function frontier(mode: string, parentLabels: string[], children: Child[]) {
  const issue = {
    title: "parent",
    state: "OPEN",
    labels: { nodes: parentLabels.map((name) => ({ name })) },
    subIssues: {
      nodes: children.map((c) => ({
        number: c.number,
        title: `child ${c.number}`,
        state: c.state ?? "OPEN",
        assignees: { totalCount: c.assignees ?? 0 },
        labels: { nodes: c.labels.map((name) => ({ name })) },
        blockedBy: { nodes: (c.blockedBy ?? []).map(([number, state]) => ({ number, state })) },
      })),
    },
  };
  const file = join(mkdtempSync(join(tmpdir(), "frontier-")), "response.json");
  writeFileSync(file, JSON.stringify({ data: { repository: { issue } } }));
  const run = spawnSync("scripts/frontier.sh", [mode, "10"], {
    env: { ...process.env, FRONTIER_JSON: file },
    encoding: "utf8",
  });
  const listed = (prefix: string) =>
    run.stdout
      .split("\n")
      .filter((l) => l.startsWith(prefix))
      .map((l) => Number(l.match(/#(\d+)/)?.[1]));
  return {
    status: run.status,
    stderr: run.stderr,
    front: listed("  #"),
    blocked: listed("  blocked:"),
    claimed: listed("  claimed:"),
  };
}

describe("frontier.sh decisions", () => {
  const children: Child[] = [
    { number: 11, labels: ["wayfinder:grilling"] },
    { number: 12, labels: ["wayfinder:grilling"], blockedBy: [[11, "OPEN"]] },
    { number: 13, labels: ["wayfinder:prototype"], blockedBy: [[20, "CLOSED"]] },
    { number: 14, labels: ["wayfinder:research"], assignees: 1 },
    { number: 15, labels: ["wayfinder:grilling"], state: "CLOSED" },
    { number: 16, labels: ["slice", "ready-for-agent"] },
  ];

  it("lists open, unblocked, unclaimed decision tickets only", () => {
    const r = frontier("decisions", ["wayfinder:map"], children);
    expect(r.status).toBe(0);
    expect(r.front).toEqual([11, 13]);
    expect(r.blocked).toEqual([12]);
    expect(r.claimed).toEqual([14]);
  });

  it("refuses a parent that is not a decision map", () => {
    const r = frontier("decisions", ["spec"], children);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("not labelled wayfinder:map");
  });
});

describe("frontier.sh build", () => {
  const children: Child[] = [
    { number: 21, labels: ["slice", "ready-for-agent"] },
    { number: 22, labels: ["slice", "ready-for-agent"], blockedBy: [[21, "OPEN"]] },
    { number: 23, labels: ["slice", "in-progress"] },
    { number: 24, labels: ["slice", "needs-triage"] },
    { number: 25, labels: ["slice", "ready-for-agent", "needs-info"] },
    { number: 26, labels: ["wayfinder:grilling"] },
    { number: 27, labels: ["slice", "ready-for-agent"], state: "CLOSED" },
  ];

  it("lists open, unblocked, unclaimed, ready slices only", () => {
    const r = frontier("build", ["spec"], children);
    expect(r.status).toBe(0);
    expect(r.front).toEqual([21]);
    expect(r.blocked).toEqual([22]);
    expect(r.claimed).toEqual([23]);
  });

  it("refuses a parent that is not a spec", () => {
    const r = frontier("build", ["wayfinder:map"], children);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("not labelled spec");
  });
});
