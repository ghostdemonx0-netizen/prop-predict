"""Render selected plays into an email (subject/text/html) and a short push string."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


def _et_stamp(updated) -> str:
    """Board's refresh time as 'H:MMam ET' — keeps each send's subject unique so
    Gmail doesn't thread + collapse them into blank-looking messages."""
    try:
        dt = datetime.fromisoformat(str(updated).replace("Z", "+00:00")).astimezone(
            ZoneInfo("America/New_York"))
        return dt.strftime("%I:%M%p ET").lstrip("0").replace("AM", "am").replace("PM", "pm")
    except Exception:
        return ""


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


# ---- styled email (same design language as the manual report) ----
_INK, _SUB, _LINE, _BG = "#0f172a", "#475569", "#e2e8f0", "#f1f5f9"
_HR_C, _K_C, _HIT_C = "#e8590c", "#1c7ed6", "#2f9e44"


def _srow(rank: int, player, sub, val, color, proj, extra: str = "") -> str:
    tag = ('<span style="background:#fff4e6;color:#b9760a;font:700 9px/1 Arial;padding:2px 5px;'
           'border-radius:4px;margin-left:5px;">PROJ</span>') if proj else ""
    return (f'<tr><td style="padding:7px 0;border-bottom:1px solid {_LINE};">'
            f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
            f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{rank}</span> '
            f'<span style="font:600 13px/1.2 Arial;color:{_INK};">{_escape(str(player))}</span>{tag}{extra} '
            f'<span style="color:{_SUB};font:400 11px/1.2 Arial;">{_escape(str(sub))}</span>'
            f'<span style="float:right;font:700 13px/1.2 Arial;color:{color};">{val}</span></td></tr>')


def _sblock(emoji: str, title: str, color: str, plays: list, metric: str, statusf: str, batter: bool = False) -> str:
    rows = "".join(_srow(i, p.get("player"), p.get("matchup", ""), _pct(p.get(metric)), color,
                         p.get(statusf) != "confirmed", platoon_badge(p) if batter else "")
                   for i, p in enumerate(plays, 1))
    if not rows:
        rows = f'<tr><td style="font:400 12px Arial;color:{_SUB};padding:6px 0;">(no upcoming plays)</td></tr>'
    return (f'<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid {_LINE};'
            f'border-left:4px solid {color};border-radius:12px;margin-bottom:12px;"><tr><td style="padding:14px 16px;">'
            f'<div style="font:800 15px/1.2 Arial;color:{color};margin-bottom:6px;">{emoji} {title}</div>'
            f'<table width="100%" cellpadding="0" cellspacing="0">{rows}</table></td></tr></table>')


def _styled_email(selection: dict, date: str, stamp: str) -> str:
    lock = selection.get("lock")
    lc = {"HR": _HR_C, "K": _K_C, "HITS": _HIT_C}.get(lock.get("prop") if lock else None, _INK)
    lock_card = (f'<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid {_LINE};'
                 f'border-left:4px solid {lc};border-radius:12px;margin-bottom:12px;"><tr><td style="padding:14px 16px;">'
                 f'<div style="font:800 11px/1 Arial;color:{lc};letter-spacing:.5px;">🔒 LOCK OF THE DAY</div>'
                 f'<div style="font:600 14px/1.4 Arial;color:{_INK};margin-top:5px;">{_escape(_lock_line(lock))}</div>'
                 f'</td></tr></table>')
    body = (lock_card
            + _sblock("💣", "Home Run Plays", _HR_C, selection.get("hr", []), "probability", "lineup_status")
            + _sblock("🔥", "Strikeout Plays", _K_C, selection.get("strikeouts", []), "over_prob", "pitcher_status")
            + _sblock("🟢", "Hits Plays", _HIT_C, selection.get("hits", []), "p_ge1", "lineup_status"))
    head_sub = f"Daily Plays &nbsp;·&nbsp; {date}" + (f" &nbsp;·&nbsp; {stamp}" if stamp else "")
    return (f'<!DOCTYPE html><html><body style="margin:0;padding:0;background:{_BG};">'
            f'<table width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};"><tr>'
            f'<td align="center" style="padding:18px 12px;"><table width="560" cellpadding="0" cellspacing="0" '
            f'style="max-width:560px;width:100%;">'
            f'<tr><td style="background:{_INK};border-radius:14px;padding:18px 20px;">'
            f'<span style="font:800 20px/1 Arial;color:#fff;">⚾ PROP-PREDICT</span>'
            f'<div style="font:600 12px/1.4 Arial;color:#94a3b8;margin-top:5px;">{head_sub}</div></td></tr>'
            f'<tr><td style="height:14px;line-height:14px;">&nbsp;</td></tr><tr><td>{body}</td></tr>'
            f'<tr><td style="padding:10px 4px;font:400 11px/1.4 Arial;color:{_SUB};">Source: prop-predict</td></tr>'
            f'</table></td></tr></table></body></html>')


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
    stamp = _et_stamp(selection.get("updated"))
    html = _styled_email(selection, date, stamp)  # styled cards (same design as manual report)
    subject = f"⚾ Prop Plays — {date}" + (f" · {stamp}" if stamp else "")
    return {"subject": subject, "text": text, "html": html}


