import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { CLASSES, classLabel } from "../src/lib/classes";
import { baseUrl, demoCookie, exchangeOf, newStudent, ownPostId, page, submitOffer, submitPost, text, usernameOf } from "./helpers";

// The board as a split with the exchange row (issue #35, decisions 0047, 0054,
// 0057, 0058), read from the HTML the built server serves. Geometry (side by
// side, stacked) is Playwright's, in e2e/board.spec.ts; here is what the
// markup promises: the exchange row's order, the attention marker on the own
// post's count, and one fragment holding both columns. Signing up hashes a
// password, so the file shares three students instead of making one a test.
const [MON_14, , WED_9, WED_1030, WED_14] = CLASSES.map((c) => c.id);
const label = (id: string) => classLabel(CLASSES.find((c) => c.id === id) as (typeof CLASSES)[number]);
const LONG = "y".repeat(200);

let owner: { cookie: string; id: number; username: string };
let viewer: string;
let offerer: string;
let offered = false;

beforeAll(async () => {
  const cookie = await newStudent("look");
  expect((await submitPost(cookie, { leaving: MON_14, join: [WED_9, WED_1030, WED_14], message: LONG })).status).toBe(303);
  const id = await ownPostId(cookie);
  if (id === null) throw new Error("no post");
  owner = { cookie, id, username: await usernameOf(cookie) };
  viewer = await newStudent("lookviewer");
  offerer = await newStudent("lookoffer");
});

/** The offerer makes one offer on the owner's post, once. */
async function makeOffer() {
  if (offered) return;
  expect((await submitOffer(offerer, owner.id, { class: WED_9 })).status).toBe(303);
  offered = true;
}

const entries = (doc: Document) => [...doc.querySelectorAll(".post")];
const entryOf = (doc: Document, username: string) => entries(doc).find((el) => text(el.querySelector("h3")) === username);

describe("the exchange row", () => {
  it("opens every entry, own and others: GIVING the leaving class, then LOOKING FOR every join class in order", async () => {
    for (const [cookie, section] of [
      [owner.cookie, "your-post"],
      [viewer, "open-posts"],
    ] as const) {
      const doc = await page("/", cookie);
      const entry = [...doc.querySelectorAll(`#${section} ~ .post`)].find((el) => text(el.querySelector("h3")) === owner.username);
      expect(entry, section).toBeTruthy();
      expect(exchangeOf(entry)).toEqual({
        giving: [label(MON_14)],
        lookingFor: [label(WED_9), label(WED_1030), label(WED_14)],
        givingFirst: true,
      });
    }
    // and every other post on the board, the seeded ones included
    const all = entries(await page("/", await demoCookie("noah")));
    expect(all.length).toBeGreaterThan(1);
    for (const el of all) {
      const row = exchangeOf(el);
      expect(row, text(el.querySelector("h3"))).not.toBeNull();
      expect(row?.giving).toHaveLength(1);
      expect(row?.lookingFor.length).toBeGreaterThanOrEqual(1);
      expect(row?.givingFirst).toBe(true);
    }
  });

  it("is the first thing after the poster's name, worded GIVING and LOOKING FOR, with no old prefixes", async () => {
    const entry = entryOf(await page("/", viewer), owner.username);
    const row = entry?.querySelector(".exchange");
    expect(entry?.querySelector("h3")?.nextElementSibling).toBe(row);
    expect(text(row?.querySelector(".giving .exchange-label")).toUpperCase()).toBe("GIVING");
    expect(text(row?.querySelector(".looking-for .exchange-label")).toUpperCase()).toBe("LOOKING FOR");
    expect(text(entry)).not.toMatch(/Leaving:|Would join:/);
  });

  it("still leaves the rest of the entry as 0047 lists it", async () => {
    const entry = entryOf(await page("/", viewer), owner.username);
    expect(text(entry?.querySelector(".message"))).toBe(`${"y".repeat(120)}…`);
    expect(text(entry?.querySelector(".meta time"))).not.toBe("");
    expect(entry?.querySelector('a[href^="/posts/"]')).not.toBeNull();
    expect(text(entry?.querySelector(".comment-count"))).toBe("0 comments");
    expect(text(entry?.querySelector(".offer-count"))).toMatch(/^\d+ pending offers?$/);
  });
});

describe("the attention marker on a pending-offer count (0058)", () => {
  it("is on the own post's count at 1 or more pending offers and not at 0", async () => {
    const own = async () => entryOf(await page("/", owner.cookie), owner.username)?.querySelector(".offer-count");
    expect(text(await own())).toBe("0 pending offers");
    expect((await own())?.hasAttribute("data-attention")).toBe(false);

    await makeOffer();
    expect(text(await own())).toBe("1 pending offer");
    expect((await own())?.hasAttribute("data-attention")).toBe(true);
  });

  it("is never on anyone else's count, even with pending offers", async () => {
    await makeOffer();
    for (const cookie of [offerer, viewer]) {
      const count = entryOf(await page("/", cookie), owner.username)?.querySelector(".offer-count");
      expect(text(count)).toBe("1 pending offer");
      expect(count?.hasAttribute("data-attention")).toBe(false);
    }
    // the seeded board has pending offers on other people's posts too
    const others = [...(await page("/", await demoCookie("noah"))).querySelectorAll("#open-posts ~ .post .offer-count")];
    expect(others.some((c) => !text(c).startsWith("0 "))).toBe(true);
    for (const count of others) expect(count.hasAttribute("data-attention")).toBe(false);
  });

  it("marks nothing else on the board", async () => {
    await makeOffer();
    const marked = [...(await page("/", owner.cookie)).querySelectorAll("main [data-attention]")];
    expect(marked.map((el) => el.className)).toEqual(["offer-count"]);
  });
});

describe("the split (0054)", () => {
  it("puts Your post and Your offers in the side column, then Open posts in the main column", async () => {
    await makeOffer();
    const doc = await page("/", offerer);
    const board = doc.querySelector("#board-live .board-split");
    const side = board?.querySelector(":scope > .side-column");
    const main = board?.querySelector(":scope > .main-column");
    expect(side && main).toBeTruthy();
    // the side column comes first: beside on a wide screen, above when stacked
    expect((side as Element).compareDocumentPosition(main as Element) & 4).toBeTruthy();
    expect([...(side as Element).querySelectorAll("h2")].map((h) => h.id)).toEqual(["your-post", "your-offers"]);
    expect([...(main as Element).querySelectorAll("h2")].map((h) => h.id)).toEqual(["open-posts"]);
  });

  it("has no hero: the heading is the board's first content", async () => {
    const doc = await page("/", viewer);
    expect(doc.querySelector(".hero")).toBeNull();
    expect(doc.querySelector("main h1")?.textContent).toBe("Board");
  });
});

describe("the board refetch (0042)", () => {
  it("returns one fragment holding Your post, Your offers and Open posts", async () => {
    await makeOffer();
    const res = await fetch(new URL("/fragments/board/", baseUrl), { headers: { cookie: offerer } });
    const doc = new JSDOM(`<body>${await res.text()}</body>`).window.document;
    expect(doc.body.querySelectorAll(":scope > .board-split")).toHaveLength(1);
    expect([...doc.body.querySelectorAll("h2")].map((h) => h.id)).toEqual(["your-post", "your-offers", "open-posts"]);
    expect(doc.body.querySelector(".board-split > .side-column #your-post")).not.toBeNull();
    expect(doc.body.querySelector(".board-split > .main-column #open-posts")).not.toBeNull();
    expect(exchangeOf(entryOf(doc, owner.username))).not.toBeNull();
  });
});
