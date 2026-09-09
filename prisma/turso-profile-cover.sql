-- Profiel-redesign (sept 2026): omslagfoto + website + socials op User.
-- Additief — toepassen via: npx tsx scripts/push-to-turso.ts "<url>" prisma/turso-profile-cover.sql
ALTER TABLE "User" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "socialLinks" TEXT;
