import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { CLASSES, classLabel } from "../src/lib/classes";
import {
  baseUrl,
  newStudent,
  ownPostId,
  page,
  submitEdit,
  submitPost,
  text,
  usernameOf,
  withdrawPost,
} from "./helpers";

// Editing and withdrawing a swap post (issue #19, decisions 0018, 0019, 0020,
// 0045). The rules are server-enforced and visible in the returned HTML, so
// these go through the built server.
const [MON_14, MON_1530, WED_9, WED_1030, WED_14, WED_1530] = CLASSES.map((c) => c.id);
const OK = { leaving: MON_14, join: [WED_9, WED_1030], message: "Clashes with my lab." };
const TIME = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}, \d\d:\d\d$/;

async function postedStudent(fields = OK) {
  const cookie = await newStudent();
  expect((await submitPost(cookie, fields)).status).toBe(303);
  const id = await ownPostId(cookie);
  if (id === null) throw new Error("the post did not appear");
  return { cookie, id, username: await usernameOf(cookie) };
}

const pinned = async (cookie: string) => [...(await page("/", cookie)).querySelectorAll("#your-post ~ .post")];

describe("editing a swap post", () => {
  it("changes the post, and the board entry and post page then show edited with the time", async () => {
    const { cookie, id } = await postedStudent();
    expect(text((await pinned(cookie))[0])).not.toMatch(/edited/i);
    expect(text((await page(`/posts/${id}/`, cookie)).querySelector("main"))).not.toMatch(/edited/i);

    const res = await submitEdit(cookie, id, { leaving: MON_1530, join: [WED_14, WED_1530], message: "Now it is my exam." });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    const [entry] = await pinned(cookie);
    expect(text(entry)).toContain(`Leaving: ${classLabel(CLASSES[1])}`);
    expect(text(entry)).toContain(`${classLabel(CLASSES[4])}, ${classLabel(CLASSES[5])}`);
    expect(text(entry)).toContain("Now it is my exam.");
    expect(text(entry)).not.toContain("Clashes with my lab.");
    expect(text(entry.querySelector(".edited"))).toMatch(/^Edited /);
    expect(text(entry.querySelector(".edited time"))).toMatch(TIME);

    const doc = await page(`/posts/${id}/`, cookie);
    expect(text(doc.querySelector(".message"))).toBe("Now it is my exam.");
    expect(text(doc.querySelector(".edited time"))).toMatch(TIME);
    // still one post, still open: the poster did not get a second one
    expect(await ownPostId(cookie)).toBe(id);
  });

  it("shows the edit form filled with the post as it stands", async () => {
    const { cookie, id } = await postedStudent();
    const doc = await page(`/posts/${id}/edit/`, cookie);
    const form = doc.querySelector("form#post-form") as HTMLFormElement;
    expect(form.getAttribute("action")).toBe(`/posts/${id}/edit/`);
    expect((doc.querySelector(`input[name="leaving"][value="${MON_14}"]`) as HTMLInputElement).checked).toBe(true);
    const joined = [...doc.querySelectorAll('input[name="join"]:checked')].map((el) => (el as HTMLInputElement).value);
    expect(joined.sort()).toEqual([WED_9, WED_1030].sort());
    expect(text(doc.querySelector("textarea"))).toBe("Clashes with my lab.");
  });

  it("refuses an edit that breaks a new-post rule with the same message, and changes nothing", async () => {
    const { cookie, id } = await postedStudent();
    const stranger = await newStudent("fresh");
    for (const fields of [
      { leaving: MON_14, join: [] },
      { leaving: MON_14, join: [MON_14] },
      { leaving: "no-such-class", join: [WED_9] },
      { join: [WED_9] },
      { leaving: MON_14, join: ["no-such-class"] },
      { leaving: MON_14, join: [WED_9], message: "x".repeat(501) },
    ]) {
      const label = JSON.stringify(fields).slice(0, 80);
      const edit = await submitEdit(cookie, id, fields);
      const create = await submitPost(stranger, fields);
      expect(edit.status, label).toBe(400);
      expect(create.status, label).toBe(400);
      const alert = (r: string) => text(new JSDOM(r).window.document.querySelector('[role="alert"]'));
      const editAlert = alert(await edit.text());
      expect(editAlert, label).not.toBe("");
      expect(editAlert, label).toBe(alert(await create.text()));
    }
    const [entry] = await pinned(cookie);
    expect(text(entry)).toContain("Clashes with my lab.");
    expect(entry.querySelector(".edited")).toBeNull();
  });

  it("keeps what was typed when it refuses", async () => {
    const { cookie, id } = await postedStudent();
    const res = await submitEdit(cookie, id, { leaving: MON_14, join: [], message: "half-typed thought" });
    const doc = new JSDOM(await res.text()).window.document;
    expect(text(doc.querySelector("textarea"))).toBe("half-typed thought");
  });

  it("lands on the board with Changes saved once, above the post", async () => {
    const { cookie, id } = await postedStudent();
    const res = await submitEdit(cookie, id, { ...OK, message: "Edited once." });
    const flash = res.headers.getSetCookie().find((c) => c.startsWith("flash="))?.split(";")[0];
    expect(flash).toBeTruthy();

    const first = await fetch(new URL("/", baseUrl), { headers: { cookie: `${cookie}; ${flash}` } });
    const doc = new JSDOM(await first.text()).window.document;
    expect(text(doc.querySelector('[role="status"]'))).toBe("Changes saved");
    const status = doc.querySelector('[role="status"]');
    expect(status && doc.querySelector("#your-post") && status.compareDocumentPosition(doc.querySelector("#your-post") as Element) & 4).toBeTruthy();
    // the board clears it, so a reload does not show it again
    expect(first.headers.getSetCookie().some((c) => /^flash=;|^flash=[^;]*;.*(max-age=0|expires=)/i.test(c))).toBe(true);
    expect(text((await page("/", cookie)).querySelector('[role="status"]'))).toBe("");
  });

  it("is refused for anyone but the poster, on the page and on the form", async () => {
    const { cookie, id } = await postedStudent();
    const other = await newStudent("other");
    const res = await submitEdit(other, id, { leaving: WED_14, join: [WED_9], message: "hijacked" });
    expect(res.status).toBe(403);
    const get = await fetch(new URL(`/posts/${id}/edit/`, baseUrl), { headers: { cookie: other } });
    expect(get.status).toBe(403);
    expect(await get.text()).not.toContain("Clashes with my lab.");

    const [entry] = await pinned(cookie);
    expect(text(entry)).toContain("Clashes with my lab.");
    expect(text(entry)).not.toContain("hijacked");
  });

  it("is 404 for a post that never existed, and needs a login", async () => {
    const cookie = await newStudent();
    for (const id of ["99999999", "0", "abc"]) {
      expect((await submitEdit(cookie, id, OK)).status, id).toBe(404);
      const get = await fetch(new URL(`/posts/${id}/edit/`, baseUrl), { headers: { cookie } });
      expect(get.status, id).toBe(404);
    }
    const out = await fetch(new URL("/posts/1/edit/", baseUrl), { redirect: "manual" });
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toContain("/login/");
  });

  it("offers Edit and Withdraw on the pinned post and the post page for the poster only", async () => {
    const { cookie, id } = await postedStudent();
    const viewer = await newStudent("viewer");
    const board = await page("/", cookie);
    expect(board.querySelector(`#your-post ~ .post a[href="/posts/${id}/edit/"]`)).toBeTruthy();
    expect(board.querySelector(`#your-post ~ .post form[action="/posts/${id}/withdraw"] button`)).toBeTruthy();

    const own = await page(`/posts/${id}/`, cookie);
    expect(own.querySelector(`a[href="/posts/${id}/edit/"]`)).toBeTruthy();
    expect(own.querySelector(`form[action="/posts/${id}/withdraw"]`)).toBeTruthy();

    for (const doc of [await page(`/posts/${id}/`, viewer), await page("/", viewer)]) {
      expect(doc.querySelector(`a[href="/posts/${id}/edit/"]`)).toBeNull();
      expect(doc.querySelector(`form[action="/posts/${id}/withdraw"]`)).toBeNull();
    }
  });
});

