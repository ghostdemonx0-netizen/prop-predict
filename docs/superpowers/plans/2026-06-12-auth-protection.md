# Auth Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the entire site (pages AND the `/data/*.json` board files) behind Clerk email-code, invite-only login with a Ballpark-Lights-themed sign-in screen — per `docs/superpowers/specs/2026-06-12-auth-protection-design.md` — building everything that doesn't require the user's Clerk account, then stopping at the interactive setup gate (Task 4).

**Architecture:** `@clerk/nextjs` SDK: `ClerkProvider` in the root layout, Clerk middleware protecting every route except the sign-in page (matcher written so `/data/:path*.json` IS covered), a catch-all sign-in page rendering Clerk's `<SignIn />` themed via its `appearance` API, and a `<UserButton />` in the board header. No Python/engine/workflow changes. Keys arrive in Task 4 (user); until then verification = TypeScript + vitest + a dummy-key build attempt.

**Tech Stack:** Next.js 16 App Router (⚠️ `web/CLAUDE.md`: this Next version may differ from training data — READ `node_modules/next/dist/docs/` before writing middleware/config code; the middleware file convention may be `middleware.ts` OR `proxy.ts` in this version — VERIFY, don't assume), @clerk/nextjs (latest), existing vitest setup.

**Baseline:** branch `auth-protection`; web suite 7 vitest tests; `cd web && npx tsc --noEmit` clean; never commit `web/public/data/index.json` (intentionally locally modified) or `web/.env.local`.

---

## File map

| File | Responsibility |
|---|---|
| `web/package.json` (modify via npm install) | + `@clerk/nextjs` |
| `web/app/layout.tsx` (modify) | wrap html in `<ClerkProvider>` |
| `web/middleware.ts` (create — or `web/proxy.ts` if this Next version's docs say so) | protect everything except `/sign-in`; matcher covers `/data` JSONs |
| `web/app/sign-in/[[...sign-in]]/page.tsx` (create) | themed `<SignIn />` |
| `web/app/page.tsx` (modify) | `<UserButton />` in the header |
| `web/.env.local.example` (create) | documents the two keys + sign-in URL env |
| `docs/AUTH-SETUP.md` (create) | the with-user runbook for Task 4 |

---

### Task 1: Clerk core wiring (no keys yet)

**Files:** modify `web/app/layout.tsx`, `web/app/page.tsx` is NOT touched here; create `web/middleware.ts` (or `proxy.ts` — see Step 1), `web/app/sign-in/[[...sign-in]]/page.tsx`, `web/.env.local.example`.

- [ ] **Step 1: Establish the middleware convention for THIS Next version.**

Run: `ls /Users/issiakadiawara/Projects/prop-predict/web/node_modules/next/dist/docs/ | grep -iE "proxy|middleware"` and read the matching doc file(s). Decide the correct filename (`middleware.ts` vs `proxy.ts`) and export shape for this Next version. Also run `cd web && npm install @clerk/nextjs` and read `web/node_modules/@clerk/nextjs/README.md` for the current middleware helper name (expected: `clerkMiddleware` + `createRouteMatcher` from `@clerk/nextjs/server`). Record findings in the commit message. If Clerk's helper is incompatible with this Next version's middleware convention, report BLOCKED with the doc excerpts — do not improvise.

- [ ] **Step 2: Root layout gains ClerkProvider.** In `web/app/layout.tsx`, import and wrap (keep everything else — fonts, classNames — identical):

```tsx
import { ClerkProvider } from "@clerk/nextjs";
```

and wrap the returned JSX:

```tsx
  return (
    <ClerkProvider>
      <html lang="en">
        {/* existing body exactly as-is */}
      </html>
    </ClerkProvider>
  );
```

- [ ] **Step 3: The gate.** Create `web/middleware.ts` (rename per Step 1 findings if needed):

```ts
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
```

- [ ] **Step 4: Sign-in page.** Create `web/app/sign-in/[[...sign-in]]/page.tsx` (theming comes in Task 2 — keep this minimal):

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
      <SignIn />
    </main>
  );
}
```

- [ ] **Step 5: Env documentation.** Create `web/.env.local.example`:

```bash
# Clerk (per environment - DEV keys here for localhost, PROD keys live in Vercel env)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
```

Confirm `web/.gitignore` (or root) already ignores `.env*` files (Next's default scaffold does — verify with `git check-ignore web/.env.local`; if not ignored, add `web/.env.local` to web/.gitignore in this commit).

- [ ] **Step 6: Verify what can be verified without keys.**

Run: `cd web && npx tsc --noEmit` → clean. `npx vitest run` → 7 passed.
Then attempt a build with a syntactically-valid dummy key:
`cd web && NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k CLERK_SECRET_KEY=sk_test_dummy npm run build`
Expected: compiles. If it fails ONLY for key-validation/prerender-auth reasons, capture the exact error in the report and proceed (real-key build is part of Task 4); any OTHER error must be fixed.

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/app/layout.tsx web/middleware.ts "web/app/sign-in/[[...sign-in]]/page.tsx" web/.env.local.example
git commit -m "feat: Clerk gate - provider, protected middleware incl /data, sign-in page"
```

