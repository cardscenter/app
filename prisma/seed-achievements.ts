import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

// Mirror of ACHIEVEMENTS from src/lib/achievements.ts — kept in sync manually.
// Running this seed populates/updates the Achievement table with the catalog.
const ACHIEVEMENTS = [
  { key: "archive-first-week",    name: "First Week",          description: "7 dagen lid van Cards Center",        category: "ARCHIVE",   threshold: 7,     rewardEmber: 50,   rewardXP: null, sortOrder: 10 },
  { key: "archive-one-month",     name: "One Month Deep",      description: "30 dagen lid",                        category: "ARCHIVE",   threshold: 30,    rewardEmber: 100,  rewardXP: null, sortOrder: 11 },
  { key: "archive-three-months",  name: "Quarterly Collector", description: "90 dagen lid",                        category: "ARCHIVE",   threshold: 90,    rewardEmber: 200,  rewardXP: null, sortOrder: 12 },
  { key: "archive-one-year",      name: "Veteran",             description: "1 jaar lid",                          category: "ARCHIVE",   threshold: 365,   rewardEmber: 1000, rewardXP: 500,  sortOrder: 13 },

  { key: "vault-first-purchase",  name: "First Pull",          description: "Je eerste aankoop voltooid",          category: "VAULT",     threshold: 1,     rewardEmber: 25,   rewardXP: null, sortOrder: 20 },
  { key: "vault-ten-purchases",   name: "Active Collector",    description: "10 aankopen voltooid",                category: "VAULT",     threshold: 10,    rewardEmber: 100,  rewardXP: null, sortOrder: 21 },
  { key: "vault-fifty-purchases", name: "Binder Keeper",       description: "50 aankopen voltooid",                category: "VAULT",     threshold: 50,    rewardEmber: 500,  rewardXP: null, sortOrder: 22 },
  { key: "vault-100-spent",       name: "Hundred Club",        description: "€100 besteed op het platform",        category: "VAULT",     threshold: 100,   rewardEmber: 50,   rewardXP: null, sortOrder: 23 },
  { key: "vault-1000-spent",      name: "Grail Hunter",        description: "€1.000 besteed op het platform",      category: "VAULT",     threshold: 1000,  rewardEmber: 500,  rewardXP: 250,  sortOrder: 24 },
  { key: "vault-10000-spent",     name: "Vault Master",        description: "€10.000 besteed op het platform",     category: "VAULT",     threshold: 10000, rewardEmber: 2500, rewardXP: 1000, sortOrder: 25 },

  { key: "trader-first-sale",     name: "First Flip",          description: "Je eerste verkoop voltooid",          category: "TRADER",    threshold: 1,     rewardEmber: 25,   rewardXP: null, sortOrder: 30 },
  { key: "trader-ten-sales",      name: "Shop Open",           description: "10 verkopen voltooid",                category: "TRADER",    threshold: 10,    rewardEmber: 100,  rewardXP: null, sortOrder: 31 },
  { key: "trader-fifty-sales",    name: "Established Seller",  description: "50 verkopen voltooid",                category: "TRADER",    threshold: 50,    rewardEmber: 500,  rewardXP: 250,  sortOrder: 32 },
  { key: "trader-100-sales",      name: "Master Trader",       description: "100 verkopen voltooid",               category: "TRADER",    threshold: 100,   rewardEmber: 1000, rewardXP: 500,  sortOrder: 33 },
  { key: "trader-1000-earned",    name: "First Thousand",      description: "€1.000 verdiend aan verkopen",        category: "TRADER",    threshold: 1000,  rewardEmber: 500,  rewardXP: null, sortOrder: 34 },

  { key: "social-first-review",   name: "First Word",          description: "Je eerste review gegeven",            category: "SOCIAL",    threshold: 1,     rewardEmber: 15,   rewardXP: null, sortOrder: 40 },
  { key: "social-ten-reviews",    name: "Voice of the Guild",  description: "10 reviews gegeven",                  category: "SOCIAL",    threshold: 10,    rewardEmber: 100,  rewardXP: null, sortOrder: 41 },
  { key: "social-five-stars",     name: "Five-Star Seller",    description: "10× een 5-sterren review ontvangen",  category: "SOCIAL",    threshold: 10,    rewardEmber: 200,  rewardXP: 100,  sortOrder: 42 },

  { key: "milestone-streak-7",    name: "Week Warrior",        description: "7 dagen op rij ingelogd",             category: "MILESTONE", threshold: 7,     rewardEmber: 50,   rewardXP: null, sortOrder: 50 },
  { key: "milestone-streak-14",   name: "Fortnight Fighter",   description: "14 dagen op rij ingelogd",            category: "MILESTONE", threshold: 14,    rewardEmber: 150,  rewardXP: null, sortOrder: 51 },
  { key: "milestone-streak-28",   name: "Monthly Devotee",     description: "28 dagen op rij ingelogd",            category: "MILESTONE", threshold: 28,    rewardEmber: 500,  rewardXP: 250,  sortOrder: 52 },

  { key: "founder-member",        name: "Founder",             description: "Account aangemaakt voor de officiële launch", category: "FOUNDER", threshold: 1, rewardEmber: 500, rewardXP: 500, sortOrder: 60 },
];

async function main() {
  console.log("🏆 Seeding achievement catalog...");

  for (const def of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: def.key },
      create: def,
      update: def,
    });
  }

  console.log(`✅ ${ACHIEVEMENTS.length} achievements upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
