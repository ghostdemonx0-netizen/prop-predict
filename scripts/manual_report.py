"""Manual report sender (run by Claude in a session, at the Mac).

Combines a NARRATIVE file (the buzz/blend/analysis/tweet-drafts Claude writes each
run, from last30days + Twitter + reasoning) with the SITE boards+parlays (pure math
from the model), and emails it via Resend. The Resend key is read from a local .env
(RESEND_API_KEY) — never hardcoded.

Usage:
    python scripts/manual_report.py <narrative.md> [--dry-run] [--to you@example.com]
"""
from __future__ import annotations

import html
import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.deep_email import _parlay_lines
from model.parlays import build_all_parlays
from model.plays import select_plays
from model.plays_email import _hits_line, _hr_line, _k_line, _lock_line

BOARD_PATH = Path("web/public/data/latest.json")
RESEND_URL = "https://api.resend.com/emails"


def load_env(path: str = ".env") -> dict:
    env = {}
    p = Path(path)
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def site_section(board: dict, now_iso: str | None = None) -> str:
    sel = select_plays(board, hr_count=10, k_count=10, hits_count=10, now_iso=now_iso)
    par = build_all_parlays(board, now_iso=now_iso)
    L = ["────────  MY MODEL'S BOARD (prop-predict, pure math)  ────────", ""]
    L.append("🔒 LOCK: " + _lock_line(sel["lock"]))
    L += ["", "💣 Top 10 Home Runs"] + ["  • " + _hr_line(p) for p in sel["hr"]]
    L += ["", "🔥 Top 10 Strikeouts"] + ["  • " + _k_line(p) for p in sel["strikeouts"]]
    L += ["", "🟢 Top 10 Hits"] + ["  • " + _hits_line(p) for p in sel["hits"]]
    L += ["", "🎰 Sample site parlays (real combined %):"]
    L += ["  HR 2-leg:"] + _parlay_lines(par["hr"]["2leg"][:3])
    L += ["  Ks 6-leg:"] + _parlay_lines(par["ks"]["6leg"][:2])
    L += ["  Money-line 5-leg:"] + _parlay_lines(par["moneyline"][5][:2])
    return "\n".join(L)


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    # value-taking flags: collect their values so they aren't mistaken for the narrative path
    flag_values = set()
    to_override = None
    board_path = BOARD_PATH
    if "--to" in argv:
        to_override = argv[argv.index("--to") + 1]
        flag_values.add(to_override)
    if "--board" in argv:
        board_path = Path(argv[argv.index("--board") + 1])
        flag_values.add(str(board_path))
    narrative_path = next((a for a in argv if not a.startswith("--") and a not in flag_values), None)

    board = json.load(open(board_path))
    # If the local board's games have all started (stale local copy), use a
    # pre-slate clock so plays still render for the report.
    now_iso = f"{board.get('date', '2026-01-01')}T00:00:00+00:00"

    narrative = Path(narrative_path).read_text() if narrative_path and Path(narrative_path).exists() else ""
    body = narrative.rstrip() + "\n\n\n" + site_section(board, now_iso) + \
        "\n\n──────────  Source: prop-predict  ──────────"
    subject = f"🧪 Manual Report — {board.get('date', '')}"
    html_body = ("<pre style=\"font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap\">"
                 + html.escape(body) + "</pre>")

    if dry:
        print(body)
        return 0

    env = load_env()
    api_key = env.get("RESEND_API_KEY") or os.environ.get("RESEND_API_KEY")
    to_email = to_override or os.environ.get("PLAYS_TO_EMAIL") or "billiongold333@gmail.com"
    if not api_key:
        print("[error] no RESEND_API_KEY in .env or env")
        return 1
    resp = requests.post(RESEND_URL,
                         headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                         json={"from": "onboarding@resend.dev", "to": [to_email],
                               "subject": subject, "html": html_body}, timeout=30)
    resp.raise_for_status()
    print(f"manual report sent to {to_email} (HTTP {resp.status_code})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
