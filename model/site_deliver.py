"""Deliver the Full Site Board email (every prop ranked). Entry: python -m model.site_deliver."""
from __future__ import annotations

import os
import sys

from model.plays import select_plays
from model.plays_deliver import DEFAULT_FROM, load_board, send_email, send_push
from model.site_email import render_site_email


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    board = load_board()
    out = render_site_email(board)

    if dry:
        print(out["subject"])
        print(f"html: {len(out['html'])} bytes")
        return 0

    sel = select_plays(board)
    if not (sel["hr"] or sel["strikeouts"] or sel["hits"]):
        print("[skip] no upcoming plays on the board — nothing sent")
        return 0

    api_key = os.environ.get("RESEND_API_KEY")
    to_email = os.environ.get("PLAYS_TO_EMAIL")
    from_email = os.environ.get("PLAYS_FROM_EMAIL", DEFAULT_FROM)
    topic = os.environ.get("NTFY_TOKEN")

    if api_key and to_email:
        send_email(out["subject"], out["html"], api_key=api_key, to_email=to_email, from_email=from_email)
        print("site board email sent")
    else:
        print("[skip] email — RESEND_API_KEY / PLAYS_TO_EMAIL not set")
    if topic:
        send_push(f"📊 Full Site Board ready — {board.get('date', '')}", topic=topic)
        print("push sent")
    else:
        print("[skip] push — NTFY_TOKEN not set")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
