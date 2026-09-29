import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { CLASSES, classLabel } from "../src/lib/classes";
import {
  acceptOffer,
  baseUrl,
  declineOffer,
  demoCookie,
  newStudent,
  offerIdsOn,
  ownOfferId,
  ownPostId,
  page,
  submitOffer,
  submitPost,
  text,
  usernameOf,
  withdrawOffer,
  withdrawPost,
} from "./helpers";
import { spawnServer } from "./spawn-server";

// Accepting and declining an offer (issue #21, decisions 0024, 0025, 0045).
// Every rule is server-enforced and every view is read from the HTML the built
// server returns, with no JavaScript anywhere: the confirm step is a page.
const [MON_14, MON_1530, WED_9, WED_1030, WED_14, WED_1530] = CLASSES.map((c) => c.id);
const label = (id: string) => classLabel(CLASSES.find((c) => c.id === id) ?? CLASSES[0]);

async function student(prefix: string, fields?: { leaving: string; join: string[] }) {
  const cookie = await newStudent(prefix);
  const username = await usernameOf(cookie);
  let postId: number | null = null;
  if (fields) {
    expect((await submitPost(cookie, { ...fields, message: "" })).status).toBe(303);
    postId = await ownPostId(cookie);
    if (postId === null) throw new Error("the post did not appear");
  }
  return { cookie, username, postId: postId as number };
}

/** A poster leaving Mon 14:00 for Wed 09:00 or 10:30. */
const poster = (prefix = "poster") => student(prefix, { leaving: MON_14, join: [WED_9, WED_1030] });

async function offer(from: { cookie: string }, on: { postId: number }, offered: string): Promise<number> {
  expect((await submitOffer(from.cookie, on.postId, { class: offered })).status).toBe(303);
  const id = await ownOfferId(from.cookie, on.postId);
  if (id === null) throw new Error("the offer did not appear");
  return id;
}

const boardPosters = async (cookie: string) =>
  [...(await page("/", cookie)).querySelectorAll("#open-posts ~ .board-post h3")].map((h) => text(h));
const get = (path: string, cookie: string | null) =>
  fetch(new URL(path, baseUrl), { headers: cookie ? { cookie } : {}, redirect: "manual" });
const main = async (path: string, cookie: string) => text((await page(path, cookie)).querySelector("main"));
const statusOf = async (cookie: string, postId: number) =>
  text((await page(`/posts/${postId}/`, cookie)).querySelector(".own-offer .offer-status"));
const yourOffers = async (cookie: string) =>
  [...(await page("/", cookie)).querySelectorAll("#your-offers ~ ul .own-offer")].map((el) => text(el));

describe("declining an offer", () => {
  it("shows the offerer Declined, leaves the post open, and refuses a re-offer", async () => {
    const p = await poster();
    const o = await student("offerer");
    const offerId = await offer(o, p, WED_9);

    const res = await declineOffer(p.cookie, offerId, `/posts/${p.postId}/`);
    expect([res.status, res.headers.get("location")]).toEqual([303, `/posts/${p.postId}/`]);

    const mine = await page(`/posts/${p.postId}/`, o.cookie);
    expect(text(mine.querySelector(".own-offer .offer-status"))).toBe("Declined");
    // no Withdraw, and no "Offer to swap" invitation
    expect(mine.querySelector('form[action^="/offers/"], form[action$="/offers"]')).toBeNull();
    expect(await yourOffers(o.cookie)).toEqual([expect.stringContaining("Declined")]);

    // the post is still open, with no pending offers, and still on the board
    const posterDoc = await page(`/posts/${p.postId}/`, p.cookie);
    expect(text(posterDoc.querySelector(".offer-count"))).toBe("0 pending offers");
    expect(posterDoc.querySelector(".offers")).toBeNull();
    expect(posterDoc.querySelector(".controls")).not.toBeNull();
    expect(await boardPosters(o.cookie)).toContain(p.username);

    // the same student can't offer again, but anyone else can
    const again = await submitOffer(o.cookie, p.postId, { class: WED_1030 });
    expect(again.status).toBe(409);
    expect((await submitOffer((await student("other")).cookie, p.postId, { class: WED_1030 })).status).toBe(303);
  });

  it("unlocks editing when it was the last pending offer", async () => {
    const p = await poster();
    const o = await student("offerer");
    await declineOffer(p.cookie, await offer(o, p, WED_9), "/");
    expect((await page(`/posts/${p.postId}/edit/`, p.cookie)).querySelector("form#post-form")).not.toBeNull();
  });

  it("is one click: the post page has a Decline button with no confirm step", async () => {
    const p = await poster();
    const o = await student("offerer");
    const offerId = await offer(o, p, WED_9);
    const form = (await page(`/posts/${p.postId}/`, p.cookie)).querySelector(`form[action="/offers/${offerId}/decline"]`);
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.querySelector("button")?.textContent?.trim()).toBe("Decline");
  });
});

