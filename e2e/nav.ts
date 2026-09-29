import type { Page } from "@playwright/test";

/** On a phone the header's links sit behind the menu button; opens it when it is showing. */
export async function openMenu(page: Page): Promise<void> {
  const menu = page.locator(".menu-toggle");
  if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
}

/** Log out through the account menu in the header (behind the menu button on a phone). */
export async function logOut(page: Page): Promise<void> {
  await openMenu(page);
  await page.locator(".account-toggle").click();
  await page.getByRole("button", { name: "Log out" }).click();
}
