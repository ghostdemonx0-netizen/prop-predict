"""Full Board auto email — Season + History-weighted + Both (intersection), every prop,
plus 3 lock variants. Pure model math (free). This is the lean automated email's body.

'Both' = players who rank in BOTH the season top list AND the history top list, in order —
so a guy strong in history but weak this season (or vice-versa) is filtered out.
"""
from __future__ import annotations

from model.plays import _not_started, _now_utc
from model.plays_email import _BG, _HIT_C, _HR_C, _INK, _K_C, _LINE, _SUB, _et_stamp, _pct, platoon_badge

TB_C, GOLD = "#7048e8", "#ca8a04"
# label, board key, color, season metric, history metric, status field, emoji, is_batter
PROPS = [
    ("Home Runs", "hr", _HR_C, "probability", "probability_hist", "lineup_status", "💣", True),
    ("Hits (1+)", "hits", _HIT_C, "p_ge1", "p_ge1_hist", "lineup_status", "🟢", True),
    ("Strikeouts", "strikeouts", _K_C, "over_prob", "over_prob_hist", "pitcher_status", "🔥", False),
    ("Total Bases (2+)", "total_bases", TB_C, "p_ge2", "p_ge2_hist", "lineup_status", "📊", True),
]
DEPTH = 8  # per prop section. 12 sections + 3 lock blocks (now with 2-box platoon) must fit
# Gmail's ~102KB clip. 8 lands ~95KB (~5KB buffer); the two-box platoon is the size cost.


def _up(board, key, now):
    return [p for p in board.get(key, []) if _not_started(p, now)]


def _rank(plays, metric, n):
    return sorted(plays, key=lambda p: p.get(metric, 0) or 0, reverse=True)[:n]


def _both(plays, m, mh, n=DEPTH, src=45):
    sn = {p["player"] for p in _rank(plays, m, src)}
    hn = {p["player"] for p in _rank(plays, mh, src)}
    names = sn & hn
    bp = [p for p in plays if p["player"] in names]
    bp.sort(key=lambda p: ((p.get(m, 0) or 0) + (p.get(mh, 0) or 0)) / 2, reverse=True)
    return bp[:n]


def _proj(p, statusf):
    return ("" if p.get(statusf) == "confirmed"
            else ' <span style="background:#fff4e6;color:#b9760a;font:700 9px/1 Arial;padding:2px 5px;border-radius:4px;">PROJ</span>')


def _wrap(emoji, title, color, rows):
    if not rows:
        rows = f'<tr><td style="font:400 12px Arial;color:{_SUB};padding:6px 0;">(none)</td></tr>'
    return (f'<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid {_LINE};'
            f'border-left:4px solid {color};border-radius:12px;margin-bottom:12px;"><tr><td style="padding:14px 16px;">'
            f'<div style="font:800 15px/1.2 Arial;color:{color};margin-bottom:6px;">{emoji} {title}</div>'
            f'<table width="100%" cellpadding="0" cellspacing="0">{rows}</table></td></tr></table>')


def _list_block(emoji, title, color, plays, metric, statusf, batter=False):
    rows = "".join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid {_LINE};">'
        f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
        f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
        f'<span style="font:600 13px Arial;color:{_INK};">{p.get("player")}</span>{_proj(p, statusf)}'
        f'{platoon_badge(p) if batter else ""}'
        f'<span style="float:right;font:700 13px Arial;color:{color};">{_pct(p.get(metric))}</span></td></tr>'
        for i, p in enumerate(plays, 1))
    return _wrap(emoji, title, color, rows)


def _both_block(emoji, title, color, plays, m, mh, statusf, batter=False):
    rows = "".join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid {_LINE};">'
        f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
        f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
        f'<span style="font:600 13px Arial;color:{_INK};">{p.get("player")}</span>{_proj(p, statusf)}'
        f'{platoon_badge(p) if batter else ""}'
        f'<span style="float:right;font:700 12px Arial;color:{color};">S {_pct(p.get(m))} · H {_pct(p.get(mh))}</span>'
        f'</td></tr>' for i, p in enumerate(plays, 1))
    return _wrap(emoji, title, color, rows)


def _lock_bet(p):
    """Short prop label for a lock row — so each name shows WHICH bet it is."""
    prop = p.get("prop")
    if prop == "K":
        return f'O{p.get("line")} K'
    return {"HR": "HR", "HITS": "1+ Hit", "TB": "2+ TB"}.get(prop, prop or "")


def _lock_items(board, now, kind, n=10):
    items = []
    for _, key, color, m, mh, statusf, emoji, batter in PROPS:
        met = m if kind == "season" else mh
        for p in _up(board, key, now):
            items.append((p.get(met, 0) or 0, p, emoji, color, statusf, met, batter))
    items.sort(key=lambda x: x[0], reverse=True)
    return items[:n]