describe("the accept confirm step", () => {
  it("is a page that says accepting is final, and accepts only when its own form is submitted", async () => {
    const p = await poster();
    const o = await student("offerer");
    const offerId = await offer(o, p, WED_9);

    // the post page only links to the confirm step: it has no accept form of its own
    const postDoc = await page(`/posts/${p.postId}/`, p.cookie);
    expect(postDoc.querySelector(`a[href="/offers/${offerId}/accept/"]`)?.textContent?.trim()).toBe("Accept");
    expect(postDoc.querySelector(`form[action="/offers/${offerId}/accept/"]`)).toBeNull();

    expect((await get(`/offers/${offerId}/accept/`, p.cookie)).status).toBe(200);
    const confirm = await page(`/offers/${offerId}/accept/`, p.cookie);
    expect(text(confirm.querySelector("main"))).toContain("final");
    expect(text(confirm.querySelector("main"))).toContain(o.username);
    expect(text(confirm.querySelector("main"))).toContain(label(WED_9));
    expect(text(confirm.querySelector("main"))).toContain(label(MON_14));
    const form = confirm.querySelector(`form[action="/offers/${offerId}/accept/"]`);
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.querySelector("button")?.textContent?.trim()).toBe("Accept the swap");
    expect(confirm.querySelector(`a[href="/posts/${p.postId}/"]`)).not.toBeNull();
    // opening the confirm step changes nothing
    expect(await statusOf(o.cookie, p.postId)).toBe("Pending");
  });

  it("is required: a POST that skips it is refused and changes nothing", async () => {
    const p = await poster();
    const o = await student("offerer");
    const offerId = await offer(o, p, WED_9);
    const res = await acceptOffer(p.cookie, offerId, { confirm: false });
    expect(res.status).toBe(400);
    expect(await statusOf(o.cookie, p.postId)).toBe("Pending");
    expect(await main(`/posts/${p.postId}/`, p.cookie)).not.toContain("Swapped:");
  });

  it("accepts, returns to the post page, which then says Swapped", async () => {
    const p = await poster();
    const o = await student("offerer");
    const offerId = await offer(o, p, WED_9);
    const res = await acceptOffer(p.cookie, offerId);
    expect([res.status, res.headers.get("location")]).toEqual([303, `/posts/${p.postId}/`]);
    expect(await main(`/posts/${p.postId}/`, p.cookie)).toContain("Swapped:");
    expect(await statusOf(o.cookie, p.postId)).toBe("Accepted");
  });

  it("is only shown to the poster, for a pending offer on an open post", async () => {
    const p = await poster();
    const o = await student("offerer");
    const offerId = await offer(o, p, WED_9);
    const confirm = (cookie: string | null) => get(`/offers/${offerId}/accept/`, cookie);
    expect((await confirm(o.cookie)).status).toBe(403);
    expect((await confirm((await student("stranger")).cookie)).status).toBe(403);
    expect((await confirm(null)).headers.get("location")).toContain("/login/");
    expect((await get("/offers/999999/accept/", p.cookie)).status).toBe(404);
    // once answered, the confirm step says so instead of offering to accept again
    await declineOffer(p.cookie, offerId, "/");
    const stale = await confirm(p.cookie);
    expect(stale.status).toBe(409);
    expect(new JSDOM(await stale.text()).window.document.querySelector("form[action$='/accept/']")).toBeNull();
  });
});

