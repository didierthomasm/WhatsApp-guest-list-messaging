import json
import os
from datetime import datetime, timezone


def load_state(state_path: str) -> dict:
    if not os.path.exists(state_path):
        return {}
    with open(state_path, encoding="utf-8") as f:
        return json.load(f)


def save_state(state_path: str, state: dict) -> None:
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def mark_sent(state_path: str, guest_id: str) -> dict:
    state = load_state(state_path)
    state[guest_id] = datetime.now(timezone.utc).isoformat()
    save_state(state_path, state)
    return state


def unmark_sent(state_path: str, guest_id: str) -> dict:
    state = load_state(state_path)
    state.pop(guest_id, None)
    save_state(state_path, state)
    return state
