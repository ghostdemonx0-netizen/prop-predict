import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

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
