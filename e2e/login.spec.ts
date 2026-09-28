import { expect, test } from "@playwright/test";
import { screenshotPath } from "./evidence";

// The login slice's core flow in a real browser, at both viewports, for the
// handoff screenshots: sign up, reach the board, and log out.
test("sign up, reach the board, and log out", async ({ page }, testInfo) => {
  const username = `e2e${testInfo.project.name[0]}${Date.now() % 100000}`;
  const password = "e2e-password-1";

  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
  await expect(page.getByText(username)).toBeVisible();

  await page.screenshot({ path: screenshotPath(testInfo, "board") });

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
