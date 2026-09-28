import { sql } from "drizzle-orm";
import { int, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export type Student = typeof students.$inferSelect;
export type Session = typeof sessions.$inferSelect;
