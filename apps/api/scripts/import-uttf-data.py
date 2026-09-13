#!/usr/bin/env python3
"""
uttf.uz'dan ko'chirilgan ma'lumotlarni (klublar, o'yinchilar reytingi, yangiliklar)
yangi UZTT platformasi bazasiga import qiladi.

Manba: /root/uttf-scrape/uttf-full-export.json (uttf.uz ochiq API'laridan olingan)
Rasmlar: apps/web/public/uttf-import/{players,clubs,news}/

Ishlatish:
    DATABASE_URL=postgresql://user:pass@host:5432/db python3 import-uttf-data.py
"""
import json
import os
import re
import sys
import uuid
from datetime import date, datetime

import psycopg2
from psycopg2.extras import execute_values

DATA_PATH = os.environ.get("UTTF_EXPORT_PATH", "/root/uttf-scrape/uttf-full-export.json")
MANIFEST_PATH = os.environ.get("UTTF_MANIFEST_PATH", "/root/uttf-scrape/images-manifest.json")
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL environment variable required", file=sys.stderr)
    sys.exit(1)


def slugify(text: str) -> str:
    text = text.lower()
    repl = {
        "ʻ": "", "'": "", "‘": "", "’": "", "`": "",
        "o‘": "o", "g‘": "g",
    }
    for k, v in repl.items():
        text = text.replace(k, v)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "item"


def split_fio(fio: str):
    parts = fio.strip().split()
    if not parts:
        return "Noma'lum", "Noma'lum"
    last = parts[0]
    first = " ".join(parts[1:]) if len(parts) > 1 else parts[0]
    return first, last


def photo_url(manifest, photo_id, kind):
    if not photo_id:
        return None
    item = manifest.get(photo_id)
    if not item or item.get("bytes", 0) == 0:
        return None
    folder = {"player": "players", "club": "clubs", "news": "news"}[kind]
    return f"/uttf-import/{folder}/{item['file']}"


def parse_uttf_date(s: str):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%d.%m.%Y").date()
    except ValueError:
        return None


def main():
    data = json.load(open(DATA_PATH))
    manifest = json.load(open(MANIFEST_PATH))

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    now = datetime.utcnow()

    # ---------- 1. Clubs ----------
    club_rows = []
    club_id_by_external = {}
    used_slugs = set()
    for c in data["clubs"]:
        cid = str(uuid.uuid4())
        club_id_by_external[c["id"]] = cid
        base_slug = slugify(c.get("name") or f"club-{c['id']}")
        slug = base_slug
        n = 1
        while slug in used_slugs:
            n += 1
            slug = f"{base_slug}-{n}"
        used_slugs.add(slug)

        club_rows.append((
            cid, slug, c.get("name") or "Noma'lum klub", c.get("type"),
            c.get("regionName"), c.get("districtName"), c.get("address"),
            float(c["latitude"]) if c.get("latitude") not in (None, "") else None,
            float(c["longitude"]) if c.get("longitude") not in (None, "") else None,
            c.get("phoneNumber"), c.get("coachName"), c.get("clubManagerName"),
            c.get("numberOfIttfTables"),
            photo_url(manifest, c.get("photoId"), "club"),
            c["id"], now, now,
        ))

    execute_values(cur, """
        INSERT INTO clubs (id, slug, name, club_type, region_name, district_name, address,
                            latitude, longitude, phone_number, coach_name, manager_name,
                            table_count, logo_url, external_id, created_at, updated_at)
        VALUES %s
        ON CONFLICT (external_id) DO NOTHING
    """, club_rows)
    print(f"Clubs inserted: {cur.rowcount}")

    # ---------- 2. Players (singles ranking = full roster) ----------
    player_rows = []
    used_slugs = set()
    seen_pinfl = set()
    for p in data["ratingsSingles"]:
        pinfl = p.get("pinfl")
        if not pinfl or pinfl in seen_pinfl:
            continue
        seen_pinfl.add(pinfl)

        fio = p.get("fio") or "Noma'lum Sportchi"
        first, last = split_fio(fio)
        base_slug = slugify(fio)
        slug = f"{base_slug}-{pinfl[:5]}"
        n = 1
        while slug in used_slugs:
            n += 1
            slug = f"{base_slug}-{pinfl[:5]}-{n}"
        used_slugs.add(slug)

        gender = "FEMALE" if p.get("genderCode") == 2 else "MALE"
        age = p.get("age") or 0
        birth_date = None
        if age and age > 0:
            birth_year = now.year - age
            birth_date = date(birth_year, 1, 1)

        club_uttf_id = p.get("clubId")
        club_id = club_id_by_external.get(club_uttf_id)

        points = p.get("points") or 0
        pid = str(uuid.uuid4())

        player_rows.append((
            pid, slug, first, last, gender, birth_date,
            p.get("regionName") or "Noma'lum", p.get("clubName"), club_id,
            pinfl, round(points),
            photo_url(manifest, p.get("photoId"), "player"),
            "UZ", "ACTIVE", now, now,
        ))

    execute_values(cur, """
        INSERT INTO players (id, slug, first_name, last_name, gender, birth_date,
                              region, club, club_id, license_number, ranking_points,
                              photo_url, country_code, status, created_at, updated_at)
        VALUES %s
        ON CONFLICT (license_number) DO NOTHING
    """, player_rows)
    print(f"Players inserted: {cur.rowcount}")

    # ---------- 3. News ----------
    news_rows = []
    news_tr_rows = []
    for a in data["news"]:
        nid = str(uuid.uuid4())
        published = parse_uttf_date(a.get("createdAt"))
        news_rows.append((
            nid, "PUBLISHED", None,
            photo_url(manifest, a.get("photoId"), "news"),
            False, None,
            published, None, now, now,
        ))
        title = (a.get("title") or "").strip() or "(Sarlavhasiz)"
        base_slug = slugify(title)[:60] or f"news-{a['id']}"
        slug = f"{base_slug}-{a['id']}"
        news_tr_rows.append((
            str(uuid.uuid4()), nid, "en", title, slug,
            (a.get("tag") or "")[:280] or None,
            a.get("description") or "",
        ))

    execute_values(cur, """
        INSERT INTO news_articles (id, status, category, cover_image_url, is_featured,
                                    tournament_id, published_at, author_id, created_at, updated_at)
        VALUES %s
    """, news_rows)
    execute_values(cur, """
        INSERT INTO news_translations (id, article_id, locale, title, slug, excerpt, body)
        VALUES %s
    """, news_tr_rows)
    print(f"News inserted: {len(news_rows)}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
