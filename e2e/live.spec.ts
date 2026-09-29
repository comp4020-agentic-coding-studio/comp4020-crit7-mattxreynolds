import { type Browser, type BrowserContext, type Page, expect, test, type TestInfo } from "@playwright/test";
import { screenshotPath } from "./evidence";

// Issue #22 (0042, 0044): an open board and an open post page follow another
// browser's changes with no reload. Each test uses its own fresh students, so
// the two viewport projects and the other e2e files can share one database.
//
// alex posts, priya offers, sam is watching. (The seeded students are left
// alone: every test here changes what it watches, and the seed is shared.)
const PASSWORD = "e2e-password-1";

async function newContext(browser: Browser, testInfo: TestInfo, options: { javaScriptEnabled?: boolean } = {}) {
  const { viewport, isMobile, hasTouch, baseURL } = testInfo.project.use;
  return browser.newContext({ viewport, isMobile, hasTouch, baseURL: baseURL ?? testInfo.config.projects[0]?.use.baseURL, ...options });
}

async function signUp(page: Page, username: string) {
  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");
}

async function postSwap(page: Page, leaving: string, joins: string[], message = "") {
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: leaving }).check();
  const group = page.getByRole("group", { name: "Classes you would join" });
  for (const join of joins) await group.getByRole("checkbox", { name: join }).check();
  if (message) await page.getByLabel(/Message/).fill(message);
  await page.getByRole("button", { name: "Post swap" }).click();
  await expect(page).toHaveURL("/");
}

async function ownPostPath(page: Page): Promise<string> {
  const href = await page.locator("#your-post ~ .post").getByRole("link", { name: "View post" }).getAttribute("href");
  return new URL(href ?? "", "http://x").pathname;
}

/** alex has a post and priya has offered on it; both are signed up in their own contexts. */
async function alexAndPriya(browser: Browser, testInfo: TestInfo, suffix: string) {
  const alexName = `alex${suffix}`;
  const alexContext = await newContext(browser, testInfo);
  const alex = await alexContext.newPage();
  await signUp(alex, alexName);
  await postSwap(alex, "Mon 14:00–15:30", ["Wed 09:00–10:30"], "Clashes with my lab.");
  const postPath = await ownPostPath(alex);

  const priyaContext = await newContext(browser, testInfo);
  const priya = await priyaContext.newPage();
  await signUp(priya, `priya${suffix}`);
  await postSwap(priya, "Wed 09:00–10:30", ["Mon 14:00–15:30"]);
  await priya.goto(postPath);
  await priya.getByRole("button", { name: "Offer to swap" }).click();
  await expect(priya.locator(".own-offer")).toContainText("Pending");
  return { alexName, alexContext, alex, postPath, priyaContext, priya };
}

async function acceptFirstOffer(alex: Page, postPath: string) {
  await alex.goto(postPath);
  await alex.getByRole("link", { name: "Accept" }).click();
  await alex.getByRole("button", { name: "Accept the swap" }).click();
  await expect(alex.locator(".swapped")).toBeVisible();
}

