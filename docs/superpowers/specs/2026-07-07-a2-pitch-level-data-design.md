# Barrel Edge — A2: Pitch-Level Data Foundation — Design Spec

- **Date:** 2026-07-07
- **Branch:** `feat/barrel-edge`
- **Status:** Design (autonomous — user delegated design→plan→code, stepping away). Scope locked through conversation.
- **Sign-off:** NONE (data/display only, no projection/bet-number change — like Phase 0). Wiring these into prop math is a *separate, later, signed-off* step.

---

## 1. Goal

Build the **pitch-level** data family that Phase 0 (batted-ball only) didn't cover, so every board column shows real numbers and the recipes are complete for later wiring. Compute — for BOTH batter and pitcher sides — **SwStr%, CSW%, Ball%**, plus **ZoneFit** (matchup), plus two cheap calcs **ISO** and **full xwOBA**. Fill the board's remaining "—" columns. **No math wiring, no sign-off.**

## 2. Roles (locked with user)
- **Future math VOTERS** (wired later, with sign-off): **ZoneFit, SwStr%, CSW%**.
- **Context / viewers** (display only, never a voter — avoids double-count): **ISO, full xwOBA, Ball%**. (Full xwOBA also becomes a **Layer-1 base** input in the later xStats upgrade; Ball% feeds a future Walks-Allowed prop.)

## 3. Data source (verified)
`statcast_batter`/`statcast_pitcher` already return **every pitch** (one row per pitch); the current event pull keeps all rows but slims to PA-level columns. So this is additive like Phase 0: **add pitch-descriptor columns** to the event whitelists. Verified fields present: `zone` (1–9 in-zone, 11–14 out), `description` (`ball, blocked_ball, called_strike, swinging_strike, swinging_strike_blocked, foul, foul_tip, hit_into_play`), `type` (`B/S/X`), `plate_x/plate_z`, `woba_value`, `woba_denom`, `estimated_woba_using_speedangle`, `stand`, `p_throws`.

## 4. The metrics (all pure, all grader-tunable seeds where noted)

Pitch universe P = all pitch rows strictly before `as_of`. (For a batter: pitches thrown TO him; for a pitcher: pitches he threw.)

- **SwStr%** = `count(description in {swinging_strike, swinging_strike_blocked}) / |P|`.
- **CSW%** = `count(description in {called_strike, swinging_strike, swinging_strike_blocked}) / |P|`.
- **Ball%** = `count(description in {ball, blocked_ball}) / |P|`.
- Batter side → the batter's own rates; pitcher side → `*_allowed`/induced rates (same code, different event source). Emitted alongside barrel metrics.

- **ISO** (batter, free calc from existing profile counts): `(season_2b + 2*season_3b + 3*season_hr) / AB`, where `AB = season_pa − walks − hbp − sac` (approximate `AB` by counting non-walk/non-HBP/non-sac PA-ending events already in the events; if unavailable, `AB ≈ season_pa`). Context column.

- **Full xwOBA** (batter + pitcher-allowed; context/display approximation): over PA-ending events with `woba_denom > 0`, `xwoba = Σ num / Σ woba_denom` where `num = estimated_woba_using_speedangle` for batted balls (contact) and `num = woba_value` for non-contact PA-enders (BB/HBP/K/etc., whose wOBA is deterministic). A reasonable display value; exactness isn't critical since it's a viewer, not a voter.

- **ZoneFit** (per-MATCHUP: hitter × pitcher). Two profile pieces + one combine:
  - **Hitter per-zone damage** `dmg[z]` for z in 1–14: mean `estimated_woba_using_speedangle` over the hitter's batted balls in zone z, regressed toward the hitter's overall xwOBAcon for thin zones (seed prior weight). Store the 14-vector on the batter profile.
  - **Pitcher per-zone frequency** `freq[z]`: fraction of the pitcher's pitches thrown in zone z (sums to 1). Store the 14-vector on the pitcher profile.
  - **ZoneFit(hitter, pitcher)** = `Σ_z dmg[z] · freq[z]` → the hitter's damage weighted by where THIS pitcher lives. Scaled to a clean display number (e.g. ×1000 → the ".105"-style value the board shows). Neutral/omitted with no data. Pure function `zone_fit(hitter, pitcher)`.

## 5. Where it lives (architecture)
- **Pull:** extend `_BATTER_EVENT_COLS` + `_PITCHER_EVENT_COLS` in `model/fetch.py` with `description, zone, type, plate_x, plate_z, woba_value, woba_denom` (some already present for barrel). **Bump the event cache key to `-v3`** (like P0·2) so fresh pulls include the pitch descriptors.
- **Compute:** a new `model/pitch_metrics.py` (SwStr/CSW/Ball + the per-zone `dmg`/`freq` vectors + a `zone_fit` combine) mirroring `model/barrel.py`'s shape; ISO + full-xwOBA helpers can live there or in `barrel.py`. Merge outputs into `batter_profile_from_events` / `pitcher_profile_from_events` (and the blended profiles) — additive keys.
- **Surface:** extend `build_boards_payload` (`export_web.py`) to emit `swstr, csw, ball, zonefit, iso, xwoba` on hitter rows and the pitcher-allowed versions on pitcher rows (fill the board "—"). Frontend already renders whatever keys are present; no frontend change needed beyond values arriving.
- **NO change** to `projections.py`/`pipeline.py` prob math, `barrel_effect.py`, or `prop_score.py`. This phase only *computes and displays*.

## 6. Testing
- Pure unit tests on `pitch_metrics` (SwStr/CSW/Ball counts, ISO calc, xwOBA calc, zone_fit combine on a small synthetic pitch set) mirroring `tests/test_barrel.py`.
- Profile tests: the new keys appear on batter + pitcher profiles.
- Full suite stays green (additive).
- A real-data smoke (like Phase 0's Judge check): print SwStr/CSW/Ball/ZoneFit for a known matchup and sanity-check (e.g. a high-whiff pitcher shows high CSW/SwStr-allowed; a good hitter vs a pitcher who lives in his zone shows a high ZoneFit).

## 7. Build order (ZoneFit last)
1. Pull columns + cache bump. 2. SwStr/CSW/Ball on profiles. 3. ISO + full xwOBA on profiles. 4. **ZoneFit** (per-zone vectors + `zone_fit`) — the hard one, last. 5. Surface all on the boards payload + real-data smoke.

## 8. Non-goals
- Wiring any of these into prop math / the nudge / the Prop Score (separate signed-off steps: add ZoneFit+SwStr to HR & other props; CSW to the pitcher engine; xwOBA to the Layer-1 base).
- Marcel-weighting the per-zone or pitch-level blends (equal-pool v1, like the barrel blend).
- Pitcher "scores" (Pitcher Score / K Score) — a later math step, not this data phase.
