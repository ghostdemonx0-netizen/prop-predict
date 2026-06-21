"""Designed HTML manual report — styled email (cards, color-coded props, rank badges).

Content below is the curated smart layer Claude assembles each run (buzz from posted X
parlays, availability-filtered + model-cross-referenced; my plays; my 3-leg parlays).
Sends via Resend using the local .env key.

Usage: python scripts/manual_report_pretty.py [--dry-run] [--to you@example.com]
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.parlays import _best_per_game, _combined, build_all_parlays, build_parlay_set  # noqa: E402
from model.plays import select_plays  # noqa: E402
from model.plays_email import platoon_badge  # noqa: E402

BOARD = "/Users/issiakadiawara/Projects/prop-predict/web/public/data/latest.json"
RESEND_URL = "https://api.resend.com/emails"
# Today's freshly-swept buzz layer (Most Bet-On / Slate / Tweets / Flags / Trending). Written
# anew each run from the live X / last30days sweep; the staleness guard refuses to send if its
# date isn't today, so the buzz can never go out stale. See scripts/manual_today.example.json.
CONTENT = Path(__file__).resolve().parent / "manual_today.json"

# ---- palette ----
INK = "#0f172a"
SUB = "#475569"
LINE = "#e2e8f0"
HR_C = "#e8590c"   # orange
K_C = "#1c7ed6"    # blue
HIT_C = "#2f9e44"  # green
BG = "#f1f5f9"

PROP_C = {"HR": HR_C, "K": K_C, "HITS": HIT_C}
PROP_LABEL = {"HR": "HOME RUN", "K": "STRIKEOUT", "HITS": "HITS"}
PILL = {
    "agree": ("#e6f4ea", "#1e7d34", "✅ MODEL + BUZZ AGREE"),
    "contrarian": ("#fff4e6", "#b9760a", "⚠️ CONTRARIAN EDGE"),
    "lean": ("#eef2f7", "#475569", "👀 MODEL LEAN"),
}

DATE = "June 20, 2026"

SLATE = [
    "📅 <b>14 games</b> today — <b>early read</b>, lineups not yet confirmed (projections).",
    "🔁 Re-run closer to first pitch (~1:10pm ET) for confirmed lineups before betting.",
    "🔥 Ben Rice is the most-posted HR name in early parlays — and he's in a lineup.",
]

MY_PLAYS = [
    {"prop": "HITS", "lead": "LOCK", "player": "Kody Clemens", "bet": "1+ hit", "model": "83%",
     "tag": "lean", "why": "Highest single probability on the whole board today — the safest floor play (projected; confirm lineup)."},
    {"prop": "HR", "player": "Ben Rice", "bet": "To hit a HR", "model": "24%",
     "tag": "agree", "why": "Most-posted HR name in the early parlays (10+ mentions) AND on my board. Bettors and the math agree."},
    {"prop": "HR", "player": "Byron Buxton", "bet": "To hit a HR", "model": "32%",
     "tag": "contrarian", "why": "My model's #1 HR play (32%) but not in the early parlay buzz — your differentiated angle."},
    {"prop": "K", "player": "J.T. Ginn", "bet": "Over 3.5 Ks", "model": "79%",
     "tag": "lean", "why": "Top strikeout edge on the board, and K parlay buzz is light this early — quiet money."},
]

MY_PARLAYS = [
    {"name": "The Safe 3-Leg", "tag": "your most-played type", "combined": "55%", "color": HIT_C,
     "legs": [("Kody Clemens", "1+ hit", "83%"), ("Matt Shaw", "1+ hit", "82%"),
              ("Endy Rodríguez", "1+ hit", "81%")],
     "why": "Three highest-floor hit props on the board, different games — ~55% combined. The ticket I'd fire (confirm lineups first)."},
    {"name": "Model + Buzz HR Bomb", "tag": "longshot, big upside", "combined": "2.0%", "color": HR_C,
     "legs": [("Byron Buxton", "HR", "32%"), ("Kyle Schwarber", "HR", "26%"), ("Ben Rice", "HR", "24%")],
     "why": "My three best HR numbers, all playing today — Ben Rice & Schwarber also buzzing. Small stake, big ceiling."},
]

# (player, model%) ranked MOST bet-on at top. Filled each run from a DEEP multi-account X
# sweep, availability-filtered to who's playing. Target depth: 15 per prop. No fake counts.
BUZZ_HR = [("Ben Rice", "24%"), ("Kyle Schwarber", "26%"), ("Yordan Alvarez", "22%"),
           ("Nick Kurtz", "17%"), ("Pete Alonso", "15%")]
BUZZ_HITS = [("Ben Rice", "70%"), ("Yordan Alvarez", "69%"), ("Kyle Schwarber", "66%"), ("Nick Kurtz", "64%")]
BUZZ_K = []  # K parlay volume is light this early — fills in closer to game time
DROPPED = "Jordan Walker, Christian Scott — in early parlays but NOT in today's lineups"

TWEETS = [
    "🔒 Lock: Kody Clemens 1+ hit (my model 83%) — quietly the safest play on today's board. 👉 [link] #MLB #PropBets",
    "💣 Ben Rice is in everybody's early HR parlay — and my model backs it (24%). When the slips and the math agree, I'm in. 👉 [link] #HomeRunProps",
    "🎰 My safe 3-leg: Kody Clemens + Matt Shaw + Endy Rodríguez, all 1+ hit. ~55% combined, three different games. 👉 [link] #GamblingTwitter",
]

BLEND = [
    ("✅", HIT_C, "Convergence (safest)", "Ben Rice — top of the early HR parlays AND on my board (24% HR / 70% hit). Lead with him."),
    ("⚠️", HR_C, "My contrarian edges", "Byron Buxton — my #1 HR at 32% with zero early buzz. J.T. Ginn K (79%) — no public K parlays yet. Pure model edges."),
    ("🌀", SUB, "Buzz I'm fading", "Jordan Walker & Christian Scott showed up in slips but aren't in today's lineups. Don't bet names that aren't playing."),
]

FLAGS = [
    ("⏰", "EARLY READ", "Lineups are NOT confirmed yet — everything here is projected. Re-run closer to first pitch."),
    ("🔁", "Confirm before betting", "Status flips projected → confirmed as lineups post (first game ~1:10pm ET)."),
    ("🩹", "No scratch/injury flags", "surfaced on the featured plays in this early pass."),
]

TRENDING = [
    "Ben Rice is the heaviest early HR-parlay name (10+ posted slips).",
    "\"Daily Dingers\" / \"Strikeout Targets\" content accounts active — verify each name is in a lineup.",
    "K-prop parlay volume is light this early; most K action posts closer to game time.",
]


# ---------- render helpers ----------
def _card(inner: str, accent: str = "") -> str:
    bl = f"border-left:4px solid {accent};" if accent else ""
    return (f'<tr><td style="padding:0 0 14px 0;"><table width="100%" cellpadding="0" cellspacing="0" '
            f'style="background:#ffffff;border:1px solid {LINE};{bl}border-radius:12px;">'
            f'<tr><td style="padding:16px 18px;">{inner}</td></tr></table></td></tr>')


def _section_title(emoji: str, text: str, note: str = "") -> str:
    n = f'<span style="color:{SUB};font-weight:400;font-size:13px;">  {note}</span>' if note else ""
    return (f'<tr><td style="padding:18px 0 10px 2px;font:700 18px/1.2 -apple-system,Segoe UI,Roboto,Arial;'
            f'color:{INK};">{emoji} {text}{n}</td></tr>')


def _pill(tag: str) -> str:
    bg, fg, label = PILL[tag]
    return (f'<span style="display:inline-block;background:{bg};color:{fg};font:700 11px/1 -apple-system,Arial;'
            f'padding:5px 9px;border-radius:999px;">{label}</span>')


def _play_card(p: dict) -> str:
    c = PROP_C[p["prop"]]
    lead = (f'<span style="background:{c};color:#fff;font:800 10px/1 Arial;padding:4px 7px;'
            f'border-radius:5px;letter-spacing:.5px;">{p["lead"]}</span> ' if p.get("lead") else "")
    badge = (f'<span style="display:inline-block;background:{c}1a;color:{c};font:700 11px/1 Arial;'
             f'padding:4px 8px;border-radius:5px;">{PROP_LABEL[p["prop"]]}</span>')
    inner = (
        f'<div style="margin-bottom:6px;">{lead}{badge} '
        f'<span style="float:right;font:800 16px/1 Arial;color:{c};">{p["model"]}</span></div>'
        f'<div style="font:800 18px/1.2 -apple-system,Arial;color:{INK};margin:6px 0 2px;">{p["player"]}</div>'
        f'<div style="font:600 14px/1.2 Arial;color:{SUB};margin-bottom:9px;">{p["bet"]}</div>'
        f'{_pill(p["tag"])}'
        f'<div style="font:400 13px/1.5 -apple-system,Arial;color:{SUB};margin-top:9px;">{p["why"]}</div>'
    )
    return _card(inner, c)


def _parlay_card(p: dict) -> str:
    legs = "".join(
        f'<tr><td style="padding:7px 0;border-bottom:1px solid {LINE};font:600 14px/1.2 Arial;color:{INK};">'
        f'{n} <span style="color:{SUB};font-weight:400;">· {b}</span>'
        f'<span style="float:right;color:{p["color"]};font-weight:800;">{m}</span></td></tr>'
        for n, b, m in p["legs"])
    inner = (
        f'<div style="margin-bottom:10px;"><span style="font:800 16px/1.2 Arial;color:{INK};">🎰 {p["name"]}</span>'
        f'<span style="float:right;background:{p["color"]};color:#fff;font:800 14px/1 Arial;padding:6px 10px;'
        f'border-radius:7px;">{p["combined"]}</span></div>'
        f'<div style="font:600 11px/1 Arial;color:{p["color"]};text-transform:uppercase;letter-spacing:.5px;'
        f'margin-bottom:8px;">{p["tag"]}</div>'
        f'<table width="100%" cellpadding="0" cellspacing="0">{legs}</table>'
        f'<div style="font:400 13px/1.5 Arial;color:{SUB};margin-top:10px;">{p["why"]}</div>'
    )
    return _card(inner, p["color"])


def _buzz_block(title_emoji: str, label: str, color: str, rows: list, note: str) -> str:
    # rows = (player, model%) ranked by how heavily they appear in posted slips.
    # No fabricated exact counts — ranking order IS the signal. Top 3 get a 🔥 heat dot.
    if not rows:  # empty list (e.g. K parlays this early) — say so, don't render blank
        inner = (f'<div style="font:800 15px/1.2 Arial;color:{color};margin-bottom:4px;">{title_emoji} {label}</div>'
                 f'<div style="font:400 12px/1.4 Arial;color:{SUB};">Light this early — few of these posted yet. '
                 f'Fills in closer to first pitch.</div>')
        return _card(inner, color)
    items = ""
    for i, (name, model) in enumerate(rows, 1):
        heat = ' <span style="color:#dc2626;font-size:12px;">🔥</span>' if i <= 3 else ""
        items += (
            f'<tr><td style="padding:8px 0;border-bottom:1px solid {LINE};">'
            f'<span style="display:inline-block;width:22px;height:22px;background:{color};color:#fff;'
            f'border-radius:50%;text-align:center;font:800 12px/22px Arial;">{i}</span> '
            f'<span style="font:600 14px/1.2 Arial;color:{INK};">{name}</span>{heat}'
            f'<span style="float:right;font:700 13px/1.2 Arial;color:{color};">{model}</span></td></tr>')
    inner = (
        f'<div style="font:800 15px/1.2 Arial;color:{color};margin-bottom:4px;">{title_emoji} {label}</div>'
        f'<div style="font:400 11px/1.3 Arial;color:{SUB};margin-bottom:8px;">{note}</div>'
        f'<table width="100%" cellpadding="0" cellspacing="0">{items}</table>')
    return _card(inner, color)


def _tweet_card(t: str) -> str:
    inner = (f'<div style="font:400 14px/1.5 -apple-system,Arial;color:{INK};">🐦 {t}</div>')
    return _card(inner, "#1da1f2")


def _notes_card(items: list, kind: str) -> str:
    rows = ""
    for it in items:
        if kind == "blend":
            emoji, color, head, body = it
            rows += (f'<div style="margin-bottom:10px;"><span style="font:800 13px/1.3 Arial;color:{color};">'
                     f'{emoji} {head}</span><div style="font:400 13px/1.5 Arial;color:{SUB};">{body}</div></div>')
        elif kind == "flags":
            emoji, head, body = it
            rows += (f'<div style="margin-bottom:8px;font:400 13px/1.5 Arial;color:{SUB};">'
                     f'{emoji} <b style="color:{INK};">{head}</b> — {body}</div>')
        else:  # trending
            rows += f'<div style="margin-bottom:7px;font:400 13px/1.5 Arial;color:{SUB};">• {it}</div>'
    return _card(rows)


def _ppct(p: float) -> str:
    pc = p * 100
    return f"{pc:.0f}%" if pc >= 10 else (f"{pc:.1f}%" if pc >= 0.1 else "<0.1%")


def _ranklist(rows: list, color: str) -> str:
    items = ""
    for i, row in enumerate(rows, 1):
        name, sub, val, *rest = row
        badge = rest[0] if rest else ""
        sub_h = f' <span style="color:{SUB};font-weight:400;font-size:12px;">{sub}</span>' if sub else ""
        items += (f'<tr><td style="padding:6px 0;border-bottom:1px solid {LINE};">'
                  f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
                  f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
                  f'<span style="font:600 13px/1.2 Arial;color:{INK};">{name}</span>{badge}{sub_h}'
                  f'<span style="float:right;font:700 13px/1.2 Arial;color:{color};">{val}</span></td></tr>')
    return f'<table width="100%" cellpadding="0" cellspacing="0">{items}</table>'


def _model_board(board: dict, now_iso: str) -> str:
    # Over-fetch, then keep only CONFIRMED lineups/starters (manual report = locked-in plays,
    # never "probable" guesses), Top 25 per prop.
    sel = select_plays(board, hr_count=60, k_count=60, hits_count=60, now_iso=now_iso)

    def conf(plays, field):
        c = [p for p in plays if p.get(field) == "confirmed"]
        return c[:8] if c else plays[:8]  # fall back to projected when nothing's confirmed yet
    any_conf = any(p.get("lineup_status") == "confirmed" for p in sel["hr"])
    hr = [(p["player"], p.get("matchup", ""), f'{p["probability"]*100:.0f}%', platoon_badge(p)) for p in conf(sel["hr"], "lineup_status")]
    k = [(p["player"], f'O{p.get("line")}', f'{p["over_prob"]*100:.0f}%') for p in conf(sel["strikeouts"], "pitcher_status")]
    hits = [(p["player"], p.get("matchup", ""), f'{p["p_ge1"]*100:.0f}%', platoon_badge(p)) for p in conf(sel["hits"], "lineup_status")]
    note = (f'<div style="font:400 11px/1.3 Arial;color:'
            + ('#94a3b8;">confirmed lineups only · Top 8 (full 25 in Deep Board email)</div>' if any_conf
               else '#d97706;">⚠️ projected — lineups not confirmed yet · Top 8</div>'))
    out = _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:4px;">💣 Top 8 — Home Runs</div>'
                + note + _ranklist(hr, HR_C), HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:4px;">🟢 Top 8 — Hits</div>'
                 + note + _ranklist(hits, HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:4px;">🔥 Top 8 — Strikeouts</div>'
                 + note + _ranklist(k, K_C), K_C)
    return out


def _factor_tags(p: dict, prop: str) -> list:
    """Real reasoning from the model's factor multipliers — heat, wind, matchup, form, BvP."""
    tags = []
    t, w = p.get("temp_f"), p.get("wind_out_mph")
    if isinstance(t, (int, float)) and t >= 90:
        tags.append(f"🌡️{t:.0f}°")
    if prop == "HR":
        if isinstance(w, (int, float)) and w >= 5:
            tags.append(f"💨out {w:.0f}")
        if p.get("pitcher_mult", 1) >= 1.15:
            tags.append("vs HR-prone arm")
        if p.get("recent_form_mult", 1) >= 1.06:
            tags.append("🔥hot")
        if p.get("park_mult", 1) >= 1.05:
            tags.append("hitter park")
        if p.get("bvp_mult", 1) >= 1.12:
            tags.append("owns matchup")
    elif prop == "HITS":
        if p.get("pitcher_factor", 1) >= 1.2:
            tags.append("vs hittable arm")
        if p.get("recent_form_mult", 1) >= 1.05:
            tags.append("🔥hot")
        if (p.get("vs") or {}).get("lean") == "H":
            tags.append("matchup→hits")
    elif prop == "K":
        ek, ln = p.get("expected_ks"), p.get("line")
        if isinstance(ek, (int, float)) and isinstance(ln, (int, float)) and ek - ln >= 1.0:
            tags.append(f"proj {ek:.1f} vs {ln}")
        if isinstance(p.get("vs"), list):
            kp = sum(1 for m in p["vs"] if (m or {}).get("lean") == "K")
            if kp >= 3:
                tags.append(f"{kp} K-lean bats")
    return tags


