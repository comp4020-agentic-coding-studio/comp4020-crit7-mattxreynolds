import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { publishPostChanged } from "./events";
import { comments, students, swapPosts } from "./schema";

// Comments on a swap post (0026, 0027, 0028): plain text, 1–500 characters,
// in one flat thread. The rules are here and every one is enforced on the
// server, whatever the form allowed.
export const COMMENT_MAX = 500;

export type AddCommentResult =
  | { ok: true; commentId: number }
  | { ok: false; reason: "not-found" | "not-open" | "invalid"; error: string };

export type DeleteCommentResult =
  | { ok: true; postId: number }
  | { ok: false; reason: "not-found" | "forbidden" | "not-open" | "already-deleted"; error: string };

const NO_SUCH_POST = "There is no swap post with that number.";
const NO_SUCH_COMMENT = "There is no comment with that number.";
const CLOSED = "This swap post is no longer open, so its comments can't be changed.";

const charCount = (text: string): number => [...text].length;

/** The comment as it will be stored, or why it can't be: the same rules as a
 *  post message (0016), plus "not empty". Line breaks are kept, as one
 *  character each; nothing else is trimmed, so it reads as written (0026). */
export function checkCommentBody(input: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = input.replace(/\r\n?/g, "\n");
  if (body.trim() === "") return { ok: false, error: "Write something to comment." };
  if (charCount(body) > COMMENT_MAX) return { ok: false, error: `A comment must be at most ${COMMENT_MAX} characters.` };
  return { ok: true, body };
}

// What a page or a refetch is given for one comment. A deleted comment has no
// author and no text here at all (0027), so no render path can show them.
export type CommentView =
  | { id: number; deleted: true }
  | {
      id: number;
      deleted: false;
      authorId: number;
      author: string;
      // written by the post's poster: shown with a "poster" tag (0026)
      byPoster: boolean;
      body: string;
      createdAt: Date;
    };

/** The post's thread, oldest first (0026). Deleted rows keep their place, and
 *  their text and author are read from the database and dropped here. */
export function commentsOn(postId: number): CommentView[] {
  const rows = db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      author: students.username,
      body: comments.body,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      posterId: swapPosts.studentId,
    })
    .from(comments)
    .innerJoin(students, eq(comments.authorId, students.id))
    .innerJoin(swapPosts, eq(comments.postId, swapPosts.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();
  return rows.map((row) =>
    row.deletedAt !== null
      ? { id: row.id, deleted: true }
      : {
          id: row.id,
          deleted: false,
          authorId: row.authorId,
          author: row.author,
          byPoster: row.authorId === row.posterId,
          body: row.body,
          createdAt: row.createdAt,
        },
  );
}

/** How many comments each post has, deleted ones not counted (0028). */
export function commentCounts(postIds: number[]): Map<number, number> {
  if (postIds.length === 0) return new Map();
  const rows = db
    .select({ postId: comments.postId, n: sql<number>`count(*)` })
    .from(comments)
    .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
    .groupBy(comments.postId)
    .all();
  return new Map(rows.map((r) => [r.postId, r.n]));
}

// "N comments" on the board (0028)
export function commentCountLabel(n: number): string {
  return `${n} ${n === 1 ? "comment" : "comments"}`;
}

// Any logged-in student, the poster included, comments on an open post (0026).
export function addComment(authorId: number, postId: number, input: string): AddCommentResult {
  const created = db.transaction((tx): AddCommentResult => {
    const post = tx.select({ status: swapPosts.status }).from(swapPosts).where(eq(swapPosts.id, postId)).get();
    if (!post) return { ok: false, reason: "not-found", error: NO_SUCH_POST };
    if (post.status !== "open") return { ok: false, reason: "not-open", error: CLOSED };
    const checked = checkCommentBody(input);
    if (!checked.ok) return { ok: false, reason: "invalid", error: checked.error };
    const row = tx
      .insert(comments)
      .values({ postId, authorId, body: checked.body, createdAt: new Date() })
      .returning({ id: comments.id })
      .get();
    return { ok: true, commentId: row.id };
  });
  if (created.ok) publishPostChanged(postId, "comment-added");
  return created;
}

// Only the author deletes, and only while the post is open (0027). Whoever
// isn't the author is refused first, so a stranger learns nothing about the
// comment or its post from the reason.
export function deleteComment(studentId: number, commentId: number): DeleteCommentResult {
  const result = db.transaction((tx): DeleteCommentResult => {
    const row = tx
      .select({
        postId: comments.postId,
        authorId: comments.authorId,
        deletedAt: comments.deletedAt,
        status: swapPosts.status,
      })
      .from(comments)
      .innerJoin(swapPosts, eq(comments.postId, swapPosts.id))
      .where(eq(comments.id, commentId))
      .get();
    if (!row) return { ok: false, reason: "not-found", error: NO_SUCH_COMMENT };
    if (row.authorId !== studentId) {
      return { ok: false, reason: "forbidden", error: "Only its author can delete a comment." };
    }
    if (row.status !== "open") return { ok: false, reason: "not-open", error: CLOSED };
    if (row.deletedAt !== null) return { ok: false, reason: "already-deleted", error: "This comment is already deleted." };
    tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId)).run();
    return { ok: true, postId: row.postId };
  });
  if (result.ok) publishPostChanged(result.postId, "comment-deleted");
  return result;
}
