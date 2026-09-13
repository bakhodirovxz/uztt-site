// UZTT — boshlang'ich ma'lumotlar: permissionlar, rollar, demo userlar,
// yosh kategoriyalari, darajalar, o'yinchilar, demo turnir, yangiliklar.
// Ishga tushirish: pnpm --filter @uztt/api prisma:seed
import {
  PrismaClient,
  Gender,
  MatchStage,
  EventType,
  PointRuleKey,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['ʻʼ`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ==================== PERMISSIONLAR ====================
// Yangi modul qo'shilganda shu ro'yxatga permissionlari qo'shiladi.
const PERMISSIONS: Array<[code: string, description: string]> = [
  // Rollar boshqaruvi
  ['role.manage', 'Rollar va permissionlarni boshqarish'],
  ['user.manage', 'Foydalanuvchilarni boshqarish'],
  // O'yinchilar
  ['player.manage', "O'yinchilarni yaratish/tahrirlash"],
  ['player.verify', "O'yinchi hujjatlarini tasdiqlash (litsenziya)"],
  ['player.document.view', "O'yinchi pasport hujjatlarini ko'rish (maxfiy)"],
  ['ranking.adjust', "Reyting ballarini qo'lda tuzatish (izoh bilan)"],
  // Musobaqalar
  ['tournament.manage', 'Musobaqalarni boshqarish'],
  ['registration.manage', 'Arizalarni tasdiqlash/rad etish, turnirdan chetlatish'],
  ['draw.manage', 'Turnir setkalarini boshqarish'],
  ['match.manage', "O'yinlarni boshqarish (yaratish, kod regeneratsiya)"],
  ['match.score', "Jonli hisob kiritish (hakam)"],
  // Kontent
  ['news.manage', 'Yangiliklarni boshqarish'],
  ['news.publish', 'Yangiliklarni nashr qilish'],
  ['media.manage', 'Media (video, galereya) boshqarish'],
  ['page.manage', 'Statik sahifalar va hujjatlarni boshqarish'],
  // Murabbiy
  ['coach.players.manage', "Murabbiy: o'z o'quvchilarini boshqarish"],
  ['coach.players.register', "Murabbiy: o'quvchilarni turnirga yozish"],
  // Aloqa
  ['contact.inbox', 'Murojaatlar inboxini ko‘rish'],
  // Translatsiya
  ['stream.view', 'Translatsiya kanalini (overlay/monitor) ochish'],
  ['uttf.sync', "uttf.uz dan ma'lumot sinxronizatsiyasini ishga tushirish"],
];

// ==================== ROLLAR ====================
// isSystem=true — o'chirib bo'lmaydi. Yangi rollar admin UI orqali qo'shiladi.
const ROLES: Array<{
  code: string;
  name: string;
  isSystem: boolean;
  sortOrder: number;
  permissions: string[] | 'ALL';
}> = [
  // Root — hamma huquqlar, shu jumladan foydalanuvchi va rollarni boshqarish
  { code: 'SUPERADMIN', name: 'Root (bosh administrator)', isSystem: true, sortOrder: 0, permissions: 'ALL' },
  {
    code: 'ADMIN',
    name: 'Administrator',
    isSystem: true,
    sortOrder: 1,
    permissions: PERMISSIONS.map(([c]) => c).filter((c) => c !== 'role.manage'),
  },
  // Operator — musobaqa jarayonini olib boradi, lekin userlar/rollarga tegmaydi
  {
    code: 'OPERATOR',
    name: 'Operator (musobaqa kotibi)',
    isSystem: true,
    sortOrder: 2,
    permissions: [
      'tournament.manage',
      'registration.manage',
      'draw.manage',
      'match.manage',
      'player.manage',
      'player.verify',
      'ranking.adjust',
      'news.manage',
      'news.publish',
      'media.manage',
      'stream.view',
      'uttf.sync',
      'contact.inbox',
    ],
  },
  {
    code: 'EDITOR',
    name: 'Muharrir',
    isSystem: true,
    sortOrder: 3,
    permissions: ['news.manage', 'news.publish', 'media.manage', 'page.manage'],
  },
  {
    code: 'REFEREE',
    name: 'Hakam',
    isSystem: true,
    sortOrder: 4,
    permissions: ['match.score'],
  },
  {
    code: 'COACH',
    name: 'Murabbiy',
    isSystem: true,
    sortOrder: 5,
    permissions: ['coach.players.manage', 'coach.players.register'],
  },
  {
    code: 'PLAYER',
    name: "O'yinchi",
    isSystem: true,
    sortOrder: 6,
    permissions: [], // o'yinchi o'z profilini boshqaradi — bu resurs-darajali tekshiruv
  },
  {
    code: 'STREAM',
    name: 'Translatsiya operatori (overlay)',
    isSystem: true,
    sortOrder: 7,
    permissions: ['stream.view'],
  },
  {
    code: 'SCREEN',
    name: 'Zal monitori',
    isSystem: true,
    sortOrder: 8,
    permissions: ['stream.view'],
  },
];

// ==================== SEED XAVFSIZLIGI ====================
// Ilgari bu fayl 'admin123'/'root12345' ni qattiq yozib qo'yardi va
// docker-entrypoint.sh SEED_ON_BOOT ni default 1 deb o'qirdi — ya'ni har
// toza deploy ochiq internetda ma'lum parolli SUPERADMIN yaratardi.
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && process.env.SEED_ALLOW_PROD !== '1') {
  throw new Error(
    "Seed production muhitida ishga tushirilmaydi. Haqiqatan kerak bo'lsa " +
      "SEED_ALLOW_PROD=1 va SEED_ADMIN_PASSWORD/SEED_ROOT_PASSWORD bering.",
  );
}

/**
 * Parolni env'dan oladi. Production'da fallback YO'Q — berilmasa seed
 * to'xtaydi. Dev'da qulaylik uchun demo qiymat qoladi.
 */
function seedPassword(envKey: string, devFallback: string): string {
  const fromEnv = process.env[envKey];
  if (fromEnv) {
    if (fromEnv.length < 12) {
      throw new Error(`${envKey} kamida 12 belgi bo'lishi kerak`);
    }
    return fromEnv;
  }
  if (IS_PROD) throw new Error(`${envKey} berilishi shart`);
  return devFallback;
}

// ==================== DEMO USERLAR ====================
const USERS: Array<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: string[];
}> = [
  {
    email: 'admin@uztt.uz',
    password: seedPassword('SEED_ADMIN_PASSWORD', 'admin123'),
    firstName: 'Bosh',
    lastName: 'Administrator',
    roles: ['SUPERADMIN'],
  },
  // Root — foydalanuvchilar va rollargacha hamma narsani boshqaradi
  {
    email: 'root@uztt.uz',
    password: seedPassword('SEED_ROOT_PASSWORD', 'root12345'),
    firstName: 'Root',
    lastName: 'Administrator',
    roles: ['SUPERADMIN'],
  },
  // Operator — turnir ochish, ariza, setka, ball, yangilik, translatsiya havolalari
  {
    email: 'operator@uztt.uz',
    password: 'operator123',
    firstName: 'Musobaqa',
    lastName: 'Operatori',
    roles: ['OPERATOR'],
  },
  {
    email: 'hakam1@uztt.uz',
    password: 'hakam123',
    firstName: 'Birinchi',
    lastName: 'Hakam',
    roles: ['REFEREE'],
  },
  {
    email: 'muharrir@uztt.uz',
    password: 'muharrir123',
    firstName: 'Sayt',
    lastName: 'Muharriri',
    roles: ['EDITOR'],
  },
  {
    email: 'mudir@uztt.uz',
    password: 'mudir123',
    firstName: 'Sayt',
    lastName: 'Mudiri',
    roles: ['ADMIN'],
  },
  {
    email: 'murabbiy@uztt.uz',
    password: 'murabbiy123',
    firstName: 'Test',
    lastName: 'Murabbiy',
    roles: ['COACH'],
  },
  {
    email: 'oyinchi@uztt.uz',
    password: 'oyinchi123',
    firstName: 'Test',
    lastName: "O'yinchi",
    roles: ['PLAYER'],
  },
  // Har stolga uchtalik: hakam + overlay (OBS) + monitor.
  // hakam1 yuqorida yaratilgan, qolgan stollar shu yerda.
  ...[2, 3, 4].map((n) => ({
    email: `hakam${n}@uztt.uz`,
    password: `hakam${n}23`,
    firstName: `${n}-stol`,
    lastName: 'Hakami',
    roles: ['REFEREE'],
  })),
  ...[1, 2, 3, 4].map((n) => ({
    email: `overlay${n}@uztt.uz`,
    password: `overlay${n}23`,
    firstName: `${n}-stol`,
    lastName: 'Overlay',
    roles: ['STREAM'],
  })),
  ...[1, 2, 3, 4].map((n) => ({
    email: `screen${n}@uztt.uz`,
    password: `screen${n}23`,
    firstName: `${n}-stol`,
    lastName: 'Monitor',
    roles: ['SCREEN'],
  })),
];

