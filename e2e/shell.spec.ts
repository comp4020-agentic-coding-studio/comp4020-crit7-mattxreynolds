import { expect, test, type Page } from "@playwright/test";
import { ROUTES } from "../spec/routes";
import { screenshotPath } from "./evidence";

// Issue #34: the transit-board shell. Text, footer and the attention marker
// are pinned on the served HTML (spec/shell.test.ts); this walk needs real
// layout: no covered route scrolls sideways, logged out or in. Later slices
// keep it green.
async function noSidewaysScroll(page: Page, route: string) {
  await page.goto(route);
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(scroll, `${route} is wider than the viewport (${scroll} > ${width})`).toBeLessThanOrEqual(width);
}

test("no covered route scrolls sideways, logged out", async ({ page }) => {
  for (const route of ROUTES) await noSidewaysScroll(page, route);
  // the routes that need a session end on the login page: still covered
  await expect(page.locator(".site-header .wordmark")).toHaveText("Swap Board");
});

test("no covered route scrolls sideways, logged in", async ({ page }, testInfo) => {
  const username = `shell${testInfo.project.name[0]}${Date.now() % 100000}`;
  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");

  // a post with a long message and every join class, the widest thing the shell holds
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
  for (const c of ["Mon 15:30–17:00", "Wed 09:00–10:30", "Wed 10:30–12:00", "Wed 14:00–15:30", "Wed 15:30–17:00"]) {
    await page.getByRole("group", { name: "Classes you would join" }).getByRole("checkbox", { name: c }).check();
  }
  await page.getByLabel(/Message/).fill("A".repeat(60) + " " + "b".repeat(80));
  await page.getByRole("button", { name: "Post swap" }).click();
  await expect(page).toHaveURL("/");

  for (const route of ROUTES.filter((r) => r !== "/login/" && r !== "/signup/")) await noSidewaysScroll(page, route);
  await noSidewaysScroll(page, "/posts/1/");

  await page.goto("/");
  await expect(page.locator(".site-header .wordmark")).toHaveText("Swap Board");
  await expect(page.locator(".site-footer")).toContainText("Unofficial, student-built COMP4020 demo.");
  await page.screenshot({ path: screenshotPath(testInfo, "shell"), fullPage: true });
});
