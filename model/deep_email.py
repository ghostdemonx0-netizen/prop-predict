"""Deep Board email — STYLED cards, pure model (no AI/buzz).

Top per prop (factor-tagged) · DIVERSE parlays (no repeated top name) · 🎲 Diversity
section · 🧠 Factor Edge section · 🎟 money-line ladder. All free (math on the model).
"""
from __future__ import annotations

from model.plays import _not_started, _now_utc, select_plays
from model.plays_email import (_BG, _HIT_C, _HR_C, _INK, _K_C, _LINE, _SUB, _et_stamp, _pct,
                               factor_strength, factor_tags)

# (color, metric, status field, bet label)
META = {"HR": (_HR_C, "probability", "lineup_status", "to HR"),
        "HITS": (_HIT_C, "p_ge1", "lineup_status", "1+ hit"),
        "K": (_K_C, "over_prob", "pitcher_status", None)}
KEYS = {"HR": "hr", "HITS": "hits", "K": "strikeouts"}
MONEYLINE_LEGS = (5, 6, 8, 9, 10, 11, 12, 13, 14, 15)


def _card(inner: str, accent: str = "") -> str:
    bl = f"border-left:4px solid {accent};" if accent else ""
    return (f'<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid {_LINE};'
            f'{bl}border-radius:12px;margin-bottom:12px;"><tr><td style="padding:14px 16px;">{inner}</td></tr></table>')


def _title(emoji: str, text: str, color: str) -> str:
    return f'<div style="font:800 15px/1.2 Arial;color:{color};margin-bottom:8px;">{emoji} {text}</div>'


def _bet(p: dict, prop: str) -> str:
    return f'O{p.get("line")}' if prop == "K" else META[prop][3]


def _row(i: int, p: dict, prop: str, color: str, val: str) -> str:
    proj = ("" if p.get(META[prop][2]) == "confirmed"
            else ' <span style="background:#fff4e6;color:#b9760a;font:700 9px/1 Arial;padding:2px 5px;border-radius:4px;">PROJ</span>')
    tags = factor_tags(p, prop)
    sub = (f'<div style="margin-left:28px;font:400 10px/1.3 Arial;color:#94a3b8;">{" · ".join(tags)}</div>'
           if tags else "")
    return (f'<tr><td style="padding:7px 0;border-bottom:1px solid {_LINE};">'
            f'<span style="display:inline-block;width:20px;height:20px;background:{color};color:#fff;'
            f'border-radius:50%;text-align:center;font:800 11px/20px Arial;">{i}</span> '
            f'<span style="font:600 13px/1.2 Arial;color:{_INK};">{p.get("player")}</span>{proj} '
            f'<span style="color:{_SUB};font:400 11px Arial;">{_bet(p, prop)}</span>'
            f'<span style="float:right;font:700 13px Arial;color:{color};">{val}</span>{sub}</td></tr>')


def _list(plays: list, prop: str, color: str) -> str:
    metric = META[prop][1]
    rows = "".join(_row(i, p, prop, color, _pct(p.get(metric))) for i, p in enumerate(plays, 1))
    return f'<table width="100%" cellpadding="0" cellspacing="0">{rows}</table>'


# ---------- parlays (diverse, factor-reasoned) ----------
def _bpg(plays: list, metric: str) -> list:
    bg = {}
    for p in plays:
        g = p.get("game_id")
        if g is None:
            continue
        if g not in bg or p.get(metric, 0) > bg[g].get(metric, 0):
            bg[g] = p
    return sorted(bg.values(), key=lambda p: p.get(metric, 0), reverse=True)


def _met(p, prop):
    return p["p_ge1"] if prop == "HITS" else (p["over_prob"] if prop == "K" else p["probability"])


def _lab(p, prop):
    return (f'{p["player"]} 1+ hit' if prop == "HITS"
            else f'{p["player"]} O{p.get("line")} K' if prop == "K" else f'{p["player"]} HR')


def _why(legs):
    seen, uniq = set(), []
    for p, prop in legs:
        for t in factor_tags(p, prop):
            if t not in seen:
                seen.add(t)
                uniq.append(t)
    return ("Edge: " + " · ".join(uniq[:4])) if uniq else "Top model numbers, all different games."


def _parlay_versions(versions, color):
    rows, n = "", 0
    for legs in versions:
        if n >= 3:
            break
        seen, ok = set(), []
        for p, prop in legs:
            if p and p["game_id"] not in seen:
                seen.add(p["game_id"])
                ok.append((p, prop))
        if len(ok) < 3:
            continue
        n += 1
        comb = 1.0
        for p, prop in ok:
            comb *= _met(p, prop)
        pc = f"{comb*100:.0f}%" if comb >= 0.1 else f"{comb*100:.1f}%"
        rows += (f'<div style="padding:7px 0;border-bottom:1px solid {_LINE};font:400 12px/1.4 Arial;color:{_SUB};">'
                 f'<b style="color:{color};">v{n} · {pc}</b> · ' + " + ".join(_lab(p, prop) for p, prop in ok)
                 + f'<div style="margin-top:2px;font:400 10px/1.3 Arial;color:#94a3b8;">{_why(ok)}</div></div>')
    return rows


