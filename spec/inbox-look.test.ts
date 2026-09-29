import { beforeAll, describe, expect, it } from "vitest";
import { baseUrl, newStudent, page, text, usernameOf } from "./helpers";

// The inbox and a conversation, redesigned (issue #38, decisions 0055, 0058,
// 0033, 0031), read from the HTML the built server serves. Geometry (a
// sideways scroll at 390px, the coral bar) is Playwright's, in
// e2e/private-messages.spec.ts; here is what the markup promises: the
// attention marker on unread rows and only those, the bold hook kept, and a
// conversation whose thread and box are unchanged. Signing up hashes a
// password, so the file shares its students.
interface Student {
  cookie: string;
  username: string;
}

async function student(prefix: string): Promise<Student> {
  const cookie = await newStudent(prefix);
  return { cookie, username: await usernameOf(cookie) };
}

async function send(from: Student, to: Student, body: string) {
  const res = await fetch(new URL(`/messages/${to.username}/send`, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, cookie: from.cookie },
    body: new URLSearchParams({ body }),
    redirect: "manual",
  });
  expect(res.status).toBe(303);
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 15));
const rows = (doc: Document) => [
  ...doc.querySelectorAll("ul.conversation-list > li.conversation"),
];
const rowOf = (doc: Document, username: string) =>
  rows(doc).find(
    (li) => text(li.querySelector(".conversation-with")) === username,
  );

let me: Student;
let unreadFrom: Student;
let readFrom: Student;
let sentTo: Student;

beforeAll(async () => {
  me = await student("lookme");
  unreadFrom = await student("lookun");
  readFrom = await student("lookrd");
  sentTo = await student("lookst");
  await send(readFrom, me, "read me first");
  await pause();
  await send(unreadFrom, me, "still unread");
  await pause();
  await send(me, sentTo, "nothing back from you");
  await page(`/messages/${readFrom.username}/`, me.cookie);
});

describe("the inbox's attention marker (0058)", () => {
  it("is on an unread row, which keeps the unread class the bold hangs on", async () => {
    const row = rowOf(await page("/messages/", me.cookie), unreadFrom.username);
    expect(row?.hasAttribute("data-attention")).toBe(true);
    expect(row?.classList.contains("unread")).toBe(true);
  });

  it("is on no read row, and none of them is bold either", async () => {
    const doc = await page("/messages/", me.cookie);
    for (const other of [readFrom, sentTo]) {
      const row = rowOf(doc, other.username);
      expect(row, other.username).toBeTruthy();
      expect(row?.hasAttribute("data-attention"), other.username).toBe(false);
      expect(row?.classList.contains("unread"), other.username).toBe(false);
    }
  });

  it("is on exactly the unread rows, so the marker and the unread class never disagree", async () => {
    const doc = await page("/messages/", me.cookie);
    expect(
      rows(doc).map((li) => [
        li.hasAttribute("data-attention"),
        li.classList.contains("unread"),
      ]),
    ).toEqual([
      [false, false],
      [true, true],
      [false, false],
    ]);
  });

  it("moves with reading: opening the conversation clears it, a later message brings it back", async () => {
    const reader = await student("lookrdr");
    const writer = await student("lookwr");
    await send(writer, reader, "one");
    const marked = async () =>
      rowOf(
        await page("/messages/", reader.cookie),
        writer.username,
      )?.hasAttribute("data-attention");
    expect(await marked()).toBe(true);
    await page(`/messages/${writer.username}/`, reader.cookie);
    expect(await marked()).toBe(false);
    await pause();
    await send(writer, reader, "two");
    expect(await marked()).toBe(true);
  });

  it("is only the row's own: nothing else on the page, and no marker at all with nothing unread", async () => {
    const doc = await page("/messages/", me.cookie);
    expect(
      [...doc.querySelectorAll("main [data-attention]")].every((el) =>
        el.matches("li.conversation"),
      ),
    ).toBe(true);
    const quiet = await page("/messages/", unreadFrom.cookie); // wrote to me, was written to by no one
    expect(quiet.querySelectorAll("main [data-attention]")).toHaveLength(0);
  });

  it("keeps the label and the preview in a marked row, whole, in order: who, when, what", async () => {
    const row = rowOf(await page("/messages/", me.cookie), unreadFrom.username);
    const parts = [".conversation-with", "time", ".conversation-preview"].map(
      (sel) => row?.querySelector(sel),
    );
    expect(parts.every(Boolean)).toBe(true);
    for (let i = 1; i < parts.length; i++) {
      expect(
        Boolean(
          (parts[i - 1] as Element).compareDocumentPosition(
            parts[i] as Element,
          ) & 4,
        ),
        `part ${i}`,
      ).toBe(true);
    }
    expect(text(row?.querySelector(".conversation-preview"))).toBe(
      "still unread",
    );
    expect(row?.querySelector("a")?.getAttribute("href")).toBe(
      `/messages/${unreadFrom.username}/`,
    );
  });
});

describe("a conversation (0031, 0034)", () => {
  it("is one column with the thread, then the box, and marks nothing as attention once it is open", async () => {
    const doc = await page(`/messages/${unreadFrom.username}/`, me.cookie);
    expect(text(doc.querySelector("main h1"))).toBe(
      `Conversation with ${unreadFrom.username}`,
    );
    const wrap = doc.querySelector("main > .messages-page");
    expect(wrap).toBeTruthy();
    const live = doc.querySelector("#conversation-live");
    const box = doc.querySelector("textarea[name=body]");
    expect(wrap?.contains(live ?? null) && wrap?.contains(box ?? null)).toBe(
      true,
    );
    expect(
      Boolean((live as Element).compareDocumentPosition(box as Element) & 4),
    ).toBe(true);
    expect(live?.contains(box ?? null)).toBe(false);
    expect(doc.querySelectorAll("main [data-attention]")).toHaveLength(0);
    expect(
      doc
        .querySelector('nav a[href="/messages/"]')
        ?.hasAttribute("data-attention"),
    ).toBe(false);
  });

  it("tells mine from theirs by class and by the sender's name, oldest first", async () => {
    const other = readFrom; // already wrote to me, in beforeAll
    await send(me, other, "from me");
    const doc = await page(`/messages/${other.username}/`, me.cookie);
    const items = [
      ...doc.querySelectorAll(".private-message-list > li.private-message"),
    ];
    expect(
      items.map((li) => [
        li.classList.contains("mine"),
        text(li.querySelector(".private-message-head strong")),
        text(li.querySelector(".private-message-body")),
      ]),
    ).toEqual([
      [false, other.username, "read me first"],
      [true, me.username, "from me"],
    ]);
  });

  it("says so when there is nothing yet, and a not-found page is not wrapped as a conversation", async () => {
    const doc = await page(`/messages/${sentTo.username}/`, me.cookie);
    expect(doc.querySelectorAll(".private-message")).toHaveLength(1);
    const fresh = await page(
      `/messages/${(await student("lookempty")).username}/`,
      me.cookie,
    );
    expect(text(fresh.querySelector(".no-private-messages"))).toBe(
      "No private messages yet.",
    );
    const res = await fetch(new URL("/messages/nobody-here-9/", baseUrl), {
      headers: { cookie: me.cookie },
    });
    expect(res.status).toBe(404);
  });
});
