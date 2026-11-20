#!/usr/bin/env python3
"""Copy approved Airtable rows into the static site.

Run by .github/workflows/sync-events.yml. Needs the AIRTABLE_TOKEN environment
variable (an Airtable personal access token with data.records:read on the base).
The token is only used here, on GitHub's servers; it is never put in the website.

Events (unchanged rules):
  * No token          -> prints a note and exits without changing anything.
  * Airtable error    -> exits with an error; no data file is rewritten.
  * Zero approved rows -> leaves data/events.json as it was (so a mistake in
                          Airtable can't wipe the page). Set ALLOW_EMPTY=1 to override.

Photos (Photos table) and directory listings are read in the same run.
Nothing is written until every Airtable read has succeeded, so an outage or
an error response cannot wipe data/events.json, data/photos.json,
data/directory.json, or images/community/.
"""
import filecmp
import io
import json
import os
import re
import sys
import tempfile
import time
import urllib.parse
import urllib.request

BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appQJMuaUdqUcuPiJ")
TABLE_ID = os.environ.get("AIRTABLE_EVENTS_TABLE_ID", "tblqCdvy290A4Lz5E")  # "Events"
OUT = os.environ.get("EVENTS_JSON", os.path.join(os.path.dirname(__file__), "..", "data", "events.json"))

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIRECTORY_TABLE = os.environ.get("AIRTABLE_DIRECTORY_TABLE_ID", "tblXmihadUKmncQxS")
PHOTOS_TABLE = os.environ.get("AIRTABLE_PHOTOS_TABLE_ID", "tbleQkhcIZoi9USKb")
DIRECTORY_OUT = os.environ.get("DIRECTORY_JSON", os.path.join(ROOT, "data", "directory.json"))
PHOTOS_OUT = os.environ.get("PHOTOS_JSON", os.path.join(ROOT, "data", "photos.json"))
PHOTO_DIR = os.environ.get("PHOTO_DIR", os.path.join(ROOT, "images", "community"))
MAX_PHOTO_WIDTH = 1600
MAX_PHOTO_BYTES = 16 * 1024 * 1024

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

# Directory columns. Approved and the consent answer are read so we can
# filter, and are never written to data/directory.json.
DF = {
    "name": "fldYz39LpInmBMgbI",          # Business/Individual Name
    "contact": "fld8vYKWy274KNgCm",       # Contact Name
    "services": "fld4OG6lZGUZMxo2Q",      # Services Offered
    "phone": "fldOjTdfUgPKPHNmG",         # Phone #
    "email": "fld8JFtp16T2NpMaW",         # Email
    "alternate": "fldHHb2XBx1jPRP1B",     # Alternate Phone Number
    "location": "fldZFhtrKCmya5rZS",      # Island Location
    "other": "fldAITFRh7DVOn0zH",         # Other Service Description (rich text)
    "notes": "fldONWqvcF8jVyY4E",         # Notes
    "approved": "fldeTXzQOtswurTP8",      # Approved (checkbox) — not exported
    "consent": "fldGB7Jwu4oCllQSM",       # Public-sharing consent — not exported
}
DIRECTORY_PUBLIC_KEYS = (
    "id", "name", "contactName", "services", "phone", "email",
    "alternatePhone", "islandLocation", "otherServiceDescription", "notes",
)
# Select options that were left over from the form, not real places.
_LOCATION_JUNK = {
    "are these services offered on whidbey island?",
    "yes",
    "island location",
}

# Photo columns by name (field ids were not published). Contact Email is
# intentionally absent: it must never be requested, stored, or printed.
PHOTO_FIELDS = ["Caption", "Photo", "Submitted By", "Approved", "Sort Order", "Submitted At"]
PHOTO_PUBLIC_KEYS = ("caption", "submittedBy", "image", "sortOrder", "submittedAt")


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


def fetch_records(token, table_id, field_ids=None, field_names=None):
    """Read every row of one table. Raises on HTTP errors or a bad payload."""
    records, offset = [], None
    while True:
        params = [("pageSize", "100")]
        if field_ids:
            params.append(("returnFieldsByFieldId", "true"))
            params += [("fields[]", fid) for fid in field_ids]
        if field_names:
            params += [("fields[]", name) for name in field_names]
        if offset:
            params.append(("offset", offset))
        url = "https://api.airtable.com/v0/%s/%s?%s" % (
            BASE_ID, table_id, urllib.parse.urlencode(params))
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        if not isinstance(data, dict) or not isinstance(data.get("records"), list):
            raise RuntimeError("Airtable response was not a record list")
        records.extend(data["records"])
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