(Adjust the middleware filename in the add if Step 1 dictated `proxy.ts`. NEVER add web/public/data files or .env.local.)

---

### Task 2: Theming + header sign-out

**Files:** modify `web/app/sign-in/[[...sign-in]]/page.tsx`, `web/app/page.tsx`.

- [ ] **Step 1: Theme the sign-in card.** Replace the sign-in page with (hexes are the Ballpark Lights tokens from `web/app/globals.css`):

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5">
      <div style={{ textAlign: "center" }}>
        <h1 className="wordmark" style={{ fontSize: "2rem" }}>
          <span className="lo">Prop </span><span className="hi">Predict</span>
        </h1>
        <p className="eyebrow" style={{ marginTop: "0.4rem" }}>members only · access by invite</p>
      </div>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#3ee07f",
            colorBackground: "#0e1613",
            colorText: "#e9f1ec",
            colorTextSecondary: "#87a096",
            colorInputBackground: "#15241d",
            colorInputText: "#e9f1ec",
            borderRadius: "10px",
          },
          elements: {
            card: { boxShadow: "0 0 40px rgba(62, 224, 127, 0.08)", border: "1px solid rgba(120, 200, 150, 0.14)" },
            footer: { display: "none" },
          },
        }}
      />
    </main>
  );
}
```

(If the installed Clerk version's `appearance.elements` keys differ — check `node_modules/@clerk/types` — adapt the element names; the variables block is stable API.)

- [ ] **Step 2: Header sign-out.** In `web/app/page.tsx`: add `import { UserButton } from "@clerk/nextjs";` and place the button in the header logo row, after `<FlamingBall />`:

```tsx
          <FlamingBall />
          <span style={{ marginLeft: "auto" }}>
            <UserButton />
          </span>
```

(The logo row div already has `flex items-center` — `marginLeft: auto` pushes the avatar to the right edge.)

- [ ] **Step 3: Verify.** `cd web && npx tsc --noEmit` clean; `npx vitest run` 7 passed; dummy-key build attempt as in Task 1 Step 6 (same expectations).

- [ ] **Step 4: Commit**

```bash
git add "web/app/sign-in/[[...sign-in]]/page.tsx" web/app/page.tsx
git commit -m "feat: themed sign-in screen and header sign-out"
```

---

### Task 3: The with-user runbook

**Files:** create `docs/AUTH-SETUP.md`.

- [ ] **Step 1: Write the runbook** — this is the artifact Task 4 executes. Full content:

```markdown
# Auth go-live runbook (interactive — owner + Claude)

