import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { CLASSES, classLabel } from "../src/lib/classes";
import {
  demoCookie,
  newStudent,
  ownOfferId,
  ownPostId,
  page,
  submitEdit,
  submitOffer,
  submitPost,
  text,
  usernameOf,
  withdrawOffer,
  withdrawPost,
} from "./helpers";
import { spawnServer } from "./spawn-server";

// Making and withdrawing an offer (issue #20, decisions 0022, 0023, 0025,
// 0045). Every rule is server-enforced and every view is read from the HTML
// the built server returns.
const [MON_14, MON_1530, WED_9, WED_1030, WED_14, WED_1530] = CLASSES.map((c) => c.id);
const OK = { leaving: MON_14, join: [WED_9, WED_1030], message: "Clashes with my lab." };

async function poster(fields = OK) {
  const cookie = await newStudent("poster");
  expect((await submitPost(cookie, fields)).status).toBe(303);
  const id = await ownPostId(cookie);
  if (id === null) throw new Error("the post did not appear");
  return { cookie, id, username: await usernameOf(cookie) };
}

async function offerer(prefix = "offerer") {
  const cookie = await newStudent(prefix);
  return { cookie, username: await usernameOf(cookie) };
}

/** A poster with an open post and an offerer who has a pending offer on it. */
async function offered() {
  const p = await poster();
  const o = await offerer();
  const res = await submitOffer(o.cookie, p.id, { class: WED_9, next: `/posts/${p.id}/` });
  expect(res.status).toBe(303);
  const offerId = await ownOfferId(o.cookie, p.id);
  if (offerId === null) throw new Error("the offer did not appear");
  return { p, o, offerId };
}

const main = async (path: string, cookie: string) => text((await page(path, cookie)).querySelector("main"));

describe("making an offer", () => {
  it("is still there after a reload, shown with Pending", async () => {
    const p = await poster();
    const o = await offerer();
    const res = await submitOffer(o.cookie, p.id, { class: WED_9, next: `/posts/${p.id}/` });
    expect(res.status).toBe(303);

    const doc = await page(`/posts/${p.id}/`, o.cookie);
    const mine = doc.querySelector(".own-offer");
    expect(text(mine)).toContain("Pending");
    expect(text(mine)).toContain(classLabel(CLASSES[2]));
    // it can be taken back from here, and no second offer is invited
    expect(mine?.querySelector('form[action^="/offers/"] button')?.textContent?.trim()).toBe("Withdraw");
    expect(doc.querySelector('form[action$="/offers"]')).toBeNull();
  });

  it("is offered from the post page with the post's join classes, and none else", async () => {
    const p = await poster();
    const o = await offerer();
    const doc = await page(`/posts/${p.id}/`, o.cookie);
    const form = doc.querySelector(`form[action="/posts/${p.id}/offers"]`);
    expect(form?.querySelector("button")?.textContent?.trim()).toBe("Offer to swap");
    const options = [...(form?.querySelectorAll('input[name="class"]') ?? [])] as HTMLInputElement[];
    expect(options.map((el) => el.value).sort()).toEqual([WED_9, WED_1030].sort());
    // two join classes: nothing is guessed for the student
    expect(options.some((el) => el.checked)).toBe(false);
  });

  it("pre-selects the offered class when the post has only one join class", async () => {
    const p = await poster({ leaving: MON_14, join: [WED_14], message: "" });
    const o = await offerer();
    const doc = await page(`/posts/${p.id}/`, o.cookie);
    const options = [...doc.querySelectorAll(`form[action="/posts/${p.id}/offers"] input[name="class"]`)] as HTMLInputElement[];
    expect(options.map((el) => [el.value, el.checked])).toEqual([[WED_14, true]]);
  });

  it("is not offered to the poster on their own post", async () => {
    const p = await poster();
    const doc = await page(`/posts/${p.id}/`, p.cookie);
    expect(doc.querySelector('form[action$="/offers"]')).toBeNull();
    expect(text(doc.querySelector("main"))).not.toContain("Offer to swap");
  });

  it("returns with a 303 to the page it came from, and to the board when that isn't a path here", async () => {
    const p = await poster();
    const a = await offerer();
    const b = await offerer();
    const c = await offerer();
    const back = await submitOffer(a.cookie, p.id, { class: WED_9, next: `/posts/${p.id}/` });
    expect([back.status, back.headers.get("location")]).toEqual([303, `/posts/${p.id}/`]);
    const board = await submitOffer(b.cookie, p.id, { class: WED_9, next: "/" });
    expect([board.status, board.headers.get("location")]).toEqual([303, "/"]);
    const evil = await submitOffer(c.cookie, p.id, { class: WED_9, next: "https://evil.example.com/" });
    expect([evil.status, evil.headers.get("location")]).toEqual([303, "/"]);
  });
});

