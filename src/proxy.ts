import { auth } from "@/lib/auth/server";

// Scoped to /auth/callback only: that's the one path OAuth providers land back on,
// and exchanging the one-time verifier for a real session cookie only happens inside
// auth.middleware(). A broader matcher would also force-redirect anonymous visitors
// off every other route (its skip-list doesn't include "/"), which we don't want —
// the home page already renders its own sign-in prompt for anonymous users.
export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: ["/auth/callback"],
};