test("sam's open board and post page follow alex accepting priya's offer, with nothing jumping", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const { alexName, alexContext, alex, postPath, priyaContext } = await alexAndPriya(browser, testInfo, suffix);

  // sam posts (so the board shows the notice, then reload clears it) and
  // keeps the board open beside alex's post page
  const samContext = await newContext(browser, testInfo);
  const sam = await samContext.newPage();
  await signUp(sam, `sam${suffix}`);
  await postSwap(sam, "Mon 15:30–17:00", ["Wed 14:00–15:30"]);
  await expect(sam.getByRole("status")).toHaveText("Your swap post is on the board");
  await sam.reload();
  await expect(sam.getByRole("status")).toHaveCount(0);
  const samPost = sam.locator("#your-post ~ .post");
  await expect(sam.locator("#open-posts ~ .post").filter({ hasText: alexName })).toContainText("1 pending offer");

  const samPostPage = await samContext.newPage();
  await samPostPage.goto(postPath);
  await expect(samPostPage.locator(".offer-count")).toHaveText("1 pending offer");
  await expect(samPostPage.getByRole("button", { name: "Offer to swap" })).toBeVisible();

  // a tall spacer after the board makes it scroll on both viewports; a real
  // marker on window proves the page never reloads
  await sam.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.id = "spacer";
    spacer.style.height = "4000px";
    document.querySelector("main")?.append(spacer);
    (window as unknown as { __noReload: boolean }).__noReload = true;
    window.scrollTo(0, 250);
  });
  await samPostPage.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });
  const editLink = samPost.getByRole("link", { name: "Edit" });
  await editLink.focus();
  const editHref = await editLink.getAttribute("href");
  const scrollBefore = await sam.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(0);

  await acceptFirstOffer(alex, postPath);

  // sam's board: alex's post has left it, and nothing else moved
  await expect(sam.locator("#open-posts ~ .post").filter({ hasText: alexName })).toHaveCount(0);
  await expect(sam.locator("#live-announce")).toHaveText("Board updated");
  expect(await sam.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  expect(await sam.evaluate(() => window.scrollY)).toBe(scrollBefore);
  expect(await sam.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(editHref);
  await expect(sam.getByRole("status")).toHaveCount(0);
  await expect(sam.getByText("Your swap post is on the board")).toHaveCount(0);
  await expect(sam.locator("#live-announce")).toHaveAttribute("aria-live", "polite");

  // sam's open post page: the status changed and the controls went
  await expect(samPostPage.locator(".swapped")).toContainText("Swapped:");
  await expect(samPostPage.locator(".offer-count")).toHaveCount(0);
  await expect(samPostPage.getByRole("button", { name: "Offer to swap" })).toHaveCount(0);
  expect(await samPostPage.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  await sam.evaluate(() => document.getElementById("spacer")?.remove());
  await sam.screenshot({ path: screenshotPath(testInfo, "live-board"), fullPage: true });
  await samPostPage.screenshot({ path: screenshotPath(testInfo, "live-post-page"), fullPage: true });
  await Promise.all([alexContext, priyaContext, samContext].map((c: BrowserContext) => c.close()));
});

test("the board refetches when its event stream reconnects", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const { alexName, alexContext, alex, postPath, priyaContext } = await alexAndPriya(browser, testInfo, `r${suffix}`);

  const samContext = await newContext(browser, testInfo);
  const sam = await samContext.newPage();
  // the first stream ends at once with a short retry, and the reconnect is
  // held while the change happens: its event is never delivered, so only the
  // reconnect's refetch can show it. Later requests reach the real server.
  let release: () => Promise<void> = async () => {};
  let requests = 0;
  await sam.route("**/api/events", async (route) => {
    requests += 1;
    if (requests === 1) {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: "retry: 100\n\n: connected\n\n" });
    }
    if (requests > 2) return route.continue();
    release = () => route.continue();
  });
  await signUp(sam, `sam${suffix}`);
  await expect(sam.locator("#open-posts ~ .post").filter({ hasText: alexName })).toBeVisible();
  await expect.poll(() => requests).toBe(2);
  await sam.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  await acceptFirstOffer(alex, postPath);
  await expect(sam.locator("#open-posts ~ .post").filter({ hasText: alexName })).toBeVisible();
  await release();

  await expect(sam.locator("#open-posts ~ .post").filter({ hasText: alexName })).toHaveCount(0);
  expect(await sam.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await Promise.all([alexContext, priyaContext, samContext].map((c: BrowserContext) => c.close()));
});

test("focus stays on a control whose label the refresh changes", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const alexContext = await newContext(browser, testInfo);
  const alex = await alexContext.newPage();
  await signUp(alex, `alexf${suffix}`);
  await postSwap(alex, "Mon 14:00–15:30", ["Wed 09:00–10:30"]);
  const postPath = await ownPostPath(alex);
  const count = alex.locator("#your-post ~ .post .offer-count").getByRole("link");
  await expect(count).toHaveText("0 pending offers");
  await count.focus();

  const priyaContext = await newContext(browser, testInfo);
  const priya = await priyaContext.newPage();
  await signUp(priya, `priyaf${suffix}`);
  await priya.goto(postPath);
  await priya.getByRole("radio", { name: "Wed 09:00–10:30" }).check().catch(() => {});
  await priya.getByRole("button", { name: "Offer to swap" }).click();

  await expect(count).toHaveText("1 pending offer");
  expect(await alex.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(postPath);
  await Promise.all([alexContext, priyaContext].map((c: BrowserContext) => c.close()));
});

test("the board and the post page are correct on reload with JavaScript off", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const ownerContext = await newContext(browser, testInfo, { javaScriptEnabled: false });
  const owner = await ownerContext.newPage();
  await signUp(owner, `nojsowner${suffix}`);
  await postSwap(owner, "Mon 14:00–15:30", ["Wed 09:00–10:30"]);
  const postPath = await ownPostPath(owner);

  const watcherContext = await newContext(browser, testInfo, { javaScriptEnabled: false });
  const watcher = await watcherContext.newPage();
  await signUp(watcher, `nojswatch${suffix}`);
  const entry = watcher.locator("#open-posts ~ .post").filter({ hasText: `nojsowner${suffix}` });
  await expect(entry).toBeVisible();
  await watcher.goto(postPath);
  await expect(watcher.getByRole("button", { name: "Offer to swap" })).toBeVisible();

  // nothing updates by itself...
  await owner.getByRole("button", { name: "Withdraw" }).click();
  await expect(owner.locator("#your-post ~ .post")).toHaveCount(0);
  await expect(watcher.getByRole("button", { name: "Offer to swap" })).toBeVisible();

  // ...and a reload is correct
  await watcher.reload();
  await expect(watcher.getByText("This swap post was withdrawn")).toBeVisible();
  await expect(watcher.getByRole("button", { name: "Offer to swap" })).toHaveCount(0);
  await watcher.goto("/");
  await expect(watcher.locator("#open-posts ~ .post").filter({ hasText: `nojsowner${suffix}` })).toHaveCount(0);
  await Promise.all([ownerContext, watcherContext].map((c: BrowserContext) => c.close()));
});
