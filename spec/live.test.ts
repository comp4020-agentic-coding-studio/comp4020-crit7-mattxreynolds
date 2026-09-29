import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import {
  acceptOffer,
  newStudent,
  offerIdsOn,
  ownPostId,
  submitOffer,
  submitPost,
  usernameOf,
} from "./helpers";
import { spawnServer } from "./spawn-server";

// The routes the live refresh refetches (issue #22; 0042, 0044): each returns
// the same server-rendered HTML the full page holds, only to a logged-in
// student, and never the flash notice.
const [MON_14, , WED_9, WED_1030] = CLASSES.map((c) => c.id);

// A server of its own, not the shared one: these compare the board fragment
// with the board page, and on the shared server the board holds every post the
// rest of the suite has made, so each comparison grew slower the later this
// file ran, until it timed out (#43).
const server = await spawnServer(join(mkdtempSync(join(tmpdir(), "spec-live-")), "test.db"));
afterAll(() => server.stop());
const baseUrl = server.baseUrl;

const get = (path: string, cookie?: string) =>
  fetch(new URL(path, baseUrl), { headers: cookie ? { cookie } : {}, redirect: "manual" });

/** The markup the way a browser would parse and re-serialise it. */
const normalised = (html: string): string => new JSDOM(`<body>${html}</body>`).window.document.body.innerHTML.trim();

async function pageInner(path: string, id: string, cookie: string): Promise<string> {
  const doc = new JSDOM(await (await get(path, cookie)).text()).window.document;
  const el = doc.getElementById(id);
  if (!el) throw new Error(`${path} has no #${id}`);
  return el.innerHTML.trim();
}

/** The fragment and the page's own copy of it, fetched back to back. Nothing
 *  else writes to this file's server between the two, so a difference is a
 *  real one and is not retried away. */
async function fragmentAndPage(fragment: string, path: string, id: string, cookie: string) {
  const res = await get(fragment, cookie);
  expect(res.status).toBe(200);
  return { fragment: normalised(await res.text()), page: normalised(await pageInner(path, id, cookie)) };
}

async function postWithOffer(): Promise<{ poster: string; offerer: string; postId: number; offerId: number }> {
  const poster = await newStudent("liveposter", baseUrl);
  expect((await submitPost(poster, { leaving: MON_14, join: [WED_9, WED_1030], message: "Live." }, baseUrl)).status).toBe(303);
  const postId = await ownPostId(poster, baseUrl);
  if (postId === null) throw new Error("no post");
  const offerer = await newStudent("liveofferer", baseUrl);
  expect((await submitOffer(offerer, postId, { class: WED_9 }, baseUrl)).status).toBe(303);
  const [offerId] = await offerIdsOn(poster, postId, baseUrl);
  return { poster, offerer, postId, offerId };
}

describe("the routes that serve refetched content", () => {
  it("refuse a logged-out request with a 401 and no content, not the login page", async () => {
    const { postId } = await postWithOffer();
    for (const path of ["/fragments/board/", `/fragments/posts/${postId}/`, "/fragments/posts/999999/"]) {
      const res = await get(path);
      expect(res.status, path).toBe(401);
      expect(await res.text(), path).toBe("");
    }
  });

  it("refuse a session that doesn't exist", async () => {
    expect((await get("/fragments/board/", "session=not-a-real-token")).status).toBe(401);
  });

  it("answer a post that never existed with a 404 to a logged-in student", async () => {
    const cookie = await newStudent("livenopost", baseUrl);
    expect((await get("/fragments/posts/999999/", cookie)).status).toBe(404);
    expect((await get("/fragments/posts/abc/", cookie)).status).toBe(404);
  });
});

