import os
from urllib.parse import quote

from flask import Flask, jsonify, render_template, request

from guests import all_tags, group_by_party, load_guests
from state import load_state, mark_sent, unmark_sent

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "guest-list.csv")
STATE_PATH = os.path.join(BASE_DIR, "state.json")
TEMPLATE_PATH = os.path.join(BASE_DIR, "message_template.txt")

WEDDING_URL = os.environ.get("WEDDING_URL", "https://wedding.carolina-and-didier.com/")
EVENT_CODE = os.environ.get("EVENT_CODE", "pkq4v6")

app = Flask(__name__)


def load_template() -> str:
    with open(TEMPLATE_PATH, encoding="utf-8") as f:
        return f.read().strip()


def save_template(text: str) -> None:
    with open(TEMPLATE_PATH, "w", encoding="utf-8") as f:
        f.write(text.strip() + "\n")


def render_message(template: str, first_name: str) -> str:
    return template.format(first_name=first_name, link=WEDDING_URL, code=EVENT_CODE)


def build_message(first_name: str) -> str:
    return render_message(load_template(), first_name)


def wa_link(phone_wa: str, first_name: str) -> str:
    message = build_message(first_name)
    return f"https://wa.me/{phone_wa}?text={quote(message)}"


@app.route("/")
def index():
    sendable, follow_up = load_guests(CSV_PATH)
    sent_state = load_state(STATE_PATH)

    party_groups = group_by_party(sendable + follow_up)
    sendable_ids = {guest.id for guest in sendable}

    rows = []
    for guest in sendable:
        party_members = party_groups.get(guest.party, []) if guest.party else []
        co_members = [member for member in party_members if member.id != guest.id]

        rows.append(
            {
                "id": guest.id,
                "name": guest.full_name,
                "phone": guest.phone_raw,
                "tags": guest.tags,
                "wa_link": wa_link(guest.phone_wa, guest.first_name or guest.full_name),
                "sent": str(guest.id) in sent_state,
                "party_key": guest.party,
                "party_size": len(party_members),
                "party_co_ids": [member.id for member in co_members if member.id in sendable_ids],
                "party_note": ", ".join(
                    member.full_name + ("" if member.id in sendable_ids else " (sin teléfono)")
                    for member in co_members
                ),
            }
        )

    follow_up_rows = [
        {
            "id": guest.id,
            "name": guest.full_name,
            "email": guest.email,
            "tags": guest.tags,
        }
        for guest in follow_up
    ]

    return render_template(
        "index.html",
        guests=rows,
        follow_up=follow_up_rows,
        tags=all_tags(sendable),
        wedding_url=WEDDING_URL,
        event_code=EVENT_CODE,
        message_template=load_template(),
        sent_count=len(sent_state),
        total_count=len(rows),
    )


@app.route("/api/message-template", methods=["POST"])
def api_save_template():
    data = request.get_json(silent=True) or {}
    template = (data.get("template") or "").strip()

    if not template:
        return jsonify({"status": "error", "error": "El mensaje no puede estar vacío."}), 400

    try:
        render_message(template, "Prueba")
    except (KeyError, IndexError):
        return jsonify(
            {"status": "error", "error": "Solo puedes usar estas variables: {first_name}, {link}, {code}."}
        ), 400

    save_template(template)
    return jsonify({"status": "ok"})


@app.route("/api/mark-sent/<int:guest_id>", methods=["POST"])
def api_mark_sent(guest_id):
    mark_sent(STATE_PATH, str(guest_id))
    return jsonify({"status": "ok", "sent": True})


@app.route("/api/unmark-sent/<int:guest_id>", methods=["POST"])
def api_unmark_sent(guest_id):
    unmark_sent(STATE_PATH, str(guest_id))
    return jsonify({"status": "ok", "sent": False})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
