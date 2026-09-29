import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { CLASSES, classLabel } from "../src/lib/classes";
import {
  acceptOffer,
  baseUrl,
  exchangeOf,
  newStudent,
  offerIdsOn,
  ownPostId,
  page,
  submitOffer,
  submitPost,
  text,
  usernameOf,
  withdrawPost,
} from "./helpers";

// The post page as a split with the exchange row (issue #37, decisions 0057,
// 0058, 0020, 0024, 0044), read from the HTML the built server serves. Geometry
// (the actions beside the comments, the stack at 390px, the buttons wrapping)
// is Playwright's, in e2e/offers.spec.ts; here is what the markup promises: the
// header's order, the attention marker, one compact row per pending offer, and
// a refetch fragment without the comment box. Signing up hashes a password, so
// the file shares its students: `open` never gets an offer, `busy` gathers them
// as the describes below run in order, and is withdrawn last.
const [MON_14, , WED_9, WED_1030, WED_14] = CLASSES.map((c) => c.id);
const label = (id: string) => classLabel(CLASSES.find((c) => c.id === id) as (typeof CLASSES)[number]);
const MESSAGE = "Clashes with my lab, happy to go either Wednesday morning.";

interface Poster {
  cookie: string;
  id: number;
  username: string;
  path: string;
}

/** A student with an open post: leaving Mon 14:00, joining three Wednesday classes. */
async function poster(prefix = "lookpost"): Promise<Poster> {
  const cookie = await newStudent(prefix);
  expect((await submitPost(cookie, { leaving: MON_14, join: [WED_9, WED_1030, WED_14], message: MESSAGE })).status).toBe(303);
  const id = await ownPostId(cookie);
  if (id === null) throw new Error("no post");
  return { cookie, id, username: await usernameOf(cookie), path: `/posts/${id}/` };
}

const offer = (from: string, p: Poster, cls = WED_9) => submitOffer(from, p.id, { class: cls, next: p.path });
const header = (doc: Document) => doc.querySelector("#post-live .post-header");
/** Whether `a` comes before `b` in the document. */
const before = (a: Element | null | undefined, b: Element | null | undefined) => Boolean(a && b && a.compareDocumentPosition(b) & 4);

let open: Poster;
let busy: Poster;
let bystander: string;
let offerer: string;
let second: string;

beforeAll(async () => {
  open = await poster();
  busy = await poster("lookbusy");
  bystander = await newStudent("lookby");
  offerer = await newStudent("lookoff");
  second = await newStudent("looktwo");
});