describe("the board fragment", () => {
  it("is exactly the content the board page holds, for the same student", async () => {
    const { poster, offerer } = await postWithOffer();
    for (const cookie of [poster, offerer]) {
      expect((await get("/fragments/board/", cookie)).headers.get("content-type")).toContain("text/html");
      const { fragment, page } = await fragmentAndPage("/fragments/board/", "/", "board-live", cookie);
      expect(fragment).toBe(page);
    }
  });

  it("shows the requesting student's own pinned post and offers", async () => {
    const { poster, offerer } = await postWithOffer();
    const posterName = await usernameOf(poster, baseUrl);
    const fragment = new JSDOM(`<body>${await (await get("/fragments/board/", offerer)).text()}</body>`).window.document;
    expect(fragment.querySelector("#your-offers")).not.toBeNull();
    expect(fragment.body.textContent).toContain(`${posterName}'s post`);
    expect(fragment.querySelector("h1")).toBeNull();
  });

  it("leaves out the flash notice, and doesn't use it up", async () => {
    const cookie = await newStudent("liveflash", baseUrl);
    const created = await submitPost(cookie, { leaving: MON_14, join: [WED_9], message: "" }, baseUrl);
    const flash = created.headers.get("set-cookie")?.match(/flash=([^;]+)/)?.[0];
    expect(flash).toBeTruthy();
    const both = `${cookie}; ${flash}`;

    const fragment = await get("/fragments/board/", both);
    expect(await fragment.text()).not.toContain("Your swap post is on the board");
    expect(fragment.headers.get("set-cookie") ?? "").not.toContain("flash=");

    const board = await (await get("/", both)).text();
    expect(board).toContain("Your swap post is on the board");
  });

  it("is what the board page swaps: the page names the fragment route and holds a polite live region", async () => {
    const cookie = await newStudent("liveregion", baseUrl);
    const doc = new JSDOM(await (await get("/", cookie)).text()).window.document;
    expect(doc.getElementById("board-live")?.getAttribute("data-live-url")).toBe("/fragments/board/");
    const region = doc.getElementById("live-announce");
    expect(region?.getAttribute("aria-live")).toBe("polite");
    // empty until a refresh, and outside the swapped content
    expect(region?.textContent).toBe("");
    expect(doc.getElementById("board-live")?.contains(region)).toBe(false);
  });
});

describe("the post fragment", () => {
  it("is exactly the content the post page holds, for each viewer of an offered post", async () => {
    const { poster, offerer, postId } = await postWithOffer();
    const bystander = await newStudent("livebystander", baseUrl);
    for (const cookie of [poster, offerer, bystander]) {
      const { fragment, page } = await fragmentAndPage(`/fragments/posts/${postId}/`, `/posts/${postId}/`, "post-live", cookie);
      expect(fragment).toBe(page);
    }
  });

  it("keeps the offer views private: only the poster's fragment names who offered", async () => {
    const { poster, offerer, postId } = await postWithOffer();
    const offererName = await usernameOf(offerer, baseUrl);
    const bystander = await newStudent("liveprivacy", baseUrl);
    const body = async (cookie: string) => (await get(`/fragments/posts/${postId}/`, cookie)).text();
    expect(await body(poster)).toContain(offererName);
    expect(await body(bystander)).not.toContain(offererName);
    expect(await body(bystander)).toContain("1 pending offer");
  });

  it("drops the controls that no longer apply once the post is swapped", async () => {
    const { poster, offerer, postId, offerId } = await postWithOffer();
    const bystander = await newStudent("liveswapped", baseUrl);
    // the offerer needs an open post of their own for the swap to withdraw
    expect((await submitPost(offerer, { leaving: WED_9, join: [MON_14], message: "" }, baseUrl)).status).toBe(303);

    const before = await (await get(`/fragments/posts/${postId}/`, poster)).text();
    expect(before).toContain("Accept");
    expect(before).toContain("Withdraw");
    expect(await (await get(`/fragments/posts/${postId}/`, bystander)).text()).toContain("Offer to swap");

    expect((await acceptOffer(poster, offerId, { confirm: true }, baseUrl)).status).toBe(303);

    const after = await (await get(`/fragments/posts/${postId}/`, poster)).text();
    expect(after).toContain("Swapped:");
    expect(after).not.toContain("Accept");
    expect(after).not.toContain("Decline");
    expect(after).not.toContain("Withdraw");
    const seen = await (await get(`/fragments/posts/${postId}/`, bystander)).text();
    expect(seen).toContain("Swapped:");
    expect(seen).not.toContain("Offer to swap");
    expect(seen).not.toContain("pending offer");
  });

  it("is named by the post page for the client script", async () => {
    const { poster, postId } = await postWithOffer();
    const doc = new JSDOM(await (await get(`/posts/${postId}/`, poster)).text()).window.document;
    const live = doc.getElementById("post-live");
    expect(live?.getAttribute("data-live-url")).toBe(`/fragments/posts/${postId}/`);
    expect(live?.getAttribute("data-post-id")).toBe(String(postId));
  });
});
