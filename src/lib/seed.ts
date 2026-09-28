import { inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { hashPassword } from "./password";
import { students } from "./schema";

// The demo students (0014, 0037): first-name usernames sharing one published
// password. Later slices add the posts, offers, comments and private
// messages written for them (0038) beside these rows.
export const DEMO_USERNAMES = ["alex", "priya", "sam", "lena", "jordan", "mei", "noah"] as const;
export const DEMO_PASSWORD = "demo-student";

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

  db.transaction((tx) => {
    for (const username of DEMO_USERNAMES) {
      tx.insert(students).values({ username, passwordHash: hashPassword(DEMO_PASSWORD) }).run();
    }
  });
}