describe("the header (0057)", () => {
  it("keeps the heading, then opens with the exchange row: GIVING the leaving class, LOOKING FOR every join class in order", async () => {
    for (const cookie of [open.cookie, bystander]) {
      const doc = await page(open.path, cookie);
      expect(text(doc.querySelector("main h1"))).toBe(`Swap post by ${open.username}`);
      const head = header(doc);
      expect(head).toBeTruthy();
      expect(head?.firstElementChild?.matches(".exchange.large")).toBe(true);
      expect(exchangeOf(head)).toEqual({
        giving: [label(MON_14)],
        lookingFor: [label(WED_9), label(WED_1030), label(WED_14)],
        givingFirst: true,
      });
      expect(text(head?.querySelector(".giving .exchange-label")).toUpperCase()).toBe("GIVING");
      expect(text(head?.querySelector(".looking-for .exchange-label")).toUpperCase()).toBe("LOOKING FOR");
    }
  });

  it("follows it with the status, the message whole, the times and the count, all before the comments", async () => {
    const doc = await page(open.path, bystander);
    const head = header(doc);
    const parts = [".exchange", ".post-status", ".message", ".post-facts time", ".offer-count"].map((sel) => head?.querySelector(sel));
    expect(parts.every(Boolean)).toBe(true);
    for (let i = 1; i < parts.length; i++) expect(before(parts[i - 1], parts[i]), `part ${i}`).toBe(true);
    expect(text(head?.querySelector(".message"))).toBe(MESSAGE);
    expect(text(head?.querySelector(".post-status"))).toBe("Open");
    expect(text(head?.querySelector(".offer-count"))).toBe("0 pending offers");
    expect(before(head, doc.querySelector("#comments"))).toBe(true);
  });

  it("no longer has the Poster / Leaving / Would join list, and has no hidden copy of it", async () => {
    const doc = await page(open.path, bystander);
    expect(text(doc.querySelector("main"))).not.toMatch(/Leaving:?\s|Would join|\bPoster\b(?!\s*tag)/);
    expect([...doc.querySelectorAll("dt")].map((dt) => text(dt))).toEqual(["Posted"]);
    expect(doc.querySelector("[hidden], .visually-hidden, [aria-hidden=true]:not(.exchange-arrow)")).toBeNull();
  });

  it("puts the poster's Message link in the header for another student, and none for the poster", async () => {
    expect(header(await page(open.path, bystander))?.querySelector(`a.message-link[href="/messages/${open.username}/"]`)).toBeTruthy();
    expect(header(await page(open.path, open.cookie))?.querySelector("a.message-link")).toBeNull();
  });

  it("shows the Edited time after an edit and only then", async () => {
    const p = await poster("lookedit");
    expect(header(await page(p.path, p.cookie))?.querySelector(".edited")).toBeNull();
    const res = await fetch(new URL(`/posts/${p.id}/edit/`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, cookie: p.cookie },
      body: new URLSearchParams({ leaving: MON_14, message: "Changed.", join: WED_9 }),
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(header(await page(p.path, p.cookie))?.querySelector(".edited time")).toBeTruthy();
  });
});

describe("the split (0057)", () => {
  it("runs header, side column, comments, then the comment box, inside the one grid", async () => {
    const doc = await page(open.path, offerer);
    const grid = doc.querySelector("main .post-split");
    const parts = [".post-header", ".side-column", ".comments", "form.comment-form"].map((sel) => grid?.querySelector(sel));
    expect(parts.every(Boolean), "every part is in the grid").toBe(true);
    for (let i = 1; i < parts.length; i++) expect(before(parts[i - 1], parts[i]), `part ${i}`).toBe(true);
    expect(grid?.querySelector(":scope > #post-live")).toBeTruthy();
    expect(grid?.querySelector(":scope > form.comment-form")).toBeTruthy();
  });

  it("holds the offer form, Your offer, the offers and Edit / Withdraw in the side column, and never the comments", async () => {
    const side = (doc: Document) => doc.querySelector(".side-column");
    expect(side(await page(open.path, offerer))?.querySelector('form[action$="/offers"] button.primary')).toBeTruthy();
    expect(side(await page(open.path, open.cookie))?.querySelector('a[href$="/edit/"]')).toBeTruthy();
    expect(side(await page(open.path, open.cookie))?.querySelector('form[action$="/withdraw"]')).toBeTruthy();
    for (const cookie of [offerer, open.cookie]) expect(side(await page(open.path, cookie))?.querySelector(".comments, #comments")).toBeNull();
  });
});

describe("the attention marker on the post page (0058)", () => {
  it("is on the poster's count, Offers heading and list at 1 or more pending offers, and on nothing else", async () => {
    const own = async () => page(busy.path, busy.cookie);
    // at 0: the count is there and neutral, and no Offers list
    let doc = await own();
    expect(text(doc.querySelector(".offer-count"))).toBe("0 pending offers");
    expect(doc.querySelector("main [data-attention]")).toBeNull();
    expect(doc.querySelector("#offers")).toBeNull();

    expect((await offer(offerer, busy)).status).toBe(303);
    doc = await own();
    expect(text(doc.querySelector(".offer-count"))).toBe("1 pending offer");
    expect(doc.querySelector(".offer-count")?.hasAttribute("data-attention")).toBe(true);
    expect(text(doc.querySelector("h2#offers"))).toBe("Offers");
    expect(doc.querySelector("h2#offers")?.hasAttribute("data-attention")).toBe(true);
    expect(doc.querySelector("ul.offers")?.hasAttribute("data-attention")).toBe(true);
    expect([...doc.querySelectorAll("main [data-attention]")].map((el) => el.tagName)).toEqual(["P", "H2", "UL"]);
  });

  it("is never on the offerer's page, not on Your offer, and never on anyone else's count", async () => {
    for (const cookie of [offerer, bystander]) {
      const doc = await page(busy.path, cookie);
      expect(text(doc.querySelector(".offer-count"))).toBe("1 pending offer");
      expect(doc.querySelector("main [data-attention]")).toBeNull();
    }
    const mine = await page(busy.path, offerer);
    expect(text(mine.querySelector("#your-offer"))).toBe("Your offer");
    expect(mine.querySelector(".own-offer")?.closest("[data-attention]")).toBeNull();
  });
});

describe("a pending offer's row (0057)", () => {
  it("is one row holding the offerer, the Message link, would leave <class>, Accept and Decline", async () => {
    expect((await offer(second, busy, WED_14)).status).toBe(303);
    const doc = await page(busy.path, busy.cookie);
    const rows = [...doc.querySelectorAll("ul.offers > li")];
    expect(rows).toHaveLength(2);
    expect(await offerIdsOn(busy.cookie, busy.id)).toHaveLength(2);
    const names = [await usernameOf(offerer), await usernameOf(second)];
    const classes = [WED_9, WED_14].map(label);
    rows.forEach((row, i) => {
      expect(text(row.querySelector(".offer-text")), `row ${i}`).toBe(`${names[i]} would leave ${classes[i]}`);
      expect(row.querySelector(`a.message-link[href="/messages/${names[i]}/"]`), `row ${i} message`).toBeTruthy();
      expect(text(row.querySelector("a.button.primary")), `row ${i} accept`).toBe("Accept");
      expect(row.querySelector("a.button.primary")?.getAttribute("href")).toMatch(/^\/offers\/\d+\/accept\/$/);
      expect(text(row.querySelector('form[action$="/decline"] button.button.secondary')), `row ${i} decline`).toBe("Decline");
      // one row: the offerer's line and the buttons are children of the same li, nothing else is
      expect(row.querySelector(".offer-who")?.contains(row.querySelector(".offer-text"))).toBe(true);
      expect(row.querySelectorAll("a.button, button")).toHaveLength(2);
    });
  });
});

describe("the refetch fragment (0044)", () => {
  it("holds the header, side column and thread, and not the comment box", async () => {
    for (const cookie of [busy.cookie, offerer]) {
      const res = await fetch(new URL(`/fragments/posts/${busy.id}/`, baseUrl), { headers: { cookie } });
      expect(res.status).toBe(200);
      const html = await res.text();
      const doc = new JSDOM(`<body>${html}</body>`).window.document;
      expect(doc.querySelector(".post-header .exchange.large")).toBeTruthy();
      expect(doc.querySelector(".side-column")).toBeTruthy();
      expect(doc.querySelector("#comments")).toBeTruthy();
      expect(doc.querySelector('form[action$="/comments"], #comment-body, textarea, .comment-form')).toBeNull();
      expect(html).not.toContain("Add a comment");
    }
  });

  it("sits the comment box outside #post-live on the page", async () => {
    const doc = await page(open.path, offerer);
    const box = doc.querySelector('form[action$="/comments"]');
    expect(box).toBeTruthy();
    expect(doc.querySelector("#post-live")?.contains(box)).toBe(false);
  });
});

describe("withdrawn and swapped posts (0020, 0024)", () => {
  it("load read-only, the status in the header, with the exchange row and no actions", async () => {
    // busy still has two pending offers: withdrawing closes them and clears the attention
    const withdrawn = busy;
    expect((await withdrawPost(withdrawn.cookie, withdrawn.id, withdrawn.path)).status).toBe(303);

    const swapped = await poster("lookswap");
    expect((await offer(second, swapped)).status).toBe(303);
    const [offerId] = await offerIdsOn(swapped.cookie, swapped.id);
    expect((await acceptOffer(swapped.cookie, offerId)).status).toBe(303);

    for (const [p, status, sentence] of [
      [withdrawn, "Withdrawn", "This swap post was withdrawn"],
      [swapped, "Swapped", "Swapped:"],
    ] as const) {
      for (const cookie of [p.cookie, bystander]) {
        const res = await fetch(new URL(p.path, baseUrl), { headers: { cookie } });
        expect(res.status, p.path).toBe(200);
        const doc = new JSDOM(await res.text()).window.document;
        const head = header(doc);
        expect(exchangeOf(head)?.giving, status).toEqual([label(MON_14)]);
        expect(text(head?.querySelector(".post-status")), status).toBe(status);
        expect(text(head), status).toContain(sentence);
        expect(head?.querySelector(".offer-count"), status).toBeNull();
        // the read-only page: no side column, no comment box, no controls
        expect(doc.querySelector(".side-column"), status).toBeNull();
        expect(doc.querySelector("form.comment-form"), status).toBeNull();
        expect(doc.querySelector("main [data-attention]"), status).toBeNull();
        expect(doc.querySelectorAll("main .post-split form, main .post-split a.button"), status).toHaveLength(0);
      }
    }
  });
});
