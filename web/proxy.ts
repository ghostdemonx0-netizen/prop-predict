import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

// Everything else - pages AND /data/*.json - requires a session.
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // deliberately COVERS /data/:path*.json (the board files must not be
  // fetchable logged-out); excludes only Next internals and the favicon
  matcher: ["/((?!_next|favicon\\.ico).*)"],
};
