import json
import os

from flask import Flask, jsonify, render_template, request

from guests import load_guests
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


@app.route("/")
def index():
    sendable, follow_up = load_guests(CSV_PATH)
    all_guests = sorted(sendable + follow_up, key=lambda guest: guest.id)
    sent_state = load_state(STATE_PATH)

    guests_payload = [
        {
            "id": guest.id,
            "first": guest.first_name or guest.full_name,
            "name": guest.full_name,
            "phone": guest.phone_raw,
            "waPhone": guest.phone_wa,
            "email": guest.email,
            "tags": guest.tags,
            "party": guest.party,
            "hasPhone": guest.has_phone,
        }
        for guest in all_guests
    ]

    initial_data = {
        "weddingUrl": WEDDING_URL,
        "eventCode": EVENT_CODE,
        "template": load_template(),
        "sentIds": [int(guest_id) for guest_id in sent_state.keys()],
        "guests": guests_payload,
    }

    # Prevent a stray "</script>" in guest data from closing the embedding tag early.
    initial_data_json = json.dumps(initial_data, ensure_ascii=False).replace("</", "<\\/")

    return render_template("index.html", initial_data_json=initial_data_json)


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
