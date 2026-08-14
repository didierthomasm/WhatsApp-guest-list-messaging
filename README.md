# Guest Messenger

Local web app to send wedding-invite WhatsApp messages via `wa.me` links, with
a filterable guest table and a "send queue" so you can work through the list
without losing track of who's been messaged.

WhatsApp has no free bulk-send API. This tool doesn't auto-send — clicking
"Enviar" opens WhatsApp (app or web) with the message pre-filled; you still
press Send there yourself. That's the only way to do this for free without
risking your number getting rate-limited by WhatsApp for automated bulk
sending.

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

- **Message text**: edit `message_template.txt`. Placeholders: `{first_name}`, `{link}`.
- **Link**: set the `WEDDING_URL` env var, or edit the default in `app.py`.
- **Guest data**: replace `data/guest-list.csv` with a fresh export (same column headers) and restart the app.

## How guests are classified

- No name at all (blank placeholder rows) → skipped entirely.
- Has a name but no usable phone number → shown in the "seguimiento manual" section at the bottom (with email if available).
- Has a name and a valid phone number → shown in the main sendable table.

## Progress tracking

Sent status is stored in `state.json` (gitignored) so it survives restarts.
Delete that file to reset everyone back to "not sent".
