# Site Protection (Email-Code Login) — Design Spec (2026-06-12)

## Goal

The entire site goes behind an invite-only, email-code (OTP) login. Visitors see a themed sign-in screen; only emails the owner has invited can get in; the data files are unreachable without a session. The owner manages everything from Clerk's dashboard. The Python engine and the automation robot are untouched.

## User decisions (2026-06-12)

| Decision | Choice |
|---|---|
| Lock scope | **Everything** — all pages and all data files; public teaser page MAYBE later |
| Access model | **Invite-only** — only owner-invited emails can sign in; strangers see "invite-only" |
| Auth provider | **Clerk** (email OTP, restricted mode, prebuilt dashboard; free tier covers current scale) |
| Owner panel v1 | **Clerk's dashboard** (dashboard.clerk.com) — invite/revoke/list users there; custom in-site `/admin` deferred to the managers phase ("A for now, eventually B") |
| Deferred | Teaser page, manager roles, custom admin UI, paid tiers (see memory: auth-membership-vision) |

## Visitor experience

- Logged out, ANY route → the sign-in screen: Ballpark Lights theme, logo, email field. No board content, no data.
- Invited email → 6-digit code via email → signed in → full site. Session persists (Clerk default, ~weeks) so codes aren't needed every visit.
- Uninvited email → Clerk's restricted-mode message (access is invite-only).
- Signed in → small user/sign-out button in the site header.

## Architecture

- `@clerk/nextjs` SDK. `ClerkProvider` wraps the app in `web/app/layout.tsx`.
- **`web/middleware.ts`** with `clerkMiddleware`: every route protected except the sign-in page and Clerk's own internals. The matcher EXPLICITLY covers `/data/:path*` so the board JSONs cannot be fetched without a session.
- **Critical verification (the side-door test):** logged-out `curl https://<site>/data/latest.json` must NOT return data (redirect or 401). If Vercel's static-asset serving bypasses middleware for `public/` files, the FALLBACK design activates: move generated JSONs out of `web/public/data` into a non-public directory served by a protected route handler (`web/app/data/[...file]/route.ts` with `auth.protect()`), and point `model/export_web.DATA_DIR` + the workflows' cache path at the new location. The implementation plan must include this verification with both outcomes specified; whichever path passes the side-door test ships.
- Sign-in page `web/app/sign-in/[[...sign-in]]/page.tsx` using Clerk's `<SignIn />` with `appearance` mapped to the existing CSS variables (dark background, green accent, display font).
- Clerk app configuration (dashboard, done with the user): authentication strategy **email verification code only** (no passwords, no social logins in v1); sign-up mode **Restricted** (invitation-only); application name "Prop Predict".
- Header: `<UserButton />` (or a styled sign-out) added near the date picker.

## Keys & environments

- Two keys per Clerk environment: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- Production keys → Vercel project env vars (Production). Development keys → `web/.env.local` (gitignored) for localhost.
- **Robot unaffected:** the workflows don't change; Vercel injects project env vars into every deploy, including robot deploys. No new GitHub secrets.

## Failure & recovery

- Clerk outage → sign-in temporarily unavailable; data stays protected (middleware fails closed). Site never exposes content while auth is down.
- User session expired → re-enter email code. No passwords to lose.
- **Owner lockout prevention (user's explicit requirement):** during setup the owner adds account recovery on their Clerk account (and optionally 2FA). The owner's Clerk login is the root of trust; Clerk support is the last resort. Documented in the setup task.

## Testing

- Existing vitest suite + `npm run build` must stay green (auth is additive; no board logic changes).
- Manual verification checklist (in the plan, executed before merge): logged-out homepage → sign-in screen; logged-out fetch of `/data/latest.json` and `/data/index.json` → blocked (THE critical test); uninvited email → restricted message; invited email full flow → board; session survives browser restart; sign-out works; localhost dev flow with dev keys; robot deploy after merge still green and the deployed site enforces all of the above.

## Owner setup (interactive task with the user, ~10 min)

1. Create Clerk account (user's email = owner/root) + application "Prop Predict"; pick email-code-only auth; set Restricted sign-up mode.
2. Set up Clerk account recovery (+ recommend 2FA) — the "master can always get back in" guarantee.
3. Copy production keys → Vercel env (via dashboard or `vercel env add`); development keys → `web/.env.local`.
4. First invite (owner's own second email or a friend) to prove the flow end to end.

## Out of scope

Teaser/landing page; manager roles and custom `/admin` (built when managers arrive); paid tiers/billing; pick-log (explicitly deprioritized 2026-06-12); any change to model math, the engine, or the automation schedule.