def _factor_list(rows: list, color: str) -> str:
    """rows = (name, bet, val, tags[, badge]). Rank, name, [⚡platoon box], bet, %, factor sub-line."""
    items = ""
    for i, row in enumerate(rows, 1):
        name, bet, val, tags, *rest = row
        badge = rest[0] if rest else ""
        sub = (f'<div style="margin-left:28px;font:400 10px/1.3 Arial;color:#94a3b8;">{" · ".join(tags)}</div>'
               if tags else "")
        items += (f'<tr><td style="padding:7px 0;border-bottom:1px solid {LINE};">'
                  f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
                  f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
                  f'<span style="font:600 13px/1.2 Arial;color:{INK};">{name}</span>{badge} '
                  f'<span style="color:{SUB};font:400 11px/1.2 Arial;">{bet}</span>'
                  f'<span style="float:right;font:700 13px/1.2 Arial;color:{color};">{val}</span>'
                  f'{sub}</td></tr>')
    return f'<table width="100%" cellpadding="0" cellspacing="0">{items}</table>'


def _board_b(board: dict, now_iso: str) -> str:
    """Board B = the model board RE-RANKED by buzz + factors (my blend), 10 deep per prop."""
    sel = select_plays(board, hr_count=25, k_count=25, hits_count=25, now_iso=now_iso)
    bh = {n for n, _ in BUZZ_HR}
    bhit = {n for n, _ in BUZZ_HITS}

    def score(p, metric, buzz):
        # blend: model prob, boosted if buzzing, nudged by the strongest factor signal
        s = p[metric] * (1.15 if p["player"] in buzz else 1.0)
        s *= max(p.get("pitcher_mult", 1), p.get("pitcher_factor", 1), p.get("recent_form_mult", 1), 1.0) ** 0.15
        return s

    def blend(plays, metric, buzz):
        return sorted(plays, key=lambda p: score(p, metric, buzz), reverse=True)[:8]

    def rows(plays, metric, prop, buzz, betfn):
        return [(p["player"] + (" ✅" if p["player"] in buzz else ""), betfn(p), f'{p[metric]*100:.0f}%',
                 _factor_tags(p, prop), platoon_badge(p) if prop in ("HR", "HITS") else "") for p in plays]
    hr = blend(sel["hr"], "probability", bh)
    hits = blend(sel["hits"], "p_ge1", bhit)
    k = blend(sel["strikeouts"], "over_prob", set())
    out = _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:8px;">💣 Blend — Home Runs (top 8)</div>'
                + _factor_list(rows(hr, "probability", "HR", bh, lambda p: "to HR"), HR_C), HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:8px;">🟢 Blend — Hits (top 8)</div>'
                 + _factor_list(rows(hits, "p_ge1", "HITS", bhit, lambda p: "1+ hit"), HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:8px;">🔥 Blend — Strikeouts (top 8)</div>'
                 + _factor_list(rows(k, "over_prob", "K", set(), lambda p: f'O{p.get("line")}'), K_C), K_C)
    return out


