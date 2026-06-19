"""Deliver the Deep Board email (Top 25 per prop + all site-data parlays).

Entry: `python -m model.deep_deliver` (add --dry-run to print instead of send).
Reuses the same config + senders as the lean email: RESEND_API_KEY, PLAYS_TO_EMAIL,
PLAYS_FROM_EMAIL (optional), NTFY_TOKEN (optional).
"""
from __future__ import annotations

import os
import sys

from model.deep_email import render_deep_email, render_deep_push
from model.plays import select_plays
from model.plays_deliver import DEFAULT_FROM, load_board, send_email, send_push


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    board = load_board()
    email = render_deep_email(board)

    if dry:
        print(email["text"])
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
        send_email(email["subject"], email["html"], api_key=api_key,
                   to_email=to_email, from_email=from_email)
        print("deep email sent")
    else:
        print("[skip] email — RESEND_API_KEY / PLAYS_TO_EMAIL not set")
    if topic:
        send_push(render_deep_push(board), topic=topic)
        print("push sent")
    else:
        print("[skip] push — NTFY_TOKEN not set")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
