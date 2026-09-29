import { expect, test } from "@playwright/test";
import { screenshotPath } from "./evidence";
import { boxes } from "./geometry";

// Issue #18: post a swap from the board, land back on it with the notice,
// reload and still see it — at both viewports, for the handoff screenshots.
test("post a swap, reload the board, and it is still there", async ({ page }, testInfo) => {
  const username = `swapper${testInfo.project.name[0]}${Date.now() % 100000}`;
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

// Issue #19: edit a post from "Your post" (the leaving class still never
// offered as a join class), land back on the board with "Changes saved", then
// withdraw it and see the withdrawn page — at both viewports.
test("edit a swap post, then withdraw it", async ({ page }, testInfo) => {
  const username = `editor${testInfo.project.name[0]}${Date.now() % 100000}`;
  await page.goto("/signup/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
  await page.getByRole("group", { name: "Classes you would join" }).getByRole("checkbox", { name: "Wed 09:00–10:30" }).check();
  await page.getByLabel(/Message/).fill("Clashes with my lab.");
  await page.getByRole("button", { name: "Post swap" }).click();
  await expect(page.locator("#your-post ~ .post")).not.toContainText("Edited");

  await page.locator("#your-post ~ .post").getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/posts\/\d+\/edit\/$/);
  await expect(page.getByRole("radio", { name: "Mon 14:00–15:30" })).toBeChecked();
  await expect(page.getByLabel(/Message/)).toHaveValue("Clashes with my lab.");
  const join = page.getByRole("group", { name: "Classes you would join" });
  await expect(join.getByRole("checkbox", { name: "Mon 14:00–15:30" })).toHaveCount(0);
  await join.getByRole("checkbox", { name: "Wed 10:30–12:00" }).check();
  await page.getByLabel(/Message/).fill("Now it is my exam.");
  await page.screenshot({ path: screenshotPath(testInfo, "edit-form"), fullPage: true });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status")).toHaveText("Changes saved");
  const mine = page.locator("#your-post ~ .post");
  await expect(mine).toContainText("Now it is my exam.");
  await expect(mine).toContainText("Edited");
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);

  await mine.getByRole("link", { name: "View post" }).click();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw" }).click();
  // withdrawing from the post page returns to the post page
  await expect(page).toHaveURL(/\/posts\/\d+\/$/);
  await expect(page.getByText("This swap post was withdrawn on")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
  await page.screenshot({ path: screenshotPath(testInfo, "withdrawn"), fullPage: true });

  await page.getByRole("link", { name: "Back to the board" }).click();
  await expect(page.locator("#your-post ~ .post")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Post a swap" })).toBeVisible();
});

// Issue #35 (0054): the board is a split. Side by side at 1920×1080 (Your
// post and Your offers beside Open posts), stacked in that order at 390×844,
// and never sideways-scrolling. Layout only exists in a real browser.
test("the board is a split on a wide screen and stacks on a phone", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name[0]}${Date.now() % 100000}`;
  const owner = `splitowner${suffix}`;
  const viewer = `splitviewer${suffix}`;
  const signUp = async (username: string) => {
    await page.goto("/signup/");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("e2e-password-1");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL("/");
  };

  await signUp(owner);
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: "Mon 14:00–15:30" }).check();
  const join = page.getByRole("group", { name: "Classes you would join" });
  await join.getByRole("checkbox", { name: "Wed 09:00–10:30" }).check();
  await join.getByRole("checkbox", { name: "Wed 10:30–12:00" }).check();
  await page.getByRole("button", { name: "Post swap" }).click();
  const ownerPost = (await page.locator("#your-post ~ .post").getByRole("link", { name: "View post" }).getAttribute("href")) ?? "";
  await page.getByRole("button", { name: "Log out" }).click();

  // the viewer has a post of their own and one offer made: every section shows
  await signUp(viewer);
  await page.getByRole("link", { name: "Post a swap" }).click();
  await page.getByRole("radio", { name: "Wed 14:00–15:30" }).check();
  await page.getByRole("group", { name: "Classes you would join" }).getByRole("checkbox", { name: "Mon 14:00–15:30" }).check();
  await page.getByLabel(/Message/).fill("Happy to swap for Monday.");
  await page.getByRole("button", { name: "Post swap" }).click();
  await page.goto(ownerPost);
  await page.getByRole("radio", { name: "Wed 09:00–10:30" }).check();
  await page.getByRole("button", { name: "Offer to swap" }).click();
  await page.goto("/");

  // a live refetch can swap the board's nodes at any moment: boxes() reads them
  // all in one go, and toPass waits out the page settling
  await expect(async () => {
    const { yourPost, yourPostEntry, yourOffers, openPosts, side, main } = await boxes(page, {
      yourPost: "#your-post",
      yourPostEntry: "#your-post ~ .post",
      yourOffers: "#your-offers",
      openPosts: "#open-posts",
      side: ".board-split > .side-column",
      main: ".board-split > .main-column",
    });

    if (testInfo.project.name === "desktop") {
      // beside: the side column ends before the main column starts, and both start at the top
      expect(side.x + side.width).toBeLessThanOrEqual(main.x);
      expect(Math.abs(yourPost.y - openPosts.y)).toBeLessThanOrEqual(4);
      // and the side column's own sections stack in order
      expect(yourOffers.y).toBeGreaterThan(yourPostEntry.y);
    } else {
      // stacked: Your post, Your offers, then Open posts, each below the last
      expect(yourOffers.y).toBeGreaterThan(yourPostEntry.y + yourPostEntry.height - 1);
      expect(openPosts.y).toBeGreaterThan(yourOffers.y);
      expect(main.y).toBeGreaterThanOrEqual(side.y + side.height - 1);
    }
  }).toPass();
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);

  // the exchange row opens every entry, GIVING before LOOKING FOR
  const row = page.locator("#open-posts ~ .post").filter({ hasText: owner }).locator(".exchange");
  await expect(row.locator(".giving")).toContainText("Mon 14:00–15:30");
  await expect(row.locator(".looking-for")).toContainText("Wed 09:00–10:30, Wed 10:30–12:00");
  const { g, l } = await boxes(page, { g: ".exchange .giving", l: ".exchange .looking-for" }, { selector: "#open-posts ~ .post", hasText: owner });
  expect(g.x < l.x || g.y < l.y).toBe(true);

  await page.screenshot({ path: screenshotPath(testInfo, "board-split"), fullPage: true });
});