describe("the server refuses an offer", () => {
  const count = async (postId: number, cookie: string) =>
    Number(text((await page(`/posts/${postId}/`, cookie)).querySelector(".offer-count")).match(/^\d+/)?.[0]);

  it("on your own post", async () => {
    const p = await poster();
    const res = await submitOffer(p.cookie, p.id, { class: WED_9 });
    expect(res.status).toBe(403);
    expect(await count(p.id, p.cookie)).toBe(0);
  });

  it("on a post that isn't open", async () => {
    const p = await poster();
    const o = await offerer();
    expect((await withdrawPost(p.cookie, p.id, "/")).status).toBe(303);
    const res = await submitOffer(o.cookie, p.id, { class: WED_9 });
    expect(res.status).toBe(409);
    expect(text((await page(`/posts/${p.id}/`, o.cookie)).querySelector(".own-offer"))).toBe("");
  });

  it("from a class that is not one of its join classes, or with no class", async () => {
    const p = await poster();
    const o = await offerer();
    expect((await submitOffer(o.cookie, p.id, { class: MON_14 })).status).toBe(400);
    expect((await submitOffer(o.cookie, p.id, { class: WED_14 })).status).toBe(400);
    expect((await submitOffer(o.cookie, p.id, { class: "no-such-class" })).status).toBe(400);
    expect((await submitOffer(o.cookie, p.id, {})).status).toBe(400);
    expect(await count(p.id, p.cookie)).toBe(0);
  });

  it("a second pending offer on the same post", async () => {
    const { p, o } = await offered();
    const res = await submitOffer(o.cookie, p.id, { class: WED_1030 });
    expect(res.status).toBe(409);
    expect(await count(p.id, p.cookie)).toBe(1);
  });

  it("on a post that doesn't exist", async () => {
    const o = await offerer();
    expect((await submitOffer(o.cookie, 999999, { class: WED_9 })).status).toBe(404);
    expect((await submitOffer(o.cookie, "abc", { class: WED_9 })).status).toBe(404);
  });

  it("when logged out, sending them to log in and making nothing", async () => {
    const p = await poster();
    const res = await submitOffer(null, p.id, { class: WED_9 });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/login/");
    expect(await count(p.id, p.cookie)).toBe(0);
  });
});

describe("withdrawing an offer", () => {
  it("takes it back from the post page, which shows You withdrew, and returns to that page", async () => {
    const { p, o, offerId } = await offered();
    const res = await withdrawOffer(o.cookie, offerId, `/posts/${p.id}/`);
    expect([res.status, res.headers.get("location")]).toEqual([303, `/posts/${p.id}/`]);
    const doc = await page(`/posts/${p.id}/`, o.cookie);
    expect(text(doc.querySelector(".own-offer"))).toContain("You withdrew");
    expect(doc.querySelector('form[action^="/offers/"]')).toBeNull();
  });

  it("returns to the board when it was pressed there", async () => {
    const { o, offerId } = await offered();
    const res = await withdrawOffer(o.cookie, offerId, "/");
    expect([res.status, res.headers.get("location")]).toEqual([303, "/"]);
  });

  it("is only for the offerer, and only while it is pending", async () => {
    const { p, o, offerId } = await offered();
    const stranger = await offerer("stranger");
    expect((await withdrawOffer(stranger.cookie, offerId, "/")).status).toBe(403);
    expect((await withdrawOffer(p.cookie, offerId, "/")).status).toBe(403);
    expect((await withdrawOffer(null, offerId, "/")).headers.get("location")).toContain("/login/");
    expect((await withdrawOffer(o.cookie, 999999, "/")).status).toBe(404);
    expect((await withdrawOffer(o.cookie, offerId, "/")).status).toBe(303);
    // already withdrawn: nothing left to withdraw
    expect((await withdrawOffer(o.cookie, offerId, "/")).status).toBe(409);
    // the withdrawn offer no longer counts
    expect(await main(`/posts/${p.id}/`, p.cookie)).toContain("0 pending offers");
  });

  it("lets the student offer again on that post", async () => {
    const { p, o, offerId } = await offered();
    expect((await withdrawOffer(o.cookie, offerId, "/")).status).toBe(303);
    const again = await submitOffer(o.cookie, p.id, { class: WED_1030, next: `/posts/${p.id}/` });
    expect(again.status).toBe(303);
    const doc = await page(`/posts/${p.id}/`, o.cookie);
    expect(text(doc.querySelector(".own-offer"))).toContain("Pending");
    expect(text(doc.querySelector(".own-offer"))).toContain(classLabel(CLASSES[3]));
    expect(text(await page(`/posts/${p.id}/`, p.cookie).then((d) => d.querySelector(".offer-count")))).toBe("1 pending offer");
  });
});

