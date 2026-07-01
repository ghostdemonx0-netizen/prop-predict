import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /api/live is public ON PURPOSE: it returns only live MLB box scores (no
// predictions, no board data), so the CDN can share one cached copy across all
// viewers instead of running the function per member. Everything else — pages,
// /data board files, predictions — stays gated below.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/live(.*)"]);

// Everything else - pages AND /data/*.json - requires a session.
const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default proxy;

export const config = {
  // deliberately COVERS /data/:path*.json (the board files must not be
  // fetchable logged-out); excludes only Next internals and the favicon
  matcher: ["/((?!_next|favicon\\.ico).*)"],
};
