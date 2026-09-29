import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";
import {
  baseUrl,
  declineOffer,
  demoCookie,
  newStudent,
  offerIdsOn,
  ownPostId,
  page,
  submitEdit,
  submitOffer,
  submitPost,
  text,
  usernameOf,
} from "./helpers";
import { ROUTES } from "./routes";

// The transit-board shell (issue #34, decisions 0050, 0051, 0052, 0058), read
// from the HTML the built server serves. Every page wears the wordmark and the
// unofficial footer; the attention (coral) marker is `data-attention`, present
// exactly where 0058 says a state is waiting on the viewer; the buttons take
// `primary` or `secondary`. Later slices reuse the same hooks.

const FOOTER = "Unofficial, student-built COMP4020 demo. Not an ANU system: it can't change your real class allocation.";

const fields = { leaving: CLASSES[0].id, join: [CLASSES[2].id], message: "Shell coverage." };

async function html(path: string, cookie?: string): Promise<Document> {
  return page(path, cookie);
}

describe("the wordmark and the unofficial footer are on every covered route", () => {
  // logged out, every route in spec/routes.ts; logged in, the same routes
  // that a session doesn't bounce (login and signup send a student on), plus
  // a seeded post's page and a student's own edit form
  it.each(ROUTES)("%s, logged out", async (route) => {
    const doc = await html(route);
    expect(text(doc.querySelector("header .wordmark"))).toBe("Swap Board");
    expect(text(doc.querySelector("footer"))).toBe(FOOTER);
  });

  const loggedIn = ROUTES.filter((r) => r !== "/login/" && r !== "/signup/").concat("/posts/1/");
  it.each(loggedIn)("%s, logged in", async (route) => {
    const cookie = await newStudent("shell");
    const doc = await html(route, cookie);
    expect(text(doc.querySelector("header .wordmark"))).toBe("Swap Board");
    expect(text(doc.querySelector("footer"))).toBe(FOOTER);
  });

  it("the edit form, logged in", async () => {
    const cookie = await newStudent("shelledit");
    expect((await submitPost(cookie, fields)).status).toBe(303);
    const id = await ownPostId(cookie);
    const doc = await html(`/posts/${id}/edit/`, cookie);
    expect(text(doc.querySelector("header .wordmark"))).toBe("Swap Board");
    expect(text(doc.querySelector("footer"))).toBe(FOOTER);
  });

  it("the page title is not the wordmark", async () => {
    expect((await html("/readme/")).title).not.toContain("Swap Board");
  });
});

describe("the attention marker (0058)", () => {
  const messagesLink = (doc: Document) => doc.querySelector('nav a[href="/messages/"]');

  it("marks Messages (N) when N is at least 1, and not at 0; the text stays", async () => {
    const cookie = await newStudent("shellmsg");
    const username = await usernameOf(cookie);
    const quiet = messagesLink(await html("/", cookie));
    expect(text(quiet)).toBe("Messages");
    expect(quiet?.hasAttribute("data-attention")).toBe(false);

    const alex = await demoCookie("Alex");
    const sent = await fetch(new URL(`/messages/${username}/send`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, cookie: alex },
      body: new URLSearchParams({ body: "Hi" }),
      redirect: "manual",
    });
    expect(sent.status).toBe(303);

    const loud = messagesLink(await html("/", cookie));
    expect(text(loud)).toBe("Messages (1)");
    expect(loud?.hasAttribute("data-attention")).toBe(true);
  });

  it("marks a form error (role=alert) on login, signup and the new-post form", async () => {
    for (const path of ["/login/?error=Wrong+password", "/signup/?error=Username+taken"]) {
      const alert = (await html(path)).querySelector('[role="alert"]');
      expect(text(alert), path).not.toBe("");
      expect(alert?.hasAttribute("data-attention"), path).toBe(true);
    }
    const cookie = await newStudent("shellerr");
    const res = await submitPost(cookie, { message: "no classes" });
    const doc = new JSDOM(await res.text()).window.document;
    const alert = doc.querySelector('[role="alert"]');
    expect(text(alert)).not.toBe("");
    expect(alert?.hasAttribute("data-attention")).toBe(true);
  });

  it("marks the edit form's and the accept step's errors too", async () => {
    const poster = await newStudent("shellalert");
    expect((await submitPost(poster, fields)).status).toBe(303);
    const id = await ownPostId(poster);
    const edit = await submitEdit(poster, id!, { message: "no classes" });
    const editAlert = new JSDOM(await edit.text()).window.document.querySelector('[role="alert"]');
    expect(text(editAlert)).not.toBe("");
    expect(editAlert?.hasAttribute("data-attention")).toBe(true);

    // an offer already declined can't be accepted: the confirm step says so
    const offerer = await newStudent("shellalertoff");
    expect((await submitOffer(offerer, id!, { class: CLASSES[2].id })).status).toBe(303);
    const [offerId] = await offerIdsOn(poster, id!);
    expect((await declineOffer(poster, offerId)).status).toBe(303);
    const blocked = (await html(`/offers/${offerId}/accept/`, poster)).querySelector('[role="alert"]');
    expect(text(blocked)).not.toBe("");
    expect(blocked?.hasAttribute("data-attention")).toBe(true);
  });

  it("leaves the board's flash notice (role=status) unmarked", async () => {
    const cookie = await newStudent("shellflash");
    const created = await submitPost(cookie, fields);
    expect(created.status).toBe(303);
    const flash = created.headers.get("set-cookie")?.match(/flash=([^;]+)/)?.[1];
    const doc = await html("/", `${cookie}; flash=${flash}`);
    const status = doc.querySelector('[role="status"]');
    expect(text(status)).toBe("Your swap post is on the board");
    expect(status?.hasAttribute("data-attention")).toBe(false);
  });

  it("leaves the login page's demo lines unmarked", async () => {
    const doc = await html("/login/");
    expect(doc.querySelectorAll(".demo-line").length).toBeGreaterThan(0);
    expect(doc.querySelector(".demo-students [data-attention]")).toBeNull();
    expect(doc.querySelector("main [data-attention]")).toBeNull();
  });
});

