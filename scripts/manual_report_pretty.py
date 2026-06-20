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

DATE = "June 18, 2026"

SLATE = [
    "🏟️ Hottest HR park: <b>NYM @ PHI</b> (Citizens Bank) — Nola (5.86 ERA) hittable",
    "🌡️ <b>102°</b> heat at LAA — home-run tailwind",
    "🪧 Loud public K names (Misiorowski, deGrom, Skubal) <b>weren't pitching</b> — K buzz didn't apply",
]

MY_PLAYS = [
    {"prop": "K", "lead": "LOCK", "player": "Bryan Woo", "bet": "Over 3.5 Ks", "model": "80%",
     "tag": "contrarian", "why": "My model's safest number — and the public K parlays were all Misiorowski/deGrom (who weren't even pitching). Quiet money."},
    {"prop": "HR", "player": "Ben Rice", "bet": "To hit a HR", "model": "25%",
     "tag": "agree", "why": "Showed up in TWO separate posted HR parlays AND sits in my model's top tier. Bettors and the math both on him."},
    {"prop": "HR", "player": "Shea Langeliers", "bet": "To hit a HR", "model": "25%",
     "tag": "agree", "why": "Model 25% + 102° heat in LAA. Power, weather, and buzz all line up."},
    {"prop": "HITS", "player": "Drake Baldwin", "bet": "1+ hit", "model": "73%",
     "tag": "lean", "why": "Highest hit probability on my whole board, flying under the public's radar."},
    {"prop": "HITS", "player": "Adley Rutschman", "bet": "1+ hit", "model": "69%",
     "tag": "agree", "why": "In 5 posted hit slips and 69% on my model — strongest model+buzz overlap of the day."},
]

MY_PARLAYS = [
    {"name": "The Safe 3-Leg", "tag": "your most-played type", "combined": "40%", "color": HIT_C,
     "legs": [("Bryan Woo", "Over 3.5 Ks", "80%"), ("Drake Baldwin", "1+ hit", "73%"),
              ("Adley Rutschman", "1+ hit", "69%")],
     "why": "Three high-floor, model-backed legs across different games. This is the ticket I'd actually fire today."},
    {"name": "Model + Buzz HR Bomb", "tag": "longshot, big upside", "combined": "1.4%", "color": HR_C,
     "legs": [("Ben Rice", "HR", "25%"), ("Shea Langeliers", "HR", "25%"), ("Bryce Harper", "HR", "22%")],
     "why": "Lottery payout, but all three are exactly where my model AND the posted parlays overlap. Small stake, monster ceiling."},
]

# (player, slips-note, model%) — ranked by posted-parlay appearances, filtered to who's playing
BUZZ_HR = [("Ben Rice", "2 slips", "25%"), ("Shea Langeliers", "", "25%"), ("Nick Kurtz", "", "22%"),
           ("Bryce Harper", "", "22%"), ("Jordan Walker", "", "19%"), ("Mike Trout", "", "16%"),
           ("Cal Raleigh", "", "8%")]
BUZZ_HITS = [("Drake Baldwin", "", "73%"), ("Adley Rutschman", "5 slips", "69%"), ("Nick Kurtz", "", "69%"),
             ("Jake Bauers", "", "67%"), ("Ryan McMahon", "", "66%"), ("Willson Contreras", "5 slips", "63%"),
             ("Paul Goldschmidt", "", "62%")]
BUZZ_K = [("Bryan Woo", "model", "80%"), ("Shane Drohan", "model", "80%"), ("Matthew Liberatore", "model", "74%"),
          ("Gage Jump", "model", "72%"), ("Ryan Weathers", "model", "70%")]
DROPPED = "Kyle Schwarber, Juan Soto, Randal Grichuk (not in 6/18 lineups), Aaron Judge (injured)"

TWEETS = [
    "🔒 LOCK: Bryan Woo OVER 3.5 Ks. Everyone's chasing Misiorowski K's — he's not even pitching. My model's quietly sitting on an 80%. 👉 [link] #MLB #PropBets",
    "💣 Ben Rice is in everybody's HR parlay tonight — and my model agrees (25%). When the slips AND the math line up, I'm in. 👉 [link] #HomeRunProps",
    "🎰 My safe 3-leg: Bryan Woo O3.5 K + Drake Baldwin hit + Adley Rutschman hit. ~40% combined, three different games. 👉 [link] #GamblingTwitter",
]

