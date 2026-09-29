import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import { acceptOffer, newStudent, ownPostId, page, submitOffer, submitPost, text } from "./helpers";

// New post, edit post, the accept step and About, redesigned (issue #39,
// decisions 0055, 0058), read from the HTML the built server serves. Geometry
// (a sideways scroll at 390px, the card) is Playwright's, in
// e2e/board.spec.ts and e2e/offers.spec.ts; the behaviour is pinned by
// posts.test.ts, posts-edit.test.ts, accept.test.ts and readme.test.ts. Here
// is what the markup promises: one column, the form or the question in one
// card, the error still an attention alert, and About's README in one article.
// Signing up hashes a password, so the file shares its students.
const [MON_14, , WED_9] = CLASSES.map((c) => c.id);

let poster: string;
let offerer: string;
let postId: number;
let offerId: number;
let fresh: string; // no open post: sees the form, and a refused post is the validation

beforeAll(async () => {
  poster = await newStudent("formlook");
  offerer = await newStudent("formoffer");
  fresh = await newStudent("formfresh");
  expect((await submitPost(poster, { leaving: MON_14, join: [WED_9] })).status).toBe(303);
  const id = await ownPostId(poster);
  if (id === null) throw new Error("no post");
  postId = id;
  expect((await submitOffer(offerer, postId, { class: WED_9 })).status).toBe(303);
  const res = await page(`/posts/${postId}/`, poster);
  const action = res.querySelector('form[action$="/decline"]')?.getAttribute("action");
  offerId = Number(action?.match(/^\/offers\/(\d+)\/decline$/)?.[1]);
});

describe("new post", () => {
  it("is one column with the post form as one card, fieldsets and message inside it", async () => {
    const doc = await page("/posts/new/", fresh);
    const column = doc.querySelector("main > .form-page");
    expect(column?.querySelector(":scope > h1")?.textContent).toBe("Post a swap");
    const form = column?.querySelector("form#post-form.form-card");
    expect(form?.querySelectorAll("fieldset")).toHaveLength(2);
    expect(form?.querySelector("textarea#message")).toBeTruthy();
    expect(form?.querySelector("button.primary")?.textContent?.trim()).toBe("Post swap");
  });

  it("keeps a refused post's reason as an attention alert in the column, with the form and what was typed", async () => {
    const res = await submitPost(fresh, { leaving: MON_14, join: [MON_14], message: "kept text" });
    expect(res.status).toBe(400);
    const doc = new JSDOM(await res.text()).window.document;
    const alert = doc.querySelector(".form-page > [role=alert]");
    expect(alert?.hasAttribute("data-attention")).toBe(true);
    expect(text(alert)).not.toBe("");
    const form = doc.querySelector(".form-page form#post-form.form-card");
    expect(form?.querySelector<HTMLTextAreaElement>("textarea#message")?.value).toBe("kept text");
    expect(form?.querySelector<HTMLInputElement>(`input[name=leaving][value="${MON_14}"]`)?.checked).toBe(true);
  });
});

describe("edit post", () => {
  it("says a post with a pending offer can't be edited, in the column, with no form", async () => {
    const doc = await page(`/posts/${postId}/edit/`, poster);
    const alert = doc.querySelector(".form-page > [role=alert]");
    // a pending offer locks editing (0018): the page says so in the column instead of the form
    expect(alert?.hasAttribute("data-attention")).toBe(true);
    expect(doc.querySelector(".form-page form")).toBeNull();
  });

  it("shows the form as a card while the post has no pending offer", async () => {
    const cookie = await newStudent("formedit");
    expect((await submitPost(cookie, { leaving: MON_14, join: [WED_9] })).status).toBe(303);
    const id = await ownPostId(cookie);
    const doc = await page(`/posts/${id}/edit/`, cookie);
    expect(doc.querySelector(".form-page > h1")?.textContent).toBe("Edit your swap post");
    expect(doc.querySelector(".form-page form#post-form.form-card button.primary")?.textContent?.trim()).toBe("Save changes");
  });
});

describe("the accept step", () => {
  it("holds the question, the final warning and the confirm form in one card", async () => {
    const doc = await page(`/offers/${offerId}/accept/`, poster);
    const card = doc.querySelector(".form-page > section.accept-card.form-card");
    expect(card?.querySelector(".swap-summary")).toBeTruthy();
    expect(text(card?.querySelector(".final"))).toContain("Accepting is final.");
    expect(card?.querySelector('form input[name="confirm"][value="yes"]')).toBeTruthy();
    expect(card?.querySelector("form button.primary")?.textContent?.trim()).toBe("Accept the swap");
  });

  it("puts a refusal in the column as an attention alert, with no card", async () => {
    const doc = await page(`/offers/${offerId}/accept/`, offerer);
    expect(doc.querySelector(".form-page > [role=alert][data-attention]")).toBeTruthy();
    expect(doc.querySelector(".accept-card")).toBeNull();
  });

  it("still refuses a POST that lacks the confirm", async () => {
    const res = await acceptOffer(poster, offerId, { confirm: false });
    expect(res.status).toBe(400);
  });
});

describe("About", () => {
  it("is the README in one article that is the page's only content", async () => {
    const doc = await page("/readme/");
    const article = doc.querySelector("main > article.readme-page");
    expect(article?.querySelector("h1")?.textContent).toBe("C7: the tutorial swap board");
    expect(doc.querySelectorAll("main > *")).toHaveLength(1);
  });
});