def _my_plays(board: dict, now_iso: str) -> str:
    """Diverse locks (mixed props) · 10 HR model+buzz blend · 10 HR contrarian · 10 Ks — with factors."""
    sel = select_plays(board, hr_count=40, k_count=40, hits_count=40, now_iso=now_iso)
    bh = {n for n, _ in BUZZ_HR}
    hr, hits, k = sel["hr"], sel["hits"], sel["strikeouts"]
    # Diverse locks: interleave best-per-prop so HR, hits, AND Ks are all represented
    pools = [[(p, "HR", "HR · to homer", p["probability"]) for p in hr],
             [(p, "HITS", "HITS · 1+ hit", p["p_ge1"]) for p in hits],
             [(p, "K", f'K · O{p.get("line")}', p["over_prob"]) for p in k]]
    locks = []
    for r in range(4):
        for pool in pools:
            if r < len(pool):
                locks.append(pool[r])
    lock_rows = [(p["player"], bet, f'{m*100:.0f}%', _factor_tags(p, prop),
                  platoon_badge(p) if prop in ("HR", "HITS") else "") for p, prop, bet, m in locks[:9]]
    hr_blend = sorted(hr, key=lambda p: p["probability"] * (1.15 if p["player"] in bh else 1.0), reverse=True)[:10]
    mb_rows = [(p["player"] + (" ✅" if p["player"] in bh else ""), "to HR", f'{p["probability"]*100:.0f}%',
                _factor_tags(p, "HR"), platoon_badge(p)) for p in hr_blend]
    con_rows = [(p["player"], "to HR", f'{p["probability"]*100:.0f}%', _factor_tags(p, "HR"), platoon_badge(p))
                for p in [p for p in hr if p["player"] not in bh][:10]]
    k10 = [(p["player"], f'O{p.get("line")}', f'{p["over_prob"]*100:.0f}%', _factor_tags(p, "K")) for p in k[:10]]
    GOLD = "#ca8a04"

    def block(emoji, title, color, rows):
        body = _factor_list(rows, color) if rows else f'<div style="font:400 12px Arial;color:{SUB};">(none yet)</div>'
        return _card(f'<div style="font:800 15px/1.2 Arial;color:{color};margin-bottom:8px;">{emoji} {title}</div>'
                     + body, color)
    return (block("🔒", "Top Locks — mixed props", GOLD, lock_rows)
            + block("💣", "Top 10 HR — Model + Buzz blend", HR_C, mb_rows)
            + block("💣", "Top 10 HR — Contrarian Edge", HR_C, con_rows)
            + block("🔥", "Top 10 Strikeouts", K_C, k10))


