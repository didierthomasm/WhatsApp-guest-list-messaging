import csv
import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Guest:
    id: int
    first_name: str
    last_name: str
    phone_raw: str
    phone_wa: str
    email: str
    tags: list = field(default_factory=list)
    party: str = ""

    @property
    def full_name(self) -> str:
        return " ".join(part for part in (self.first_name, self.last_name) if part).strip()

    @property
    def has_phone(self) -> bool:
        return bool(self.phone_wa)


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if 8 <= len(digits) <= 15:
        return digits
    return ""


def _parse_tags(raw: str) -> list:
    return [tag.strip() for tag in (raw or "").split(",") if tag.strip()]


def load_guests(csv_path: str):
    sendable = []
    follow_up = []

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_id, row in enumerate(reader, start=1):
            first_name = (row.get("first name") or "").strip()
            last_name = (row.get("last name") or "").strip()

            if not first_name and not last_name:
                continue

            guest = Guest(
                id=row_id,
                first_name=first_name,
                last_name=last_name,
                phone_raw=(row.get("phone number") or "").strip(),
                phone_wa=_normalize_phone(row.get("phone number") or ""),
                email=(row.get("email") or "").strip(),
                tags=_parse_tags(row.get("tags") or ""),
                party=(row.get("party") or "").strip(),
            )

            if guest.has_phone:
                sendable.append(guest)
            else:
                follow_up.append(guest)

    return sendable, follow_up