describe("withdrawing a swap post", () => {
  it("takes it off the board, frees Post a swap, and lets the poster post again", async () => {
    const { cookie, id, username } = await postedStudent();
    const viewer = await newStudent("viewer");
    const onBoard = async (c: string) => text((await page("/", c)).querySelector("main")).includes(`Leaving: ${classLabel(CLASSES[0])}`);
    expect(await onBoard(viewer)).toBe(true);

    const res = await withdrawPost(cookie, id, "/");
    expect(res.status).toBe(303);

    const mine = await page("/", cookie);
    expect(mine.querySelectorAll("#your-post ~ .post")).toHaveLength(0);
    expect(text(mine.querySelector('#your-post ~ a[href="/posts/new/"]'))).toBe("Post a swap");
    const names = [...(await page("/", viewer)).querySelectorAll(".post h3")].map((h) => text(h));
    expect(names).not.toContain(username);

    expect((await submitPost(cookie, { leaving: WED_14, join: [WED_9] })).status).toBe(303);
    expect(await ownPostId(cookie)).not.toBe(id);
  });

  it("leaves a page that says This swap post was withdrawn with the time and no edit controls", async () => {
    const { cookie, id, username } = await postedStudent();
    await withdrawPost(cookie, id, "/");
    const other = await newStudent("other");
    for (const viewer of [cookie, other]) {
      const res = await fetch(new URL(`/posts/${id}/`, baseUrl), { headers: { cookie: viewer } });
      expect(res.status).toBe(200);
      const doc = new JSDOM(await res.text()).window.document;
      expect(text(doc.querySelector("main"))).toContain("This swap post was withdrawn");
      expect(text(doc.querySelector(".withdrawn"))).toContain("This swap post was withdrawn");
      expect(text(doc.querySelector(".withdrawn time"))).toMatch(TIME);
      expect(text(doc.querySelector("main"))).toContain(username);
      expect(text(doc.querySelector("main"))).toContain("Clashes with my lab.");
      expect(doc.querySelector(`a[href$="/edit/"]`)).toBeNull();
      expect(doc.querySelector(`form[action$="/withdraw"]`)).toBeNull();
    }
  });

  it("is refused for anyone but the poster", async () => {
    const { cookie, id } = await postedStudent();
    const other = await newStudent("other");
    expect((await withdrawPost(other, id, "/")).status).toBe(403);
    expect(await ownPostId(cookie)).toBe(id);
    expect(text((await page(`/posts/${id}/`, cookie)).querySelector("main"))).not.toContain("withdrawn");
  });

  it("refuses editing or withdrawing a post that is already withdrawn", async () => {
    const { cookie, id } = await postedStudent();
    expect((await withdrawPost(cookie, id, "/")).status).toBe(303);
    expect((await withdrawPost(cookie, id, "/")).status).toBe(409);
    expect((await submitEdit(cookie, id, OK)).status).toBe(409);
    const get = await fetch(new URL(`/posts/${id}/edit/`, baseUrl), { headers: { cookie } });
    expect(get.status).toBe(409);
    expect(text(new JSDOM(await get.text()).window.document.querySelector("main"))).toContain("This swap post was withdrawn");
    // and the edit did not bring it back
    expect(await ownPostId(cookie)).toBeNull();
  });

  it("is 404 for a post that never existed, and needs a login", async () => {
    const cookie = await newStudent();
    expect((await withdrawPost(cookie, "99999999", "/")).status).toBe(404);
    expect((await withdrawPost(cookie, "abc", "/")).status).toBe(404);
    const out = await fetch(new URL("/posts/1/withdraw", baseUrl), { method: "POST", headers: { origin: baseUrl }, redirect: "manual" });
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toContain("/login/");
  });

  it("returns with a 303 to the page it was submitted from", async () => {
    for (const from of ["board", "post page"]) {
      const { cookie, id } = await postedStudent();
      const next = from === "board" ? "/" : `/posts/${id}/`;
      const res = await withdrawPost(cookie, id, next);
      expect(res.status, from).toBe(303);
      expect(res.headers.get("location"), from).toBe(next);
    }
  });

  it("only returns to a path on this site", async () => {
    for (const next of ["//evil.example/", "https://evil.example/", "/\\evil.example", undefined]) {
      const { cookie, id } = await postedStudent();
      const res = await withdrawPost(cookie, id, next);
      expect(res.status, String(next)).toBe(303);
      expect(res.headers.get("location"), String(next)).toBe("/");
    }
  });
});
