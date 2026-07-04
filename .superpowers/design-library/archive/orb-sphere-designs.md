# Orb sphere designs — archived finishes

The probability orb (mock 7 "Spatial Depth" skin) went through three rounds of
sphere-finish exploration plus a readability pass. **"Neon + glass"** was chosen
and is now the live finish in `web/components/spatial/ProbabilityOrb.tsx` and (as
a ringless variant) `GlassDot.tsx`.

This file archives EVERY finish that was explored, with its exact CSS recipe, so
any of them can be revived later. The full comparison component is preserved next
to this file as **`OrbVariants.tsx`** (the `/next/orbs` comparison route was
deleted once the finish was chosen). To revive it: drop `OrbVariants.tsx` back
under `web/components/spatial/`, fix its relative imports, re-add a route, and
restore the `sp-orbv-*` CSS block (recipes below).

---

## Shared color tokens (per orb, from `heatCols()` / `heatColor`)

Every variant derives its colors from the live site's `heatColor(prob, kind)`
HSL string (blue → cyan → green → amber → red across each prop's real range),
then lifts them to stay vivid:

- `H` = hue, `S` = min(sat + 16, 92)
- `light` = base L, `brightL` = min(L + 24, 88), `darkL` = max(L − 26, 8)
- `col = hsl(H S light%)`, `bright = hsl(H S brightL%)`, `dark = hsl(H S darkL%)`
- Pearl also: `Ssoft = round(S*0.55)`, `H2 = (H+38)%360` (warm), `H3 = (H+336)%360` (cool)

The ringless `GlassDot` uses a FIXED hue (K=8 / C=150 / N=224, or env green 150 /
amber 40 / red 8) with `sat = 64 + t*26`, `lig = 46 + t*14`.

Every variant KEEPS the SVG progress ring (encodes raw %), the centered % number,
and the `heatColor` base color. Only the sphere finish changes. Unless noted, the
ring uses `col`; neon-family variants pass `bright`.

**Performance principle (rounds 3+):** no `backdrop-filter`, no large blur radii,
no big halos, minimal stacked box-shadows. Rim glow is done with small box-shadow
blur (cheap), not filters. This is why "Neon + glass" was safe to ship to phones.

---

## The finishes

### Current (pre-exploration baseline)
The original mock7 depth-halo orb: `orbShadow` (blurred cast shadow) + `orbHalo`
(blurred colored glow) + `orbCore` (radial light→dark gradient sphere) + big
`orbSpec` specular ellipse. Params size-scaled via `orbParams()`. Replaced because
the heavy blurred halo/shadow layers were the priciest per-orb cost on phones.

### Flat
Solid `col` fill, no gradient/gloss (the `default` switch case). Reference only.

### Matte
(Round-1 concept, not carried into round 2) — diffuse non-glossy fill, no specular.

### Glossy — round-1 favorite
Translucent liquid-glass bubble.
- **fill bg:** `radial-gradient(120% 120% at 32% 24%, hsl(H S 78% / .55), hsl(H S light% / .42) 44%, hsl(H S 12% / .55) 100%)`
- **box-shadow:** `inset 0 0 0 1px hsl(H S 92% / .5)`, `inset 0 2px 6px hsl(H 40% 98% / .35)`, `inset 0 -6px 14px hsl(H 80% 10% / .4)`, `0 2px 10px hsl(H 70% 8% / .35)`
- **sub-elements:** `.sp-orbv-gloss-spec` (sharp white specular top-left 46%×34%, blur .4px) + `.sp-orbv-gloss-band` (soft lower gloss band, blur 1px)
- **class:** `.sp-orbv-glossy { backdrop-filter: blur(1px) }`

### Gel — candy / jelly bead
Glossy translucent, gummier: broad soft top gloss + bright subsurface glow from the bottom.
- **fill bg:** `radial-gradient(115% 130% at 38% 22%, hsl(H S 84% / .68), hsl(H S light% / .8) 42%, hsl(H S darkL% / .86) 100%)`
- **box-shadow:** `inset 0 3px 8px hsl(H 40% 98% / .5)`, `inset 0 -11px 16px hsl(H 92% 62% / .42)` (subsurface glow), `inset 0 0 0 1px hsl(H S 88% / .42)`, `0 3px 12px hsl(H 80% 10% / .42)`
- **sub-elements:** `.sp-orbv-gel-gloss` (broad top gloss 56%×40%, blur 1.2px) + `.sp-orbv-gel-core` (inner bottom subsurface tint `radial-gradient(closest-side, hsl(H S 74% / .55), hsl(H S light% / 0) 72%)`, blur 2px)
- **class:** `.sp-orbv-gel { backdrop-filter: blur(.5px) }`

### Gradient — clean & understated
Smooth directional light-top → deep-bottom linear gradient, one subtle highlight, no glow.
- **fill bg:** `linear-gradient(176deg, hsl(H S brightL%) 0%, hsl(H S light%) 46%, hsl(H S darkL%) 100%)`
- **box-shadow:** `inset 0 1px 1px hsl(H 30% 96% / .4)`, `inset 0 -2px 5px hsl(H 70% 10% / .28)`, `inset 0 0 0 1px hsl(H S 22% / .32)` — no outer glow/cast
- **sub-element:** `.sp-orbv-grad-hi` (single soft highlight 48%×26%, blur 2px)

### Pearl — satin / pearlescent
Muted premium: broad diffuse sheen + slight iridescent hue shift; saturation reduced.
- **fill bg:** `radial-gradient(120% 120% at 40% 30%, hsl(H Ssoft% 90%), hsl(H round(S*0.6)% 72%) 44%, hsl(H2 Ssoft% 60%) 78%, hsl(H3 round(S*0.45)% 50%) 100%)`
- **box-shadow:** `inset 0 2px 6px hsl(H 20% 98% / .55)`, `inset 0 -6px 12px hsl(H 30% 40% / .3)`, `inset 0 0 0 1px hsl(H 30% 90% / .38)`, `0 2px 8px hsl(H 40% 20% / .3)`
- **sub-elements:** `.sp-orbv-pearl-iris` (inset 4%, `mix-blend-mode: screen`, blur 1.5px, `radial-gradient(closest-side at 62% 70%, hsl(H2 60% 74% / .5), transparent 70%)`) + `.sp-orbv-pearl-hi` (broad diffuse highlight 62%×44%, blur 3px)

### Chrome — polished metal
Vertical environment-reflection gradient tinted with heat hue (bright sky → dark horizon → reflected floor lightens → darkens at base) + one hard specular.
- **fill bg:** `linear-gradient(158deg, hsl(H min(S+6,96)% 92%) 0%, hsl(H S 66%) 20%, hsl(H S 30%) 46%, hsl(H S 15%) 58%, hsl(H S 52%) 82%, hsl(H S 24%) 100%)`
- **box-shadow:** `inset 0 2px 3px hsl(H 30% 98% / .6)`, `inset 0 -9px 12px hsl(H 60% 6% / .5)`, `inset 0 0 0 1px hsl(H S 82% / .45)`, `0 3px 10px hsl(0 0% 0% / .45)`
- **sub-element:** `.sp-orbv-chrome-spec` (small 30%×20%, hard, rotated −18°, near-opaque white radial highlight, blur .2px) — this hard dot sells "polished metal"
- **ring:** `col`, glow 4

### Neon rim — dark core, glowing edge
Near-black core faintly tinted; the color lives on the RIM + the ring.
- **fill bg:** `radial-gradient(88% 88% at 50% 46%, hsl(H S 9%), hsl(H S 5%) 62%, hsl(H S 4%) 100%)`
- **box-shadow:** `inset 0 0 0 1.5px hsl(H S min(brightL+4,82)%)`, `inset 0 0 12px hsl(H S brightL% / .6)`, `inset 0 0 3px hsl(H S brightL% / .9)`, `0 0 16px hsl(H S brightL% / .5)`
- **sub-element:** `.sp-orbv-neon-arc` (inset −2%, `mix-blend-mode: screen`, `radial-gradient(closest-side, transparent 66%, hsl(H S brightL% / .55) 88%, transparent 100%)`)
- **ring:** `bright`, glow 6. Priciest of the neon set (screen blend + 16px bloom).

### Neon + light chrome
Neon rim + a DIM, quiet chrome fill (top highlight capped ~56%). Cheapest of round 3: NO sub-elements.
- **fill bg:** `linear-gradient(158deg, hsl(H S 56%) 0%, hsl(H S 38%) 26%, hsl(H S 22%) 50%, hsl(H S 14%) 62%, hsl(H S 30%) 84%, hsl(H S 18%) 100%)`
- **box-shadow (3 small):** `inset 0 0 0 1.5px hsl(H S brightL% / .9)`, `inset 0 0 6px hsl(H S brightL% / .3)`, `0 0 7px hsl(H S brightL% / .38)`
- **ring:** `bright`, glow 4

### Neon + medium chrome
Same idea, fuller/brighter fill (top ~74%) + one cheap UNBLURRED specular dot.
- **fill bg:** `linear-gradient(158deg, hsl(H S 74%) 0%, hsl(H S 52%) 22%, hsl(H S 28%) 48%, hsl(H S 16%) 60%, hsl(H S 44%) 84%, hsl(H S 22%) 100%)`
- **box-shadow:** `inset 0 1px 2px hsl(H 30% 96% / .35)`, `inset 0 0 0 1.5px hsl(H S min(brightL+4,82)% / .95)`, `inset 0 0 9px hsl(H S brightL% / .4)`, `0 0 10px hsl(H S brightL% / .42)`
- **sub-element:** `.sp-orbv-softspec` (soft dim specular dot 34%×22%, NO blur)
- **ring:** `bright`, glow 5

### Chrome + neon edge
The bright Chrome fill (identical to Chrome), but the metal edge line + black cast are swapped for a thin neon rim line + one small neon outer glow. Chrome-dominant, neon accent.
- **fill bg:** identical to Chrome
- **box-shadow:** `inset 0 2px 3px hsl(H 30% 98% / .6)`, `inset 0 -9px 12px hsl(H 60% 6% / .5)`, `inset 0 0 0 1.25px hsl(H S brightL% / .95)`, `0 0 10px hsl(H S brightL% / .5)`
- **sub-element:** `.sp-orbv-chrome-spec` (reused hard dot)
- **ring:** `bright`, glow 5

### Neon + transparent chrome — readability pick
Neon rim + a SEE-THROUGH metal sheen (fill alpha ~.10–.24) so the dark bg shows through and the % keeps contrast. NO sub-element, NO blur.
- **fill bg:** `linear-gradient(158deg, hsl(H S 62% / .24) 0%, hsl(H S 42% / .16) 30%, hsl(H S 22% / .10) 52%, hsl(H S 16% / .12) 64%, hsl(H S 34% / .20) 86%, hsl(H S 20% / .14) 100%)`
- **box-shadow:** `inset 0 1px 2px hsl(H 30% 96% / .22)`, `inset 0 0 0 1.5px hsl(H S brightL% / .9)`, `inset 0 0 7px hsl(H S brightL% / .28)`, `0 0 8px hsl(H S brightL% / .4)`
- **ring:** `bright`, glow 4

### ★ Neon + glass — CHOSEN (now live)
Neon glowing rim + a NEARLY-CLEAR glassy center (fill alpha ~.06–.12) so the dark
background reads through and the % is maximally legible. One thin top gloss line
sells the glass. Cheapest fill of all — no blur, no backdrop-filter.
- **fill bg:** `linear-gradient(160deg, hsl(H S 60% / .12) 0%, hsl(H S 40% / .06) 46%, hsl(H S 24% / .08) 100%)`
- **box-shadow:** `inset 0 0 0 1.5px hsl(H S min(brightL+4,82)% / .92)`, `inset 0 0 6px hsl(H S brightL% / .22)`, `0 0 8px hsl(H S brightL% / .4)`
- **sub-element / gloss:** thin unblurred top gloss — top 9%, left 20%, width 60%, height 24%, `linear-gradient(180deg, hsl(0 0% 100% / .3), hsl(0 0% 100% / 0) 92%)` (in the live orb this is the restyled `.orbSpec`; in the archived `OrbVariants` it is `.sp-orbv-glass-gloss`)
- **ring:** `bright`. (Live orb keeps the heat-scaled `orbParams().glow`, 2→7; the archived variant used a fixed glow of 4.)
- **number:** two-layer dark text-shadow `0 1px 4px hsl(248 80% 2% / .85), 0 0 7px hsl(248 80% 2% / .7)` so the % stays crisp on the near-clear fill.

The live ringless `GlassDot` (CatDot / EnvDot / LeanPair) uses the SAME recipe
minus the SVG ring, with its fixed K/C/N or env-sign hue.

> **UPDATE (round 4, superseded):** the near-clear "Neon + glass" above read too
> bright once it was live. A round-4 pass explored DARKER / deeper glass fills
> (keeping the same neon ring, SVG progress ring, and white % number) and the user
> chose **Deep glass** — see the round-4 section below. Deep glass is now the live
> finish in `ProbabilityOrb.tsx` and the ringless `GlassDot`. "Neon + glass" is no
> longer live but is preserved above for reference.

---

## Round 4 — dark / glass fills (Deep glass CHOSEN)

The near-clear "Neon + glass" finish shipped but read too BRIGHT. Round 4 reverted
it and explored five DARKER / subtler glass center fills — including one that
mimics the app's own CARDS glass — while keeping the neon ring the user liked.

Every round-4 variant keeps the exact same three things unchanged:
- the neon glowing rim (in the `heatColor` hue),
- the SVG progress ring (encodes raw %),
- the centered % in IBM Plex Mono, drawn WHITE with a subtle two-layer dark halo.

Only the CENTER FILL changes. The archived `OrbVariants.tsx` next to this file is
this round-4 comparison (Cards glass / Cards glass frosted / Deep glass / Smoked
glass / Neon glass near-clear). Shared **neon rim** used by all five (the "ring"
look kept): `inset 0 0 0 1.5px hsl(H S rim% / .92)`, `inset 0 0 6px hsl(H S brightL% / .22)`,
`0 0 8px hsl(H S brightL% / .4)` — where `rim = min(brightL+4, 82)`,
`brightL = min(light+24, 88)`. Number halo (all five): `0 1px 4px hsl(248 80% 2% / .85), 0 0 7px hsl(248 80% 2% / .7)`.

### ★ Deep glass — CHOSEN (now live)
A darker, deeper translucent glass center: a radial fill that darkens toward the
bottom edge for real depth, plus a thin inset top highlight. Neon rim carries the
color. Cheap — no blur, no backdrop-filter.
- **fill bg:** `radial-gradient(120% 120% at 50% 36%, hsl(H S 20% / .5) 0%, hsl(H S 11% / .68) 58%, hsl(H S 7% / .82) 100%)`
- **box-shadow:** `inset 0 1px 1px hsl(0 0% 100% / .1)` (top highlight), then the shared neon rim (3 shadows above)
- **sub-element / gloss:** full-inset subtle top gloss `linear-gradient(180deg, hsl(0 0% 100% / .06), transparent 30%)` (`.sp-orbv-cardgloss` in the archived variant; the live `.orbSpec` was restyled to this)
- **ring:** `bright`. (Live orb keeps the heat-scaled `orbParams().glow`, 2→7; the archived variant used a fixed glow of 4.)
- **live in:** `ProbabilityOrb.tsx` + ringless `GlassDot` (fixed K/C/N or env-sign hue, `sat = 64 + t*26`, `lig = 46 + t*14`).

### Cards glass — NOT chosen
The SAME glass material as the app's `GlassCard` / `.sp-float`, made round: the
orb reads like a little round card. No blur.
- **fill bg:** `linear-gradient(168deg, var(--glass), var(--glass-2))`
- **box-shadow:** `inset 0 1px 0 var(--hi)` (card top highlight), `inset 0 0 0 1px var(--line-2)` (card border line), then the shared neon rim
- **sub-element:** `.sp-orbv-cardgloss` (full-inset subtle top gloss, as above)

### Cards glass frosted — NOT chosen
Cards glass PLUS the card's real backdrop-filter blur — the ONLY round-4 variant
that uses blur (mimics desktop cards; priciest to composite).
- **fill bg / box-shadow / gloss:** identical to Cards glass
- **class:** `.sp-orbv-frost { backdrop-filter: blur(20px) saturate(1.3) }` (+ `-webkit-` prefix)

### Smoked glass — NOT chosen
A dark, smoky, very subtle translucent fill — like Deep glass but LOW saturation
(a near-neutral smoky tint instead of a colored deep tint).
- **fill bg:** `radial-gradient(120% 120% at 50% 40%, hsl(H 18% 22% / .34) 0%, hsl(H 20% 12% / .46) 60%, hsl(H 22% 8% / .55) 100%)`
- **box-shadow:** `inset 0 1px 1px hsl(0 0% 100% / .08)`, then the shared neon rim
- **sub-element:** `.sp-orbv-cardgloss`

### Neon glass (near-clear) — NOT chosen (the reverted-to reference)
The previously-live near-clear fill (alpha ~.06–.12), carried into round 4 as the
"too bright" baseline to compare against. Full recipe: see the round-3
"★ Neon + glass" section above.
- **fill bg:** `linear-gradient(160deg, hsl(H S 60% / .12) 0%, hsl(H S 40% / .06) 46%, hsl(H S 24% / .08) 100%)`
- **box-shadow:** the shared neon rim only
- **sub-element:** thin top gloss line `.sp-orbv-glass-gloss` (top 9%, left 20%, width 60%, height 24%, `linear-gradient(180deg, hsl(0 0% 100% / .3), hsl(0 0% 100% / 0) 92%)`)

**Round-4 `sp-orbv-*` structure classes** (removed from `spatial.css` when the
comparison route was deleted, needed to revive `OrbVariants.tsx`):
- `.sp-orbv-fill` `{ position:absolute; inset:0; border-radius:50%; overflow:hidden; z-index:1 }`
- `.sp-orbv-frost` `{ backdrop-filter: blur(20px) saturate(1.3) }`
- `.sp-orbv-cardgloss` `{ position:absolute; inset:0; border-radius:inherit; pointer-events:none; background: linear-gradient(180deg, hsl(0 0% 100% / .06), transparent 30%) }`
- `.sp-orbv-glass-gloss` `{ position:absolute; top:9%; left:20%; width:60%; height:24%; border-radius:50%; background: linear-gradient(180deg, hsl(0 0% 100% / .3), hsl(0 0% 100% / 0) 92%) }`
- plus `.sp-orbv`, `.sp-orbv-ring`, `.sp-orbv-num` (+ `-num i`), and the page/grid/cell/head chrome (`.sp-orbv-page`, `-head`, `-grid`, `-row` `grid-template-columns: 64px repeat(5, 1fr)`, `-cell`, `-corner`, `-colhead`, `-rowhead`, `-caption`).