describe("the post page's three views (0023)", () => {
  it("shows the poster each pending offer with its offerer and offered class, and the count", async () => {
    const p = await poster();
    const a = await offerer("offera");
    const b = await offerer("offerb");
    await submitOffer(a.cookie, p.id, { class: WED_9 });
    await submitOffer(b.cookie, p.id, { class: WED_1030 });

    const doc = await page(`/posts/${p.id}/`, p.cookie);
    const offers = [...doc.querySelectorAll(".offers li .offer-text")].map((li) => text(li));
    expect(offers).toEqual([
      `${a.username} would leave ${classLabel(CLASSES[2])}`,
      `${b.username} would leave ${classLabel(CLASSES[3])}`,
    ]);
    expect(text(doc.querySelector(".offer-count"))).toBe("2 pending offers");
    // Withdraw and Offer belong to the offerer, not the poster (who answers instead)
    expect(doc.querySelector('form[action^="/offers/"][action$="/withdraw"]')).toBeNull();
    expect(doc.querySelector('form[action$="/offers"]')).toBeNull();
  });

  it("shows an offerer their own offer and status, the count, and nobody else's offer", async () => {
    const p = await poster();
    const a = await offerer("offera");
    const b = await offerer("offerb");
    await submitOffer(a.cookie, p.id, { class: WED_9 });
    await submitOffer(b.cookie, p.id, { class: WED_1030 });

    const doc = await page(`/posts/${p.id}/`, a.cookie);
    expect(text(doc.querySelector(".own-offer"))).toBe(`You would leave ${classLabel(CLASSES[2])} Pending Withdraw`);
    expect(text(doc.querySelector(".offer-count"))).toBe("2 pending offers");
    expect(doc.querySelector(".offers")).toBeNull();
    expect(text(doc.querySelector("main"))).not.toContain(b.username);
  });

  it("shows anyone else only the count: no offerer, no offered class, no controls", async () => {
    const p = await poster();
    const a = await offerer("offera");
    await submitOffer(a.cookie, p.id, { class: WED_9 });
    const viewer = await offerer("viewer");

    const doc = await page(`/posts/${p.id}/`, viewer.cookie);
    expect(text(doc.querySelector(".offer-count"))).toBe("1 pending offer");
    expect(doc.querySelector(".offers, .own-offer")).toBeNull();
    expect(doc.querySelector('form[action^="/offers/"]')).toBeNull();
    expect(text(doc.querySelector("main"))).not.toContain(a.username);
    // they can offer themselves
    expect(doc.querySelector(`form[action="/posts/${p.id}/offers"]`)).toBeTruthy();
  });

  it("keeps who offered off the board, the post page and the edit page for everyone but the poster", async () => {
    const p = await poster();
    const a = await offerer("offera");
    await submitOffer(a.cookie, p.id, { class: WED_9 });
    const viewer = await offerer("viewer");
    for (const path of ["/", `/posts/${p.id}/`]) {
      expect(text((await page(path, viewer.cookie)).querySelector("main")), path).not.toContain(a.username);
    }
    // the edit page: refused to others, and to the poster it says only that offers are pending
    expect(text((await page(`/posts/${p.id}/edit/`, viewer.cookie)).querySelector("main"))).not.toContain(a.username);
    expect(text((await page(`/posts/${p.id}/edit/`, p.cookie)).querySelector("main"))).not.toContain(a.username);
    // the poster's own board entry shows a count, never the names
    expect(text((await page("/", p.cookie)).querySelector("main"))).not.toContain(a.username);
  });
});

