# Guest Messenger

Local web app to send wedding-invite WhatsApp messages via `wa.me` links. A
two-pane dashboard: a filterable, groupable guest list on the left (with
Pendientes / Enviados / Sin teléfono tabs), and a detail pane on the right
with a live WhatsApp-style message preview, an in-page message editor, and
progress stats. A full-screen "send queue" mode walks through guests one at a
time so you never lose track of who's been messaged.

WhatsApp has no free bulk-send API. This tool doesn't auto-send — clicking
"Abrir WhatsApp" opens WhatsApp (app or web) with the message pre-filled; you
still press Send there yourself. That's the only way to do this for free
without risking your number getting rate-limited by WhatsApp for automated
bulk sending.

## Setup

```bash
cd guest-messenger
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Open http://localhost:5000

## Customize

- **Message text**: edit it from the "Mensaje" tab in the app (saves to `message_template.txt`), or edit that file directly. Placeholders: `{first_name}`, `{link}`, `{code}`.
- **Event code**: set the `EVENT_CODE` env var, or edit the default in `app.py`.
- **Link**: set the `WEDDING_URL` env var, or edit the default in `app.py`.
- **Guest data**: replace `data/guest-list.csv` with a fresh export (same column headers) and restart the app.

## How guests are classified

- No name at all (blank placeholder rows) → skipped entirely.
- Has a name but no usable phone number → shown under the "Sin teléfono" tab (with email if available), and inline (muted) inside their party group if grouped with someone who does have a phone.
- Has a name and a valid phone number → shown in the "Pendientes" / "Enviados" tabs.
- Guests sharing a `party` id in the CSV (couples, plus-ones) are grouped into collapsible sections when "Agrupar parejas y familias" is on. Selecting one sendable member's checkbox always selects their sendable party-mates too, regardless of that toggle.

## Progress tracking

Sent status is stored in `state.json` (gitignored) so it survives restarts.
Delete that file to reset everyone back to "not sent".
