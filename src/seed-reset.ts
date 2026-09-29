import { eq } from "drizzle-orm";
import { db } from "./lib/db";
import { resetDemo } from "./lib/seed";
import { swapPosts } from "./lib/schema";

// The operator's reset (0040, 0041, 0049). It is bundled to dist/seed-reset.mjs
// beside the server: `pnpm seed:reset` runs that file locally and
// `fly ssh console -C "node dist/seed-reset.mjs"` runs it on Fly. Nothing in
// the app imports or calls this; the app has no reset button.
//
// Importing the database opens DATABASE_PATH and applies the migrations, as a
// boot does, so it works on a volume no server has touched yet.
resetDemo(db);

const path = process.env.DATABASE_PATH ?? "./.data/app.db";
const open = db.select({ id: swapPosts.id }).from(swapPosts).where(eq(swapPosts.status, "open")).all().length;
console.log(`Reset the demo to the seed in ${path} (${open} open swap posts).`);