def _top_plays(board: dict, now_iso: str) -> str:
    """Top 7 per prop (HR / Hits / Ks), ranked by model %, 🔥 = also in the buzz."""
    sel = select_plays(board, hr_count=7, k_count=7, hits_count=7, now_iso=now_iso)
    bh = {n for n, _ in BUZZ_HR}
    bhit = {n for n, _ in BUZZ_HITS}

    def rows(plays, metric, sub_fn, buzz, batter=False):
        return [(p["player"] + (" 🔥" if p["player"] in buzz else ""), sub_fn(p), f'{p[metric]*100:.0f}%',
                 platoon_badge(p) if batter else "") for p in plays]
    hr = rows(sel["hr"], "probability", lambda p: p.get("matchup", ""), bh, batter=True)
    hits = rows(sel["hits"], "p_ge1", lambda p: p.get("matchup", ""), bhit, batter=True)
    k = rows(sel["strikeouts"], "over_prob", lambda p: f'O{p.get("line")}', set())
    out = _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:8px;">💣 Top 7 — Home Runs</div>'
                + _ranklist(hr, HR_C), HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:8px;">🟢 Top 7 — Hits</div>'
                 + _ranklist(hits, HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:8px;">🔥 Top 7 — Strikeouts</div>'
                 + _ranklist(k, K_C), K_C)
    return out


