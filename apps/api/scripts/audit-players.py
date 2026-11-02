#!/usr/bin/env python3
"""
O'yinchilar va ballarni tekshirish / tuzatish (serverda ishlatish uchun).

Standart rejim — FAQAT HISOBOT (bazaga hech narsa yozmaydi).

  DATABASE_URL=postgresql://... python3 audit-players.py
  DATABASE_URL=postgresql://... python3 audit-players.py --apply
  DATABASE_URL=postgresql://... python3 audit-players.py --apply --sync-points

Tekshiradi:
  1. uttf eksportidagi barcha o'yinchi (pinfl) bazada bormi — yo'qlari ro'yxati
  2. O'yinchi / juftlik / jamoa ballari manfiy emasmi, ustun turi butun (integer) mi
  3. Bazadagi ball eksportdagi (yaxlitlangan) ball bilan mosmi

--apply:
  * Avval players/partnerships/teams jadvallarining zaxira nusxasi (…_bak_YYYYMMDD) olinadi
  * Yo'q o'yinchilar qo'shiladi (ON CONFLICT DO NOTHING — mavjudiga tegmaydi)
  * Manfiy ballar 0 ga tenglanadi
--sync-points (faqat --apply bilan):
  * Saytda hali bironta ball yozuvi (player_points_log) YO'Q o'yinchilarning balli
    eksportdagi yaxlitlangan qiymatga tenglanadi. Sayt o'yinlarida ball olganlarga TEGILMAYDI.

Ball qoidasi: faqat butun va 0 dan kichik emas (59.2 → 59, 59.5 → 60, manfiy → 0).
"""
import importlib.util
import json
import os
import sys
import uuid
from datetime import date, datetime

import psycopg2
from psycopg2.extras import execute_values

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.environ.get("UTTF_EXPORT_PATH", "/root/uttf-scrape/uttf-full-export.json")
MANIFEST_PATH = os.environ.get("UTTF_MANIFEST_PATH", "/root/uttf-scrape/images-manifest.json")
DATABASE_URL = os.environ.get("DATABASE_URL")
APPLY = "--apply" in sys.argv
SYNC = "--sync-points" in sys.argv

if not DATABASE_URL:
    print("DATABASE_URL kerak", file=sys.stderr)
    sys.exit(1)
if SYNC and not APPLY:
    print("--sync-points faqat --apply bilan ishlaydi", file=sys.stderr)
    sys.exit(1)

# import-uttf-data.py dagi yordamchilarni qayta ishlatamiz (slugify, split_fio, photo_url, pts)
spec = importlib.util.spec_from_file_location("uttf_import", os.path.join(HERE, "import-uttf-data.py"))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)

data = json.load(open(DATA_PATH))
try:
    manifest = json.load(open(MANIFEST_PATH))
except OSError:
    manifest = {}
    print("OGOHLANTIRISH: rasm manifesti topilmadi — yangi o'yinchilar rasmsiz qo'shiladi")

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

# ---- eksport: noyob pinfl bo'yicha ----
export = {}
dup = 0
for p in data["ratingsSingles"]:
    pinfl = p.get("pinfl")
    if not pinfl:
        continue
    if pinfl in export:
        dup += 1
        continue
    export[pinfl] = p

cur.execute("SELECT id, license_number, ranking_points, slug FROM players")
db = {r[1]: r for r in cur.fetchall() if r[1]}
cur.execute("SELECT COUNT(*) FROM players")
total_players = cur.fetchone()[0]
cur.execute("SELECT DISTINCT player_id FROM player_points_log")
has_log = {r[0] for r in cur.fetchall()}

print("=" * 60)
print(f"Eksportda noyob o'yinchi : {len(export)}  (takror pinfl: {dup})")
print(f"Bazada o'yinchi (jami)    : {total_players}")
missing = [p for k, p in export.items() if k not in db]
print(f"Bazada YO'Q (eksportdan)  : {len(missing)}")
for p in missing[:15]:
    print(f"   - {p.get('fio')}  [{p.get('regionName')}]  ball={p.get('points')}")
if len(missing) > 15:
    print(f"   ... va yana {len(missing) - 15} ta")
extra = [k for k in db if k not in export]
print(f"Bazada bor, eksportda yo'q: {len(extra)}  (sayt orqali ro'yxatdan o'tganlar bo'lishi mumkin — tegilmaydi)")

# ---- ustun turlari ----
cur.execute("""
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE (table_name, column_name) IN (('players','ranking_points'),('partnerships','points'),('teams','points'))
""")
types = cur.fetchall()
print("Ball ustunlari turi        :", ", ".join(f"{t}.{c}={d}" for t, c, d in types))
non_int = [(t, c) for t, c, d in types if d not in ("integer", "bigint", "smallint")]
if non_int:
    print("   !!! BUTUN EMAS:", non_int)

