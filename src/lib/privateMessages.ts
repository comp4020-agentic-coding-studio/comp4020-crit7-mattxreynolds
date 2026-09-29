import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import { publishPrivateMessageSent } from "./events";
import { privateMessages, students } from "./schema";

// Private messages (0030, 0031, 0032): plain text, 1–500 characters, from one
// student to another, never edited or deleted. The rules are here and every
// one is enforced on the server, whatever the form allowed. Always said in
// full, in code too: bare "message" means a swap post's message.
export const PRIVATE_MESSAGE_MAX = 500;

export type SendResult =
  | { ok: true; recipient: string }
  | { ok: false; reason: "not-found" | "self" | "invalid"; error: string };

const charCount = (text: string): number => [...text].length;

/** The private message as it will be stored, or why it can't be: the same
 *  rules as a comment (0032). Line breaks are kept, as one character each;
 *  nothing else is trimmed, so it reads as written. */
export function checkPrivateMessageBody(input: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = input.replace(/\r\n?/g, "\n");
  if (body.trim() === "") return { ok: false, error: "Write something to send." };
  if (charCount(body) > PRIVATE_MESSAGE_MAX) {
    return { ok: false, error: `A private message must be at most ${PRIVATE_MESSAGE_MAX} characters.` };
  }
  return { ok: true, body };
}

export interface OtherStudent {
  id: number;
  username: string;
}

/** The student behind a `/messages/<username>/` address. Usernames are unique
 *  ignoring case (0011), so the address is too; the stored spelling is what
 *  comes back. */
export function studentByUsername(username: string): OtherStudent | null {
  return (
    db
      .select({ id: students.id, username: students.username })
      .from(students)
      .where(sql`lower(${students.username}) = lower(${username})`)
      .get() ?? null
  );
}

/** The other student of a conversation, as the viewer may open it: nobody for
 *  an unknown username or the viewer's own (0031). */
export function conversationPartner(viewerId: number, username: string): OtherStudent | null {
  const other = studentByUsername(username);
  return other && other.id !== viewerId ? other : null;
}

// What a page or a refetch is given for one private message.
export interface PrivateMessageView {
  id: number;
  // sent by the viewer (the other student is the one named on the page)
  fromViewer: boolean;
  sender: string;
  body: string;
  createdAt: Date;
}

/** Every private message between the viewer and `other`, oldest first (0031).
 *  The query names the viewer on one side of every row, so it can only ever
 *  return the viewer's own (0034). */
export function conversationWith(viewerId: number, other: OtherStudent, viewerName: string): PrivateMessageView[] {
  const rows = db
    .select({
      id: privateMessages.id,
      senderId: privateMessages.senderId,
      body: privateMessages.body,
      createdAt: privateMessages.createdAt,
    })
    .from(privateMessages)
    .where(
      or(
        and(eq(privateMessages.senderId, viewerId), eq(privateMessages.recipientId, other.id)),
        and(eq(privateMessages.senderId, other.id), eq(privateMessages.recipientId, viewerId)),
      ),
    )
    .orderBy(asc(privateMessages.createdAt), asc(privateMessages.id))
    .all();
  return rows.map((row) => ({
    id: row.id,
    fromViewer: row.senderId === viewerId,
    sender: row.senderId === viewerId ? viewerName : other.username,
    body: row.body,
    createdAt: row.createdAt,
  }));
}

// Any logged-in student writes to any other (0030). Refused: an unknown
// username, yourself, and a body that breaks the rules.
export function sendPrivateMessage(senderId: number, recipientUsername: string, input: string): SendResult {
  const recipient = studentByUsername(recipientUsername);
  if (!recipient) return { ok: false, reason: "not-found", error: "There is no student with that username." };
  if (recipient.id === senderId) {
    return { ok: false, reason: "self", error: "You can't send a private message to yourself." };
  }
  const checked = checkPrivateMessageBody(input);
  if (!checked.ok) return { ok: false, reason: "invalid", error: checked.error };
  db.insert(privateMessages)
    .values({ senderId, recipientId: recipient.id, body: checked.body, createdAt: new Date() })
    .run();
  publishPrivateMessageSent();
  return { ok: true, recipient: recipient.username };
}

