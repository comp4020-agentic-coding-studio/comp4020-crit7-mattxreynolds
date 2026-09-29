import type { Page } from "@playwright/test";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Several elements' boxes, read in one page.evaluate. A live refetch swaps
 *  the board's or post page's nodes (src/scripts/live.ts); one evaluate is one
 *  browser task, so a swap lands before or after the read, never between two
 *  measurements (#41; scripts/e2e-geometry.test.ts keeps e2e on this).
 *  `within` narrows every selector to the first element matching its selector
 *  whose text contains `hasText`. Throws naming each selector that matches
 *  nothing, or nothing laid out. */
export async function boxes<K extends string>(
  page: Page,
  selectors: Record<K, string>,
  within?: { selector: string; hasText?: string },
): Promise<Record<K, Box>> {
  const { found, missing } = await page.evaluate(
    ({ selectors, within }) => {
      const root = within
        ? [...document.querySelectorAll(within.selector)].find((el) => !within.hasText || el.textContent?.includes(within.hasText))
        : document;
      if (!root) return { found: {}, missing: [within?.selector ?? ""] };
      const found: Record<string, { x: number; y: number; width: number; height: number }> = {};
      const missing: string[] = [];
      for (const [key, selector] of Object.entries(selectors)) {
        const el = root.querySelector(selector);
        const rect = el?.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) missing.push(selector);
        else found[key] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
      return { found, missing };
    },
    { selectors: selectors as Record<string, string>, within },
  );
  if (missing.length > 0) throw new Error(`no box for ${missing.join(", ")}`);
  return found as Record<K, Box>;
}