async function main() {
  console.log('Seed boshlandi...');

  // Permissionlar (upsert — qayta ishga tushirish xavfsiz)
  for (const [code, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }
  console.log(`  ${PERMISSIONS.length} ta permission`);

  // Rollar + permission bog'lamalari
  for (const role of ROLES) {
    const dbRole = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, sortOrder: role.sortOrder },
      create: {
        code: role.code,
        name: role.name,
        isSystem: role.isSystem,
        sortOrder: role.sortOrder,
      },
    });

    const permCodes =
      role.permissions === 'ALL'
        ? PERMISSIONS.map(([c]) => c)
        : role.permissions;
    const perms = await prisma.permission.findMany({
      where: { code: { in: permCodes } },
    });
    // Avval eski bog'lamalarni tozalaymiz (seed idempotent bo'lsin)
    await prisma.rolePermission.deleteMany({ where: { roleId: dbRole.id } });
    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: dbRole.id, permissionId: p.id })),
      });
    }
  }
  console.log(`  ${ROLES.length} ta rol`);

  // Userlar
  // Production'da faqat ikkita SUPERADMIN yaratiladi — qolganlari (operator,
  // hakam, muharrir, overlay, screen...) demo fiksturalar va ularning parollari
  // manbada ochiq turadi. Haqiqiy hisoblarni admin panel orqali yarating.
  const seedUsers = IS_PROD
    ? USERS.filter((u) => u.email === 'admin@uztt.uz' || u.email === 'root@uztt.uz')
    : USERS;

  for (const u of seedUsers) {
    const passwordHash = await argon2.hash(u.password, { type: argon2.argon2id });
    const dbUser = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
      },
    });
    const roles = await prisma.role.findMany({
      where: { code: { in: u.roles } },
    });
    for (const r of roles) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: dbUser.id, roleId: r.id } },
        update: {},
        create: { userId: dbUser.id, roleId: r.id },
      });
    }
  }
  console.log(`  ${seedUsers.length} ta user yaratildi/tekshirildi`);

  // Translatsiya kanallari: overlayN/screenN → N-stol
  for (const n of [1, 2, 3, 4]) {
    for (const [prefix, type] of [
      ['overlay', 'OVERLAY'],
      ['screen', 'SCREEN'],
    ] as const) {
      const u = await prisma.user.findUnique({
        where: { email: `${prefix}${n}@uztt.uz` },
      });
      if (!u) continue;
      await prisma.streamProfile.upsert({
        where: { userId: u.id },
        update: { type, tableNumber: n },
        create: { userId: u.id, type, tableNumber: n, label: `${n}-stol` },
      });
    }
  }
  console.log('  8 ta translatsiya kanali (4 overlay + 4 monitor)');

  // PLAYER test hisobiga bog'langan o'yinchi profili (tasdiqlangan, 14 yosh)
  const playerUser = await prisma.user.findUnique({
    where: { email: 'oyinchi@uztt.uz' },
  });
  if (playerUser) {
    await prisma.player.upsert({
      where: { slug: 'test-oyinchi' },
      update: { userId: playerUser.id },
      create: {
        slug: 'test-oyinchi',
        firstName: 'Test',
        lastName: "O'yinchi",
        gender: Gender.MALE,
        birthDate: new Date('2012-05-10'), // 2026 da 14 yosh — U15+ kategoriyalar
        region: 'Toshkent',
        club: 'Yoshlik SK',
        licenseNumber: 'UZ-9001',
        status: 'ACTIVE',
        userId: playerUser.id,
      },
    });
  }

  await seedDomain();

  // Test o'yinchi ro'yxatdan o'tishda tanlagan yosh toifalari (14 yosh → U15+)
  const testPlayer = await prisma.player.findUnique({
    where: { slug: 'test-oyinchi' },
  });
  if (testPlayer) {
    const declared = await prisma.ageCategory.findMany({
      where: { code: { in: ['U15', 'U17', 'SENIOR'] } },
    });
    for (const ac of declared) {
      await prisma.playerAgeCategory.upsert({
        where: {
          playerId_ageCategoryId: {
            playerId: testPlayer.id,
            ageCategoryId: ac.id,
          },
        },
        update: {},
        create: { playerId: testPlayer.id, ageCategoryId: ac.id },
      });
    }
    console.log(`  test o'yinchiga ${declared.length} ta yosh toifasi belgilandi`);
  }

  console.log('Seed tugadi.');
}

