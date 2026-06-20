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
from model.parlays import build_all_parlays  # noqa: E402
from model.plays import select_plays  # noqa: E402

BOARD = "/Users/issiakadiawara/Projects/prop-predict/web/public/data/latest.json"
RESEND_URL = "https://api.resend.com/emails"

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
    for i, (name, sub, val) in enumerate(rows, 1):
        sub_h = f' <span style="color:{SUB};font-weight:400;font-size:12px;">{sub}</span>' if sub else ""
        items += (f'<tr><td style="padding:6px 0;border-bottom:1px solid {LINE};">'
                  f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
                  f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
                  f'<span style="font:600 13px/1.2 Arial;color:{INK};">{name}</span>{sub_h}'
                  f'<span style="float:right;font:700 13px/1.2 Arial;color:{color};">{val}</span></td></tr>')
    return f'<table width="100%" cellpadding="0" cellspacing="0">{items}</table>'


def _model_board(board: dict, now_iso: str) -> str:
    # Over-fetch, then keep only CONFIRMED lineups/starters (manual report = locked-in plays,
    # never "probable" guesses), Top 25 per prop.
    sel = select_plays(board, hr_count=60, k_count=60, hits_count=60, now_iso=now_iso)

    def conf(plays, field):
        c = [p for p in plays if p.get(field) == "confirmed"]
        return c[:25] if c else plays[:25]  # fall back to projected when nothing's confirmed yet
    any_conf = any(p.get("lineup_status") == "confirmed" for p in sel["hr"])
    hr = [(p["player"], p.get("matchup", ""), f'{p["probability"]*100:.0f}%') for p in conf(sel["hr"], "lineup_status")]
    k = [(p["player"], f'O{p.get("line")}', f'{p["over_prob"]*100:.0f}%') for p in conf(sel["strikeouts"], "pitcher_status")]
    hits = [(p["player"], p.get("matchup", ""), f'{p["p_ge1"]*100:.0f}%') for p in conf(sel["hits"], "lineup_status")]
    note = (f'<div style="font:400 11px/1.3 Arial;color:'
            + ('#94a3b8;">confirmed lineups only · Top 25</div>' if any_conf
               else '#d97706;">⚠️ projected — lineups not confirmed yet · Top 25</div>'))
    out = _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:4px;">💣 Top 25 — Home Runs</div>'
                + note + _ranklist(hr, HR_C), HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:4px;">🟢 Top 25 — Hits</div>'
                 + note + _ranklist(hits, HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:4px;">🔥 Top 25 — Strikeouts</div>'
                 + note + _ranklist(k, K_C), K_C)
    return out


def _top_plays(board: dict, now_iso: str) -> str:
    """Top 7 per prop (HR / Hits / Ks), ranked by model %, 🔥 = also in the buzz."""
    sel = select_plays(board, hr_count=7, k_count=7, hits_count=7, now_iso=now_iso)
    bh = {n for n, _ in BUZZ_HR}
    bhit = {n for n, _ in BUZZ_HITS}

    def rows(plays, metric, sub_fn, buzz):
        return [(p["player"] + (" 🔥" if p["player"] in buzz else ""), sub_fn(p), f'{p[metric]*100:.0f}%')
                for p in plays]
    hr = rows(sel["hr"], "probability", lambda p: p.get("matchup", ""), bh)
    hits = rows(sel["hits"], "p_ge1", lambda p: p.get("matchup", ""), bhit)
    k = rows(sel["strikeouts"], "over_prob", lambda p: f'O{p.get("line")}', set())
    out = _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:8px;">💣 Top 7 — Home Runs</div>'
                + _ranklist(hr, HR_C), HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:8px;">🟢 Top 7 — Hits</div>'
                 + _ranklist(hits, HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:8px;">🔥 Top 7 — Strikeouts</div>'
                 + _ranklist(k, K_C), K_C)
    return out