describe("pending-offer counts", () => {
  const entry = async (cookie: string, section: "your-post" | "open-posts", username: string) =>
    [...(await page("/", cookie)).querySelectorAll(`#${section} ~ .board-post, #${section} ~ .your-swap-panel .board-post`)].find((el) => el.classList.contains("board-post-own") || text(el.querySelector("h3")) === username);

  it("count only pending offers, on the board, the pinned post and the post page", async () => {
    const p = await poster();
    const posterName = p.username;
    const viewer = await offerer("viewer");
    const a = await offerer("offera");
    const b = await offerer("offerb");
    const c = await offerer("offerc");
    expect(text((await entry(viewer.cookie, "open-posts", posterName))?.querySelector(".offer-count"))).toBe("0 pending offers");

    await submitOffer(a.cookie, p.id, { class: WED_9 });
    await submitOffer(b.cookie, p.id, { class: WED_9 });
    await submitOffer(c.cookie, p.id, { class: WED_1030 });
    const bOffer = await ownOfferId(b.cookie, p.id);
    expect(text((await entry(viewer.cookie, "open-posts", posterName))?.querySelector(".offer-count"))).toBe("3 pending offers");

    // a withdrawn offer stops counting, everywhere
    expect((await withdrawOffer(b.cookie, bOffer as number, "/")).status).toBe(303);
    expect(text((await entry(viewer.cookie, "open-posts", posterName))?.querySelector(".offer-count"))).toBe("2 pending offers");
    const pinned = await entry(p.cookie, "your-post", posterName);
    expect(text(pinned?.querySelector(".offer-count"))).toBe("2 pending offers");
    expect(pinned?.querySelector(".offer-count a")?.getAttribute("href")).toBe(`/posts/${p.id}/`);
    expect(text((await page(`/posts/${p.id}/`, viewer.cookie)).querySelector(".offer-count"))).toBe("2 pending offers");
  });

  it("say '1 pending offer' for one", async () => {
    const p = await poster();
    const a = await offerer("offera");
    await submitOffer(a.cookie, p.id, { class: WED_9 });
    expect(text((await entry(p.cookie, "your-post", p.username))?.querySelector(".offer-count"))).toBe("1 pending offer");
  });
});

describe("Your offers on the board (0019, 0025)", () => {
  const section = async (cookie: string) => (await page("/", cookie)).querySelector('section[aria-labelledby="your-offers"]');

  it("appears only after a first offer", async () => {
    const p = await poster();
    const o = await offerer();
    expect(await section(o.cookie)).toBeNull();
    expect(await section(p.cookie)).toBeNull();
    await submitOffer(o.cookie, p.id, { class: WED_9 });
    expect(await section(o.cookie)).not.toBeNull();
    // the poster made no offer, so still none
    expect(await section(p.cookie)).toBeNull();
  });

  it("stays once every offer is withdrawn, showing it as withdrawn", async () => {
    const { o, offerId } = await offered();
    await withdrawOffer(o.cookie, offerId, "/");
    expect(text(await section(o.cookie))).toContain("You withdrew");
  });

  it("lists pending offers first, then the rest newest first, each linked to its post page", async () => {
    const one = await poster();
    const two = await poster();
    const three = await poster();
    const o = await offerer();
    await submitOffer(o.cookie, one.id, { class: WED_9 });
    await submitOffer(o.cookie, two.id, { class: WED_9 });
    await submitOffer(o.cookie, three.id, { class: WED_9 });
    // withdraw the middle one: it drops below the pending pair, and the
    // pending pair is newest first
    const middle = (await ownOfferId(o.cookie, two.id)) as number;
    await withdrawOffer(o.cookie, middle, "/");

    const items = [...(await section(o.cookie))!.querySelectorAll(".own-offer")];
    expect(items.map((li) => li.querySelector("a")?.getAttribute("href"))).toEqual([
      `/posts/${three.id}/`,
      `/posts/${one.id}/`,
      `/posts/${two.id}/`,
    ]);
    expect(items.map((li) => text(li.querySelector(".offer-status")))).toEqual(["Pending", "Pending", "You withdrew"]);
    expect(text(items[0])).toContain(`${three.username}'s post`);
  });

  it("withdraws from the board and stays on the board", async () => {
    const { o } = await offered();
    const form = (await section(o.cookie))?.querySelector('form[action^="/offers/"]');
    expect(form?.querySelector('input[name="next"]')?.getAttribute("value")).toBe("/");
    expect(form?.querySelector("button")?.textContent?.trim()).toBe("Withdraw");
  });

  it("shows a post that was withdrawn as 'Post withdrawn'", async () => {
    const { p, o } = await offered();
    await withdrawPost(p.cookie, p.id, "/");
    expect(text(await section(o.cookie))).toContain("Post withdrawn");
  });
});

