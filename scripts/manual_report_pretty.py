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


def build_html() -> str:
    plays = "".join(_play_card(p) for p in MY_PLAYS)
    parlays = "".join(_parlay_card(p) for p in MY_PARLAYS)
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
    <div style="font:600 13px/1.4 Arial;color:#94a3b8;margin-top:6px;">Curated Report &nbsp;·&nbsp; {DATE}</div>
  </td></tr>

  {_section_title("🗓️", "Slate Overview")}
  {_card(slate)}

  {_section_title("🔥", "My Plays", "what I'd actually post")}
  {plays}

  {_section_title("🎰", "My 3-Leg Parlays", "your most-played ticket")}
  {parlays}

  {_section_title("📡", "Most Bet-On", "from posted X parlays")}
  {buzz}
  {dropped}

  {_section_title("🐦", "Ready-to-Post Tweets")}
  {tweets}

  <tr><td style="padding:18px 4px;font:400 12px/1.5 Arial;color:{SUB};">
    Full Top-25 boards + all parlays are in your 📊 Deep Board email. Source: prop-predict.
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
