import { sql } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export const students = sqliteTable(
  "students",
  {
    id: int().primaryKey({ autoIncrement: true }),
    username: text().notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  // usernames are unique ignoring case (0011): an index on lower(username)
  // enforces that at the database, not just in application code.
  (table) => [uniqueIndex("students_username_lower_idx").on(sql`lower(${table.username})`)],
);

export const sessions = sqliteTable("sessions", {
  token: text().primaryKey(),
  studentId: int("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
});

// The six crit-group sessions students swap between (0008, 0010). Rows are
// written at boot from the committed seed file (src/lib/classes.ts); the app
// never fetches them and no request changes them.
export const classes = sqliteTable("classes", {
  id: text().primaryKey(),
  position: int().notNull(),
  day: text().notNull(),
  start: text().notNull(),
  end: text().notNull(),
  room: text().notNull(),
  tutor: text().notNull(),
});

// A swap post (0016): one leaving class, its join classes beside it in
// swap_post_join_classes, an optional message and when it was posted, as an
// instant (0046 formats it for Canberra when shown). It is open, or
// withdrawn (0018: withdrawn_at, and withdrawn_by, the student who did it),
// or swapped (0024, when offers arrive); edited_at is the last edit (0018).
export const swapPosts = sqliteTable(
  "swap_posts",
  {
    id: int().primaryKey({ autoIncrement: true }),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    leavingClassId: text("leaving_class_id")
      .notNull()
      .references(() => classes.id),
    message: text(),
    status: text({ enum: ["open", "withdrawn", "swapped"] })
      .notNull()
      .default("open"),
    postedAt: int("posted_at", { mode: "timestamp_ms" }).notNull(),
    editedAt: int("edited_at", { mode: "timestamp_ms" }),
    withdrawnAt: int("withdrawn_at", { mode: "timestamp_ms" }),
    withdrawnBy: int("withdrawn_by").references(() => students.id),
  },
  // at most one open post per student (0017), enforced by the database so two
  // simultaneous requests can't both get in
  (table) => [
    uniqueIndex("swap_posts_one_open_per_student_idx")
      .on(table.studentId)
      .where(sql`${table.status} = 'open'`),
  ],
);

export const swapPostJoinClasses = sqliteTable(
  "swap_post_join_classes",
  {
    postId: int("post_id")
      .notNull()
      .references(() => swapPosts.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
  },
  (table) => [primaryKey({ columns: [table.postId, table.classId] })],
);

// An offer (0022, 0025): a student saying "happy to swap" on a swap post,
// naming the join class they hold and would leave. Its status is what became
// of it; a closed offer stores why (closed_reason), and resolved_at is when it
// stopped pending.
export const offers = sqliteTable(
  "offers",
  {
    id: int().primaryKey({ autoIncrement: true }),
    postId: int("post_id")
      .notNull()
      .references(() => swapPosts.id, { onDelete: "cascade" }),
    offererId: int("offerer_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    offeredClassId: text("offered_class_id")
      .notNull()
      .references(() => classes.id),
    status: text({ enum: ["pending", "accepted", "declined", "withdrawn", "closed"] })
      .notNull()
      .default("pending"),
    closedReason: text("closed_reason", { enum: ["post-withdrawn", "post-swapped", "offerer-swapped"] }),
    createdAt: int("created_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: int("resolved_at", { mode: "timestamp_ms" }),
  },
  // at most one pending offer per student per post (0022), enforced by the
  // database so two simultaneous requests can't both get in
  (table) => [
    uniqueIndex("offers_one_pending_per_student_post_idx")
      .on(table.postId, table.offererId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type Student = typeof students.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SchoolClass = typeof classes.$inferSelect;
export type SwapPost = typeof swapPosts.$inferSelect;