def write_events(records):
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


def _text(value):
    if value is None:
        return ""
    return str(value).strip()


def _services(value):
    if value is None or value == "":
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        text = _text(item)
        if text:
            cleaned.append(text)
    return cleaned


def _or_none(value):
    text = _text(value)
    return text or None


def _notes(value):
    """Plain notes. Non-breaking spaces become normal spaces; line breaks stay."""
    if value is None:
        return None
    text = str(value).replace("\u00a0", " ").replace("\u202f", " ").replace("&nbsp;", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    return text or None


def _plain_rich_text(value):
    """Airtable rich text (markdown or simple HTML) as plain text, keeping line breaks."""
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value") or value.get("text") or ""
    if isinstance(value, list):
        value = "\n".join(str(part) for part in value if part is not None)
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ").replace("&nbsp;", " ")
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|tr)\s*>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "- ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text, flags=re.S)
    text = re.sub(r"__(.+?)__", r"\1", text, flags=re.S)
    text = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"\1", text, flags=re.S)
    text = re.sub(r"(?m)^#{1,6}\s*", "", text)
    lines = [line.rstrip() for line in text.split("\n")]
    while lines and lines[0] == "":
        lines.pop(0)
    while lines and lines[-1] == "":
        lines.pop()
    cleaned = "\n".join(lines).strip()
    return cleaned or None


def _island_location(value):
    """One place name. The known typo is corrected; leftover form options are dropped."""
    if isinstance(value, list):
        names = []
        for item in value:
            name = _island_location(item)
            if name and name not in names:
                names.append(name)
        return ", ".join(names) or None
    if isinstance(value, dict):
        value = value.get("name") or value.get("value") or ""
    text = _text(value)
    if not text or text.casefold() in _LOCATION_JUNK:
        return None
    if text.casefold() == "south whibey":
        return "South Whidbey"
    return text


def build_directory(records):
    """Approved listings whose public-sharing answer is exactly Yes.

    The returned objects contain only DIRECTORY_PUBLIC_KEYS.
    """
    listings = []
    for rec in records:
        fields = rec.get("fields") or {}
        if not fields.get(DF["approved"]):
            continue
        consent = fields.get(DF["consent"])
        if isinstance(consent, list):
            consent = consent[0] if consent else ""
        if _text(consent) != "Yes":
            continue
        record_id = _text(rec.get("id"))
        name = _text(fields.get(DF["name"]))
        if not re.match(r"^rec[A-Za-z0-9]+$", record_id) or not name:
            continue
        listing = {
            "id": record_id,
            "name": name,
            "contactName": _or_none(fields.get(DF["contact"])),
            "services": _services(fields.get(DF["services"])),
            "phone": _or_none(fields.get(DF["phone"])),
            "email": _or_none(fields.get(DF["email"])),
            "alternatePhone": _or_none(fields.get(DF["alternate"])),
            "islandLocation": _island_location(fields.get(DF["location"])),
            "otherServiceDescription": _plain_rich_text(fields.get(DF["other"])),
            "notes": _notes(fields.get(DF["notes"])),
        }
        listings.append({key: listing[key] for key in DIRECTORY_PUBLIC_KEYS})
    listings.sort(key=lambda row: (row["name"].casefold(), row["id"]))
    return listings


def _any_known_field(records, keys):
    keyset = set(keys)
    for rec in records:
        if keyset.intersection((rec.get("fields") or {}).keys()):
            return True
    return False


def write_directory(records):
    # A payload of rows with none of the columns we asked for is not a real
    # "nobody is approved" result. Leave the published file alone.
    if records and not _any_known_field(records, DF.values()):
        print(
            "Airtable directory rows did not include the expected fields. data/directory.json was not changed.",
            file=sys.stderr,
        )
        return 0
    listings = build_directory(records)
    try:
        with open(DIRECTORY_OUT, encoding="utf-8") as fh:
            current = json.load(fh)
        if isinstance(current, dict) and current.get("records") == listings:
            print("No changes (%d directory listings)." % len(listings))
            return 0
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    # Keep the previous timestamp when the listings themselves did not change
    # (handled above). A new timestamp is written only alongside new listings,
    # so an hourly run does not commit just because the clock moved.
    payload = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "records": listings,
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    _atomic_write(DIRECTORY_OUT, text)
    print("Wrote %d directory listings to %s" % (len(listings), DIRECTORY_OUT))
    return 0


