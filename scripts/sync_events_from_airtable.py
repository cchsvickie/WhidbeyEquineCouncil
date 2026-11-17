#!/usr/bin/env python3
"""Rewrite data/events.json from the APPROVED records in the Airtable "Events" table.

Run by .github/workflows/sync-events.yml. Needs the AIRTABLE_TOKEN environment
variable (an Airtable personal access token with data.records:read on the base).
The token is only used here, on GitHub's servers; it is never put in the website.

Safety rules:
  * No token          -> prints a note and exits without changing anything.
  * Airtable error    -> exits with an error, data/events.json is left as it was.
  * Zero approved rows -> leaves data/events.json as it was (so a mistake in
                          Airtable can't wipe the page). Set ALLOW_EMPTY=1 to override.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appQJMuaUdqUcuPiJ")
TABLE_ID = os.environ.get("AIRTABLE_EVENTS_TABLE_ID", "tblqCdvy290A4Lz5E")  # "Events"
OUT = os.environ.get("EVENTS_JSON", os.path.join(os.path.dirname(__file__), "..", "data", "events.json"))

# Field IDs (stay the same even if a column is renamed in Airtable)
F = {
    "title": "fldxyy2bej8A04Usl",      # Title
    "category": "fldZkg2veLvBtpBUK",   # Category
    "date": "fldq2kcIaw5LwAfni",       # Date
    "no_date": "fldFDVcz2iyUx3f1x",    # If No Date (Dates coming soon / Ongoing)
    "time": "fldWZHgX8G0j4LyVi",       # Time
    "desc": "fld1kNIRl1LxwVOGb",       # Description
    "location": "fldc0qU2mkvB1LAW4",   # Location
    "price": "fldsPbbFoiBG4ESzJ",      # Price
    "link": "fldGvlYASWC9wJqAY",       # Link
    "approved": "fldUBItfzh5ob7XK7",   # Approved (checkbox)
}
CATEGORIES = {"Community Activities", "Meetings", "Shows/Clinics"}


def fetch_approved(token):
    records, offset = [], None
    while True:
        # Unapproved rows are skipped below (to_event), so renaming the
        # Approved column in Airtable can't break this.
        params = [
            ("returnFieldsByFieldId", "true"),
            ("pageSize", "100"),
        ]
        params += [("fields[]", fid) for fid in F.values()]
        if offset:
            params.append(("offset", offset))
        url = "https://api.airtable.com/v0/%s/%s?%s" % (BASE_ID, TABLE_ID, urllib.parse.urlencode(params))
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            return records


def clean_link(value):
    u = str(value or "").strip()
    if not u:
        return ""
    if re.match(r"^https?://", u, re.I):
        return u
    if re.match(r"^[a-z][a-z0-9+.-]*:", u, re.I) or u.startswith("//"):
        return ""  # e.g. javascript:, mailto: -> not allowed
    return u  # a file on this site, like events/Flyer.pdf


def to_event(rec, idx):
    f = rec.get("fields", {})
    if not f.get(F["approved"]):
        return None
    title = str(f.get(F["title"], "")).strip()
    if not title:
        return None
    date = str(f.get(F["date"], "")).strip()[:10]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        date = "2100-01-01" if f.get(F["no_date"]) == "Dates coming soon" else "ongoing"
    category = f.get(F["category"]) or "Community Activities"
    if category not in CATEGORIES:
        category = "Community Activities"
    return {
        "id": idx,
        "category": category,
        "title": title,
        "date": date,
        "time": str(f.get(F["time"], "")).strip(),
        "desc": str(f.get(F["desc"], "")).strip(),
        "location": str(f.get(F["location"], "")).strip(),
        "price": str(f.get(F["price"], "")).strip(),
        "registerUrl": clean_link(f.get(F["link"])),
    }


def build(records):
    records = sorted(records, key=lambda r: (r.get("createdTime", ""), r.get("id", "")))
    events = []
    for rec in records:
        ev = to_event(rec, len(events) + 1)
        if ev:
            events.append(ev)
    return events


def main():
    token = os.environ.get("AIRTABLE_TOKEN", "").strip()
    if not token:
        print("AIRTABLE_TOKEN is not set; nothing to do. data/events.json was not changed.")
        return 0
    try:
        records = fetch_approved(token)
    except Exception as e:  # noqa: BLE001
        print("Could not read Airtable (%s). data/events.json was not changed." % e, file=sys.stderr)
        return 1
    events = build(records)
    if not events and os.environ.get("ALLOW_EMPTY") != "1":
        print("Airtable returned no approved events; leaving data/events.json unchanged.")
        return 0
    text = json.dumps(events, indent=2, ensure_ascii=False) + "\n"
    try:
        with open(OUT, encoding="utf-8") as fh:
            if fh.read() == text:
                print("No changes (%d approved events)." % len(events))
                return 0
    except FileNotFoundError:
        pass
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print("Wrote %d approved events to %s" % (len(events), OUT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