def _gen_parlays(board: dict, now_iso: str) -> str:
    """Several model-built parlays (mostly 3-leg — the user's most-played), different games."""
    sel = select_plays(board, hr_count=10, k_count=10, hits_count=10, now_iso=now_iso)
    h, k, hr = sel["hits"], sel["strikeouts"], sel["hr"]

    def leg(p, prop):
        if prop == "hits":
            return (p["player"], "1+ hit", p["p_ge1"])
        if prop == "k":
            return (p["player"], f'O{p.get("line")} K', p["over_prob"])
        return (p["player"], "HR", p["probability"])

    def card(name, tag, color, legs, why):
        comb = 1.0
        for _, _, pr in legs:
            comb *= pr
        cs = f"{comb*100:.0f}%" if comb >= 0.1 else f"{comb*100:.1f}%"
        return _parlay_card({"name": name, "tag": tag, "color": color, "combined": cs,
                             "legs": [(n, b, f"{pr*100:.0f}%") for n, b, pr in legs], "why": why})
    out = ""
    if len(h) >= 3:
        out += card("Safe Hits 3-Leg", "highest floor", HIT_C, [leg(h[0], "hits"), leg(h[1], "hits"), leg(h[2], "hits")],
                    "The three highest-probability hit props, different games. My go-to safe ticket.")
    if len(k) >= 3:
        out += card("Strikeout 3-Leg", "pitcher overs", K_C, [leg(k[0], "k"), leg(k[1], "k"), leg(k[2], "k")],
                    "Top three K-overs on the board. Pitchers control their own outcome more than hitters.")
    if len(h) >= 2 and len(k) >= 1:
        out += card("Mixed Safe 3-Leg", "hits + K", INK, [leg(h[0], "hits"), leg(k[0], "k"), leg(h[1], "hits")],
                    "Two safe hits plus the top strikeout over — spreads the risk across bet types.")
    if len(hr) >= 3:
        out += card("HR Bomb 3-Leg", "longshot, big payout", HR_C, [leg(hr[0], "hr"), leg(hr[1], "hr"), leg(hr[2], "hr")],
                    "My three best home-run numbers. Lottery odds, huge ceiling — small stake.")
    if len(h) >= 1 and len(hr) >= 1 and len(k) >= 1:
        out += card("Balanced 3-Leg", "hit + HR + K", HR_C, [leg(h[0], "hits"), leg(hr[0], "hr"), leg(k[0], "k")],
                    "One of each: a safe hit, a power swing, and a strikeout over.")
    return out


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

    plays = "".join(_play_card(p) for p in MY_PLAYS)
    top7 = _top_plays(board, now_iso)
    my_parlays = "".join(_parlay_card(p) for p in MY_PARLAYS) + _gen_parlays(board, now_iso)
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

  {_section_title("🔥", "My Plays", "what I'd actually post")}
  {plays}

  {_section_title("📋", "Top 7 by Prop", "ranked by my model · 🔥 = also buzzing")}
  {top7}

  {_section_title("🎰", "My Parlays", "your most-played ticket")}
  {my_parlays}

  {_section_title("📡", "Most Bet-On", "Board A — from posted X parlays")}
  {buzz}
  {dropped}

  {_section_title("🧠", "Blend", "Board B — model meets buzz")}
  {_notes_card(BLEND, "blend")}

  {_section_title("⚠️", "Contradiction & Environment Flags")}
  {_notes_card(FLAGS, "flags")}

  {_section_title("⭐", "Trending Elsewhere", "verify first")}
  {_notes_card(TRENDING, "trending")}

  {_section_title("📊", "My Model Board", "Board C — pure math")}
  {_model_board(board, now_iso)}

  {_section_title("🎟", "All Site Parlays")}
  {_parlays_section(board, now_iso)}

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


def _stale_guard(argv: list[str]) -> int | None:
    """Refuse to build on a board that isn't today's — the Bryan-Woo / 2-day-stale failure."""
    import datetime
    board = json.load(open(BOARD))
    bdate = board.get("date", "")
    today = datetime.date.today().isoformat()
    if bdate != today and "--allow-stale" not in argv:
        print(f"[STALE BOARD] board date is {bdate}, today is {today}.")
        print("Refusing to build a manual report on a stale board.")
        print("Refresh first: cd ~/Projects/prop-predict && .venv/bin/python -m model.jobs morning")
        print("(or pass --allow-stale to override for a test).")
        return 1
    return None


def main(argv: list[str]) -> int:
    guard = _stale_guard(argv)
    if guard is not None:
        return guard
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