describe("the server refuses to answer an offer", () => {
  it("unless the poster does, and only while it is pending on an open post", async () => {
    const p = await poster();
    const o = await student("offerer");
    const stranger = await student("stranger");
    const offerId = await offer(o, p, WED_9);

    for (const answer of [
      (c: string | null) => acceptOffer(c, offerId),
      (c: string | null) => declineOffer(c, offerId, "/"),
    ]) {
      expect((await answer(o.cookie)).status, "the offerer").toBe(403);
      expect((await answer(stranger.cookie)).status, "a stranger").toBe(403);
      expect((await answer(null)).headers.get("location"), "logged out").toContain("/login/");
    }
    expect((await acceptOffer(p.cookie, 999999)).status).toBe(404);
    expect((await declineOffer(p.cookie, "abc", "/")).status).toBe(404);
    expect(await statusOf(o.cookie, p.postId)).toBe("Pending");

    // answered once, an offer can't be answered again
    expect((await declineOffer(p.cookie, offerId, "/")).status).toBe(303);
    expect((await declineOffer(p.cookie, offerId, "/")).status).toBe(409);
    expect((await acceptOffer(p.cookie, offerId)).status).toBe(409);
    expect(await statusOf(o.cookie, p.postId)).toBe("Declined");
  });

  it("not an offer that was withdrawn or closed", async () => {
    const p = await poster();
    const a = await student("offera");
    const b = await student("offerb");
    const aOffer = await offer(a, p, WED_9);
    const bOffer = await offer(b, p, WED_1030);
    expect((await withdrawOffer(a.cookie, aOffer, "/")).status).toBe(303);
    expect((await acceptOffer(p.cookie, aOffer)).status).toBe(409);
    expect((await withdrawPost(p.cookie, p.postId, "/")).status).toBe(303);
    expect((await acceptOffer(p.cookie, bOffer)).status).toBe(409);
    expect((await declineOffer(p.cookie, bOffer, "/")).status).toBe(409);
    expect(await statusOf(b.cookie, p.postId)).toBe("Post withdrawn");
  });

  it("a stale accept after a swap, and never lets an accepted offer be withdrawn", async () => {
    const p = await poster();
    const a = await student("offera");
    const b = await student("offerb");
    const aOffer = await offer(a, p, WED_9);
    const bOffer = await offer(b, p, WED_1030);
    expect((await acceptOffer(p.cookie, aOffer)).status).toBe(303);
    // b's page was open before the swap: their offer is closed now
    expect((await acceptOffer(p.cookie, bOffer)).status).toBe(409);
    expect((await declineOffer(p.cookie, bOffer, "/")).status).toBe(409);
    expect(await statusOf(b.cookie, p.postId)).toBe("Post swapped with someone else");
    expect((await withdrawOffer(a.cookie, aOffer, "/")).status).toBe(409);
    expect(await statusOf(a.cookie, p.postId)).toBe("Accepted");
    // and a swapped post can't be withdrawn or offered on
    expect((await withdrawPost(p.cookie, p.postId, "/")).status).toBe(409);
    expect((await submitOffer((await student("late")).cookie, p.postId, { class: WED_9 })).status).toBe(409);
  });
});

