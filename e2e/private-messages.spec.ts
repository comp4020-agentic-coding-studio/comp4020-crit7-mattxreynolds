import { type Browser, type BrowserContext, type Page, expect, test, type TestInfo } from "@playwright/test";
import { screenshotPath } from "./evidence";

// Issue #24 (0030, 0031, 0034): starting a conversation from a post page, and
// a private message arriving in the other student's open conversation with no
// reload and their half-typed private message untouched. Fresh students in
// each test, so the two viewport projects and the other e2e files can share
// one database.
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

test("a private message from another student appears live and leaves a half-typed one alone", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const alexName = `alexm${suffix}`;
  const samName = `samm${suffix}`;

  const alexContext = await newContext(browser, testInfo);
  const alex = await alexContext.newPage();
  await signUp(alex, alexName);
  await postSwap(alex, "Clashes with my lab.");
  const href = await alex.locator("#your-post ~ .post").getByRole("link", { name: "View post" }).getAttribute("href");
  const postPath = new URL(href ?? "", "http://x").pathname;

  // sam starts from the "Message" link beside alex's name on the post page
  const samContext = await newContext(browser, testInfo);
  const sam = await samContext.newPage();
  await signUp(sam, samName);
  await sam.goto(postPath);
  await sam.getByRole("link", { name: `Message ${alexName}` }).click();
  await expect(sam).toHaveURL(`/messages/${alexName}/`);
  await expect(sam.getByText("No private messages yet.")).toBeVisible();

  // alex has no Message link beside their own name, and opens sam's conversation by address
  await alex.goto(postPath);
  await expect(alex.getByRole("link", { name: `Message ${alexName}` })).toHaveCount(0);
  await alex.goto(`/messages/${samName}/`);
  await expect(alex.getByText("No private messages yet.")).toBeVisible();

  // alex is part-way through a reply, with the caret in the middle of it
  const box = alex.getByLabel(/Private message to/);
  await box.fill("Yes, that works if");
  await box.focus();
  await alex.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  // sam sends: back to the conversation, the private message there
  await sam.getByLabel(/Private message to/).fill("Would you swap Mon 14:00 for Wed 09:00?\nI can do either day.");
  await sam.getByRole("button", { name: "Send" }).click();
  await expect(sam).toHaveURL(`/messages/${alexName}/`);
  const samThread = sam.locator(".private-message-list .private-message");
  await expect(samThread).toHaveCount(1);
  await expect(samThread.first()).toContainText(samName);
  await expect(samThread.first().locator("time")).toBeVisible();
  await expect(sam.getByLabel(/Private message to/)).toHaveValue("");

  // alex's open conversation shows it, with nothing reloaded and nothing typed lost
  const alexThread = alex.locator(".private-message-list .private-message");
  await expect(alexThread).toHaveCount(1);
  await expect(alexThread.first()).toContainText("Would you swap Mon 14:00 for Wed 09:00?");
  await expect(alexThread.first()).toContainText(samName);
  await expect(box).toHaveValue("Yes, that works if");
  await expect(box).toBeFocused();
  expect(await alex.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  // alex finishes it: sam's open conversation shows the reply
  await box.fill("Yes, that works if you do it today.");
  await alex.getByRole("button", { name: "Send" }).click();
  await expect(alex).toHaveURL(`/messages/${samName}/`);
  await expect(alexThread).toHaveCount(2);
  await expect(samThread).toHaveCount(2);
  await expect(samThread.nth(1)).toContainText("Yes, that works if you do it today.");
  await expect(samThread.nth(1)).toContainText(alexName);

  await alex.screenshot({ path: screenshotPath(testInfo, "private-messages-conversation"), fullPage: true });
  await Promise.all([alexContext, samContext].map((c: BrowserContext) => c.close()));
});

test("an unknown username or your own is not found", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const context = await newContext(browser, testInfo);
  const page = await context.newPage();
  const name = `solo${suffix}`;
  await signUp(page, name);
  for (const path of [`/messages/${name}/`, "/messages/nobody-here-9/"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Conversation not found" })).toBeVisible();
  }
  await context.close();
});