# ---- manfiy ballar ----
neg = {}
for label, sql in (
    ("players", "SELECT COUNT(*) FROM players WHERE ranking_points < 0"),
    ("partnerships", "SELECT COUNT(*) FROM partnerships WHERE points < 0"),
    ("teams", "SELECT COUNT(*) FROM teams WHERE points < 0"),
):
    cur.execute(sql)
    neg[label] = cur.fetchone()[0]
print(f"Manfiy ballar              : o'yinchi={neg['players']}, juftlik={neg['partnerships']}, jamoa={neg['teams']}")

# ---- eksport bilan solishtirish ----
diff = []
for k, p in export.items():
    r = db.get(k)
    if r and r[2] != imp.pts(p.get("points")):
        diff.append((k, r[0], r[2], imp.pts(p.get("points"))))
diff_nolog = [d for d in diff if d[1] not in has_log]
print(f"Ball eksportdan farq qiladi: {len(diff)} ta  (shundan saytda ball yozuvi yo'qlari: {len(diff_nolog)})")
for k, pid, cur_pts, exp_pts in diff[:8]:
    print(f"   - {export[k].get('fio')}: bazada={cur_pts}, eksport={exp_pts}{'  (saytda ball olgan)' if pid in has_log else ''}")
print("=" * 60)

if not APPLY:
    print("Bu faqat hisobot. O'zgartirish uchun: --apply  (yo'q o'yinchilar + manfiy->0)")
    conn.rollback()
    sys.exit(0)

# ---- tuzatish ----
stamp = datetime.utcnow().strftime("%Y%m%d")
for t in ("players", "partnerships", "teams"):
    cur.execute(f'CREATE TABLE IF NOT EXISTS "{t}_bak_{stamp}" AS TABLE "{t}"')
print(f"Zaxira jadvallar: players_bak_{stamp}, partnerships_bak_{stamp}, teams_bak_{stamp}")

cur.execute("SELECT external_id, id FROM clubs WHERE external_id IS NOT NULL")
club_by_ext = dict(cur.fetchall())
cur.execute("SELECT slug FROM players")
used = {r[0] for r in cur.fetchall()}
now = datetime.utcnow()
rows = []
for p in missing:
    pinfl = p["pinfl"]
    fio = p.get("fio") or "Noma'lum Sportchi"
    first, last = imp.split_fio(fio)
    base = imp.slugify(fio)
    slug = f"{base}-{pinfl[:5]}"
    n = 1
    while slug in used:
        n += 1
        slug = f"{base}-{pinfl[:5]}-{n}"
    used.add(slug)
    age = p.get("age") or 0
    rows.append((
        str(uuid.uuid4()), slug, first, last,
        "FEMALE" if p.get("genderCode") == 2 else "MALE",
        date(now.year - age, 1, 1) if age and age > 0 else None,
        p.get("regionName") or "Noma'lum", p.get("clubName"), club_by_ext.get(p.get("clubId")),
        pinfl, imp.pts(p.get("points")),
        imp.photo_url(manifest, p.get("photoId"), "player"),
        "UZ", "ACTIVE", now, now,
    ))
if rows:
    execute_values(cur, """
        INSERT INTO players (id, slug, first_name, last_name, gender, birth_date,
                             region, club, club_id, license_number, ranking_points,
                             photo_url, country_code, status, created_at, updated_at)
        VALUES %s ON CONFLICT (license_number) DO NOTHING
    """, rows)
    print(f"Qo'shilgan o'yinchilar     : {cur.rowcount}")

cur.execute("UPDATE players SET ranking_points = 0 WHERE ranking_points < 0")
a = cur.rowcount
cur.execute("UPDATE partnerships SET points = 0 WHERE points < 0")
b = cur.rowcount
cur.execute("UPDATE teams SET points = 0 WHERE points < 0")
c = cur.rowcount
print(f"Manfiy -> 0                : o'yinchi={a}, juftlik={b}, jamoa={c}")

if SYNC and diff_nolog:
    execute_values(cur, """
        UPDATE players AS p SET ranking_points = v.pts
        FROM (VALUES %s) AS v(id, pts) WHERE p.id = v.id
    """, [(d[1], d[3]) for d in diff_nolog])
    print(f"Eksportga tenglashtirildi  : {len(diff_nolog)} ta (saytda ball olmaganlar)")

conn.commit()
print("TAYYOR (commit qilindi). Qaytarish kerak bo'lsa: …_bak_%s jadvallaridan tiklash mumkin." % stamp)