// ==================== DOMEN MA'LUMOTLARI ====================

async function seedDomain() {
  // Yosh kategoriyalari — muvofiqlik: yosh <= maxAge yoki maxAge null
  const AGE_CATEGORIES: Array<[code: string, name: string, maxAge: number | null]> = [
    ['U9', 'U-9', 9],
    ['U11', 'U-11', 11],
    ['U13', 'U-13', 13],
    ['U15', 'U-15', 15],
    ['U17', 'U-17', 17],
    ['U19', 'U-19', 19],
    ['SENIOR', 'Kattalar', null],
  ];
  for (const [i, [code, name, maxAge]] of AGE_CATEGORIES.entries()) {
    await prisma.ageCategory.upsert({
      where: { code },
      update: { name, maxAge, sortOrder: i },
      create: { code, name, maxAge, sortOrder: i },
    });
  }
  console.log(`  ${AGE_CATEGORIES.length} ta yosh kategoriyasi`);

  // Darajalar (legacy rankingPointsTable porti)
  // Daraja = REGLAMENT. Har daraja o'z ball jadvaliga ega: guruhdagi g'alaba,
  // guruhdan chiqish, setkadagi har bir g'alaba, finalda ishtirok, chempionlik.
  // Musobaqa ochilganda daraja tanlanadi va o'yinlar shu jadval bo'yicha ball beradi.
  const LEVELS: Array<{
    code: string;
    name: string;
    description: string;
    coefficient: number;
    sortOrder: number;
    rules: Partial<Record<PointRuleKey, number>>;
  }> = [
    {
      code: 'NATIONAL',
      name: 'Respublika chempionati',
      description: "Eng yuqori daraja — milliy chempionat va kubok",
      coefficient: 3.0,
      sortOrder: 0,
      rules: {
        PARTICIPATION: 100,
        GROUP_ADVANCE: 300,
        WIN: 500,
        CHAMPION: 2100,
      },
    },
    {
      code: 'REGIONAL',
      name: 'Viloyat musobaqasi',
      description: 'Viloyat chempionati va hududiy turnirlar',
      coefficient: 2.5,
      sortOrder: 1,
      rules: {
        PARTICIPATION: 80,
        GROUP_ADVANCE: 250,
        WIN: 400,
        CHAMPION: 1750,
      },
    },
    {
      code: 'OPEN',
      name: 'Ochiq turnir',
      description: 'Ochiq va xalqaro ishtirokli turnirlar',
      coefficient: 1.5,
      sortOrder: 2,
      rules: {
        PARTICIPATION: 50,
        GROUP_ADVANCE: 150,
        WIN: 250,
        CHAMPION: 1050,
      },
    },
    {
      code: 'CLUB',
      name: 'Klub turniri',
      description: 'Klublararo va mahalliy turnirlar',
      coefficient: 1.0,
      sortOrder: 3,
      rules: {
        PARTICIPATION: 30,
        GROUP_ADVANCE: 100,
        WIN: 150,
        CHAMPION: 700,
      },
    },
  ];
  for (const level of LEVELS) {
    const row = await prisma.tournamentLevel.upsert({
      where: { code: level.code },
      update: {
        name: level.name,
        description: level.description,
        coefficient: level.coefficient,
        sortOrder: level.sortOrder,
      },
      create: {
        code: level.code,
        name: level.name,
        description: level.description,
        coefficient: level.coefficient,
        sortOrder: level.sortOrder,
      },
    });
    // Faqat YETISHMAYOTGAN kalitlar qo'shiladi — admin qo'lda kiritgan
    // qiymatlar hech qachon ustidan yozilmaydi.
    const existing = await prisma.levelPointsRule.findMany({
      where: { levelId: row.id },
      select: { key: true },
    });
    const have = new Set(existing.map((r) => r.key));
    const missing = Object.entries(level.rules)
      .filter(([key]) => !have.has(key as PointRuleKey))
      .map(([key, points]) => ({
        levelId: row.id,
        key: key as PointRuleKey,
        points: points!,
      }));
    if (missing.length > 0) {
      await prisma.levelPointsRule.createMany({ data: missing });
    }
  }
  console.log(`  ${LEVELS.length} ta daraja (reglament ballari bilan)`);

  // Bosqich ballari (legacy: final 700, semifinal 450, quarterfinal 250, round1 120, default 100)
  const STAGE_POINTS: Array<[MatchStage, number]> = [
    [MatchStage.FINAL, 700],
    [MatchStage.SEMIFINAL, 450],
    [MatchStage.QUARTERFINAL, 250],
    [MatchStage.ROUND_OF_16, 120],
    [MatchStage.ROUND_OF_32, 120],
    [MatchStage.ROUND_1, 120],
    [MatchStage.GROUP, 100],
  ];
  for (const [stage, basePoints] of STAGE_POINTS) {
    await prisma.stagePoints.upsert({
      where: { stage },
      update: { basePoints },
      create: { stage, basePoints },
    });
  }

  // O'yinchilar (legacy seed: 6 erkak + 6 ayol, 6 viloyat)
  const senior = await prisma.ageCategory.findUniqueOrThrow({ where: { code: 'SENIOR' } });
  const PLAYERS: Array<[first: string, last: string, gender: Gender, region: string, club: string, points: number]> = [
    ['Aziz', 'Rahimov', Gender.MALE, 'Toshkent', 'Yoshlik SK', 480],
    ['Botir', 'Qodirov', Gender.MALE, 'Samarqand', 'Dinamo', 445],
    ['Davron', "Yo'ldoshev", Gender.MALE, 'Farg‘ona', 'Paxtakor', 390],
    ['Eldor', 'Nazarov', Gender.MALE, 'Buxoro', 'Lokomotiv', 350],
    ['Farrux', 'Karimov', Gender.MALE, 'Andijon', 'Navbahor', 310],
    ['G‘ayrat', 'Sobirov', Gender.MALE, 'Namangan', 'Yoshlik SK', 270],
    ['Dilnoza', 'Ergasheva', Gender.FEMALE, 'Toshkent', 'Dinamo', 470],
    ['Feruza', 'Islomova', Gender.FEMALE, 'Samarqand', 'Yoshlik SK', 430],
    ['Gulnora', 'Tosheva', Gender.FEMALE, 'Farg‘ona', 'Paxtakor', 400],
    ['Hulkar', 'Mirzayeva', Gender.FEMALE, 'Buxoro', 'Lokomotiv', 360],
    ['Iroda', 'Xolmatova', Gender.FEMALE, 'Andijon', 'Navbahor', 320],
    ['Jasmina', 'Usmonova', Gender.FEMALE, 'Namangan', 'Dinamo', 280],
  ];
  const playerIds: string[] = [];
  for (const [i, [firstName, lastName, gender, region, club, points]] of PLAYERS.entries()) {
    const slug = slugify(`${firstName} ${lastName}`);
    const p = await prisma.player.upsert({
      where: { slug },
      update: { rankingPoints: points },
      create: {
        slug,
        firstName,
        lastName,
        gender,
        region,
        club,
        rankingPoints: points,
        licenseNumber: `UZ-${String(1001 + i)}`,
        ageCategoryId: senior.id,
        birthDate: new Date(1998 + (i % 8), (i * 3) % 12, 5 + i),
      },
    });
    playerIds.push(p.id);
  }
  console.log(`  ${PLAYERS.length} ta o'yinchi`);

  // Demo turnir
  const national = await prisma.tournamentLevel.findUniqueOrThrow({ where: { code: 'NATIONAL' } });
  const tournament = await prisma.tournament.upsert({
    where: { slug: 'respublika-chempionati-2026' },
    update: {},
    create: {
      slug: 'respublika-chempionati-2026',
      name: 'Respublika chempionati 2026',
      levelId: national.id,
      city: 'Toshkent',
      venue: 'Yoshlik sport majmuasi',
      startDate: new Date('2026-07-30'),
      endDate: new Date('2026-08-05'),
      status: 'LIVE',
      ageCategoryId: senior.id,
    },
  });

  // Demo turnir kategoriyalari: yosh toifasi × guruh
  // (erkaklar/ayollar yakka va juftlik, aralash juftlik, jamoaviy)
  const CATEGORY_MATRIX: Array<{
    code: string;
    gender: Gender | null;
    eventType: EventType;
  }> = [];
  for (const code of ['U9', 'U13', 'SENIOR']) {
    for (const gender of [Gender.MALE, Gender.FEMALE]) {
      CATEGORY_MATRIX.push({ code, gender, eventType: EventType.SINGLES });
    }
  }
  // Kattalar uchun qo'shimcha guruhlar
  CATEGORY_MATRIX.push(
    { code: 'SENIOR', gender: Gender.MALE, eventType: EventType.DOUBLES },
    { code: 'SENIOR', gender: Gender.FEMALE, eventType: EventType.DOUBLES },
    { code: 'SENIOR', gender: null, eventType: EventType.MIXED_DOUBLES },
    { code: 'SENIOR', gender: null, eventType: EventType.TEAM },
  );
  for (const { code, gender, eventType } of CATEGORY_MATRIX) {
    const ac = await prisma.ageCategory.findUniqueOrThrow({ where: { code } });
    const existing = await prisma.tournamentCategory.findFirst({
      where: {
        tournamentId: tournament.id,
        ageCategoryId: ac.id,
        gender,
        eventType,
      },
    });
    if (!existing) {
      await prisma.tournamentCategory.create({
        data: {
          tournamentId: tournament.id,
          ageCategoryId: ac.id,
          gender,
          eventType,
        },
      });
    }
  }
  console.log(`  ${CATEGORY_MATRIX.length} ta turnir kategoriyasi (guruhlar bilan)`);

  // Demo o'yinlar — faqat birinchi seed'da (qayta ishga tushirishda dublikat bo'lmasin)
  const existingMatches = await prisma.match.count({ where: { tournamentId: tournament.id } });
  if (existingMatches === 0) {
    // 1) Jonli o'yin — dev hakam kodi 111111 (faqat seed/demo uchun!)
    await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        stage: MatchStage.SEMIFINAL,
        tableNumber: 1,
        bestOf: 5,
        status: 'SCHEDULED',
        player1Id: playerIds[0],
        player2Id: playerIds[1],
        refereeCodeHash: sha256('111111'),
        scheduledAt: new Date(),
      },
    });
    // 2) Kutilayotgan o'yin
    await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        stage: MatchStage.SEMIFINAL,
        tableNumber: 2,
        bestOf: 5,
        status: 'SCHEDULED',
        player1Id: playerIds[2],
        player2Id: playerIds[3],
        refereeCodeHash: sha256(String(Math.floor(100000 + Math.random() * 900000))),
        scheduledAt: new Date(Date.now() + 3600_000),
      },
    });
    // 3) Tugagan o'yin (setlari bilan)
    const finished = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        stage: MatchStage.QUARTERFINAL,
        tableNumber: 3,
        bestOf: 5,
        status: 'FINISHED',
        player1Id: playerIds[4],
        player2Id: playerIds[5],
        winnerId: playerIds[4],
        player1SetsWon: 3,
        player2SetsWon: 1,
        pointsAwarded: 750, // 250 × 3.0
        refereeCodeHash: sha256(String(Math.floor(100000 + Math.random() * 900000))),
        sets: {
          create: [
            { setNumber: 1, p1Points: 11, p2Points: 7 },
            { setNumber: 2, p1Points: 9, p2Points: 11 },
            { setNumber: 3, p1Points: 11, p2Points: 4 },
            { setNumber: 4, p1Points: 12, p2Points: 10 },
          ],
        },
      },
    });
    await prisma.playerPointsLog.create({
      data: {
        playerId: playerIds[4],
        delta: 750,
        reason: 'MATCH_WIN',
        matchId: finished.id,
        tournamentId: tournament.id,
      },
    });
    console.log('  3 ta demo o\'yin (jonli o\'yin hakam kodi: 111111)');
  }

  // Yangiliklar (uz/ru/en tarjimalari bilan)
  const NEWS: Array<{
    category: string;
    featured?: boolean;
    /** Musobaqa sahifasidagi "Yangiliklar" tabi uchun */
    linkTournament?: boolean;
    uz: [title: string, body: string];
    ru: [string, string];
    en: [string, string];
  }> = [
    {
      category: 'musobaqa',
      featured: true,
      linkTournament: true,
      uz: ['Respublika chempionati boshlandi', 'Toshkentda 2026-yilgi Respublika chempionati start oldi. Yarim final o‘yinlari jonli efirda kuzatib borish mumkin.'],
      ru: ['Стартовал чемпионат Республики', 'В Ташкенте стартовал чемпионат Республики 2026 года. Полуфинальные матчи можно смотреть в прямом эфире.'],
      en: ['National Championship has started', 'The 2026 National Championship kicked off in Tashkent. Semifinal matches are available live.'],
    },
    {
      category: 'federatsiya',
      uz: ['Yangi mavsum kalendari tasdiqlandi', 'Federatsiya 2026/2027 mavsumi uchun musobaqalar kalendarini tasdiqladi — 24 ta rasmiy turnir rejalashtirilgan.'],
      ru: ['Утверждён календарь нового сезона', 'Федерация утвердила календарь соревнований на сезон 2026/2027 — запланировано 24 официальных турнира.'],
      en: ['New season calendar approved', 'The Federation approved the 2026/2027 competition calendar — 24 official tournaments are planned.'],
    },
    {
      category: 'reyting',
      uz: ['Iyul oyi reytingi e’lon qilindi', 'Milliy reytingning yangi holati e’lon qilindi. Yetakchilar o‘z pozitsiyalarini saqlab qolishdi.'],
      ru: ['Опубликован рейтинг за июль', 'Опубликовано новое состояние национального рейтинга. Лидеры сохранили свои позиции.'],
      en: ['July rankings published', 'The updated national rankings are out. The leaders kept their positions.'],
    },
  ];
  for (const n of NEWS) {
    const slug = slugify(n.uz[0]);
    const exists = await prisma.newsTranslation.findUnique({
      where: { locale_slug: { locale: 'uz', slug } },
    });
    if (exists) continue;
    await prisma.newsArticle.create({
      data: {
        status: 'PUBLISHED',
        category: n.category,
        isFeatured: n.featured ?? false,
        tournamentId: n.linkTournament ? tournament.id : null,
        publishedAt: new Date(),
        translations: {
          create: [
            { locale: 'uz', title: n.uz[0], slug, body: n.uz[1], excerpt: n.uz[1].slice(0, 120) },
            { locale: 'ru', title: n.ru[0], slug: slugify(n.ru[0]) || `${slug}-ru`, body: n.ru[1], excerpt: n.ru[1].slice(0, 120) },
            { locale: 'en', title: n.en[0], slug: slugify(n.en[0]), body: n.en[1], excerpt: n.en[1].slice(0, 120) },
          ],
        },
      },
    });
  }
  console.log(`  ${NEWS.length} ta yangilik (3 tilda)`);

  // Media namunalari — faqat birinchi seed'da
  const videoCount = await prisma.video.count();
  if (videoCount === 0) {
    // Placeholder YouTube ID'lar — admin realini kiritadi
    await prisma.video.create({
      data: {
        youtubeId: 'PLACEHOLDER1',
        category: 'highlights',
        isFeatured: true,
        tournamentId: tournament.id,
        publishedAt: new Date(),
        translations: {
          create: [
            { locale: 'uz', title: 'Chempionat yarim finali — eng sara lahzalar' },
            { locale: 'ru', title: 'Полуфинал чемпионата — лучшие моменты' },
            { locale: 'en', title: 'Championship semifinal — highlights' },
          ],
        },
      },
    });
    await prisma.video.create({
      data: {
        youtubeId: 'PLACEHOLDER2',
        category: 'interview',
        publishedAt: new Date(),
        translations: {
          create: [
            { locale: 'uz', title: 'Bosh murabbiy bilan suhbat' },
            { locale: 'ru', title: 'Интервью с главным тренером' },
            { locale: 'en', title: 'Interview with the head coach' },
          ],
        },
      },
    });

    await prisma.gallery.create({
      data: {
        publishedAt: new Date(),
        tournamentId: tournament.id,
        translations: {
          create: [
            { locale: 'uz', title: 'Respublika chempionati — 1-kun' },
            { locale: 'ru', title: 'Чемпионат Республики — день 1' },
            { locale: 'en', title: 'National Championship — day 1' },
          ],
        },
      },
    });

    const STAFF: Array<{
      type: 'EXECUTIVE' | 'STAFF';
      uz: [string, string];
      ru: [string, string];
      en: [string, string];
    }> = [
      {
        type: 'EXECUTIVE',
        uz: ['Anvar Toshpulatov', 'Federatsiya prezidenti'],
        ru: ['Анвар Ташпулатов', 'Президент федерации'],
        en: ['Anvar Toshpulatov', 'Federation President'],
      },
      {
        type: 'EXECUTIVE',
        uz: ['Malika Ismoilova', 'Bosh kotib'],
        ru: ['Малика Исмаилова', 'Генеральный секретарь'],
        en: ['Malika Ismoilova', 'Secretary General'],
      },
      {
        type: 'STAFF',
        uz: ['Rustam Berdiyev', 'Musobaqalar bo‘yicha menejer'],
        ru: ['Рустам Бердыев', 'Менеджер по соревнованиям'],
        en: ['Rustam Berdiyev', 'Competitions Manager'],
      },
    ];
    for (const [i, s] of STAFF.entries()) {
      await prisma.staffProfile.create({
        data: {
          type: s.type,
          sortOrder: i,
          translations: {
            create: [
              { locale: 'uz', fullName: s.uz[0], position: s.uz[1] },
              { locale: 'ru', fullName: s.ru[0], position: s.ru[1] },
              { locale: 'en', fullName: s.en[0], position: s.en[1] },
            ],
          },
        },
      });
    }

    await prisma.federationDocument.create({
      data: {
        category: 'TECHNICAL',
        fileUrl: '/uploads/docs/musobaqa-nizomi-2026.pdf',
        mimeType: 'application/pdf',
        translations: {
          create: [
            { locale: 'uz', title: 'Musobaqa nizomi 2026' },
            { locale: 'ru', title: 'Положение о соревнованиях 2026' },
            { locale: 'en', title: 'Competition regulations 2026' },
          ],
        },
      },
    });

    await prisma.sponsor.createMany({
      data: [
        { name: 'Milliy Bank', tier: 1, sortOrder: 0 },
        { name: 'UzSport Invest', tier: 2, sortOrder: 1 },
        { name: 'Toshkent Arena', tier: 2, sortOrder: 2 },
      ],
    });
    console.log('  media namunalari (video, galereya, xodimlar, hujjat, homiylar)');
  }

  // Statik sahifalar (huquqiy matnlar). Matn NAMUNA — federatsiya yuridik
  // xizmati tasdiqlagan versiyaga panel orqali almashtiriladi.
  const PAGES: Array<{
    key: string;
    sortOrder: number;
    uz: [title: string, body: string];
    ru: [string, string];
    en: [string, string];
  }> = [
    {
      key: 'privacy',
      sortOrder: 0,
      uz: [
        'Maxfiylik siyosati',
        [
          '> **Namuna matn.** Yuridik xizmat tasdiqlagan variant panel orqali kiritiladi.',
          '',
          "## Qanday ma'lumot yig'amiz",
          '',
          "Ro'yxatdan o'tishda ism-familiya, tug'ilgan sana, viloyat, klub va aloqa ma'lumotlari so'raladi. Musobaqada ishtirok etish uchun shaxsni tasdiqlovchi hujjat yuklanadi.",
          '',
          '## Hujjatlar qanday saqlanadi',
          '',
          "Pasport ma'lumotlari va hujjat nusxalari AES-256 bilan shifrlangan holda saqlanadi. Ularni faqat maxsus huquqqa ega xodim ocha oladi va har ochilish tizim jurnalida qayd etiladi.",
          '',
          '## Aloqa',
          '',
          "Savollar bo'yicha: info@uztt.uz",
        ].join('\n'),
      ],
      ru: [
        'Политика конфиденциальности',
        [
          '> **Образец текста.** Финальная редакция вносится через панель.',
          '',
          '## Какие данные мы собираем',
          '',
          'При регистрации запрашиваются ФИО, дата рождения, регион, клуб и контакты. Для участия в соревнованиях загружается документ, удостоверяющий личность.',
          '',
          '## Как хранятся документы',
          '',
          'Паспортные данные и копии документов шифруются AES-256. Доступ — только у сотрудников с отдельным правом, каждое открытие фиксируется в журнале.',
          '',
          '## Контакты',
          '',
          'info@uztt.uz',
        ].join('\n'),
      ],
      en: [
        'Privacy policy',
        [
          '> **Sample text.** The final version approved by legal counsel is entered via the admin panel.',
          '',
          '## What we collect',
          '',
          'Registration requires full name, date of birth, region, club and contact details. Competing requires an identity document upload.',
          '',
          '## How documents are stored',
          '',
          'Passport data and document scans are stored encrypted with AES-256. Only staff with an explicit permission can open them, and every access is written to an audit log.',
          '',
          '## Contact',
          '',
          'info@uztt.uz',
        ].join('\n'),
      ],
    },
    {
      key: 'terms',
      sortOrder: 1,
      uz: [
        'Foydalanish shartlari',
        [
          '> **Namuna matn.** Yuridik xizmat tasdiqlagan variant panel orqali kiritiladi.',
          '',
          "## Hisob va ro'yxatdan o'tish",
          '',
          "Har bir o'yinchi bitta hisobga ega bo'ladi. Kiritilgan ma'lumotlar haqiqiy bo'lishi shart — soxta ma'lumot musobaqadan chetlashtirishga olib keladi.",
          '',
          '## Musobaqa qoidalari',
          '',
          "Yosh toifasiga muvofiqlik tug'ilgan yil bo'yicha avtomatik tekshiriladi. Hakam qarori jonli hisobda yakuniy hisoblanadi; xatolik bo'lsa musobaqa kotibi tuzatadi va tuzatish tarixda qoladi.",
          '',
          '## Kontentdan foydalanish',
          '',
          "Saytdagi matn va suratlar federatsiyaga tegishli. Manba ko'rsatilgan holda ommaviy axborot vositalari foydalanishi mumkin.",
        ].join('\n'),
      ],
      ru: [
        'Условия использования',
        [
          '> **Образец текста.** Финальная редакция вносится через панель.',
          '',
          '## Аккаунт и регистрация',
          '',
          'У каждого игрока один аккаунт. Данные должны быть достоверными — за ложные сведения следует отстранение.',
          '',
          '## Правила соревнований',
          '',
          'Соответствие возрастной категории проверяется автоматически по году рождения. Решение судьи во время матча окончательное; исправления секретаря остаются в истории.',
        ].join('\n'),
      ],
      en: [
        'Terms of use',
        [
          '> **Sample text.** The final version approved by legal counsel is entered via the admin panel.',
          '',
          '## Accounts',
          '',
          'Each player has a single account and must provide accurate details.',
          '',
          '## Competition rules',
          '',
          'Age-category eligibility is checked automatically by year of birth. The referee decision is final during live scoring; corrections by the competition secretary stay in the audit trail.',
        ].join('\n'),
      ],
    },
  ];

  for (const page of PAGES) {
    const existing = await prisma.page.findUnique({ where: { key: page.key } });
    if (existing) continue;
    await prisma.page.create({
      data: {
        key: page.key,
        isSystem: true,
        sortOrder: page.sortOrder,
        translations: {
          create: [
            { locale: 'uz', title: page.uz[0], body: page.uz[1] },
            { locale: 'ru', title: page.ru[0], body: page.ru[1] },
            { locale: 'en', title: page.en[0], body: page.en[1] },
          ],
        },
      },
    });
  }
  console.log(`  ${PAGES.length} ta statik sahifa (maxfiylik, shartlar)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
