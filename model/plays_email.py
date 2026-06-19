"""Render selected plays into an email (subject/text/html) and a short push string."""
from __future__ import annotations


def _pct(x) -> str:
    return f"{x * 100:.0f}%" if isinstance(x, (int, float)) else "—"


def _tag(p: dict, status_field: str) -> str:
    """' ⚠️proj' when the lineup/pitcher isn't confirmed yet (play may shift)."""
    return "" if p.get(status_field) == "confirmed" else " ⚠️proj"


def _hr_line(p: dict) -> str:
    return (f"{p.get('player')} ({p.get('team')}) — {_pct(p.get('probability'))} to homer"
            f" · {p.get('matchup', '')} · {p.get('park', '')}{_tag(p, 'lineup_status')}")


def _k_line(p: dict) -> str:
    ek = p.get("expected_ks")
    proj = f" (proj {ek:.1f})" if isinstance(ek, (int, float)) else ""
    return (f"{p.get('player')} ({p.get('team')}) — {_pct(p.get('over_prob'))} over"
            f" {p.get('line')} Ks{proj} · {p.get('matchup', '')}{_tag(p, 'pitcher_status')}")


def _hits_line(p: dict) -> str:
    return (f"{p.get('player')} ({p.get('team')}) — {_pct(p.get('p_ge1'))} for a hit"
            f" · {p.get('matchup', '')}{_tag(p, 'lineup_status')}")


def _lock_line(p: dict | None) -> str:
    if not p:
        return "No lock today."
    prop = p.get("prop")
    if prop == "HR":
        return (f"{p.get('player')} to hit a HR — {_pct(p.get('probability'))}"
                f" · {p.get('matchup', '')}{_tag(p, 'lineup_status')}")
    if prop == "HITS":
        return (f"{p.get('player')} to record a hit — {_pct(p.get('p_ge1'))}"
                f" · {p.get('matchup', '')}{_tag(p, 'lineup_status')}")
    return (f"{p.get('player')} OVER {p.get('line')} Ks — {_pct(p.get('over_prob'))}"
            f" · {p.get('matchup', '')}{_tag(p, 'pitcher_status')}")


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_email(selection: dict) -> dict:
    date = selection.get("date", "")
    lines = [f"PROP-PREDICT PLAYS — {date}", "",
             "🔒 LOCK OF THE DAY", _lock_line(selection.get("lock")), "",
             "💣 HOME RUN PLAYS"]
    lines += ["  • " + _hr_line(p) for p in selection.get("hr", [])]
    lines += ["", "🔥 STRIKEOUT PLAYS"]
    lines += ["  • " + _k_line(p) for p in selection.get("strikeouts", [])]
    lines += ["", "🟢 HITS PLAYS"]
    lines += ["  • " + _hits_line(p) for p in selection.get("hits", [])]
    lines += ["", f"Board refreshed {selection.get('updated', '')} (UTC). Source: prop-predict."]
    text = "\n".join(lines)
    html = "<pre style=\"font:14px/1.5 ui-monospace,monospace\">" + _escape(text) + "</pre>"
    return {"subject": f"⚾ Prop Plays — {date}", "text": text, "html": html}


def render_push(selection: dict) -> str:
    n = (len(selection.get("hr", [])) + len(selection.get("strikeouts", []))
         + len(selection.get("hits", [])))
    return f"Lock: {_lock_line(selection.get('lock'))} | {n} plays ready — check email."