def _gen_parlays(board: dict, now_iso: str) -> str:
    """5 parlay TYPES, 3 DIVERSE versions each — by Season, History (3-yr), and Blended numbers.
    Different legs (not the same top 3), each with a factor-based 'why' from real multipliers."""
    sel = select_plays(board, hr_count=25, k_count=25, hits_count=25, now_iso=now_iso)
    SM = {"HR": "probability", "HITS": "p_ge1", "K": "over_prob"}
    HM = {"HR": "probability_hist", "HITS": "p_ge1_hist", "K": "over_prob_hist"}

    def met(p, prop, mode="season"):
        s = p.get(SM[prop], 0) or 0
        if mode == "season":
            return s
        h = p.get(HM[prop], 0) or 0
        return h if mode == "hist" else (s + h) / 2

    def bpg(plays, keyfn):  # best play per game (full dict, keeps factors), sorted
        bg = {}
        for p in plays:
            g = p.get("game_id")
            if g is None:
                continue
            if g not in bg or keyfn(p) > keyfn(bg[g]):
                bg[g] = p
        return sorted(bg.values(), key=keyfn, reverse=True)

    def lab(p, prop):
        return (f'{p["player"]} 1+ hit' if prop == "HITS"
                else f'{p["player"]} O{p.get("line")} K' if prop == "K" else f'{p["player"]} HR')

    def why(legs):
        tags = []
        for p, prop in legs:
            tags += _factor_tags(p, prop)
        seen, uniq = set(), []
        for t in tags:
            if t not in seen:
                seen.add(t)
                uniq.append(t)
        return ("Edge: " + " · ".join(uniq[:4])) if uniq else "Top model numbers, all different games."

    def version_row(legs, i, color, mode):
        seen, ok = set(), []
        for p, prop in legs:
            if p["game_id"] not in seen:
                seen.add(p["game_id"])
                ok.append((p, prop))
        if len(ok) < 3:
            return None
        comb = 1.0
        for p, prop in ok:
            comb *= met(p, prop, mode)
        pc = f"{comb*100:.0f}%" if comb >= 0.1 else f"{comb*100:.1f}%"
        return (f'<div style="padding:7px 0;border-bottom:1px solid {LINE};font:400 12px/1.4 Arial;color:{SUB};">'
                f'<b style="color:{color};">v{i} · {pc}</b> · ' + " + ".join(lab(p, prop) for p, prop in ok)
                + f'<div style="margin-top:2px;font:400 10px/1.3 Arial;color:#94a3b8;">{why(ok)}</div></div>')

    def type_card(name, tag, color, versions, mode):
        rows, n = "", 0
        for legs in versions:
            if n >= 3:
                break
            r = version_row(legs, n + 1, color, mode)
            if r:
                n += 1
                rows += r
        return _card(f'<div style="font:800 14px/1.2 Arial;color:{color};margin-bottom:2px;">🎰 {name} '
                     f'<span style="font-weight:400;font-size:11px;color:{SUB};">×3 · {tag}</span></div>' + rows, color)

    def win(pool, prop):  # 3 DIVERSE windows (non-overlapping legs) + fallbacks
        cand = [[(pool[i], prop) for i in range(s, s + 3) if i < len(pool)] for s in (0, 3, 6)]
        cand += [[(pool[i], prop) for i in idx if i < len(pool)] for idx in ((0, 1, 2), (1, 3, 5), (2, 4, 6))]
        return cand

    def g(pool, i, prop):
        return (pool[i], prop) if i < len(pool) else None

    def build(hp, kp, rp, mode, core_only=False):
        bal = [[g(hp, 0, "HITS"), g(rp, 0, "HR"), g(kp, 0, "K")], [g(hp, 1, "HITS"), g(rp, 1, "HR"), g(kp, 1, "K")],
               [g(hp, 2, "HITS"), g(rp, 2, "HR"), g(kp, 2, "K")], [g(hp, 3, "HITS"), g(rp, 3, "HR"), g(kp, 3, "K")]]
        bal = [[x for x in v if x] for v in bal]
        out = (type_card("Safe Hits 3-Leg", "highest floor", HIT_C, win(hp, "HITS"), mode)
               + type_card("Strikeout 3-Leg", "pitcher overs", K_C, win(kp, "K"), mode)
               + type_card("Balanced 3-Leg", "hit + HR + K", HR_C, bal, mode))
        if core_only:  # history/blend: 3 core types (keeps the email under Gmail's clip limit)
            return out
        out += type_card("HR Bomb 3-Leg", "longshot, big payout", HR_C, win(rp, "HR"), mode)
        mixed = [[g(hp, 0, "HITS"), g(hp, 3, "HITS"), g(kp, 0, "K")], [g(hp, 1, "HITS"), g(hp, 4, "HITS"), g(kp, 1, "K")],
                 [g(hp, 2, "HITS"), g(hp, 5, "HITS"), g(kp, 2, "K")], [g(hp, 0, "HITS"), g(kp, 0, "K"), g(hp, 6, "HITS")]]
        mixed = [[x for x in v if x] for v in mixed]
        return out + type_card("Mixed Safe 3-Leg", "hits + K", INK, mixed, mode)

    def pools(mode):
        return (bpg(sel["hits"], lambda p: met(p, "HITS", mode)),
                bpg(sel["strikeouts"], lambda p: met(p, "K", mode)),
                bpg(sel["hr"], lambda p: met(p, "HR", mode)))

    def hdr(text):
        return f'<div style="font:800 15px/1.2 Arial;color:{INK};margin:16px 0 8px;">{text}</div>'
    return (hdr("🎰 Parlays — Season") + build(*pools("season"), "season")
            + hdr("📜 Parlays — History-Weighted (3-yr)") + build(*pools("hist"), "hist", core_only=True)
            + hdr("🔀 Parlays — Blended (season + history)") + build(*pools("blend"), "blend", core_only=True))


