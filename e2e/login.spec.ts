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

// Issue #17: the login page with its demo buttons (the screenshots Matt
// judges at both viewports), then one click as a named student and one as
// the random button, with nothing typed.
test("log in with one click as a demo student", async ({ page }, testInfo) => {
  await page.goto("/login/");
  for (const name of ["alex", "priya", "sam", "lena", "jordan", "mei", "noah", "Random demo student"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: screenshotPath(testInfo, "login"), fullPage: true });

  await page.getByRole("button", { name: "priya", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
  await expect(page.getByRole("main").locator("strong")).toHaveText("priya");

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Random demo student" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
});

// Issue #36: login's two cards sit side by side on a wide screen and stack on
// a phone, and signup's one card is the same width as login's first card. The
// screenshots are the ones Matt judges: "Signup looks like login".
test("login and signup share one card, and the demo students sit beside or under it", async ({ page }, testInfo) => {
  const wide = (page.viewportSize()?.width ?? 0) >= 768;
  const box = async (locator: ReturnType<typeof page.locator>) => {
    const b = await locator.boundingBox();
    if (!b) throw new Error("not laid out");
    return b;
  };

  await page.goto("/login/");
  const [formCard, demoCard] = [page.locator(".auth-card").nth(0), page.locator(".auth-card").nth(1)];
  const [form, demo] = [await box(formCard), await box(demoCard)];
  if (wide) {
    expect(demo.x, "demo students beside the form").toBeGreaterThan(form.x + form.width - 1);
    expect(Math.abs(demo.y - form.y), "cards start level").toBeLessThan(2);
  } else {
    expect(demo.y, "demo students under the form").toBeGreaterThan(form.y + form.height - 1);
    expect(Math.abs(demo.x - form.x), "cards line up").toBeLessThan(2);
  }
  const tagline = await box(page.locator(".tagline"));
  expect(tagline.y, "the line sits above the cards").toBeLessThan(form.y);

  await page.goto("/signup/");
  await expect(page.locator(".demo-students")).toHaveCount(0);
  const card = await box(page.locator(".auth-card"));
  expect(Math.abs(card.width - form.width), "signup's card is login's card").toBeLessThan(2);
  expect(Math.abs(card.x - form.x), "and starts at the same edge").toBeLessThan(2);
  await page.screenshot({ path: screenshotPath(testInfo, "signup"), fullPage: true });
});