describe("a pending offer locks editing (0018)", () => {
  it("refuses the edit, the edit page says why, and a withdrawn offer unlocks it", async () => {
    const { p, o, offerId } = await offered();
    const before = await main(`/posts/${p.id}/`, p.cookie);

    const refused = await submitEdit(p.cookie, p.id, { leaving: MON_14, join: [WED_9], message: "Changed my mind." });
    expect(refused.status).toBe(409);
    expect(text((await page(`/posts/${p.id}/edit/`, p.cookie)).querySelector('[role="alert"]'))).toContain("pending offers");
    expect((await page(`/posts/${p.id}/edit/`, p.cookie)).querySelector("form#post-form")).toBeNull();
    // nothing changed, and no edited marker
    expect(await main(`/posts/${p.id}/`, p.cookie)).toBe(before);
    expect(text((await page(`/posts/${p.id}/`, p.cookie)).querySelector(".edited"))).toBe("");

    await withdrawOffer(o.cookie, offerId, "/");
    const allowed = await submitEdit(p.cookie, p.id, { leaving: MON_14, join: [WED_9], message: "Changed my mind." });
    expect(allowed.status).toBe(303);
    expect(text((await page(`/posts/${p.id}/`, p.cookie)).querySelector(".message"))).toBe("Changed my mind.");
  });
});

describe("withdrawing a post closes its pending offers (0025)", () => {
  it("shows offerers 'Post withdrawn' and no longer lets them withdraw or offer", async () => {
    const p = await poster();
    const a = await offerer("offera");
    const b = await offerer("offerb");
    await submitOffer(a.cookie, p.id, { class: WED_9 });
    await submitOffer(b.cookie, p.id, { class: WED_1030 });
    // one offerer took theirs back first: it stays withdrawn, not closed
    const bOffer = (await ownOfferId(b.cookie, p.id)) as number;
    await withdrawOffer(b.cookie, bOffer, "/");
    const aOffer = (await ownOfferId(a.cookie, p.id)) as number;

    expect((await withdrawPost(p.cookie, p.id, "/")).status).toBe(303);

    const aDoc = await page(`/posts/${p.id}/`, a.cookie);
    expect(text(aDoc.querySelector(".own-offer"))).toContain("Post withdrawn");
    expect(aDoc.querySelector('form[action^="/offers/"], form[action$="/offers"]')).toBeNull();
    const bDoc = await page(`/posts/${p.id}/`, b.cookie);
    expect(text(bDoc.querySelector(".own-offer"))).toContain("You withdrew");
    expect(bDoc.querySelector('form[action$="/offers"]')).toBeNull();
    expect((await withdrawOffer(a.cookie, aOffer, "/")).status).toBe(409);
    // the poster's page shows no pending offers any more
    expect(text((await page(`/posts/${p.id}/`, p.cookie)).querySelector(".offers"))).toBe("");
  });
});