def factor_tags(p: dict, prop: str) -> list:
    """Reasoning from the model's own factor multipliers — heat, wind, matchup, form, BvP.
    Pure thresholding of numbers the model already computed (no AI). Shared by all emails."""
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
    elif prop == "TB":
        if p.get("recent_form_mult", 1) >= 1.05:
            tags.append("🔥hot")
        if p.get("park_mult", 1) >= 1.05:
            tags.append("hitter park")
        if p.get("pitcher_factor", 1) >= 1.2 or p.get("pitcher_mult", 1) >= 1.12:
            tags.append("vs hittable arm")
        if (p.get("vs") or {}).get("lean") == "H":
            tags.append("matchup→bases")
    return tags


def factor_strength(p: dict, prop: str) -> int:
    """How many strong factors a play has — for the Factor Edge ranking."""
    return len(factor_tags(p, prop))


def platoon_badge(p: dict) -> str:
    """Two little boxes next to a BATTER who has the platoon edge, matching the site:
    a turquoise handedness box (LHB / RHB / SW) that lights up only on an edge
    (opposite-handed vs the pitcher, or a switch hitter), then a separate 'vs <pitcher>'
    box. Returns '' when there's no edge or data's missing. Batters only (not pitchers)."""
    bats = p.get("bats")
    vs = p.get("vs") or {}
    throws, name = vs.get("throws"), vs.get("name")
    if not bats or not throws:
        return ""
    edge = bats == "S" or (bats == "L" and throws == "R") or (bats == "R" and throws == "L")
    if not edge:
        return ""
    hand = "SW" if bats == "S" else ("LHB" if bats == "L" else "RHB")
    box1 = (f'<span style="background:#c3fae8;color:#0b7285;font:700 9px/1 Arial;'
            f'padding:2px 5px;border-radius:4px;margin-left:5px;">{hand}</span>')
    box2 = ""
    if name:
        box2 = (f'<span style="background:#f1f3f5;color:#495057;font:700 9px/1 Arial;'
                f'padding:2px 5px;border-radius:4px;margin-left:3px;">vs {name}</span>')
    return box1 + box2


def render_push(selection: dict) -> str:
    """The full lean plays — compact enough to read straight in the phone push."""
    lines = [f"🔒 {_lock_line(selection.get('lock'))}"]
    if selection.get("hr"):
        lines += ["", "💣 HR"] + ["• " + _hr_line(p) for p in selection["hr"]]
    if selection.get("strikeouts"):
        lines += ["", "🔥 K"] + ["• " + _k_line(p) for p in selection["strikeouts"]]
    if selection.get("hits"):
        lines += ["", "🟢 HITS"] + ["• " + _hits_line(p) for p in selection["hits"]]
    return "\n".join(lines)
