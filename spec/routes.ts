// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it.
export const ROUTES = ["/", "/readme/", "/login/", "/signup/", "/posts/new/", "/messages/alex/"];
// The live refresh's fragment routes (/fragments/board/, /fragments/posts/N/)
// are left out on purpose: they are not pages (no title, heading or landmark)
// and answer a logged-out request with a 401. spec/live.test.ts covers them.
