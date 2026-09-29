import { describe, expect, it } from "vitest";
import { CLASSES, classLabel } from "../src/lib/classes";
import {
  baseUrl,
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
