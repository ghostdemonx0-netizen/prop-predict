"""Render the Deep Board email — Top 25 per prop + all site-data parlays (no AI)."""
from __future__ import annotations

from model.parlays import MONEYLINE_LEGS, build_all_parlays
from model.plays import select_plays
from model.plays_email import _escape, _et_stamp, _hits_line, _hr_line, _k_line

TOP_N = 25


def _parlay_pct(p: float) -> str:
    """Whole % for >=10%, one decimal down to 0.1%, then '<0.1%' for the moonshots."""
    pc = p * 100
    if pc >= 10:
        return f"{pc:.0f}%"
    if pc >= 0.1:
        return f"{pc:.1f}%"
    return "<0.1%"


def _parlay_lines(parlays: list[dict]) -> list[str]:
    return [f"   {_parlay_pct(p['prob'])}  " + " + ".join(leg["label"] for leg in p["legs"])
            for p in parlays]


def _section(title: str, lines: list[str]) -> list[str]:
    return [title] + (lines if lines else ["   (none — slate too small)"])


def render_deep_email(board: dict, now_iso: str | None = None) -> dict:
    date = board.get("date", "")
    sel = select_plays(board, hr_count=TOP_N, k_count=TOP_N, hits_count=TOP_N, now_iso=now_iso)
    par = build_all_parlays(board, now_iso=now_iso)

    L = [f"PROP-PREDICT DEEP BOARD — {date}", ""]
    L.append("══ TOP 25 — HOME RUNS ══")
    L += [f" {i:>2}. " + _hr_line(p) for i, p in enumerate(sel["hr"], 1)]
    L += ["", "══ TOP 25 — HITS ══"]
    L += [f" {i:>2}. " + _hits_line(p) for i, p in enumerate(sel["hits"], 1)]
    L += ["", "══ TOP 25 — STRIKEOUTS ══"]
    L += [f" {i:>2}. " + _k_line(p) for i, p in enumerate(sel["strikeouts"], 1)]

    L += ["", "══ PARLAYS (real combined %, different games) ══", "", "— HOME RUN —"]
    L += _section(" 2-leg:", _parlay_lines(par["hr"]["2leg"]))
    L += _section(" 3-leg:", _parlay_lines(par["hr"]["3leg"]))
    L.append(" Longshots:")
    for n in (4, 5, 6):
        L += _section(f"  {n}-leg:", _parlay_lines(par["hr"]["longshots"][n]))

    L += ["", "— HITS —"]
    L += _section(" 6-leg:", _parlay_lines(par["hits"]["6leg"]))
    L += _section(" 7-leg:", _parlay_lines(par["hits"]["7leg"]))

    L += ["", "— STRIKEOUTS —"]
    L += _section(" 6-leg:", _parlay_lines(par["ks"]["6leg"]))
    L += _section(" 7-leg:", _parlay_lines(par["ks"]["7leg"]))

    L += ["", "— MONEY-LINE (lottery) —"]
    skipped = []
    for n in MONEYLINE_LEGS:
        pls = par["moneyline"][n]
        if pls:
            L += _section(f" {n}-leg:", _parlay_lines(pls))
        else:
            skipped.append(n)
    if skipped:
        legs = ", ".join(str(n) for n in skipped)
        L.append(f" (skipped {legs}-leg — not enough games on today's slate)")

    L += ["", f"Board refreshed {board.get('updated', '')} (UTC). Source: prop-predict."]

    text = "\n".join(L)
    html = "<pre style=\"font:13px/1.45 ui-monospace,monospace;white-space:pre-wrap\">" + _escape(text) + "</pre>"
    stamp = _et_stamp(board.get("updated"))
    subject = f"📊 Deep Board — {date}" + (f" · {stamp}" if stamp else "")
    return {"subject": subject, "text": text, "html": html}
