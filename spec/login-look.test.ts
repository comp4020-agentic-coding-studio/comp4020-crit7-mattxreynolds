import { describe, expect, it } from "vitest";
import { DEMO_LOGIN_NOTICE } from "../src/lib/notice";
import { DEMO_USERNAMES } from "../src/lib/seed";
import { newStudent, page, text } from "./helpers";

// Login and signup after the redesign (issue #36, decisions 0014, 0015, 0048,
// 0053, 0055, 0058), read from the HTML the built server serves. Layout
// (sideways scroll at 390px) is Playwright's, in e2e/shell.spec.ts; here is
// what the markup promises: the one plain line, the neutral "N offers to
// answer" line, and signup wearing login's panel without the demo students.
const LINE = "Post the class you're leaving, see who'd swap, and agree it together.";

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("the one plain line (0053)", () => {
  it.each(["/", "/login/"])("%s, logged out, shows it exactly once, under the wordmark and outside the header", async (path) => {
    const doc = await page(path);
    expect(occurrences(text(doc.body), LINE)).toBe(1);
    const tagline = doc.querySelector("main .tagline");
    expect(text(tagline)).toBe(LINE);
    expect(doc.querySelectorAll(".tagline")).toHaveLength(1);
    expect(doc.querySelector("header")?.textContent).not.toContain(LINE);
  });

  it("is the only tagline and there is no hero, on login or signup", async () => {
    for (const path of ["/", "/login/", "/signup/"]) {
      const doc = await page(path);
      // the page is its heading, at most the one line, and the cards: nothing else can be a hero
      const kids = [...(doc.querySelector("main .auth-page")?.children ?? [])].map((el) => (el.matches(".auth-heading, h1, .tagline, .auth-card") ? el.tagName : `unexpected ${el.tagName}`));
      expect(kids.filter((k) => k.startsWith("unexpected")), path).toEqual([]);
      expect(doc.querySelector("main")?.children, path).toHaveLength(1);
      expect(doc.querySelector("main img, main picture, main svg, [class*='hero']"), path).toBeNull();
      expect(doc.querySelectorAll(".tagline").length, path).toBe(path === "/signup/" ? 0 : 1);
    }
  });

  it("is not on signup, and not on the board a student reaches after logging in", async () => {
    expect(text((await page("/signup/")).body)).not.toContain(LINE);
    expect(text((await page("/", await newStudent("lookline"))).body)).not.toContain(LINE);
  });
});

describe('the "N offers to answer" line (0058)', () => {
  it("is neutral on /login/ and on logged-out /: no attention marker on it, inside it or around it", async () => {
    for (const path of ["/login/", "/"]) {
      const doc = await page(path);
      const lines = [...doc.querySelectorAll(".demo-line")].filter((el) => /offers? to answer/.test(text(el)));
      expect(lines.length, `${path} has an "offers to answer" line`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.closest("[data-attention]"), text(line)).toBeNull();
        expect(line.querySelector("[data-attention]"), text(line)).toBeNull();
      }
      expect(doc.querySelector("main [data-attention]"), path).toBeNull();
    }
  });
});

describe("signup takes login's panel and heading style (0055)", () => {
  it("wears the same page and card hooks as login, with its heading inside", async () => {
    for (const path of ["/login/", "/signup/"]) {
      const doc = await page(path);
      const card = doc.querySelector("main .auth-page .auth-card");
      expect(card, path).toBeTruthy();
      expect(doc.querySelector("main .auth-page h1"), path).toBeTruthy();
      expect(card?.querySelector("form input[name=username]"), path).toBeTruthy();
      expect(card?.querySelector("form input[name=password]"), path).toBeTruthy();
      expect(card?.querySelector("button.primary"), path).toBeTruthy();
    }
  });

  it("keeps the 0015 notice and shows no demo-student list", async () => {
    const doc = await page("/signup/");
    expect(text(doc.querySelector("main"))).toContain(DEMO_LOGIN_NOTICE);
    expect(doc.querySelector(".demo-students")).toBeNull();
    expect(doc.querySelector(".demo-line")).toBeNull();
    expect(doc.querySelector("form[action='/login/demo']")).toBeNull();
    // the notice says "demo students" in passing (0015): what must be absent is
    // the login page's list, its heading and its one-click blurb
    expect([...doc.querySelectorAll("main h2")].map((h) => text(h))).not.toContain("Demo students");
    expect(text(doc.querySelector("main"))).not.toContain("One click, no typing");
    expect([...doc.querySelectorAll("main button")].map((b) => text(b))).not.toContain("Random demo student");
    for (const name of DEMO_USERNAMES) {
      expect([...doc.querySelectorAll("main button")].map((b) => text(b)), name).not.toContain(name);
    }
  });

  it("the login page keeps its demo students beside the form, and the notice stays off it", async () => {
    const doc = await page("/login/");
    expect(doc.querySelectorAll(".demo-students li").length).toBe(DEMO_USERNAMES.length + 1);
    expect(text(doc.querySelector("main"))).not.toContain(DEMO_LOGIN_NOTICE);
  });
});