describe("primary and secondary buttons (0058)", () => {
  // one entry per matching control, "none" when it has neither style, so a
  // control that loses its class can't hide behind a sibling that has one
  const styleOf = (doc: Document, label: string): string[] => {
    const controls = [...doc.querySelectorAll<HTMLElement>("main a, main button")].filter((el) => text(el) === label);
    expect(controls.length, `a "${label}" control`).toBeGreaterThan(0);
    return controls.map((el) => (el.classList.contains("primary") ? "primary" : el.classList.contains("secondary") ? "secondary" : "none"));
  };
  const only = (styles: string[], want: "primary" | "secondary") => expect(styles.every((s) => s === want), styles.join(",")).toBe(true);

  it("Post a swap is primary", async () => {
    const cookie = await newStudent("shellbtn");
    only(styleOf(await html("/", cookie), "Post a swap"), "primary");
  });

  it("Offer to swap is primary, and an own pending offer's Withdraw is secondary", async () => {
    const poster = await newStudent("shellposter");
    expect((await submitPost(poster, fields)).status).toBe(303);
    const id = await ownPostId(poster);
    const offerer = await newStudent("shelloffer");
    only(styleOf(await html(`/posts/${id}/`, offerer), "Offer to swap"), "primary");
    expect((await submitOffer(offerer, id!, { class: CLASSES[2].id })).status).toBe(303);
    only(styleOf(await html(`/posts/${id}/`, offerer), "Withdraw"), "secondary");
    only(styleOf(await html("/", offerer), "Withdraw"), "secondary");
  });

  it("Accept is primary; Decline and the poster's Withdraw are secondary", async () => {
    const poster = await newStudent("shellowner");
    expect((await submitPost(poster, fields)).status).toBe(303);
    const id = await ownPostId(poster);
    const offerer = await newStudent("shelloffer2");
    expect((await submitOffer(offerer, id!, { class: CLASSES[2].id })).status).toBe(303);
    const doc = await html(`/posts/${id}/`, poster);
    only(styleOf(doc, "Accept"), "primary");
    only(styleOf(doc, "Decline"), "secondary");
    only(styleOf(doc, "Withdraw"), "secondary");
    only(styleOf(await html("/", poster), "Withdraw"), "secondary");
    // the confirm step's own button is the primary action too
    const [offerId] = await offerIdsOn(poster, id!);
    only(styleOf(await html(`/offers/${offerId}/accept/`, poster), "Accept the swap"), "primary");
  });

  it("a comment's Delete is secondary", async () => {
    const poster = await newStudent("shellcom");
    expect((await submitPost(poster, fields)).status).toBe(303);
    const id = await ownPostId(poster);
    const res = await fetch(new URL(`/posts/${id}/comments`, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, cookie: poster },
      body: new URLSearchParams({ body: "A comment" }),
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    only(styleOf(await html(`/posts/${id}/`, poster), "Delete"), "secondary");
  });
});
