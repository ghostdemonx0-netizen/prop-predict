"""Orchestrate + deliver curated plays: load board -> select -> format -> email + push.

Entry: `python -m model.plays_deliver` (add --dry-run to print instead of send).
Config via env: RESEND_API_KEY, PLAYS_TO_EMAIL, PLAYS_FROM_EMAIL (optional),
NTFY_TOKEN (optional — holds the ntfy topic name; free ntfy.sh needs only the
topic in the URL). Missing email/push config is skipped, not an error.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

from model.full_board import render_full_board
from model.plays import select_plays
from model.plays_email import render_push

BOARD_PATH = Path("web/public/data/latest.json")
RESEND_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "onboarding@resend.dev"


def load_board(path: Path = BOARD_PATH) -> dict:
    with open(path) as f:
        return json.load(f)


def send_email(subject: str, html: str, *, api_key: str, to_email: str, from_email: str) -> None:
    resp = requests.post(
        RESEND_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"from": from_email, "to": [to_email], "subject": subject, "html": html},
        timeout=30,
    )
    resp.raise_for_status()


def send_push(message: str, *, topic: str) -> None:
    resp = requests.post(f"https://ntfy.sh/{topic}", data=message.encode("utf-8"),
                         headers={"Title": "Prop Plays"}, timeout=30)
    resp.raise_for_status()


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    board = load_board()
    selection = select_plays(board)
    email = render_full_board(board)  # Season + History + Both, every prop
    push = render_push(selection)     # phone push stays the lean top plays

    if dry:
        print(email["subject"])
        print(f"html: {len(email['html'])} bytes")
        print("\n[push]", push)
        return 0

    # Off-hours / between slates the board can have zero upcoming games — don't
    # send an empty email or push.
    if not (selection["hr"] or selection["strikeouts"] or selection["hits"]):
        print("[skip] no upcoming plays on the board — nothing sent")
        return 0

    api_key = os.environ.get("RESEND_API_KEY")
    to_email = os.environ.get("PLAYS_TO_EMAIL")
    from_email = os.environ.get("PLAYS_FROM_EMAIL", DEFAULT_FROM)
    topic = os.environ.get("NTFY_TOKEN")  # holds the ntfy topic name (free public push)

    if api_key and to_email:
        send_email(email["subject"], email["html"], api_key=api_key,
                   to_email=to_email, from_email=from_email)
        print("email sent")
    else:
        print("[skip] email — RESEND_API_KEY / PLAYS_TO_EMAIL not set")
    if topic:
        send_push(push, topic=topic)
        print("push sent")
    else:
        print("[skip] push — NTFY_TOKEN not set")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