## A. Create the owner account (~10 min, browser)
1. clerk.com → Sign up with THE OWNER EMAIL (this email = root of all control).
2. Create application: name "Prop Predict".
   - Sign-in options: enable **Email** with **Email verification code**; DISABLE password and all social providers.
3. Configure → **Restrictions** → Sign-up mode: **Restricted** (invitation-only).
4. Account security: set up recovery (and ideally 2FA) on the Clerk account itself — this is the "master can always get back in" guarantee.

## B. Keys
5. Clerk dashboard → API Keys: copy the **Development** pair into `web/.env.local` (copy `web/.env.local.example` as the template).
6. Copy the **Production** pair into Vercel: project prop-predict → Settings → Environment Variables → add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (Production), plus `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`.
   - Production instance in Clerk requires the domain: Clerk dashboard → Domains → add `prop-predict.vercel.app` (follow its instructions).

## C. Local preview (standing rule: preview before production)
7. `cd web && npm run dev` → localhost:3000 must show the themed sign-in.
8. Owner signs in via email code → board appears; sign-out button works.
9. Logged-out check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/data/latest.json` → expect 404/40x/redirect, NOT 200-with-data. ALSO open the JSON URL in a private window → must not show numbers.

## D. THE SIDE-DOOR TEST (production, after deploy)
10. Merge `auth-protection` → main, push; deploy (`cd web && npx vercel deploy --prod`).
11. Logged out: `curl -sI https://prop-predict.vercel.app/` → not the board (redirect to sign-in).
12. Logged out: `curl -s https://prop-predict.vercel.app/data/latest.json | head -c 200` → MUST NOT be board JSON.
    - **If this leaks** (static files bypass middleware on Vercel): activate the spec's fallback — move generated JSON out of `web/public/data` to a private dir served by a protected route handler, repoint `model/export_web.DATA_DIR`, `web/lib/data.ts` fetch paths, and the workflows' cache path. (Coded only if needed; new mini-plan at that point.)
13. Robot compatibility: trigger `gh workflow run refresh-board`; confirm green INCLUDING the deploy step, and the deployed site still enforces sign-in afterwards.

## E. First members
14. Clerk dashboard → Users → **Invitations** → invite the owner's second email or a friend; have them complete the email-code flow.
15. Confirm an UNinvited email is refused at sign-in.

## F. Done criteria
- All of C, D, E pass. Site = members-only. Owner can invite/revoke/list from dashboard.clerk.com.
```

- [ ] **Step 2: Commit**

```bash
git add docs/AUTH-SETUP.md
git commit -m "docs: auth go-live runbook for the interactive setup"
```

---

### Task 4: INTERACTIVE GO-LIVE (controller + user — DO NOT run as a subagent; BLOCKED until the user returns)

Execute `docs/AUTH-SETUP.md` top to bottom with the user: account (A), keys (B), local preview + user okay (C), merge/push/deploy + side-door test (D — includes the only deploy; the standing preview-before-production rule is satisfied by C), first invite (E). If D-12 leaks, write the fallback mini-plan before any further deploys. Afterwards: update project memory (auth live, owner email, where invites happen) and re-verify the robot's next scheduled run deploys green.

---

## Self-review notes

- **Spec coverage:** lock-everything (T1 matcher), invite-only (runbook A3), themed sign-in (T2), header sign-out (T2), env/keys split (T1 S5 + runbook B), robot-unaffected (no workflow changes; runbook D-13 verifies), side-door test + fallback (runbook C9/D12 mirroring the spec), owner recovery (runbook A4), Clerk-dashboard-as-admin (runbook E). Deferred items absent by design.
- **Placeholders:** none — every file has full content; the only conditional is the documented middleware-filename verification (Step 1) and the documented dummy-key build expectation, both with explicit decision rules.
- **Consistency:** middleware path referenced identically in T1 S3/S7 and file map; sign-in route `/sign-in` consistent across middleware matcher, env example, and runbook.