BLEND = [
    ("✅", HIT_C, "Convergence (safest)", "Ben Rice (HR), Adley Rutschman & Drake Baldwin (hits) — my model AND the posted parlays are both on them. Lead with these."),
    ("⚠️", HR_C, "My contrarian edges", "Bryan Woo & Shane Drohan K-overs (both 80%) — zero public K buzz because the loud K arms weren't pitching. Pure model edge."),
    ("🌀", SUB, "Buzz I'm fading", "Schwarber/Soto HR slips and Misiorowski K hype — all sidelined or not pitching 6/18. Don't chase names that aren't in the lineup."),
]

FLAGS = [
    ("🌡️", "102° heat at LAA (ATH @ LAA)", "Home-run tailwind — boosts any LAA/ATH power bat."),
    ("🏟️", "NYM @ PHI, Citizens Bank Park", "Top HR park tonight (~3.36 projected HR)."),
    ("🪧", "Hittable starters", "Nola (5.86 ERA) & Manaea (4.78) — lifts opposing bats' hit/HR props."),
    ("🩹", "No injury/scratch flags", "on the featured plays in this pass."),
]

TRENDING = [
    "\"Daily Dinger\" content pushing Harper + Bellinger HR hard — verify lineups first.",
    "Misiorowski dubbed \"most dominant pitcher on the planet\" (105mph) — huge K hype, but NOT pitching 6/18.",
    "FanDuel's hit list stacked the NYM @ PHI game (6 of 25 picks) — crowd piling into one spot.",
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
    items = ""
    for i, (name, slips, model) in enumerate(rows, 1):
        slip_tag = (f'<span style="background:{color}1a;color:{color};font:700 10px/1 Arial;padding:3px 6px;'
                    f'border-radius:4px;margin-left:6px;">🎟 {slips}</span>' if slips and slips != "model" else "")
        items += (
            f'<tr><td style="padding:8px 0;border-bottom:1px solid {LINE};">'
            f'<span style="display:inline-block;width:22px;height:22px;background:{color};color:#fff;'
            f'border-radius:50%;text-align:center;font:800 12px/22px Arial;">{i}</span> '
            f'<span style="font:600 14px/1.2 Arial;color:{INK};">{name}</span>{slip_tag}'
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
    sel = select_plays(board, hr_count=15, k_count=15, hits_count=15, now_iso=now_iso)
    hr = [(p["player"], p.get("matchup", ""), f'{p["probability"]*100:.0f}%') for p in sel["hr"]]
    k = [(p["player"], f'O{p.get("line")}', f'{p["over_prob"]*100:.0f}%') for p in sel["strikeouts"]]
    hits = [(p["player"], p.get("matchup", ""), f'{p["p_ge1"]*100:.0f}%') for p in sel["hits"]]
    out = _card(f'<div style="font:800 15px/1.2 Arial;color:{HR_C};margin-bottom:8px;">💣 Top 15 — Home Runs</div>'
                + _ranklist(hr, HR_C), HR_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{HIT_C};margin-bottom:8px;">🟢 Top 15 — Hits</div>'
                 + _ranklist(hits, HIT_C), HIT_C)
    out += _card(f'<div style="font:800 15px/1.2 Arial;color:{K_C};margin-bottom:8px;">🔥 Top 15 — Strikeouts</div>'
                 + _ranklist(k, K_C), K_C)
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
    my_parlays = "".join(_parlay_card(p) for p in MY_PARLAYS)
    buzz = (_buzz_block("💣", "Most bet-on HOME RUNS", HR_C, BUZZ_HR,
                        "Ranked by appearances in posted X parlays, filtered to who's playing. % = my model.")
            + _buzz_block("🟢", "Most bet-on HITS", HIT_C, BUZZ_HITS,
                          "From posted hit parlays (Contreras, Rutschman led the slips). % = my model.")
            + _buzz_block("🔥", "STRIKEOUTS — model board", K_C, BUZZ_K,
                          "Public K names weren't pitching 6/18, so these are the model's K plays. % = over prob."))
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

  {_section_title("🎰", "My 3-Leg Parlays", "your most-played ticket")}
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


def main(argv: list[str]) -> int:
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
