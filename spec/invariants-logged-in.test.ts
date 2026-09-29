import axe from "axe-core";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import { acceptOffer, newStudent, offerIdsOn, ownPostId, submitOffer, submitPost, withdrawPost } from "./helpers";

// spec/invariants.test.ts (a permanent, unedited check) fetches every route
// in spec/routes.ts logged OUT — so "/" there checks the login page, by
// design (0048). This file gives the board the same invariant and
// accessibility floor, fetched with a fresh student's own session cookie, to
// cover the logged-in pages spec/invariants.test.ts can't see (0013): the
// board, the new-post form, and (0020) a seeded post's own page — the first
// demo post, which a fresh test database always has as post 1. The pages that
// need a post of the student's own (its edit form, and the page of a withdrawn
// post, 0020) are fetched as that post's poster. A swapped post (0024), the
// post a swap withdrew and the accept confirm step are covered the same way.
const baseUrl = inject("baseUrl");

async function ownedPosts(): Promise<{
  open: number;
  withdrawn: number;
  openOwner: string;
  withdrawnOwner: string;
  offered: number;
  offeredOwner: string;
  offerer: string;
  closedOfferer: string;
  swapped: number;
  swappedOwner: string;
  swappedOfferer: string;
  swapWithdrawn: number;
  confirmPath: string;
}> {
  const fields = { leaving: CLASSES[0].id, join: [CLASSES[2].id], message: "Route coverage." };
  const openOwner = await newStudent("invopen");
  expect((await submitPost(openOwner, fields)).status).toBe(303);
  const withdrawnOwner = await newStudent("invgone");
  expect((await submitPost(withdrawnOwner, fields)).status).toBe(303);
  const withdrawn = await ownPostId(withdrawnOwner);
  const open = await ownPostId(openOwner);
  if (open === null || withdrawn === null) throw new Error("could not set up the posts");
  // the post page's other views (0023): a post with a pending offer (which
  // locks its edit page, so it isn't the open post above), its offerer, and an
  // offerer whose offer was closed when the withdrawn post was withdrawn
  const offeredOwner = await newStudent("invofrd");
  expect((await submitPost(offeredOwner, fields)).status).toBe(303);
  const offered = await ownPostId(offeredOwner);
  if (offered === null) throw new Error("could not set up the offered post");
  const offerer = await newStudent("invoffer");
  expect((await submitOffer(offerer, offered, { class: CLASSES[2].id })).status).toBe(303);
  const closedOfferer = await newStudent("invclosed");
  expect((await submitOffer(closedOfferer, withdrawn, { class: CLASSES[2].id })).status).toBe(303);
  expect((await withdrawPost(withdrawnOwner, withdrawn, "/")).status).toBe(303);
  // a swap (0024): the owner accepts an offer from a student with an open
  // post of their own, which the swap then withdraws
  const swappedOwner = await newStudent("invswap");
  expect((await submitPost(swappedOwner, fields)).status).toBe(303);
  const swapped = await ownPostId(swappedOwner);
  const swappedOfferer = await newStudent("invswapper");
  expect((await submitPost(swappedOfferer, { leaving: CLASSES[2].id, join: [CLASSES[0].id], message: "" })).status).toBe(303);
  const swapWithdrawn = await ownPostId(swappedOfferer);
  if (swapped === null || swapWithdrawn === null) throw new Error("could not set up the swapped posts");
  expect((await submitOffer(swappedOfferer, swapped, { class: CLASSES[2].id })).status).toBe(303);
  const [swapOffer] = await offerIdsOn(swappedOwner, swapped);
  expect((await acceptOffer(swappedOwner, swapOffer)).status).toBe(303);
  const [pendingOffer] = await offerIdsOn(offeredOwner, offered);
  return {
    open,
    withdrawn,
    openOwner,
    withdrawnOwner,
    offered,
    offeredOwner,
    offerer,
    closedOfferer,
    swapped,
    swappedOwner,
    swappedOfferer,
    swapWithdrawn,
    confirmPath: `/offers/${pendingOffer}/accept/`,
  };
}

const owned = await ownedPosts();
// a conversation (0031) with something in it: a fresh student writes to demo
// student alex, who a fresh database always has
const talker = await newStudent("invtalk");
expect(
  (
    await fetch(new URL("/messages/alex/send", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, cookie: talker },
      body: new URLSearchParams({ body: "Route coverage.\nTwo lines." }),
      redirect: "manual",
    })
  ).status,
).toBe(303);
// [route, cookie to fetch it with (a fresh student when none)]
const LOGGED_IN_ROUTES: [string, string | null][] = [
  ["/", null],
  ["/posts/new/", null],
  ["/posts/1/", null],
  [`/posts/${owned.open}/`, owned.openOwner],
  [`/posts/${owned.open}/edit/`, owned.openOwner],
  [`/posts/${owned.withdrawn}/`, owned.withdrawnOwner],
  [`/posts/${owned.offered}/`, owned.offeredOwner],
  [`/posts/${owned.offered}/`, owned.offerer],
  [`/posts/${owned.withdrawn}/`, owned.closedOfferer],
  [`/posts/${owned.swapped}/`, owned.swappedOwner],
  [`/posts/${owned.swapped}/`, owned.swappedOfferer],
  [`/posts/${owned.swapWithdrawn}/`, owned.swappedOfferer],
  [owned.confirmPath, owned.offeredOwner],
  ["/messages/alex/", null],
  ["/messages/alex/", talker],
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

  // the swapped post must really be the swapped page, and the post a swap
  // withdrew must say so
  if (route === `/posts/${owned.swapped}/`) {
    it("says the post was swapped", () => {
      expect(doc.body.textContent).toContain("Swapped:");
    });
  }
  if (route === `/posts/${owned.swapWithdrawn}/`) {
    it("says a swap withdrew the post", () => {
      expect(doc.body.textContent).toContain("This swap post was withdrawn automatically");
    });
  }
  if (route === "/messages/alex/") {
    it("is the conversation with alex, not the not-found page", () => {
      expect(doc.querySelector("h1")?.textContent).toBe("Conversation with alex");
    });
  }
  if (route === owned.confirmPath) {
    it("is the confirm step, saying accepting is final", () => {
      expect(doc.body.textContent).toContain("Accepting is final");
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