def _parlay_rows(parlays: list, color: str) -> str:
    if not parlays:
        return f'<div style="font:400 12px/1.4 Arial;color:{SUB};">(none — slate too small)</div>'
    rows = ""
    for p in parlays:
        legs = " + ".join(leg["label"] for leg in p["legs"])
        rows += (f'<div style="padding:6px 0;border-bottom:1px solid {LINE};font:400 12px/1.4 Arial;color:{SUB};">'
                 f'<b style="color:{color};">{_ppct(p["prob"])}</b> · {legs}</div>')
    return rows


def _parlays_section(board: dict, now_iso: str) -> str:
    par = build_all_parlays(board, now_iso=now_iso)
    out = ""
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:8px;">💣 HR parlays</div>'
                 + '<div style="font:700 12px/1 Arial;color:#94a3b8;margin:6px 0 2px;">2-LEG</div>'
                 + _parlay_rows(par["hr"]["2leg"], HR_C)
                 + '<div style="font:700 12px/1 Arial;color:#94a3b8;margin:8px 0 2px;">3-LEG</div>'
                 + _parlay_rows(par["hr"]["3leg"], HR_C)
                 + '<div style="font:700 12px/1 Arial;color:#94a3b8;margin:8px 0 2px;">LONGSHOTS (4/5/6-LEG)</div>'
                 + _parlay_rows(par["hr"]["longshots"][4] + par["hr"]["longshots"][5] + par["hr"]["longshots"][6], HR_C),
                 HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:8px;">🟢 Hits parlays (6 & 7-leg)</div>'
                 + _parlay_rows(par["hits"]["6leg"] + par["hits"]["7leg"], HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:8px;">🔥 Ks parlays (6 & 7-leg)</div>'
                 + _parlay_rows(par["ks"]["6leg"] + par["ks"]["7leg"], K_C), K_C)
    ml = [(n, par["moneyline"][n]) for n in (5, 6, 8, 9, 10, 11, 12, 13, 14, 15)]
    ml_rows = ""
    skipped = []
    for n, pls in ml:
        if pls:
            ml_rows += (f'<div style="font:700 12px/1 Arial;color:#94a3b8;margin:8px 0 2px;">{n}-LEG</div>'
                        + _parlay_rows(pls[:2], INK))
        else:
            skipped.append(str(n))
    skip = (f'<div style="font:400 11px/1.4 Arial;color:{SUB};margin-top:6px;">Skipped {", ".join(skipped)}-leg — '
            f'not enough games on the slate.</div>' if skipped else "")
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{INK};margin-bottom:8px;">🎟 Money-line ladder '
                 f'<span style="font-weight:400;font-size:12px;color:{SUB};">(slate-adaptive)</span></div>'
                 + ml_rows + skip)
    return out


