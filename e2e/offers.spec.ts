import { type Page, expect, test } from "@playwright/test";
import { screenshotPath } from "./evidence";

async function signUp(page: Page, username: string) {
  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");
}

// Issue #20: make an offer from a post page, reload and still see it Pending,
// then see the three views of the post page and withdraw from "Your offers" —
// at both viewports, for the handoff screenshots.
test("make an offer, see it after a reload, and withdraw it", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const poster = `owner${suffix}`;
  const offerer = `offerer${suffix}`;
  const bystander = `bystander${suffix}`;

  await signUp(page, poster);
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
  const join = page.getByRole("group", { name: "Classes you would join" });
  await join.getByRole("checkbox", { name: "Wed 09:00–10:30" }).check();
  await join.getByRole("checkbox", { name: "Wed 10:30–12:00" }).check();
  await page.getByRole("button", { name: "Post swap" }).click();
  await expect(page.locator("#your-post ~ .post .offer-count")).toHaveText("0 pending offers");
  const postUrl = new URL(
    (await page.locator("#your-post ~ .post").getByRole("link", { name: "View post" }).getAttribute("href")) ?? "",
    "http://x",
  ).pathname;
  await page.getByRole("button", { name: "Log out" }).click();

  // the offerer: two join classes, so nothing is pre-selected
  await signUp(page, offerer);
  await page.goto(postUrl);
  await expect(page.getByRole("button", { name: "Offer to swap" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Wed 09:00–10:30" })).not.toBeChecked();
  await page.getByRole("radio", { name: "Wed 09:00–10:30" }).check();
  await page.getByRole("button", { name: "Offer to swap" }).click();
  await expect(page).toHaveURL(postUrl);
  await page.reload();
  await expect(page.locator(".own-offer")).toContainText("Pending");
  await expect(page.locator(".own-offer")).toContainText("Wed 09:00–10:30");
  await expect(page.getByRole("button", { name: "Offer to swap" })).toHaveCount(0);
  await expect(page.locator(".offer-count")).toHaveText("1 pending offer");
  await page.screenshot({ path: screenshotPath(testInfo, "post-page-offerer"), fullPage: true });

  // the board's "Your offers", then everyone else's view of the post
  await page.getByRole("navigation").getByRole("link", { name: "Board" }).click();
  await expect(page.locator("#your-offers ~ ul .own-offer")).toContainText(`${poster}'s post`);
  await expect(page.locator("#your-offers ~ ul .own-offer")).toContainText("Pending");
  await page.screenshot({ path: screenshotPath(testInfo, "board-your-offers"), fullPage: true });
  await page.getByRole("button", { name: "Log out" }).click();

  await signUp(page, bystander);
  await page.goto(postUrl);
  await expect(page.locator(".offer-count")).toHaveText("1 pending offer");
  await expect(page.getByText(offerer)).toHaveCount(0);
  await expect(page.locator("#your-offers")).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(testInfo, "post-page-bystander"), fullPage: true });
  await page.getByRole("button", { name: "Log out" }).click();

  // the poster sees who offered, and the post is locked for editing
  await page.goto("/login/");
  await page.getByLabel("Username").fill(poster);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.goto(postUrl);
  await expect(page.locator(".offers li .offer-text")).toHaveText(`${offerer} would leave Wed 09:00–10:30`);
  await page.screenshot({ path: screenshotPath(testInfo, "post-page-poster"), fullPage: true });
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("alert")).toContainText("pending offers");
  await page.getByRole("button", { name: "Log out" }).click();

  // the offerer withdraws from the board and can offer again
  await page.goto("/login/");
  await page.getByLabel("Username").fill(offerer);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.locator("#your-offers ~ ul").getByRole("button", { name: "Withdraw" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("#your-offers ~ ul .own-offer")).toContainText("You withdrew");
  await page.goto(postUrl);
  await expect(page.locator(".offer-count")).toHaveText("0 pending offers");
  await expect(page.getByRole("button", { name: "Offer to swap" })).toBeVisible();
});

