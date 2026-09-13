#!/usr/bin/env python3
"""
uttf.uz'dan ko'chirilgan Juftlik, Aralash juftlik va Jamoaviy reytinglarini
import qiladi, shuningdek allaqachon import qilingan o'yinchilarga (Player)
yosh toifasini (AgeCategory) biriktiradi.

OLDIN BAJARILGAN BO'LISHI SHART:
  1. import-uttf-data.py (yoki uttf-import-data.sql) — Player/Club/News
  2. Ushbu skript ishlaydigan migratsiya: 20260816164126_add_partnerships_and_teams

Ishlatish:
    DATABASE_URL=postgresql://user:pass@host:5432/db python3 import-uttf-rankings-extra.py
"""
import json
import os
import sys
import uuid
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values

DATA_PATH = os.environ.get("UTTF_EXPORT_PATH", "/root/uttf-scrape/uttf-full-export.json")
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL environment variable required", file=sys.stderr)
    sys.exit(1)

# code, name(uz), maxAge, sortOrder — apps/api/prisma/seed.ts bilan bir xil
AGE_CATEGORIES = [
    ("U9", "U-9", 9, 0),
    ("U11", "U-11", 11, 1),
    ("U13", "U-13", 13, 2),
    ("U15", "U-15", 15, 3),
    ("U17", "U-17", 17, 4),
    ("U19", "U-19", 19, 5),
    ("SENIOR", "Kattalar", None, 6),
]


def age_to_category_code(age):
    if age is None or age <= 0:
        return None
    for code, _name, max_age, _sort in AGE_CATEGORIES:
        if max_age is not None and age <= max_age:
            return code
    return "SENIOR"


# uttf.uz jamoaviy reytingidagi ageCategory yorlig'i -> bizning kod
TEAM_AGE_CATEGORY_MAP = {
    "U11": "U11", "U13": "U13", "U15": "U15",
    "U17": "U17", "U19": "U19", "Adults": "SENIOR",
}


def main():
    data = json.load(open(DATA_PATH))
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()
    now = datetime.utcnow()

    # ---------- 1. AgeCategory'larni seed qilish (mavjud bo'lmasa) ----------
    cur.execute("SELECT code, id FROM age_categories")
    category_id_by_code = dict(cur.fetchall())

    to_insert = []
    for code, name, max_age, sort_order in AGE_CATEGORIES:
        if code not in category_id_by_code:
            cid = str(uuid.uuid4())
            category_id_by_code[code] = cid
            to_insert.append((cid, code, name, max_age, sort_order))
    if to_insert:
        execute_values(cur, """
            INSERT INTO age_categories (id, code, name, max_age, sort_order)
            VALUES %s
        """, to_insert)
    print(f"AgeCategory seeded: {len(to_insert)} yangi (jami {len(category_id_by_code)})")

    # ---------- 2. Player.age_category_id backfill ----------
    cur.execute("SELECT license_number, id FROM players WHERE license_number IS NOT NULL")
    player_id_by_pinfl = dict(cur.fetchall())

    updates = []
    for p in data["ratingsSingles"]:
        pinfl = p.get("pinfl")
        pid = player_id_by_pinfl.get(pinfl)
        if not pid:
            continue
        code = age_to_category_code(p.get("age"))
        if code:
            updates.append((category_id_by_code[code], pid))
    if updates:
        execute_values(cur, """
            UPDATE players AS p SET age_category_id = data.cat_id
            FROM (VALUES %s) AS data(cat_id, player_id)
            WHERE p.id = data.player_id
        """, updates)
    print(f"Player.ageCategoryId yangilandi: {len(updates)}")

    # ---------- 3. Partnerships (Juftlik + Aralash juftlik) ----------
    def import_partnerships(rows, event_type):
        seen_pairs = set()
        out = []
        for r in rows:
            p1 = player_id_by_pinfl.get(r.get("pinfl"))
            if not p1:
                continue
            p2 = player_id_by_pinfl.get(r.get("partnerPinfl"))
            # Juftlikni ikki marta (har ikki tarafdan) qo'shib olmaslik uchun
            key = tuple(sorted([r.get("pinfl"), r.get("partnerPinfl") or ""]))
            if key in seen_pairs:
                continue
            seen_pairs.add(key)

            age = r.get("age") or 0
            partner_age = r.get("partnerAge") or 0
            older = max(age, partner_age) or None
            code = age_to_category_code(older)
            age_cat_id = category_id_by_code.get(code) if code else None

            out.append((
                str(uuid.uuid4()), event_type, p1, p2,
                round(r.get("points") or 0), r.get("ranking"),
                age_cat_id, now, now,
            ))
        if out:
            execute_values(cur, """
                INSERT INTO partnerships (id, category, player1_id, player2_id, points,
                                           ranking, age_category_id, created_at, updated_at)
                VALUES %s
            """, out)
        return len(out)

    n_doubles = import_partnerships(data["ratingsDoubles"], "DOUBLES")
    n_mixed = import_partnerships(data["ratingsMixed"], "MIXED_DOUBLES")
    print(f"Partnerships inserted: doubles={n_doubles}, mixed={n_mixed}")

    # ---------- 4. Teams (Jamoaviy) ----------
    team_rows = []
    for t in data["ratingsTeams"]:
        gender_code = t.get("genderCode")
        gender = "MALE" if gender_code == 1 else "FEMALE" if gender_code == 2 else None
        team_age_label = t.get("ageCategory")
        code = TEAM_AGE_CATEGORY_MAP.get(team_age_label)
        age_cat_id = category_id_by_code.get(code) if code else None

        team_rows.append((
            str(uuid.uuid4()), t.get("name") or "Noma'lum jamoa",
            t.get("regionName"), t.get("districtName"), gender,
            age_cat_id, round(t.get("points") or 0), t.get("ranking"),
            t.get("id"), now, now,
        ))
    if team_rows:
        execute_values(cur, """
            INSERT INTO teams (id, name, region_name, district_name, gender,
                                age_category_id, points, ranking, external_id,
                                created_at, updated_at)
            VALUES %s
            ON CONFLICT (external_id, age_category_id, gender) DO NOTHING
        """, team_rows)
    print(f"Teams inserted: {len(team_rows)}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
