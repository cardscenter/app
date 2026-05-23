import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Lokaal (geen DATABASE_URL gezet) → SQLite-bestand. In productie (Railway)
  // wijst DATABASE_URL naar de Turso libSQL-database; TURSO_AUTH_TOKEN hoort
  // daarbij. Voor een lokaal file:-pad is geen token nodig.
  const url = process.env.DATABASE_URL ?? "file:dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const adapter = new PrismaLibSql(
    authToken ? { url, authToken } : { url }
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
