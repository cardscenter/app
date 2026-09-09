-- Label-systeem verwijderd (Fase 45, 2026-09-09): AuctionLabel / ListingLabel /
-- ClaimsaleLabel zijn uit het schema gehaald. Geen refunds voor bestaande
-- betaalde labels (beta, verwaarloosbaar). Indexen verdwijnen met de tabel;
-- niets verwijst via FK naar deze tabellen, dus DROP is veilig.
--
-- Optioneel vooraf: SELECT COUNT(*) FROM "AuctionLabel"; (idem Listing/Claimsale)
-- Toepassen: npx tsx scripts/push-to-turso.ts "libsql://<db>.turso.io" prisma/turso-remove-labels.sql

DROP TABLE IF EXISTS "AuctionLabel";
DROP TABLE IF EXISTS "ListingLabel";
DROP TABLE IF EXISTS "ClaimsaleLabel";