describe("what an accept closes (0024)", () => {
  it("closes the post's other offers, and all pending offers by the poster and by the offerer, on any post", async () => {
    const p = await poster();
    const o = await student("offerer", { leaving: WED_9, join: [MON_14, MON_1530] }); // has an open post of their own
    const third = await student("third");
    const x = await student("x", { leaving: WED_14, join: [WED_1030, WED_1530] });
    const y = await student("y", { leaving: MON_1530, join: [WED_1030, WED_1530] });

    const accepted = await offer(o, p, WED_9);
    await offer(third, p, WED_1030); // another offer on the swapped post
    await offer(p, x, WED_1030); // the poster's own offer elsewhere
    await offer(o, y, WED_1030); // the offerer's own offer elsewhere
    await offer(third, o, MON_14); // an offer on the offerer's own open post
    await offer(third, x, WED_1030); // unrelated to the swap
    await offer(p, o, MON_1530); // the poster's offer on the post the swap withdraws

    expect((await acceptOffer(p.cookie, accepted)).status).toBe(303);
    expect(await statusOf(p.cookie, o.postId)).toBe("Closed: you swapped");

    expect(await main(`/posts/${p.postId}/`, p.cookie)).toContain("Swapped:");
    expect(text((await page(`/posts/${o.postId}/`, o.cookie)).querySelector(".withdrawn"))).toContain("withdrawn");
    expect(await statusOf(o.cookie, p.postId)).toBe("Accepted");
    expect(await statusOf(third.cookie, p.postId)).toBe("Post swapped with someone else");
    expect(await statusOf(p.cookie, x.postId)).toBe("Closed: you swapped");
    expect(await statusOf(o.cookie, y.postId)).toBe("Closed: you swapped");
    expect(await statusOf(third.cookie, o.postId)).toBe("Post withdrawn");
    // nothing else moved: third's offer on x's post is still pending and still counted
    expect(await statusOf(third.cookie, x.postId)).toBe("Pending");
    expect(text((await page(`/posts/${x.postId}/`, x.cookie)).querySelector(".offer-count"))).toBe("1 pending offer");
    // and the posts the swap did not touch are still open
    expect(text((await page(`/posts/${y.postId}/`, y.cookie)).querySelector(".offer-count"))).toBe("0 pending offers");
    expect((await page(`/posts/${x.postId}/`, x.cookie)).querySelector(".controls")).not.toBeNull();
  });
});

describe("after an accept", () => {
  it("both students can post again, and the poster's spot links to the swapped post until they do", async () => {
    const p = await poster();
    const o = await student("offerer", { leaving: WED_9, join: [MON_14] });
    await offer(o, p, WED_9);
    const offerId = (await offerIdsOn(p.cookie, p.postId))[0];
    expect((await acceptOffer(p.cookie, offerId)).status).toBe(303);

    const spot = async (cookie: string) => (await page("/", cookie)).querySelector('section[aria-labelledby="your-post"]');
    const posterSpot = await spot(p.cookie);
    expect(posterSpot?.querySelector('a[href="/posts/new/"]')?.textContent?.trim()).toBe("Post a swap");
    expect(posterSpot?.querySelector(`a[href="/posts/${p.postId}/"]`)).not.toBeNull();
    expect(text(posterSpot)).toContain("swapped");
    // the swapped post is off the board
    expect(await boardPosters(o.cookie)).not.toContain(p.username);
    // the offerer's post was withdrawn: they can post again too, and see Accepted
    expect((await spot(o.cookie))?.querySelector('a[href="/posts/new/"]')).not.toBeNull();
    expect(await yourOffers(o.cookie)).toEqual([expect.stringContaining("Accepted")]);

    expect((await submitPost(p.cookie, { leaving: WED_14, join: [WED_1530] })).status).toBe(303);
    expect((await submitPost(o.cookie, { leaving: WED_9, join: [WED_1530] })).status).toBe(303);
    const after = await spot(p.cookie);
    expect(after?.querySelector(`a[href="/posts/${p.postId}/"]`)).toBeNull();
    expect(after?.querySelector(".board-post")).not.toBeNull();
  });
});

