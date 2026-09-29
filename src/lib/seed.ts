import { and, eq, inArray, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { CLASSES, type ClassId } from "./classes";
import { hashPassword } from "./password";
import { classes, comments, offers, privateMessages, students, swapPostJoinClasses, swapPosts } from "./schema";

// The demo students (0014, 0037): first-name usernames sharing one published
// password, and the posts, offers, comments and private messages written for
// them (0038).
export const DEMO_USERNAMES = ["alex", "priya", "sam", "lena", "jordan", "mei", "noah"] as const;
export const DEMO_PASSWORD = "demo-student";

// The classes come from the committed seed file (src/lib/classes.ts) on every
// boot, so a corrected file reaches the deployed volume; nothing else writes
// them.
export function seedClasses(db: BetterSQLite3Database): void {
  db.transaction((tx) => {
    CLASSES.forEach((c, position) => {
      tx.insert(classes)
        .values({ ...c, position })
        .onConflictDoUpdate({ target: classes.id, set: { ...c, position } })
        .run();
    });
  });
}

// The open posts (0038) that exist so far, with times set relative to when
// the seed runs: alex's is the oldest, lena's the newest.
const HOUR = 60 * 60 * 1000;
const DEMO_POSTS: { username: string; leaving: ClassId; joins: ClassId[]; message?: string; hoursAgo: number }[] = [
  { username: "alex", leaving: "shitao", joins: ["baishi", "dachi"], message: "Clashes with my lab.", hoursAgo: 68 },
  { username: "priya", leaving: "baishi", joins: ["shitao", "bada"], hoursAgo: 40 },
  { username: "lena", leaving: "bada", joins: ["yunlin", "liuru"], hoursAgo: 5 },
];

// The pending offers (0038), each after the post it is on. An offered class is
// the offerer's own leaving class where they have a post (priya's is Wed 09:00,
// lena's Mon 15:30), so the seed never contradicts itself; sam has no post.
const DEMO_OFFERS: { offerer: string; poster: string; offered: ClassId; hoursAgo: number }[] = [
  { offerer: "priya", poster: "alex", offered: "baishi", hoursAgo: 60 },
  { offerer: "sam", poster: "alex", offered: "dachi", hoursAgo: 30 },
  { offerer: "lena", poster: "priya", offered: "bada", hoursAgo: 20 },
];

// The comments on open posts (0038), each after its post: sam asks alex a
// question and alex, the poster, answers it (that comment carries the "poster"
// tag).
const DEMO_COMMENTS: { author: string; poster: string; body: string; hoursAgo: number }[] = [
  { author: "sam", poster: "alex", body: "Would you rather have Wed 09:00 or Wed 10:30?", hoursAgo: 50 },
  { author: "alex", poster: "alex", body: "Either is fine. It is only Mon 14:00 that clashes with my lab.", hoursAgo: 46 },
];

// The private messages (0038). priya writes to alex about her offer and he has
// not opened it (unread, 0033). jordan and mei talk after the swap, which is
// why a conversation outlives a post (0026); both were read. Each sits after
// what it refers to: priya's offer (60h ago) and the swap (60h ago).
const DEMO_PRIVATE_MESSAGES: {
  sender: string;
  recipient: string;
  body: string;
  hoursAgo: number;
  read: boolean;
}[] = [
  {
    sender: "priya",
    recipient: "alex",
    body: "Hi Alex, I have offered my Wed 09:00. Are you free to sort out the MyTimetable change today?",
    hoursAgo: 36,
    read: false,
  },
  {
    sender: "jordan",
    recipient: "mei",
    body: "Thanks for the swap. I have moved to Wed 15:30 in MyTimetable.",
    hoursAgo: 58,
    read: true,
  },
  {
    sender: "mei",
    recipient: "jordan",
    body: "Done on my side too, I am in Wed 14:00 now. See you Wednesday!",
    hoursAgo: 57,
    read: true,
  },
];

// jordan's swapped post (0038) and the offer mei made on it, which jordan
// accepted: jordan moves to Wed 15:30 and mei to Wed 14:00. It is the oldest
// thing in the seed, and the swap happened after the offer, so the
// jordan/mei conversation and jordan's comment sit either side of
// `swappedHoursAgo`. Neither student has anything pending.
const DEMO_SWAP: {
  poster: string;
  leaving: ClassId;
  join: ClassId;
  offerer: string;
  postedHoursAgo: number;
  offeredHoursAgo: number;
  swappedHoursAgo: number;
  // mei's comment on the post, after her offer and before the swap (0038)
  commentBody: string;
  commentedHoursAgo: number;
} = {
  poster: "jordan",
  leaving: "yunlin",
  join: "liuru",
  offerer: "mei",
  postedHoursAgo: 71,
  offeredHoursAgo: 65,
  swappedHoursAgo: 60,
  commentBody: "I hold Wed 15:30 and would happily move, so I have made an offer.",
  commentedHoursAgo: 64,
};

type Tx = Parameters<Parameters<BetterSQLite3Database["transaction"]>[0]>[0];

// Written only when no demo student exists (0040): a fresh volume or a fresh
// test database. A boot never tops up a partly present seed, or a restart
// would undo what was done as a demo student; only the operator's reset
// puts it back.
export function seedDemoStudents(db: BetterSQLite3Database): void {
  const existing = db
    .select({ id: students.id })
    .from(students)
    .where(inArray(students.username, [...DEMO_USERNAMES]))
    .get();
  if (existing) return;

  db.transaction((tx) => writeDemoSeed(tx));
}

// The operator's reset (0041, 0049), in one transaction so a failure part-way
// leaves the database as it was (0024's shape). It deletes everything that
// involves a demo student, then writes the seed again (0038). Students are
// not in the list: every account stays, and a demo student who is missing is
// written back. Real-only rows are never matched.
export function resetDemo(db: BetterSQLite3Database): void {
  db.transaction((tx) => {
    const demoIds = tx
      .select({ id: students.id })
      .from(students)
      .where(inArray(students.username, [...DEMO_USERNAMES]))
      .all()
      .map((row) => row.id);

    if (demoIds.length > 0) {
      // a real student's post is swapped through a demo student's accepted
      // offer: it names both students, so it goes with that offer (0024)
      const swappedWithDemo = tx
        .select({ postId: offers.postId })
        .from(offers)
        .where(and(eq(offers.status, "accepted"), inArray(offers.offererId, demoIds)))
        .all()
        .map((row) => row.postId);
      const postIds = tx
        .select({ id: swapPosts.id })
        .from(swapPosts)
        .where(
          or(
            inArray(swapPosts.studentId, demoIds),
            swappedWithDemo.length > 0 ? inArray(swapPosts.id, swappedWithDemo) : undefined,
          ),
        )
        .all()
        .map((row) => row.id);

      // children first, so no delete leans on a foreign key cascade
      tx.delete(comments)
        .where(or(inArray(comments.authorId, demoIds), postIds.length > 0 ? inArray(comments.postId, postIds) : undefined))
        .run();
      tx.delete(offers)
        .where(or(inArray(offers.offererId, demoIds), postIds.length > 0 ? inArray(offers.postId, postIds) : undefined))
        .run();
      if (postIds.length > 0) {
        tx.delete(swapPostJoinClasses).where(inArray(swapPostJoinClasses.postId, postIds)).run();
        tx.delete(swapPosts).where(inArray(swapPosts.id, postIds)).run();
      }
      tx.delete(privateMessages)
        .where(or(inArray(privateMessages.senderId, demoIds), inArray(privateMessages.recipientId, demoIds)))
        .run();
    }

    writeDemoSeed(tx);
  });
}

function writeDemoSeed(tx: Tx): void {
  const now = Date.now();
  const ids = new Map<string, number>();
  for (const username of DEMO_USERNAMES) {
    // a clash with an existing student (usernames are unique ignoring case)
    // leaves that student alone rather than stopping the server booting; a
    // demo student who already exists, as on a reset, keeps their account
    const row = tx
      .insert(students)
      .values({ username, passwordHash: hashPassword(DEMO_PASSWORD) })
      .onConflictDoNothing()
      .returning({ id: students.id })
      .get();
    const id = row?.id ?? tx.select({ id: students.id }).from(students).where(eq(students.username, username)).get()?.id;
    if (id !== undefined) ids.set(username, id);
  }

  const postIds = new Map<string, number>();
  for (const post of DEMO_POSTS) {
    const studentId = ids.get(post.username);
    if (studentId === undefined) continue;
    const { id } = tx
      .insert(swapPosts)
      .values({
        studentId,
        leavingClassId: post.leaving,
        message: post.message ?? null,
        postedAt: new Date(now - post.hoursAgo * HOUR),
      })
      .returning({ id: swapPosts.id })
      .get();
    tx.insert(swapPostJoinClasses)
      .values(post.joins.map((classId) => ({ postId: id, classId })))
      .run();
    postIds.set(post.username, id);
  }

  for (const offer of DEMO_OFFERS) {
    const offererId = ids.get(offer.offerer);
    const postId = postIds.get(offer.poster);
    if (offererId === undefined || postId === undefined) continue;
    tx.insert(offers)
      .values({ postId, offererId, offeredClassId: offer.offered, createdAt: new Date(now - offer.hoursAgo * HOUR) })
      .run();
  }

  for (const comment of DEMO_COMMENTS) {
    const authorId = ids.get(comment.author);
    const postId = postIds.get(comment.poster);
    if (authorId === undefined || postId === undefined) continue;
    tx.insert(comments)
      .values({ postId, authorId, body: comment.body, createdAt: new Date(now - comment.hoursAgo * HOUR) })
      .run();
  }

  for (const message of DEMO_PRIVATE_MESSAGES) {
    const senderId = ids.get(message.sender);
    const recipientId = ids.get(message.recipient);
    if (senderId === undefined || recipientId === undefined) continue;
    const sentAt = now - message.hoursAgo * HOUR;
    tx.insert(privateMessages)
      .values({
        senderId,
        recipientId,
        body: message.body,
        createdAt: new Date(sentAt),
        // a read one was opened soon after it was sent
        readAt: message.read ? new Date(sentAt + HOUR) : null,
      })
      .run();
  }

  const posterId = ids.get(DEMO_SWAP.poster);
  const offererId = ids.get(DEMO_SWAP.offerer);
  if (posterId !== undefined && offererId !== undefined) {
    const { id } = tx
      .insert(swapPosts)
      .values({
        studentId: posterId,
        leavingClassId: DEMO_SWAP.leaving,
        status: "swapped",
        postedAt: new Date(now - DEMO_SWAP.postedHoursAgo * HOUR),
      })
      .returning({ id: swapPosts.id })
      .get();
    tx.insert(swapPostJoinClasses).values({ postId: id, classId: DEMO_SWAP.join }).run();
    tx.insert(comments)
      .values({
        postId: id,
        authorId: offererId,
        body: DEMO_SWAP.commentBody,
        createdAt: new Date(now - DEMO_SWAP.commentedHoursAgo * HOUR),
      })
      .run();
    tx.insert(offers)
      .values({
        postId: id,
        offererId,
        offeredClassId: DEMO_SWAP.join,
        status: "accepted",
        createdAt: new Date(now - DEMO_SWAP.offeredHoursAgo * HOUR),
        resolvedAt: new Date(now - DEMO_SWAP.swappedHoursAgo * HOUR),
      })
      .run();
  }
}
