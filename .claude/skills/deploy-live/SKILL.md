---
name: deploy-live
description: Livegang-checklist voor Cards Center (push naar main = automatische Railway-deploy). Gebruik dit ALTIJD als de gebruiker vraagt om te pushen naar main, live te zetten, te deployen, te mergen naar main, of als er schemawijzigingen naar Turso (live database) moeten.
---

# Live zetten (main → Railway)

Een push naar `main` deployt automatisch naar https://cardscenter.up.railway.app. Alleen met expliciete toestemming van Youri. Werk in deze volgorde en stop bij elke fout.

1. **Stand opnemen**
   - `git fetch origin && git log --oneline origin/main..HEAD`: wat gaat er mee?
   - `git merge-base --is-ancestor origin/main HEAD`: fast-forward mogelijk? Zo niet, eerst uitzoeken (nooit force-pushen).
2. **Database (Turso) vóór de code**
   - Verwacht schema maken: `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > <scratchpad>/expected.sql`
   - Vergelijken (read-only): `npx tsx scripts/compare-schema.ts <scratchpad>/expected.sql "libsql://cardscenter-cardscenter.aws-eu-west-1.turso.io"`
   - Ontbreekt er iets: een **additief** SQL-bestand in `prisma/turso-<onderwerp>.sql` (CREATE TABLE / ALTER TABLE ADD COLUMN / CREATE INDEX; nooit een tabel-rebuild van `User`), eerst greppen op `DROP|new_|RENAME`, dan toepassen met `npx tsx scripts/push-to-turso.ts "<url>" prisma/<bestand>.sql` en opnieuw vergelijken tot "Schema compleet."
   - Additieve migraties kunnen vóór de push: de oude live-code negeert nieuwe kolommen/tabellen.
3. **Code-checks** (dev-server eerst stoppen, anders DB-lock)
   - `npx tsc --noEmit`, `npx eslint src` (0 errors), `npm test`, `npm run test:int`
   - `rm -rf .next && npm run build` moet slagen.
4. **Env-vars op Railway** (Claude heeft geen Railway-toegang: Youri zet ze zelf in service → Variables). Check of nieuwe code een env-var nodig heeft (grep `process.env.` in de diff) en geef Youri de exacte naam + waarde. Bekend: `IBAN_ENCRYPTION_KEY` (verplicht voor IBAN/inkoop), `MOLLIE_API_KEY` (leeg = online betalen uit, tenzij `PAYMENT_SIMULATION=true`), `FEATURE_*` (leeg = uit), `CRON_SECRET`.
5. **Pushen**: `git push origin <branch>` en `git push origin HEAD:main` (fast-forward). Nooit `--force`.
6. **Na de deploy** (Railway bouwt ~3-5 min):
   - Health: `curl -s -o /dev/null -w "%{http_code}" https://cardscenter.up.railway.app/nl` en `/api/cards/search?q=pikachu` (beta-gate: homepage kan 200 geven met een wachtwoordscherm).
   - Eenmalige data-scripts (bv. `scripts/encrypt-ibans.ts "<url>" --apply` met `IBAN_ENCRYPTION_KEY=<zelfde sleutel als Railway>` als env) pas ná de deploy.
   - Bulk-jobs op live Turso: klein, gepaced, foreground (zie memory feedback_live_db_bulk_jobs).
7. **Vastleggen**: CLAUDE.md (welke migraties op live staan) en de statusnotitie in memory (`project_current_state.md`) bijwerken.
