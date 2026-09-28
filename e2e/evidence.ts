import type { TestInfo } from "@playwright/test";

/** Where a slice's evidence screenshot goes: one per viewport project, named
 *  so the handoff can attach them (`test-results/` is gitignored and wiped
 *  at the start of each run, so what's there is the last run's). */
export function screenshotPath(testInfo: TestInfo, name: string): string {
  return `test-results/screenshots/${testInfo.project.name}-${name}.png`;
}