describe("the swapped post's page (0024)", () => {
  it("says who moves where in the fixed sentence, with both usernames and classes, and no controls", async () => {
    const p = await poster();
    const o = await student("offerer");
    const other = await student("other");
    await offer(other, p, WED_1030);
    const offerId = await offer(o, p, WED_9);
    await acceptOffer(p.cookie, offerId);

    const sentence = `Swapped: ${p.username} moves to ${label(WED_9)}, ${o.username} moves to ${label(MON_14)}. Make the change in MyTimetable. This app can't.`;
    for (const cookie of [p.cookie, o.cookie, other.cookie]) {
      const doc = await page(`/posts/${p.postId}/`, cookie);
      expect(doc.querySelector(".swapped")?.textContent?.replace(/\s+/g, " ").trim()).toBe(sentence);
      // no Edit, Withdraw, Offer, Accept, Decline or offer-count controls of any kind
      expect(doc.querySelector("main form, main button, main a[href$='/edit/'], main a[href$='/accept/']")).toBeNull();
      expect(doc.querySelector(".offers")).toBeNull();
    }
    // a swapped post still loads for a student who never touched it
    expect((await get(`/posts/${p.postId}/`, (await student("bystander")).cookie)).status).toBe(200);
  });

  it("says a swap withdrew the offerer's own post, unlike a post its poster withdrew", async () => {
    const p = await poster();
    const o = await student("offerer", { leaving: WED_9, join: [MON_14] });
    const by = await student("by", { leaving: WED_14, join: [WED_1530] });
    await offer(o, p, WED_9);
    await offer(by, o, MON_14);
    await acceptOffer(p.cookie, (await offerIdsOn(p.cookie, p.postId))[0]);
    await withdrawPost(by.cookie, by.postId, "/");

    const swapWithdrawn = await page(`/posts/${o.postId}/`, o.cookie);
    const bySwap = text(swapWithdrawn.querySelector(".withdrawn"));
    expect(bySwap).toContain("This swap post was withdrawn");
    expect(bySwap).toContain("automatically");
    expect(bySwap).toContain("because its poster swapped");
    expect(swapWithdrawn.querySelector("main form, main a[href$='/edit/']")).toBeNull();
    const byPoster = text((await page(`/posts/${by.postId}/`, by.cookie)).querySelector(".withdrawn"));
    expect(byPoster).toContain("This swap post was withdrawn");
    expect(byPoster).not.toContain("automatically");
    expect(byPoster).not.toContain("because");
  });
});

describe("every label shows to its offerer (0025)", () => {
  it("Pending, Accepted, Declined, You withdrew, Post withdrawn, Post swapped with someone else, Closed: you swapped", async () => {
    const p = await poster();
    const q = await student("q", { leaving: WED_14, join: [WED_1530] }); // will withdraw their post
    const z = await student("z", { leaving: MON_1530, join: [WED_1530] }); // stays open
    const accepted = await student("accepted");
    const declined = await student("declined");
    const withdrew = await student("withdrew");
    const swapped = await student("swapped");
    const gone = await student("gone");
    const pending = await student("pending");

    const acceptedOffer = await offer(accepted, p, WED_9);
    await offer(accepted, z, WED_1530); // closes when the accept happens
    await declineOffer(p.cookie, await offer(declined, p, WED_1030), "/");
    await withdrawOffer(withdrew.cookie, await offer(withdrew, p, WED_9), "/");
    await offer(swapped, p, WED_1030);
    await offer(gone, q, WED_1530);
    await withdrawPost(q.cookie, q.postId, "/");
    await offer(pending, z, WED_1530);
    expect(await statusOf(pending.cookie, z.postId)).toBe("Pending");

    await acceptOffer(p.cookie, acceptedOffer);

    expect(await statusOf(accepted.cookie, p.postId)).toBe("Accepted");
    expect(await statusOf(declined.cookie, p.postId)).toBe("Declined");
    expect(await statusOf(withdrew.cookie, p.postId)).toBe("You withdrew");
    expect(await statusOf(swapped.cookie, p.postId)).toBe("Post swapped with someone else");
    expect(await statusOf(gone.cookie, q.postId)).toBe("Post withdrawn");
    expect(await statusOf(accepted.cookie, z.postId)).toBe("Closed: you swapped");
    expect(await statusOf(pending.cookie, z.postId)).toBe("Pending");

    // "Your offers" on the board shows the same words, pending first
    const board = await yourOffers(accepted.cookie);
    expect(board).toHaveLength(2);
    expect(board.map((line) => line.replace(/.*(Accepted|Closed: you swapped).*/, "$1")).sort()).toEqual(["Accepted", "Closed: you swapped"]);
  });
});