/** How many private messages the viewer has received and not yet read (0033):
 *  the header's "Messages (N)". */
export function unreadCount(viewerId: number): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(privateMessages)
      .where(and(eq(privateMessages.recipientId, viewerId), isNull(privateMessages.readAt)))
      .get()?.n ?? 0
  );
}

/** Opening a conversation reads every private message received there (0033):
 *  the viewer's own, from `other`, and nothing sent by the viewer or in
 *  anyone else's conversation. The one GET that writes. */
export function markConversationRead(viewerId: number, other: OtherStudent): void {
  db.update(privateMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(privateMessages.recipientId, viewerId),
        eq(privateMessages.senderId, other.id),
        isNull(privateMessages.readAt),
      ),
    )
    .run();
}

// What the inbox shows for one conversation.
export interface InboxRow {
  username: string;
  // the last private message of the conversation, whoever sent it
  preview: string;
  at: Date;
  unread: boolean;
}

// The inbox cuts a long last private message to this many characters (then "…").
export const INBOX_PREVIEW_CUT = 80;

/** The last private message as one line: line breaks read as spaces, cut at
 *  INBOX_PREVIEW_CUT characters with "…" when there was more. */
export function inboxPreview(body: string): string {
  const chars = [...body.replace(/\s+/g, " ").trim()];
  return chars.length > INBOX_PREVIEW_CUT ? `${chars.slice(0, INBOX_PREVIEW_CUT).join("")}…` : chars.join("");
}

/** The viewer's conversations, most recent activity first (0033). The query
 *  names the viewer on one side of every row, so it can only return the
 *  viewer's own (0031). One row per other student. */
export function inboxFor(viewerId: number): InboxRow[] {
  const rows = db
    .select({
      senderId: privateMessages.senderId,
      recipientId: privateMessages.recipientId,
      body: privateMessages.body,
      createdAt: privateMessages.createdAt,
      readAt: privateMessages.readAt,
    })
    .from(privateMessages)
    .where(or(eq(privateMessages.senderId, viewerId), eq(privateMessages.recipientId, viewerId)))
    .orderBy(desc(privateMessages.createdAt), desc(privateMessages.id))
    .all();
  // newest first, so the first row seen for a student is the conversation's last
  const byOther = new Map<number, Omit<InboxRow, "username">>();
  for (const row of rows) {
    const otherId = row.senderId === viewerId ? row.recipientId : row.senderId;
    const unread = row.recipientId === viewerId && row.readAt === null;
    const seen = byOther.get(otherId);
    if (seen) {
      seen.unread ||= unread;
    } else {
      byOther.set(otherId, { preview: inboxPreview(row.body), at: row.createdAt, unread });
    }
  }
  if (byOther.size === 0) return [];
  const names = new Map(
    db
      .select({ id: students.id, username: students.username })
      .from(students)
      .where(inArray(students.id, [...byOther.keys()]))
      .all()
      .map((s) => [s.id, s.username]),
  );
  return [...byOther].flatMap(([id, row]) => {
    const username = names.get(id);
    return username === undefined ? [] : [{ username, ...row }];
  });
}

/** Unread private messages for each of these usernames: the login page's
 *  unread part of a demo line (0039). Counts only. */
export function demoUnreadCounts(usernames: readonly string[]): Map<string, number> {
  const rows = db
    .select({ username: sql<string>`lower(${students.username})`, n: sql<number>`count(*)` })
    .from(privateMessages)
    .innerJoin(students, eq(privateMessages.recipientId, students.id))
    .where(and(isNull(privateMessages.readAt), inArray(sql`lower(${students.username})`, usernames.map((u) => u.toLowerCase()))))
    .groupBy(sql`lower(${students.username})`)
    .all();
  return new Map(usernames.flatMap((u) => {
    const row = rows.find((r) => r.username === u.toLowerCase());
    return row ? [[u, row.n] as [string, number]] : [];
  }));
}

/** The login page's unread part of a demo line: "1 unread message". */
export function unreadLabel(n: number): string {
  return `${n} unread ${n === 1 ? "message" : "messages"}`;
}
