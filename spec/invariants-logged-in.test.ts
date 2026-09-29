import axe from "axe-core";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import { newStudent, ownPostId, submitPost, withdrawPost } from "./helpers";

// spec/invariants.test.ts (a permanent, unedited check) fetches every route
// in spec/routes.ts logged OUT — so "/" there checks the login page, by
// design (0048). This file gives the board the same invariant and
// accessibility floor, fetched with a fresh student's own session cookie, to
// cover the logged-in pages spec/invariants.test.ts can't see (0013): the
// board, the new-post form, and (0020) a seeded post's own page — the first
// demo post, which a fresh test database always has as post 1. The pages that
// need a post of the student's own (its edit form, and the page of a withdrawn
// post, 0020) are fetched as that post's poster.
const baseUrl = inject("baseUrl");

async function ownedPosts(): Promise<{ open: number; withdrawn: number; openOwner: string; withdrawnOwner: string }> {
  const fields = { leaving: CLASSES[0].id, join: [CLASSES[2].id], message: "Route coverage." };
  const openOwner = await newStudent("invopen");
  expect((await submitPost(openOwner, fields)).status).toBe(303);
  const withdrawnOwner = await newStudent("invgone");
  expect((await submitPost(withdrawnOwner, fields)).status).toBe(303);
  const withdrawn = await ownPostId(withdrawnOwner);
  const open = await ownPostId(openOwner);
  if (open === null || withdrawn === null) throw new Error("could not set up the posts");
  expect((await withdrawPost(withdrawnOwner, withdrawn, "/")).status).toBe(303);
  return { open, withdrawn, openOwner, withdrawnOwner };
}

const owned = await ownedPosts();
// [route, cookie to fetch it with (a fresh student when none)]
const LOGGED_IN_ROUTES: [string, string | null][] = [
  ["/", null],
  ["/posts/new/", null],
  ["/posts/1/", null],
  [`/posts/${owned.open}/`, owned.openOwner],
  [`/posts/${owned.open}/edit/`, owned.openOwner],
  [`/posts/${owned.withdrawn}/`, owned.withdrawnOwner],
];

async function signUpAndGetCookie(username: string, password: string): Promise<string> {
  const res = await fetch(new URL("/api/signup", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ username, password, next: "/" }),
    redirect: "manual",
  });
  const match = res.headers.get("set-cookie")?.match(/session=([^;]+)/);
  if (!match) throw new Error("sign-up did not set a session cookie");
  return `session=${match[1]}`;
}

for (const [route, ownerCookie] of LOGGED_IN_ROUTES) describe(`invariants: ${route} (logged in)`, () => {
  let status: number;
  let dom: JSDOM;
  let doc: Document;

  beforeAll(async () => {
    const username = `invlogin${process.hrtime.bigint() % 10_000_000n}`;
    const cookie = ownerCookie ?? (await signUpAndGetCookie(username, "invariant-password1"));
    const res = await fetch(new URL(route, baseUrl), { headers: { cookie } });
    status = res.status;
    dom = new JSDOM(await res.text(), {
      url: new URL(route, baseUrl).href,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    doc = dom.window.document;
  });

  it("responds 200", () => {
    expect(status).toBe(200);
  });

  // the withdrawn page must really be the withdrawn page, not an open post
  if (route === `/posts/${owned.withdrawn}/`) {
    it("says the post was withdrawn", () => {
      expect(doc.body.textContent).toContain("This swap post was withdrawn");
    });
  }

  it("declares its language", () => {
    expect(doc.documentElement.getAttribute("lang")).toBeTruthy();
  });

  it("has a real title", () => {
    expect(doc.title.trim()).not.toBe("");
  });

  it("has a mobile viewport", () => {
    expect(doc.querySelector('meta[name="viewport"]')).toBeTruthy();
  });

  it("has a navigation landmark", () => {
    expect(doc.querySelector("nav")).toBeTruthy();
  });

  it("has exactly one top-level heading", () => {
    expect(doc.querySelectorAll("h1").length).toBe(1);
  });

  it("gives every image alt text", () => {
    for (const img of doc.querySelectorAll("img")) {
      expect(
        img.hasAttribute("alt"),
        `<img src="${img.getAttribute("src")}"> needs alt text`,
      ).toBe(true);
    }
  });

  it("has no axe violations", async () => {
    const window = dom.window as unknown as {
      eval: (source: string) => void;
      axe: typeof axe;
    };
    window.eval(axe.source);
    const results = await window.axe.run(doc, {
      rules: {
        "color-contrast": { enabled: false },
        "link-in-text-block": { enabled: false },
      },
    });
    const violations = results.violations.map(
      ({ id, help, nodes }) =>
        `${id}: ${help} (${nodes.map((node) => node.target.join(" ")).join("; ")})`,
    );
    expect(violations).toEqual([]);
  });
});
