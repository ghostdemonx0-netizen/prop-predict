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
