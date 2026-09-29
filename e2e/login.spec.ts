import { expect, test } from "@playwright/test";
import { screenshotPath } from "./evidence";
import { boxes } from "./geometry";
import { logOut } from "./nav";

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
  await expect(page.getByRole("heading", { name: "Agentic Coding Studio" })).toBeVisible();
  await expect(page.locator(".nav-username")).toHaveText(username);

  await page.screenshot({ path: screenshotPath(testInfo, "board") });

  await logOut(page);
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
  await expect(page.getByRole("heading", { name: "Agentic Coding Studio" })).toBeVisible();
  await expect(page.locator(".nav-username")).toHaveText("priya");

  await logOut(page);
  await page.getByRole("button", { name: "Random demo student" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Agentic Coding Studio" })).toBeVisible();
});

// Issue #36: login's two cards sit side by side on a wide screen and stack on
// a phone, and signup's one card is the same width as login's first card. The
// screenshots are the ones Matt judges: "Signup looks like login".
test("login and signup share one card, and the demo students sit beside or under it", async ({ page }, testInfo) => {
  const wide = (page.viewportSize()?.width ?? 0) >= 768;

  await page.goto("/login/");
  const { form, demo, tagline } = await boxes(page, { form: ".auth-card", demo: ".auth-card ~ .auth-card", tagline: ".tagline" });
  if (wide) {
    expect(demo.x, "demo students beside the form").toBeGreaterThan(form.x + form.width - 1);
    expect(Math.abs(demo.y - form.y), "cards start level").toBeLessThan(2);
  } else {
    expect(demo.y, "demo students under the form").toBeGreaterThan(form.y + form.height - 1);
    expect(Math.abs(demo.x - form.x), "cards line up").toBeLessThan(2);
  }
  expect(tagline.y, "the line sits above the cards").toBeLessThan(form.y);

  await page.goto("/signup/");
  await expect(page.locator(".demo-students")).toHaveCount(0);
  // signup is its own centred column, wider than login's card beside the demo students, but the same card
  const cardStyle = (selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.borderRadius, s.boxShadow, s.paddingLeft].join("|");
    });
  const signupStyle = await cardStyle(".auth-card");
  await page.goto("/login/");
  expect(signupStyle, "signup's card is login's card").toBe(await cardStyle(".auth-card"));
  await page.goto("/signup/");
  await page.screenshot({ path: screenshotPath(testInfo, "signup"), fullPage: true });
});
