"""Full Site Board email — every prop ranked for the day, pure model (no AI, no buzz).

HR · Hits · Strikeouts · Total Bases, each a deep ranked list. Styled to match the
other emails. Reuses the lean email's styled block helper.
"""
from __future__ import annotations

from model.plays import _not_started, _now_utc
from model.plays_email import _BG, _HIT_C, _HR_C, _INK, _K_C, _SUB, _et_stamp, _sblock

TB_C = "#7048e8"  # purple — total bases


def _ranked(board: dict, key: str, metric: str, now) -> list:
    return sorted((p for p in board.get(key, []) if _not_started(p, now)),
                  key=lambda p: p.get(metric, 0) or 0, reverse=True)


def render_site_email(board: dict, now_iso: str | None = None, depth: int = 40) -> dict:
    now = _now_utc(now_iso)
    date = board.get("date", "")
    blocks = [
        ("💣", "Home Runs", _HR_C, _ranked(board, "hr", "probability", now)[:depth], "probability", "lineup_status"),
        ("🟢", "Hits (1+)", _HIT_C, _ranked(board, "hits", "p_ge1", now)[:depth], "p_ge1", "lineup_status"),
        ("🔥", "Strikeouts (over)", _K_C, _ranked(board, "strikeouts", "over_prob", now)[:depth], "over_prob", "pitcher_status"),
        ("📊", "Total Bases (2+)", TB_C, _ranked(board, "total_bases", "p_ge2", now)[:depth], "p_ge2", "lineup_status"),
    ]
    body = "".join(_sblock(e, f"{t} — top {len(pl)}", c, pl, m, s) for e, t, c, pl, m, s in blocks)
    stamp = _et_stamp(board.get("updated"))
    head = f"Full Site Board &nbsp;·&nbsp; {date}" + (f" &nbsp;·&nbsp; {stamp}" if stamp else "")
    html = (f'<!DOCTYPE html><html><body style="margin:0;padding:0;background:{_BG};">'
            f'<table width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};"><tr>'
            f'<td align="center" style="padding:18px 12px;"><table width="600" cellpadding="0" cellspacing="0" '
            f'style="max-width:600px;width:100%;">'
            f'<tr><td style="background:{_INK};border-radius:14px;padding:18px 20px;">'
            f'<span style="font:800 20px/1 Arial;color:#fff;">⚾ PROP-PREDICT</span>'
            f'<div style="font:600 12px/1.4 Arial;color:#94a3b8;margin-top:5px;">{head}</div></td></tr>'
            f'<tr><td style="height:14px;line-height:14px;">&nbsp;</td></tr><tr><td>{body}</td></tr>'
            f'<tr><td style="padding:10px 4px;font:400 11px/1.4 Arial;color:{_SUB};">'
            f'Full ranked board · pure model · prop-predict</td></tr>'
            f'</table></td></tr></table></body></html>')
    subject = f"📊 Full Site Board — {date}" + (f" · {stamp}" if stamp else "")
    return {"subject": subject, "html": html}
