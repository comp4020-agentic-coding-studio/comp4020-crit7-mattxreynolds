import { expect, test } from "@playwright/test";
import { screenshotPath } from "./evidence";

// The starter's core flow in a real browser at both viewports: sign the
// guestbook, reload, and the message is still there exactly once. It
// describes the starter, so it goes when the starter does, like
// spec/guestbook.test.ts.
test("a signed message survives a reload", async ({ page }, testInfo) => {
  const message = `e2e ${testInfo.project.name} ${Date.now()}`;

  await page.goto("/");
  await page.getByLabel("Leave a message").fill(message);
  await page.getByRole("button", { name: "Sign" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: message })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: message })).toHaveCount(1);

  await page.screenshot({ path: screenshotPath(testInfo, "guestbook") });
});
