import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { CLASSES } from "../src/lib/classes";

// The accept cascade against a real SQLite file (issue #21, decision 0024):
// the store is imported in this process on its own temp database, so a test
// can break the database part-way through an accept and look at what is left.
const dbPath = join(mkdtempSync(join(tmpdir(), "accept-store-")), "store.db");
process.env.DATABASE_PATH = dbPath;
const { db } = await import("../src/lib/db");
const { acceptOffer, makeOffer } = await import("../src/lib/offer-store");
const { createPost } = await import("../src/lib/posts");
const { students } = await import("../src/lib/schema");

const [MON_14, , WED_9, WED_1030, WED_14, WED_1530] = CLASSES.map((c) => c.id);

function newStudent(username: string): number {
  return db.insert(students).values({ username, passwordHash: "x" }).returning({ id: students.id }).get().id;
}
function newPost(studentId: number, leaving: string, join: string[]): number {
  const made = createPost(studentId, { leavingClassId: leaving, joinClassIds: join, message: "" });
  if (!made.ok) throw new Error(made.error);
  return made.postId;
}
function newOffer(offererId: number, postId: number, offered: string): number {
  const made = makeOffer(offererId, postId, offered);
  if (!made.ok) throw new Error(made.error);
  return made.offerId;
}

// what is in the database, as (offer id, status, closed reason) and (post id, status)
function snapshot() {
  const raw = new Database(dbPath, { readonly: true });
  const rows = {
    offers: raw.prepare("select id, status, closed_reason as reason from offers order by id").all(),
    posts: raw.prepare("select id, status, withdrawn_by as by from swap_posts order by id").all(),
  };
  raw.close();
  return rows;
}

it("closes exactly what 0024 lists, in one transaction: a failure part-way leaves nothing changed", () => {
  const poster = newStudent("store-poster");
  const offerer = newStudent("store-offerer");
  const third = newStudent("store-third");
  const other = newStudent("store-other");
  const posterPost = newPost(poster, MON_14, [WED_9, WED_1030]);
  const offererPost = newPost(offerer, WED_9, [MON_14]);
  const otherPost = newPost(other, WED_14, [WED_1530]);
  const accepted = newOffer(offerer, posterPost, WED_9);
  const onSwapped = newOffer(third, posterPost, WED_1030);
  const posterElsewhere = newOffer(poster, otherPost, WED_1530);
  const onOfferersPost = newOffer(third, offererPost, MON_14);
  const unrelated = newOffer(third, otherPost, WED_1530);
  const before = snapshot();
  for (const id of [accepted, onSwapped, posterElsewhere, onOfferersPost, unrelated]) {
    expect(before.offers.find((o) => (o as { id: number }).id === id)).toMatchObject({ status: "pending" });
  }

  // break the last step of the cascade: withdrawing the offerer's own post
  const raw = new Database(dbPath);
  raw.exec(
    "create trigger fail_withdraw before update on swap_posts when new.status = 'withdrawn' begin select raise(abort, 'broken on purpose'); end",
  );
  expect(() => acceptOffer(poster, accepted)).toThrow(/broken on purpose/);
  expect(snapshot()).toEqual(before);

  raw.exec("drop trigger fail_withdraw");
  raw.close();
  expect(acceptOffer(poster, accepted)).toMatchObject({ ok: true });

  const after = snapshot();
  const offer = (id: number) => after.offers.find((o) => (o as { id: number }).id === id);
  expect(offer(accepted)).toMatchObject({ status: "accepted", reason: null });
  expect(offer(onSwapped)).toMatchObject({ status: "closed", reason: "post-swapped" });
  expect(offer(posterElsewhere)).toMatchObject({ status: "closed", reason: "offerer-swapped" });
  expect(offer(onOfferersPost)).toMatchObject({ status: "closed", reason: "post-withdrawn" });
  expect(offer(unrelated)).toMatchObject({ status: "pending", reason: null });
  const post = (id: number) => after.posts.find((p) => (p as { id: number }).id === id);
  expect(post(posterPost)).toMatchObject({ status: "swapped" });
  // withdrawn by the swap, not by anyone
  expect(post(offererPost)).toMatchObject({ status: "withdrawn", by: null });
  expect(post(otherPost)).toMatchObject({ status: "open" });
});
