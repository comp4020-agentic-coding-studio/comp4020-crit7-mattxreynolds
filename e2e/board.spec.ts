import { expect, test } from "@playwright/test";
import { screenshotPath } from "./evidence";

// Issue #18: post a swap from the board, land back on it with the notice,
// reload and still see it — at both viewports, for the handoff screenshots.
test("post a swap, reload the board, and it is still there", async ({ page }, testInfo) => {
  const username = `e2e${testInfo.project.name[0]}${Date.now() % 100000}`;
  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: "Post a swap" }).click();
  await expect(page).toHaveURL("/posts/new/");

  // the leaving class is never offered as a join class
  const join = page.getByRole("group", { name: "Classes you would join" });
  await expect(join.getByRole("checkbox")).toHaveCount(6);
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
  await expect(join.getByRole("checkbox")).toHaveCount(5);
  await expect(join.getByRole("checkbox", { name: "Mon 14:00–15:30" })).toHaveCount(0);
  // changing the leaving class brings the old one back and hides the new one
  await page.getByRole("radio", { name: "Wed 09:00–10:30" }).check();
  await expect(join.getByRole("checkbox", { name: "Mon 14:00–15:30" })).toBeVisible();
  await expect(join.getByRole("checkbox", { name: "Wed 09:00–10:30" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();

  await join.getByRole("checkbox", { name: "Wed 09:00–10:30" }).check();
  await join.getByRole("checkbox", { name: "Wed 10:30–12:00" }).check();
  await page.getByLabel(/Message/).fill("Clashes with my lab.");
  await page.screenshot({ path: screenshotPath(testInfo, "post-form"), fullPage: true });
  await page.getByRole("button", { name: "Post swap" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status")).toHaveText("Your swap post is on the board");
  const mine = page.locator("#your-post ~ .post");
  await expect(mine).toContainText(username);
  await expect(mine).toContainText("Clashes with my lab.");

  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("#your-post ~ .post")).toContainText("Clashes with my lab.");
  await expect(page.getByRole("link", { name: "Post a swap" })).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(testInfo, "board"), fullPage: true });

  await page.locator("#your-post ~ .post").getByRole("link", { name: "View post" }).click();
  await expect(page.getByRole("heading", { name: `Swap post by ${username}` })).toBeVisible();
  await expect(page.getByText("Clashes with my lab.")).toBeVisible();
});