def _type_card(name, tag, color, versions):
    return _card(f'<div style="font:800 14px/1.2 Arial;color:{color};margin-bottom:2px;">🎰 {name} '
                 f'<span style="font-weight:400;font-size:11px;color:{_SUB};">×3 · {tag}</span></div>'
                 + _parlay_versions(versions, color), color)


def _parlays(hp, kp, rp):
    def win(pool, prop):
        c = [[(pool[i], prop) for i in range(s, s + 3) if i < len(pool)] for s in (0, 3, 6)]
        c += [[(pool[i], prop) for i in idx if i < len(pool)] for idx in ((0, 1, 2), (1, 3, 5), (2, 4, 6))]
        return c

    def g(pool, i, prop):
        return (pool[i], prop) if i < len(pool) else None
    mixed = [[g(hp, 0, "HITS"), g(hp, 3, "HITS"), g(kp, 0, "K")], [g(hp, 1, "HITS"), g(hp, 4, "HITS"), g(kp, 1, "K")],
             [g(hp, 2, "HITS"), g(hp, 5, "HITS"), g(kp, 2, "K")], [g(hp, 0, "HITS"), g(kp, 0, "K"), g(hp, 6, "HITS")]]
    bal = [[g(hp, 0, "HITS"), g(rp, 0, "HR"), g(kp, 0, "K")], [g(hp, 1, "HITS"), g(rp, 1, "HR"), g(kp, 1, "K")],
           [g(hp, 2, "HITS"), g(rp, 2, "HR"), g(kp, 2, "K")], [g(hp, 3, "HITS"), g(rp, 3, "HR"), g(kp, 3, "K")]]
    clean = lambda v: [[x for x in leg if x] for leg in v]
    return (_type_card("Safe Hits 3-Leg", "highest floor", _HIT_C, win(hp, "HITS"))
            + _type_card("Strikeout 3-Leg", "pitcher overs", _K_C, win(kp, "K"))
            + _type_card("HR Bomb 3-Leg", "longshot", _HR_C, win(rp, "HR"))
            + _type_card("Mixed Safe 3-Leg", "hits + K", _INK, clean(mixed))
            + _type_card("Balanced 3-Leg", "hit + HR + K", _HR_C, clean(bal)))


def _moneyline(allpool):
    rows, skipped = "", []
    for nlegs in MONEYLINE_LEGS:
        if len(allpool) >= nlegs:
            legs = allpool[:nlegs]
            comb = 1.0
            for p, prop in legs:
                comb *= _met(p, prop)
            pc = f"{comb*100:.0f}%" if comb >= 0.1 else (f"{comb*100:.1f}%" if comb >= 0.001 else "<0.1%")
            rows += (f'<div style="padding:6px 0;border-bottom:1px solid {_LINE};font:400 11px/1.4 Arial;color:{_SUB};">'
                     f'<b style="color:{_INK};">{nlegs}-leg · {pc}</b> · {" + ".join(p["player"] for p, _ in legs)}</div>')
        else:
            skipped.append(str(nlegs))
    note = (f'<div style="margin-top:6px;font:400 10px Arial;color:{_SUB};">Skipped {", ".join(skipped)}-leg — '
            f'not enough games.</div>' if skipped else "")
    return _card(_title("🎟", "Money-line ladder (slate-adaptive)", _INK) + rows + note, _INK)