def build_html() -> str:
    board = json.load(open(BOARD))
    now_iso = f"{board.get('date', '2026-01-01')}T00:00:00+00:00"
    fresh = board.get("updated", "")

    plays = _my_plays(board, now_iso)
    top7 = _top_plays(board, now_iso)
    my_parlays = _gen_parlays(board, now_iso)
    BUZZ_NOTE = "Ranked by how heavily each appears in posted parlays, filtered to who's playing. % = my model."
    buzz = (_buzz_block("💣", "Most bet-on HOME RUNS", HR_C, BUZZ_HR, BUZZ_NOTE)
            + _buzz_block("🟢", "Most bet-on HITS", HIT_C, BUZZ_HITS, BUZZ_NOTE)
            + _buzz_block("🔥", "Most bet-on STRIKEOUTS", K_C, BUZZ_K, BUZZ_NOTE))
    slate = "".join(f'<div style="font:400 13px/1.6 Arial;color:{SUB};">{s}</div>' for s in SLATE)
    tweets = "".join(_tweet_card(t) for t in TWEETS)
    dropped = _card(f'<div style="font:400 12px/1.5 Arial;color:{SUB};">🚫 <b>Dropped (not playing / injured):</b> '
                    f'{DROPPED} — exactly why the availability filter matters.</div>')

    return f"""\
<!DOCTYPE html><html><body style="margin:0;padding:0;background:{BG};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:{BG};"><tr><td align="center" style="padding:20px 12px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:{INK};border-radius:14px;padding:22px 22px;">
    <span style="font:800 22px/1 -apple-system,Arial;color:#fff;">⚾ PROP-PREDICT</span>
    <span style="float:right;background:#16a34a;color:#fff;font:700 11px/1 Arial;padding:6px 10px;border-radius:999px;">● MANUAL</span>
    <div style="font:600 13px/1.4 Arial;color:#94a3b8;margin-top:6px;">Curated Report &nbsp;·&nbsp; {DATE} &nbsp;·&nbsp; board refreshed {fresh[:16].replace('T', ' ')} UTC</div>
  </td></tr>

  {_section_title("🗓️", "Slate Overview")}
  {_card(slate)}

  {_section_title("🔥", "My Plays", "7 locks · 7+7 HR · 10 K, in order")}
  {plays}

  {_section_title("🎰", "My Parlays", "3 versions of each type · your most-played")}
  {my_parlays}

  {_section_title("📡", "Most Bet-On", "Board A — from posted X parlays")}
  {buzz}
  {dropped}

  {_section_title("🧠", "Blend Board", "Board B — model re-ranked by buzz + factors, top 10")}
  {_board_b(board, now_iso)}

  {_section_title("⚠️", "Contradiction & Environment Flags")}
  {_notes_card(FLAGS, "flags")}

  {_section_title("⭐", "Trending Elsewhere", "verify first")}
  {_notes_card(TRENDING, "trending")}

  {_section_title("📋", "Top 7 by Prop", "ranked by my model · 🔥 = also buzzing")}
  {top7}

  {_section_title("📊", "My Model Board", "Board C — pure math")}
  {_model_board(board, now_iso)}

  <tr><td style="padding:14px 4px 4px;font:400 12px/1.5 Arial;color:{SUB};">
    🎟 The full HR / Hits / K parlay sets + the 5–15 leg money-line ladder live in your 📊 Deep Board email.
  </td></tr>

  {_section_title("🐦", "Ready-to-Post Tweets")}
  {tweets}

  <tr><td style="padding:18px 4px;font:400 12px/1.5 Arial;color:{SUB};">
    Source: prop-predict &nbsp;·&nbsp; buzz from posted X parlays + last30days, availability-filtered.
  </td></tr>

</table></td></tr></table></body></html>"""