// Issue #21: the poster declines one offer in one click and accepts another
// through the confirm step, then both students see the outcome. JavaScript is
// off throughout, since accepting has to work without it (0042).
test.describe("accepting and declining", () => {
  test.use({ javaScriptEnabled: false });

  test("decline in one click, accept after the confirm step, with no JavaScript", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
    const poster = `swapper${suffix}`;
    const declined = `declined${suffix}`;
    const accepted = `accepted${suffix}`;

    async function logIn(username: string) {
      await page.goto("/login/");
      await page.getByLabel("Username").fill(username);
      await page.getByLabel("Password").fill("e2e-password-1");
      await page.getByRole("button", { name: "Log in" }).click();
    }

    await signUp(page, poster);
    await page.getByRole("link", { name: "Post a swap" }).click();
    await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
    const join = page.getByRole("group", { name: "Classes you would join" });
    await join.getByRole("checkbox", { name: "Wed 09:00–10:30" }).check();
    await join.getByRole("checkbox", { name: "Wed 10:30–12:00" }).check();
    await page.getByRole("button", { name: "Post swap" }).click();
    const postUrl = new URL(
      (await page.locator("#your-post ~ .post").getByRole("link", { name: "View post" }).getAttribute("href")) ?? "",
      "http://x",
    ).pathname;
    await page.getByRole("button", { name: "Log out" }).click();

    for (const [username, cls] of [
      [declined, "Wed 10:30–12:00"],
      [accepted, "Wed 09:00–10:30"],
    ]) {
      await signUp(page, username);
      await page.goto(postUrl);
      await page.getByRole("radio", { name: cls }).check();
      await page.getByRole("button", { name: "Offer to swap" }).click();
      await page.getByRole("button", { name: "Log out" }).click();
    }

    // the poster declines the first offer: one click, and the post stays open
    await logIn(poster);
    await page.goto(postUrl);
    await expect(page.locator(".offers li")).toHaveCount(2);
    await page.locator(".offers li", { hasText: declined }).getByRole("button", { name: "Decline" }).click();
    await expect(page).toHaveURL(postUrl);
    await expect(page.locator(".offers li")).toHaveCount(1);
    await expect(page.locator(".offer-count")).toHaveText("1 pending offer");

    // accepting goes through a page that says it is final
    await page.locator(".offers li", { hasText: accepted }).getByRole("link", { name: "Accept" }).click();
    await expect(page.getByRole("heading", { name: "Accept this offer?" })).toBeVisible();
    await expect(page.getByText("Accepting is final")).toBeVisible();
    await page.screenshot({ path: screenshotPath(testInfo, "accept-confirm"), fullPage: true });
    await page.getByRole("button", { name: "Accept the swap" }).click();
    await expect(page).toHaveURL(postUrl);
    await expect(page.locator(".swapped")).toHaveText(
      `Swapped: ${poster} moves to Wed 09:00–10:30, ${accepted} moves to Mon 14:00–15:30. Make the change in MyTimetable. This app can't.`,
    );
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);
    await page.screenshot({ path: screenshotPath(testInfo, "post-page-swapped"), fullPage: true });

    // the poster's board spot links to the swapped post; the others see their labels
    await page.getByRole("navigation").getByRole("link", { name: "Board" }).click();
    await expect(page.getByRole("link", { name: "Post a swap" })).toBeVisible();
    await expect(page.locator("#your-post ~ .swapped-line").getByRole("link")).toHaveAttribute("href", postUrl);
    await page.getByRole("button", { name: "Log out" }).click();

    await logIn(declined);
    await expect(page.locator("#your-offers ~ ul .own-offer")).toContainText("Declined");
    await page.getByRole("button", { name: "Log out" }).click();
    await logIn(accepted);
    await expect(page.locator("#your-offers ~ ul .own-offer")).toContainText("Accepted");
  });
});