def render_deep_email(board: dict, now_iso: str | None = None) -> dict:
    now = _now_utc(now_iso)
    date = board.get("date", "")
    sel = select_plays(board, hr_count=12, k_count=12, hits_count=12, now_iso=now_iso)

    # diverse pools (one play per game)
    hp = _bpg([p for p in board.get("hits", []) if _not_started(p, now)], "p_ge1")
    kp = _bpg([p for p in board.get("strikeouts", []) if _not_started(p, now)], "over_prob")
    rp = _bpg([p for p in board.get("hr", []) if _not_started(p, now)], "probability")

    # Top per prop (factor-tagged)
    tops = (_card(_title("💣", "Top 12 — Home Runs", _HR_C) + _list(sel["hr"], "HR", _HR_C), _HR_C)
            + _card(_title("🟢", "Top 12 — Hits", _HIT_C) + _list(sel["hits"], "HITS", _HIT_C), _HIT_C)
            + _card(_title("🔥", "Top 12 — Strikeouts", _K_C) + _list(sel["strikeouts"], "K", _K_C), _K_C))

    # Diversity section: best play per game across props, spread, ranked by metric
    spread = sorted([(p, "HR") for p in rp] + [(p, "HITS") for p in hp] + [(p, "K") for p in kp],
                    key=lambda x: _met(x[0], x[1]), reverse=True)
    seen_g, div_rows, n = set(), "", 0
    for p, prop in spread:
        if p["game_id"] in seen_g or n >= 12:
            continue
        seen_g.add(p["game_id"])
        n += 1
        c = META[prop][0]
        div_rows += _row(n, p, prop, c, _pct(_met(p, prop)))
    diversity = _card(_title("🎲", "Diversity — one play per game (max spread)", "#0ca678")
                      + f'<table width="100%" cellpadding="0" cellspacing="0">{div_rows}</table>', "#0ca678")
    # diverse parlays from the spread pool
    spread_legs = [(p, prop) for p, prop in spread if p["game_id"] in list(seen_g)][:9]
    div_par = _type_card("Spread 3-Leg (3 diff games)", "max variety", "#0ca678",
                         [spread_legs[0:3], spread_legs[3:6], spread_legs[6:9]])

    # Factor Edge section: ranked by number of strong factors, then metric
    fac = sorted([(p, "HR") for p in rp] + [(p, "HITS") for p in hp] + [(p, "K") for p in kp],
                 key=lambda x: (factor_strength(x[0], x[1]), _met(x[0], x[1])), reverse=True)
    fac = [(p, prop) for p, prop in fac if factor_strength(p, prop) >= 2][:12]
    fac_rows = "".join(_row(i, p, prop, "#f08c00", _pct(_met(p, prop))) for i, (p, prop) in enumerate(fac, 1))
    factor = _card(_title("🧠", "Factor Edge — best spots (heat/matchup/form stacked)", "#f08c00")
                   + (f'<table width="100%" cellpadding="0" cellspacing="0">{fac_rows}</table>' if fac_rows
                      else '<div style="font:400 12px Arial;color:#94a3b8;">No multi-factor spots right now.</div>'),
                   "#f08c00")
    fac_par = _type_card("Factor 3-Leg (best spots)", "every leg in a great spot", "#f08c00",
                         [[fac[i] for i in (0, 1, 2)], [fac[i] for i in (0, 3, 4)] if len(fac) > 4 else [],
                          [fac[i] for i in (1, 3, 5)] if len(fac) > 5 else []]) if len(fac) >= 3 else ""

    allpool = sorted([(p, "HR") for p in rp] + [(p, "HITS") for p in hp] + [(p, "K") for p in kp],
                     key=lambda x: _met(x[0], x[1]), reverse=True)
    seen2, ml_pool = set(), []
    for p, prop in allpool:
        if p["game_id"] not in seen2:
            seen2.add(p["game_id"])
            ml_pool.append((p, prop))

    body = (tops
            + f'<div style="font:800 16px/1.2 Arial;color:{_INK};margin:18px 0 8px;">🎰 Parlays (diverse · 3 versions each)</div>'
            + _parlays(hp, kp, rp)
            + f'<div style="font:800 16px/1.2 Arial;color:#0ca678;margin:18px 0 8px;">🎲 Diversity</div>'
            + diversity + div_par
            + f'<div style="font:800 16px/1.2 Arial;color:#f08c00;margin:18px 0 8px;">🧠 Factor Edge</div>'
            + factor + fac_par
            + _moneyline(ml_pool))

    stamp = _et_stamp(board.get("updated"))
    head = f"Deep Board &nbsp;·&nbsp; {date}" + (f" &nbsp;·&nbsp; {stamp}" if stamp else "")
    html = (f'<!DOCTYPE html><html><body style="margin:0;padding:0;background:{_BG};">'
            f'<table width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};"><tr>'
            f'<td align="center" style="padding:18px 12px;"><table width="600" cellpadding="0" cellspacing="0" '
            f'style="max-width:600px;width:100%;">'
            f'<tr><td style="background:{_INK};border-radius:14px;padding:18px 20px;">'
            f'<span style="font:800 20px/1 Arial;color:#fff;">⚾ PROP-PREDICT</span>'
            f'<div style="font:600 12px/1.4 Arial;color:#94a3b8;margin-top:5px;">{head}</div></td></tr>'
            f'<tr><td style="height:14px;line-height:14px;">&nbsp;</td></tr><tr><td>{body}</td></tr>'
            f'<tr><td style="padding:10px 4px;font:400 11px/1.4 Arial;color:{_SUB};">Pure model · prop-predict</td></tr>'
            f'</table></td></tr></table></body></html>')
    text = (f"DEEP BOARD — {date}\nTop 12 HR/Hits/Ks + PARLAYS (diverse) + Diversity + Factor Edge "
            f"+ MONEY-LINE ladder. (styled HTML email)")
    subject = f"📊 Deep Board — {date}" + (f" · {stamp}" if stamp else "")
    return {"subject": subject, "text": text, "html": html}


def render_deep_push(board: dict, now_iso: str | None = None) -> str:
    sel = select_plays(board, hr_count=3, k_count=3, hits_count=3, now_iso=now_iso)
    L = [f"📊 Deep Board — {board.get('date', '')}"]
    if sel["hr"]:
        L += ["", "💣 Top HR"] + [f'• {p["player"]} {_pct(p.get("probability"))}' for p in sel["hr"]]
    if sel["strikeouts"]:
        L += ["", "🔥 Top K"] + [f'• {p["player"]} O{p.get("line")} {_pct(p.get("over_prob"))}' for p in sel["strikeouts"]]
    L += ["", "Full styled board (diverse parlays + factor edge) in the email 📧"]
    return "\n".join(L)
