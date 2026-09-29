import { type Browser, type BrowserContext, type Page, expect, test, type TestInfo } from "@playwright/test";
import { screenshotPath } from "./evidence";

// Issue #23 (0026, 0027, 0029, 0044): commenting on a post page, and another
// student's comment arriving on an open page with the half-typed comment
// untouched. Fresh students in each test, so the two viewport projects and the
// other e2e files can share one database.
const PASSWORD = "e2e-password-1";

async function newContext(browser: Browser, testInfo: TestInfo) {
  const { viewport, isMobile, hasTouch, baseURL } = testInfo.project.use;
  return browser.newContext({ viewport, isMobile, hasTouch, baseURL: baseURL ?? testInfo.config.projects[0]?.use.baseURL });
}

async function signUp(page: Page, username: string) {
  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");
}

async function postSwap(page: Page, message: string) {
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
  await page.getByRole("group", { name: "Classes you would join" }).getByRole("checkbox", { name: "Wed 09:00–10:30" }).check();
  await page.getByLabel(/Message/).fill(message);
  await page.getByRole("button", { name: "Post swap" }).click();
  await expect(page).toHaveURL("/");
}

async function comment(page: Page, text: string) {
  await page.getByLabel(/Add a comment/).fill(text);
  await page.getByRole("button", { name: "Comment", exact: true }).click();
}

test("a comment from another student appears live and leaves a half-typed comment alone", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const alexContext = await newContext(browser, testInfo);
  const alex = await alexContext.newPage();
  await signUp(alex, `alexc${suffix}`);
  await postSwap(alex, "Clashes with my lab.");
  const href = await alex.locator("#your-post ~ .your-swap-panel .board-post").getByRole("link", { name: "View post" }).getAttribute("href");
  const postPath = new URL(href ?? "", "http://x").pathname;

  const samContext = await newContext(browser, testInfo);
  const sam = await samContext.newPage();
  await signUp(sam, `samc${suffix}`);
  await sam.goto(postPath);
  await expect(sam.getByText("No comments yet.")).toBeVisible();

  // sam is part-way through a comment, with the caret in the middle of it
  const box = sam.getByLabel(/Add a comment/);
  await box.fill("Would you take Wed 09:00 if");
  await box.focus();
  await sam.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  // alex, on the same page in another browser, comments first: the poster's tag
  await alex.goto(postPath);
  await comment(alex, "Happy to hear offers.\nAny time.");
  await expect(alex).toHaveURL(postPath);
  await expect(alex.locator(".comment .poster-tag")).toHaveText("poster");

  // sam's open page shows it, with nothing reloaded and nothing typed lost
  const samComments = sam.locator(".comment-list .comment");
  await expect(samComments).toHaveCount(1);
  await expect(samComments.first()).toContainText("Happy to hear offers.");
  await expect(samComments.first().locator(".poster-tag")).toBeVisible();
  await expect(box).toHaveValue("Would you take Wed 09:00 if");
  await expect(box).toBeFocused();
  expect(await sam.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  // sam finishes it and sends it
  await box.fill("Would you take Wed 09:00 if I offered?");
  await sam.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(sam).toHaveURL(postPath);
  await expect(sam.locator(".comment-list .comment")).toHaveCount(2);
  await expect(sam.getByLabel(/Add a comment/)).toHaveValue("");

  // alex sees sam's, and sam deletes it: alex's open page shows the placeholder
  await expect(alex.locator(".comment-list .comment")).toHaveCount(2);
  await expect(alex.locator(".comment").nth(1)).toContainText("Would you take Wed 09:00 if I offered?");
  await expect(alex.locator(".comment").nth(1).getByRole("button", { name: "Delete" })).toHaveCount(0);
  await sam.locator(".comment").nth(1).getByRole("button", { name: "Delete" }).click();
  await expect(sam.locator(".comment").nth(1)).toHaveText("Comment deleted");
  await expect(alex.locator(".comment").nth(1)).toHaveText("Comment deleted");
  await expect(alex.locator("main")).not.toContainText("Would you take Wed 09:00");

  // the board says how many are left, deleted ones not counted
  await alex.goto("/");
  await expect(alex.locator("#your-post ~ .your-swap-panel .board-post .comment-count")).toHaveText("1 comment");

  await alex.goto(postPath);
  await comment(alex, "Second thought: any class after 10 works.");
  await expect(alex.locator(".comment-list .comment")).toHaveCount(3);
  await alex.screenshot({ path: screenshotPath(testInfo, "comments-thread"), fullPage: true });
  await Promise.all([alexContext, samContext].map((c: BrowserContext) => c.close()));
});

test("a withdrawn post's page keeps its comments and loses the box", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const context = await newContext(browser, testInfo);
  const page = await context.newPage();
  await signUp(page, `alexw${suffix}`);
  await postSwap(page, "");
  await page.locator("#your-post ~ .your-swap-panel .board-post").getByRole("link", { name: "View post" }).click();
  await comment(page, "Never mind, sorted it out.");
  await expect(page.locator(".comment")).toHaveCount(1);
  await page.getByRole("button", { name: "Withdraw" }).click();

  await expect(page.locator(".withdrawn")).toBeVisible();
  await expect(page.locator(".comment")).toContainText("Never mind, sorted it out.");
  await expect(page.getByLabel(/Add a comment/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await context.close();
});