describe("the demo seed's offers (0038)", () => {
  it("opens a fresh database with priya's and sam's pending offers on alex's post and lena's on priya's, dated after their posts", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "offers-seed-")), "test.db");
    const before = Date.now();
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db
        .prepare(
          `select offerer.username as offerer, poster.username as poster, o.offered_class_id as offered, o.status,
                  o.closed_reason as closedReason, o.created_at as at, p.posted_at as postedAt
           from offers o
           join students offerer on offerer.id = o.offerer_id
           join swap_posts p on p.id = o.post_id
           join students poster on poster.id = p.student_id
           where o.status = 'pending'
           order by poster.username, offerer.username`,
        )
        .all() as { offerer: string; poster: string; offered: string; status: string; closedReason: string | null; at: number; postedAt: number }[];
      db.close();

      expect(rows.map((r) => [r.offerer, r.poster, r.offered, r.status, r.closedReason])).toEqual([
        ["Priya", "Alex", WED_9, "pending", null],
        ["Sam", "Alex", WED_1030, "pending", null],
        ["Lena", "Priya", MON_1530, "pending", null],
      ]);
      for (const r of rows) {
        expect(r.at, r.offerer).toBeGreaterThan(r.postedAt);
        expect(r.at, r.offerer).toBeLessThanOrEqual(Date.now());
        expect(r.at, r.offerer).toBeGreaterThan(before - 3 * 24 * 60 * 60 * 1000);
      }

      // what a tutor sees: alex's board and post page, sam's and noah's views
      const alex = await demoCookie("Alex", server.baseUrl);
      const board = await page("/", alex, server.baseUrl);
      expect(text(board.querySelector("#your-post ~ .your-swap-panel .board-post .offer-count"))).toBe("2 pending offers");
      const alexPost = board.querySelector('#your-post ~ .your-swap-panel .board-post a[href^="/posts/"]')?.getAttribute("href") ?? "";
      const offers = [...(await page(alexPost, alex, server.baseUrl)).querySelectorAll(".offers li .offer-text")].map((li) => text(li));
      expect(offers).toEqual([
        `Priya would leave ${classLabel(CLASSES[2])}`,
        `Sam would leave ${classLabel(CLASSES[3])}`,
      ]);

      const noah = await demoCookie("Noah", server.baseUrl);
      const counts = [...(await page("/", noah, server.baseUrl)).querySelectorAll("#open-posts ~ .board-post")].map((el) => [
        text(el.querySelector("h3")),
        text(el.querySelector(".offer-count")),
      ]);
      expect(counts).toEqual([
        ["Lena", "0 pending offers"],
        ["Priya", "1 pending offer"],
        ["Alex", "2 pending offers"],
      ]);
      expect((await page("/", noah, server.baseUrl)).querySelector("#your-offers")).toBeNull();

      const sam = await demoCookie("Sam", server.baseUrl);
      const yours = [...(await page("/", sam, server.baseUrl)).querySelectorAll("#your-offers ~ ul .own-offer")].map((el) => text(el));
      expect(yours).toEqual([`Alex's post You would leave ${classLabel(CLASSES[3])} Pending Withdraw`]);
    } finally {
      await server.stop();
    }
  }, 60_000);

  it("shows the offer parts of each demo line on the login page, counts only, and keeps them live", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "offers-lines-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const lines = async () => {
        const doc = await page("/login/", undefined, server.baseUrl);
        return Object.fromEntries(
          [...doc.querySelectorAll(".demo-students li")]
            .map((li) => text(li.querySelector(".demo-line")))
            .filter(Boolean)
            .map((line) => line.split(": ")),
        );
      };
      expect(await lines()).toMatchObject({
        Alex: "2 offers to answer · 1 unread message",
        Priya: "1 offer to answer · 1 pending offer",
        Sam: "1 pending offer",
        Lena: "open post · 1 pending offer",
        Noah: "no post yet",
      });

      // noah offers on lena's post: noah's line and lena's both move
      const noah = await demoCookie("Noah", server.baseUrl);
      const lenaPost = (await page("/", noah, server.baseUrl)).querySelector('#open-posts ~ .board-post a[href^="/posts/"]')?.getAttribute("href") ?? "";
      const res = await submitOffer(noah, lenaPost.match(/\d+/)?.[0] ?? "", { class: CLASSES[4].id }, server.baseUrl);
      expect(res.status).toBe(303);
      expect(await lines()).toMatchObject({ Lena: "1 offer to answer · 1 pending offer", Noah: "1 pending offer" });

      const raw = await (await fetch(new URL("/login/", server.baseUrl))).text();
      expect(raw).not.toContain("would leave");
    } finally {
      await server.stop();
    }
  }, 60_000);
});