describe("the demo seed's accept cascade (0038)", () => {
  it("accepting priya's offer as alex swaps alex's post, withdraws priya's, and closes sam's and lena's offers", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "accept-seed-")), "test.db");
    const server = await spawnServer(dbPath);
    try {
      const at = (path: string, cookie: string) => page(path, cookie, server.baseUrl);
      const own = async (cookie: string) =>
        (await at("/", cookie)).querySelector('#your-post ~ .your-swap-panel .board-post a[href^="/posts/"]')?.getAttribute("href") ?? "";
      const yours = async (cookie: string) =>
        [...(await at("/", cookie)).querySelectorAll("#your-offers ~ ul .own-offer")].map((el) => text(el));

      const alex = await demoCookie("alex", server.baseUrl);
      const priya = await demoCookie("priya", server.baseUrl);
      const sam = await demoCookie("sam", server.baseUrl);
      const lena = await demoCookie("lena", server.baseUrl);
      const alexPost = await own(alex);
      const priyaPost = await own(priya);

      // priya's offer is the first pending one on alex's post
      const offers = [...(await at(alexPost, alex)).querySelectorAll('form[action$="/decline"]')].map((f) => f.getAttribute("action")?.match(/\d+/)?.[0]);
      expect(text((await at(alexPost, alex)).querySelector(".offers li"))).toContain("priya");
      const res = await acceptOffer(alex, offers[0] ?? "", { confirm: true }, server.baseUrl);
      expect([res.status, res.headers.get("location")]).toEqual([303, alexPost]);

      // alex's post is swapped: alex takes priya's class, priya takes alex's
      expect(text((await at(alexPost, alex)).querySelector(".swapped"))).toBe(
        `Swapped: alex moves to ${label(WED_9)}, priya moves to ${label(MON_14)}. Make the change in MyTimetable. This app can't.`,
      );
      expect(await yours(priya)).toEqual([
        expect.stringContaining("Accepted"), // her offer on alex's post
      ]);
      expect(await yours(sam)).toEqual([expect.stringContaining("Post swapped with someone else")]);

      // priya's own post is withdrawn by the swap, and lena's offer on it closed
      const withdrawn = text((await at(priyaPost, priya)).querySelector(".withdrawn"));
      expect(withdrawn).toContain("This swap post was withdrawn");
      expect(withdrawn).toContain("automatically");
      expect(withdrawn).toContain("because its poster swapped");
      expect(await yours(lena)).toEqual([expect.stringContaining("Post withdrawn")]);

      // both can post again, and alex's spot links to the swapped post
      const alexSpot = (await at("/", alex)).querySelector('section[aria-labelledby="your-post"]');
      expect(alexSpot?.querySelector('a[href="/posts/new/"]')?.textContent?.trim()).toBe("Post a swap");
      expect(alexSpot?.querySelector(`a[href="${alexPost}"]`)).not.toBeNull();
      expect((await at("/", priya)).querySelector('#your-post ~ .your-swap-panel a[href="/posts/new/"]')).not.toBeNull();

      // lena's post is untouched: still open with nothing pending
      expect(text((await at("/", sam)).querySelector("#open-posts ~ .board-post h3"))).toBe("lena");
      expect(text((await at("/", sam)).querySelector("#open-posts ~ .board-post .offer-count"))).toBe("0 pending offers");
    } finally {
      await server.stop();
    }
  }, 60_000);

  it("opens a fresh database with jordan's swapped post and mei's accepted offer, and nothing pending for either", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "swapped-seed-")), "test.db");
    const before = Date.now();
    const server = await spawnServer(dbPath);
    try {
      const db = new Database(dbPath, { readonly: true });
      const post = db
        .prepare(
          `select p.id, p.leaving_class_id as leaving, p.status, p.posted_at as postedAt, p.withdrawn_at as withdrawnAt
           from swap_posts p join students s on s.id = p.student_id where s.username = 'jordan'`,
        )
        .all() as { id: number; leaving: string; status: string; postedAt: number; withdrawnAt: number | null }[];
      expect(post).toHaveLength(1);
      expect([post[0].leaving, post[0].status, post[0].withdrawnAt]).toEqual([WED_14, "swapped", null]);
      const joins = db.prepare("select class_id from swap_post_join_classes where post_id = ?").all(post[0].id);
      expect(joins).toEqual([{ class_id: WED_1530 }]);

      const rows = db
        .prepare(
          `select offerer.username as offerer, o.offered_class_id as offered, o.status, o.closed_reason as closedReason,
                  o.created_at as at, o.resolved_at as resolvedAt
           from offers o join students offerer on offerer.id = o.offerer_id where o.post_id = ?`,
        )
        .all(post[0].id) as { offerer: string; offered: string; status: string; closedReason: string | null; at: number; resolvedAt: number }[];
      expect(rows.map((r) => [r.offerer, r.offered, r.status, r.closedReason])).toEqual([["mei", WED_1530, "accepted", null]]);
      // posted, then offered, then accepted, all within the last three days
      expect(rows[0].at).toBeGreaterThan(post[0].postedAt);
      expect(rows[0].resolvedAt).toBeGreaterThan(rows[0].at);
      expect(rows[0].resolvedAt).toBeLessThanOrEqual(Date.now());
      expect(post[0].postedAt).toBeGreaterThan(before - 3 * 24 * 60 * 60 * 1000);

      const pending = db
        .prepare(
          `select count(*) as n from offers o
           join students offerer on offerer.id = o.offerer_id
           join swap_posts p on p.id = o.post_id join students poster on poster.id = p.student_id
           where o.status = 'pending' and (offerer.username in ('jordan', 'mei') or poster.username in ('jordan', 'mei'))`,
        )
        .get() as { n: number };
      db.close();
      expect(pending.n).toBe(0);

      const jordan = await demoCookie("jordan", server.baseUrl);
      const mei = await demoCookie("mei", server.baseUrl);
      const swappedPath = `/posts/${post[0].id}/`;
      expect(text((await page(swappedPath, jordan, server.baseUrl)).querySelector(".swapped"))).toBe(
        `Swapped: jordan moves to ${label(WED_1530)}, mei moves to ${label(WED_14)}. Make the change in MyTimetable. This app can't.`,
      );
      const board = await page("/", jordan, server.baseUrl);
      expect(board.querySelector('#your-post ~ .your-swap-panel a[href="/posts/new/"]')?.textContent?.trim()).toBe("Post a swap");
      expect(board.querySelector(`#your-post ~ .your-swap-panel p a[href="${swappedPath}"]`)).not.toBeNull();
      // the swapped post is off the board for everyone
      expect([...board.querySelectorAll("#open-posts ~ .board-post h3")].map((h) => text(h))).toEqual(["lena", "priya", "alex"]);
      const meiLines = [...(await page("/", mei, server.baseUrl)).querySelectorAll("#your-offers ~ ul .own-offer")].map((el) => text(el));
      expect(meiLines).toEqual([`jordan's post You would leave ${label(WED_1530)} Accepted`]);
    } finally {
      await server.stop();
    }
  }, 60_000);
});