def load_key() -> str:
    for line in Path(".env").read_text().splitlines() if Path(".env").exists() else []:
        if line.startswith("RESEND_API_KEY="):
            return line.split("=", 1)[1].strip()
    return os.environ.get("RESEND_API_KEY", "")


def load_content() -> dict:
    """The buzz layer for today, written fresh each run. Empty dict if not yet filled."""
    if CONTENT.exists():
        try:
            return json.loads(CONTENT.read_text())
        except Exception as exc:
            print(f"[warn] could not read {CONTENT.name}: {exc}")
    return {}


def _apply_content(c: dict) -> None:
    """Overlay today's swept buzz onto the module globals the renderers read."""
    g = globals()
    if c.get("date_label"):
        g["DATE"] = c["date_label"]
    for key, name in (("slate", "SLATE"), ("trending", "TRENDING"), ("tweets", "TWEETS")):
        if key in c:
            g[name] = c[key]
    for key, name in (("buzz_hr", "BUZZ_HR"), ("buzz_hits", "BUZZ_HITS"),
                      ("buzz_k", "BUZZ_K"), ("flags", "FLAGS")):
        if key in c:
            g[name] = [tuple(x) for x in c[key]]
    if "dropped" in c:
        g["DROPPED"] = c["dropped"]


def _stale_guard(argv: list[str]) -> int | None:
    """Refuse to build on a stale board OR with stale (not-today) buzz. The board guard is the
    Bryan-Woo 2-day-stale failure; the buzz guard is what forces a fresh X sweep every run."""
    import datetime
    today = datetime.date.today().isoformat()
    allow = "--allow-stale" in argv
    board = json.load(open(BOARD))
    bdate = board.get("date", "")
    if bdate != today and not allow:
        print(f"[STALE BOARD] board date is {bdate}, today is {today}.")
        print("Refusing to build a manual report on a stale board.")
        print("Refresh first: cd ~/Projects/prop-predict && .venv/bin/python -m model.jobs morning")
        print("(or pass --allow-stale to override for a test).")
        return 1
    cdate = load_content().get("date", "")
    if cdate != today and not allow:
        print(f"[BUZZ NOT FILLED] {CONTENT.name} date is {cdate or '(missing)'}, today is {today}.")
        print("The Most Bet-On / Slate / Tweets layer must be swept fresh before sending.")
        print(f"Fill {CONTENT} with today's X / last30days buzz (date set to {today}), then re-run.")
        print("(or pass --allow-stale to send with the existing buzz for a test).")
        return 1
    return None


def main(argv: list[str]) -> int:
    guard = _stale_guard(argv)
    if guard is not None:
        return guard
    _apply_content(load_content())  # overlay today's freshly-swept buzz before rendering
    html = build_html()
    if "--dry-run" in argv:
        Path("/tmp/manual_pretty.html").write_text(html)
        print(f"html built: {len(html)} bytes -> /tmp/manual_pretty.html")
        return 0
    to = argv[argv.index("--to") + 1] if "--to" in argv else "billiongold333@gmail.com"
    key = load_key()
    if not key:
        print("[error] no RESEND_API_KEY")
        return 1
    r = requests.post(RESEND_URL, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      json={"from": "onboarding@resend.dev", "to": [to],
                            "subject": f"📋 Manual Report — {DATE}", "html": html}, timeout=30)
    r.raise_for_status()
    print(f"pretty manual report sent to {to} (HTTP {r.status_code})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