def _atomic_write(path, text):
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".data-", suffix=".tmp", dir=folder or None)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _sort_order(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number.is_integer():
        return int(number)
    return number


def _ext_from(filename, content_type):
    mapping = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/pjpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    ctype = str(content_type or "").split(";")[0].strip().lower()
    if ctype in mapping:
        return mapping[ctype]
    name = str(filename or "").lower().strip()
    for ext in ("jpeg", "jpg", "png", "webp", "gif"):
        if name.endswith("." + ext):
            return "jpg" if ext == "jpeg" else ext
    return ""


def _first_image(value):
    attachments = value
    if isinstance(attachments, dict):
        attachments = [attachments]
    if not isinstance(attachments, list):
        return None
    for att in attachments:
        if not isinstance(att, dict):
            continue
        url = str(att.get("url") or "")
        if not url.startswith("https://"):
            continue
        filename = str(att.get("filename") or "")
        ctype = str(att.get("type") or "")
        if ctype.startswith("image/") or _ext_from(filename, ctype) or (not ctype and not filename):
            return att
    return None


def download_bytes(url):
    if not str(url).startswith("https://"):
        raise RuntimeError("refusing a non-https attachment URL")
    req = urllib.request.Request(url, headers={"User-Agent": "WhidbeyEquineCouncil-sync"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        final = resp.geturl()
        if not str(final).startswith("https://"):
            raise RuntimeError("attachment redirect was not https")
        data = resp.read(MAX_PHOTO_BYTES + 1)
        ctype = resp.headers.get("Content-Type", "")
    if len(data) > MAX_PHOTO_BYTES:
        raise RuntimeError("image is larger than 16MB")
    if not data:
        raise RuntimeError("image download was empty")
    return data, ctype


def transcode_image(data, content_type, filename):
    """Shrink wide photos to MAX_PHOTO_WIDTH. Falls back to the original bytes."""
    ext = _ext_from(filename, content_type)
    try:
        from PIL import Image, ImageOps
    except ImportError:
        if not ext:
            raise RuntimeError("Pillow is not installed and the image type is unknown")
        print("Pillow is not installed; saving the original image without resizing.")
        return data, ext
    im = None
    try:
        Image.MAX_IMAGE_PIXELS = 40_000_000
        im = Image.open(io.BytesIO(data))
        im.load()
        im = ImageOps.exif_transpose(im)
        if im.width > MAX_PHOTO_WIDTH:
            height = max(1, int(round(im.height * (MAX_PHOTO_WIDTH / float(im.width)))))
            im = im.resize((MAX_PHOTO_WIDTH, height), Image.Resampling.LANCZOS)
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        out = io.BytesIO()
        if has_alpha:
            if im.mode != "RGBA":
                im = im.convert("RGBA")
            im.save(out, format="PNG", optimize=True)
            return out.getvalue(), "png"
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.save(out, format="JPEG", quality=82, optimize=True)
        return out.getvalue(), "jpg"
    except Exception as exc:  # noqa: BLE001
        if ext:
            print("Could not resize image (%s); saving the original." % exc)
            return data, ext
        raise
    finally:
        if im is not None:
            im.close()


def _photo_meta(rec):
    fields = rec.get("fields") or {}
    record_id = _text(rec.get("id"))
    if not re.match(r"^rec[A-Za-z0-9]+$", record_id):
        return None
    if not fields.get("Approved"):
        return None
    submitted = _text(fields.get("Submitted At")) or _text(rec.get("createdTime"))
    return {
        "id": record_id,
        "caption": _text(fields.get("Caption")),
        "submittedBy": _text(fields.get("Submitted By")),
        "sortOrder": _sort_order(fields.get("Sort Order")),
        "submittedAt": submitted,
        "attachment": _first_image(fields.get("Photo")),
    }


def _existing_photo(record_id):
    if not os.path.isdir(PHOTO_DIR):
        return ""
    matches = []
    for name in os.listdir(PHOTO_DIR):
        if re.match(r"^%s\.(jpe?g|png|webp|gif)$" % re.escape(record_id), name, re.I):
            matches.append(name)
    if not matches:
        return ""
    matches.sort()
    return "images/community/" + matches[0]


def _save_photo_file(record_id, blob, ext):
    os.makedirs(PHOTO_DIR, exist_ok=True)
    filename = "%s.%s" % (record_id, ext)
    final = os.path.join(PHOTO_DIR, filename)
    fd, tmp = tempfile.mkstemp(prefix=".photo-", suffix="." + ext, dir=PHOTO_DIR)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(blob)
        if os.path.exists(final) and filecmp.cmp(tmp, final, shallow=False):
            os.remove(tmp)
        else:
            os.replace(tmp, final)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return "images/community/" + filename


def _public_photo(meta, image_path):
    photo = {
        "caption": meta["caption"],
        "submittedBy": meta["submittedBy"],
        "image": image_path,
        "sortOrder": meta["sortOrder"],
        "submittedAt": meta["submittedAt"],
    }
    return {key: photo[key] for key in PHOTO_PUBLIC_KEYS}


def _photo_sort_key(photo):
    order = photo["sortOrder"]
    missing = order is None
    return (missing, 0 if missing else order, photo["submittedAt"] or "", photo["image"])


def write_photos(records):
    """Download approved photos. A failed download keeps the previous file.

    Rows that include none of the Photos columns are not treated as "nothing
    is approved" — that would wipe the gallery. The published files are left
    as they were.
    """
    if records and not _any_known_field(records, PHOTO_FIELDS):
        print(
            "Airtable photo rows did not include the expected fields. data/photos.json and images/community were not changed.",
            file=sys.stderr,
        )
        return 0

    metas = []
    for rec in records:
        meta = _photo_meta(rec)
        if meta:
            metas.append(meta)

    prepared = []
    failures = 0
    approved_with_file = 0
    for meta in metas:
        if not meta["attachment"]:
            continue
        approved_with_file += 1
        try:
            blob, ctype = download_bytes(meta["attachment"].get("url"))
            header_type = ctype or meta["attachment"].get("type") or ""
            data, ext = transcode_image(blob, header_type, meta["attachment"].get("filename") or "")
            path = _save_photo_file(meta["id"], data, ext)
            prepared.append(_public_photo(meta, path))
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print("Photo %s was not downloaded (%s)." % (meta["id"], exc), file=sys.stderr)
            existing = _existing_photo(meta["id"])
            if existing:
                prepared.append(_public_photo(meta, existing))

    if approved_with_file and not prepared:
        # Downloads failed and there is no local copy to keep. Do not replace
        # the gallery with an empty list; events and the directory can still update.
        print(
            "Could not save any approved photos; leaving data/photos.json and images/community unchanged.",
            file=sys.stderr,
        )
        return 0

    prepared.sort(key=_photo_sort_key)
    text = json.dumps(prepared, indent=2, ensure_ascii=False) + "\n"
    try:
        with open(PHOTOS_OUT, encoding="utf-8") as fh:
            unchanged = fh.read() == text
    except (FileNotFoundError, OSError):
        unchanged = False
    if not unchanged:
        _atomic_write(PHOTOS_OUT, text)
        print("Wrote %d community photos to %s" % (len(prepared), PHOTOS_OUT))
    else:
        print("No changes (%d community photos)." % len(prepared))

    keep = {os.path.basename(photo["image"]) for photo in prepared}
    _remove_stale_photos(keep)
    if failures:
        print("Community photos updated with %d image(s) left as they were." % failures)
    return 0


def _remove_stale_photos(keep_names):
    if not os.path.isdir(PHOTO_DIR):
        return
    for name in os.listdir(PHOTO_DIR):
        path = os.path.join(PHOTO_DIR, name)
        if name.startswith(".photo-") or name.startswith(".data-"):
            if os.path.isfile(path):
                os.remove(path)
            continue
        if name in keep_names:
            continue
        if re.match(r"^rec[A-Za-z0-9]+\.(jpe?g|png|webp|gif)$", name, re.I) and os.path.isfile(path):
            os.remove(path)
            print("Removed images/community/%s (no longer approved)." % name)


def _read_all(token):
    """Fetch events, directory, and photos. Any failure leaves every file alone."""
    try:
        events = fetch_approved(token)
        directory = fetch_records(token, DIRECTORY_TABLE, field_ids=list(DF.values()))
        photos = fetch_records(token, PHOTOS_TABLE, field_names=PHOTO_FIELDS)
    except Exception as exc:  # noqa: BLE001
        print("Could not read Airtable (%s). data/events.json was not changed." % exc, file=sys.stderr)
        print("data/photos.json, data/directory.json, and images/community were not changed.", file=sys.stderr)
        return None
    return events, directory, photos


def main():
    token = os.environ.get("AIRTABLE_TOKEN", "").strip()
    if not token:
        print("AIRTABLE_TOKEN is not set; nothing to do. data/events.json was not changed.")
        return 0
    fetched = _read_all(token)
    if fetched is None:
        return 1
    events, directory, photos = fetched
    write_events(events)
    write_directory(directory)
    # If every photo download fails, write_photos leaves the gallery files
    # alone and still returns 0 so this run can commit event and directory updates.
    return write_photos(photos)


if __name__ == "__main__":
    sys.exit(main())