def _both_lock(board, now, n=10, src=20):
    """'Both' lock: players who land in BOTH the top-{src} season AND top-{src} history pools,
    ranked by the blend of their two numbers. Wider src so this fills toward {n} instead of the
    handful that survive a top-8 vs top-8 overlap."""
    season = _lock_items(board, now, "season", src)
    hist_v = {}
    for it in _lock_items(board, now, "hist", src):
        hist_v.setdefault(it[1]["player"], it[0])  # best history value per player
    scored, seen = [], set()
    for it in season:
        nm = it[1]["player"]
        if nm in seen or nm not in hist_v:
            continue
        seen.add(nm)
        scored.append(((it[0] + hist_v[nm]) / 2, it))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [it for _, it in scored[:n]]


def _lock_block(title, plays_items):
    rows = "".join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid {_LINE};">'
        f'<span style="display:inline-block;width:20px;height:20px;background:{GOLD};color:#fff;'
        f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
        f'{emoji} <span style="font:600 13px Arial;color:{_INK};">{p.get("player")}</span>'
        f'<span style="background:#fff;border:1px solid {color};color:{color};font:700 9px/1 Arial;'
        f'padding:2px 6px;border-radius:5px;margin-left:6px;">{_lock_bet(p)}</span>'
        f'{_proj(p, statusf)}{platoon_badge(p) if batter else ""}'
        f'<span style="float:right;font:700 13px Arial;color:{color};">{_pct(p.get(met))}</span></td></tr>'
        for i, (v, p, emoji, color, statusf, met, batter) in enumerate(plays_items, 1))
    return _wrap("🔒", title, GOLD, rows)


def render_full_board(board: dict, now_iso: str | None = None) -> dict:
    now = _now_utc(now_iso)
    date = board.get("date", "")

    season_lock = _lock_items(board, now, "season", 10)
    hist_lock = _lock_items(board, now, "hist", 10)
    both_lock = _both_lock(board, now, 10)

    locks = (f'<div style="font:800 16px Arial;color:{GOLD};margin:6px 0 8px;">🔒 Locks of the Day</div>'
             + _lock_block("Season — highest % across the board", season_lock)
             + _lock_block("History-weighted (3-yr)", hist_lock)
             + _lock_block("Both — strong in season AND history", both_lock))

    def section(heading, color, render):
        out = f'<div style="font:800 16px Arial;color:{color};margin:18px 0 8px;">{heading}</div>'
        for label, key, c, m, mh, statusf, emoji, batter in PROPS:
            out += render(label, key, c, m, mh, statusf, emoji, batter)
        return out
    season = section("📅 Season", _INK,
                     lambda label, key, c, m, mh, sf, e, b: _list_block(e, f"{label} — top {DEPTH}", c, _rank(_up(board, key, now), m, DEPTH), m, sf, b))
    history = section("📜 History-Weighted (3-yr)", _INK,
                      lambda label, key, c, m, mh, sf, e, b: _list_block(e, f"{label} (hist) — top {DEPTH}", c, _rank(_up(board, key, now), mh, DEPTH), mh, sf, b))
    both = section("🎯 Both — must rank in season AND history", _INK,
                   lambda label, key, c, m, mh, sf, e, b: _both_block(e, f"{label} — in both", c, _both(_up(board, key, now), m, mh, DEPTH), m, mh, sf, b))

    body = locks + season + history + both
    stamp = _et_stamp(board.get("updated"))
    head = f"Full Board &nbsp;·&nbsp; {date}" + (f" &nbsp;·&nbsp; {stamp}" if stamp else "")
    html = (f'<!DOCTYPE html><html><body style="margin:0;padding:0;background:{_BG};">'
            f'<table width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};"><tr>'
            f'<td align="center" style="padding:18px 12px;"><table width="600" cellpadding="0" cellspacing="0" '
            f'style="max-width:600px;width:100%;">'
            f'<tr><td style="background:{_INK};border-radius:14px;padding:18px 20px;">'
            f'<span style="font:800 20px/1 Arial;color:#fff;">⚾ PROP-PREDICT</span>'
            f'<div style="font:600 12px/1.4 Arial;color:#94a3b8;margin-top:5px;">{head}</div></td></tr>'
            f'<tr><td style="height:14px;line-height:14px;">&nbsp;</td></tr><tr><td>{body}</td></tr>'
            f'<tr><td style="padding:10px 4px;font:400 11px/1.4 Arial;color:{_SUB};">'
            f'Season · History · Both · pure model · prop-predict</td></tr>'
            f'</table></td></tr></table></body></html>')
    subject = f"⚾ Full Board — {date}" + (f" · {stamp}" if stamp else "")
    return {"subject": subject, "html": html}
