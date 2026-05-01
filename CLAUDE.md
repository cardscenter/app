@AGENTS.md

# Cards Center

Pokémon trading card marketplace — auctions, claimsales, listings, wallet, messaging, reviews, watchlist, notifications, disputes.

## CRITICAL RULES
- **NOOIT destructieve git commando's** (`git stash`, `git reset --hard`, `git checkout .`, `git clean`) gebruiken zonder EERST te committen. Op 2026-03-31 zijn alle unstaged wijzigingen verloren gegaan door een mislukte `git stash`.
- **Altijd committen** na elke grote wijziging zodat werk niet verloren gaat.
- **Nooit `npm run build` draaien vanuit achtergrond agents** terwijl de dev server draait — dit veroorzaakt database locks en frozen pages.
- **`"use server"` bestanden mogen alleen async exports hebben.** Constants (zoals `IBAN_COOLDOWN_DAYS`, `WITHDRAWAL_MIN_AMOUNT`) moeten in een apart `src/lib/*-config.ts` bestand. Anders breekt Next.js client-side imports met "module has no exports at all".
- **Schema-wijzigingen via `prisma db push`, NIET `prisma migrate dev`.** Het project heeft drift tussen migration-history (in `prisma/migrations/`) en de huidige schema. `migrate dev` wil de DB resetten — gebruik `db push --accept-data-loss` om data te behouden.
- **Voor `prisma db push`: kill eerst de dev server.** Anders DB-lock.
- **Admin-werk hoort thuis in het admin panel** (Fase 15). Elke nieuwe admin-feature, admin-page, admin-action of admin-only flow moet via `/dashboard/admin/*` gaan en de admin-conventies volgen — zie sectie **Admin panel (Fase 15)** verderop. Concreet: nooit een nieuwe `*/admin/page.tsx` ergens anders aanmaken, nooit een admin-action zonder `requireAdmin()` + `logAdminAction()` schrijven, nooit een nieuwe cron toevoegen zonder `CRON_JOBS` registry + `withCronLogging`.

## Tech Stack
- **Framework:** Next.js 16 (App Router) — **Read `node_modules/next/dist/docs/` before writing code**
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (default config, no custom theme file)
- **Database:** SQLite via Prisma ORM (`prisma/schema.prisma`)
- **Auth:** Auth.js v5 (NextAuth) with credentials provider
- **Validation:** Zod v4
- **i18n:** next-intl (Dutch default + English) — `src/messages/nl.json` + `en.json`
- **Charts:** recharts v3.8.0

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build (use to verify after changes)
- `npx prisma db push --accept-data-loss` — **gebruik dit voor schema-wijzigingen** (`migrate dev` werkt niet door drift)
- `npx prisma db seed` — Seed the database
- `npx prisma generate` — Regenerate Prisma client (na elke `db push`)

### Schema-wijziging workflow
1. Edit `prisma/schema.prisma`
2. Kill dev server: `taskkill //PID <pid> //F` (vind PID via `netstat -ano | grep :3000`)
3. `npx prisma db push --accept-data-loss && npx prisma generate`
4. `rm -rf .next && npm run dev` (verse cache)
5. `curl http://localhost:3000/<gewijzigde-page>` om te compileren

## Conventions
- Code (variables, functions, components) in **English**
- UI text via **next-intl** — never hardcode Dutch/English strings in components
- Filenames: **kebab-case** (e.g., `bid-section.tsx`)
- Import alias: `@/` → `src/`
- Server Actions in `src/actions/`, Zod schemas in `src/lib/validations/`
- Pages are Server Components; add `"use client"` only when needed (charts, forms with state)
- **Locale-aware navigation**: `Link`, `useRouter`, `usePathname`, `getPathname` ALTIJD uit `@/i18n/navigation` — niet uit `next/link` of `next/navigation`. **redirect**: voor stub-paden die naar een ander pad in dezelfde locale verwijzen (zoals de `/dashboard/geschillen/admin` → `/dashboard/admin/disputes` redirects) werkt `redirect({ href, locale })` uit `@/i18n/navigation`. Maar voor redirects vanuit een live stateful page (bv. admin → admin-overview) gaf de i18n-redirect "This page couldn't load" + hook-mismatches in Next 16 + next-intl 4 setup — gebruik daar `redirect` uit `next/navigation` met een **handmatig locale-prefixed pad**: `redirect(\`/${locale}/dashboard/admin\`)`. Locale komt uit `params` (`const { locale } = await params;`). `notFound()` mag uit `next/navigation` (geen locale relevant). Bij twijfel: vermijd server-side redirects en gebruik een client-side Link.
- **Surface-hiërarchie (Fase 26)**: light-mode gebruikt **3 surface-niveaus**: `bg-background` (#f5f6f8, page-frame) < `bg-muted` (#eef0f3, pills/secondary surfaces) < `bg-card` (#ffffff, primary content). Cards op page-bg krijgen `border border-border` + optioneel `shadow-card` (subtiele elevation). **Nooit hardcoded `bg-white` / `bg-slate-200` / `bg-gray-100`** — gebruik altijd semantic tokens (`bg-card`, `bg-muted`, `bg-secondary`, `border-border`, `divide-border`, `hover:bg-muted`). Dark-mode tokens blijven onveranderd. Glass-utilities (`.glass`, `.glass-subtle`, `.glass-nav`, `.glass-input`) zijn in light-mode geherdefinieerd als solide `bg-card` + border + shadow; in dark-mode behouden ze het echte glass-effect (rgba + backdrop-blur). Custom-shadow-tokens: `shadow-card` voor rust-state, `shadow-card-hover` voor lift-on-hover.
- **Layout-tiers (Fase 25)**: gebruik `<PageContainer width="narrow|default|wide">` uit `@/components/layout/page-container` als top-level wrap voor elke page. Géén losse `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`-strings meer in nieuwe pages — die zijn vervangen door één bron van waarheid. Tiers:
  - `narrow` = `max-w-3xl` (768px) — voorwaarden, instructies, single-column tekst-pages
  - `default` = `max-w-[1440px]` — detail-pages (auction/listing/claimsale/seller-profile), forms (`*/nieuw/`), customization, calculator-pages, winkelwagen
  - `wide` = `max-w-[1680px]` — grid-overzichten (marktplaats/veilingen/claimsales/zoeken/kaarten/pokedex/admin-tables), header, footer, dashboard-layout, homepage-secties
  - PageContainer bevat alleen horizontale padding (`px-4 sm:px-6 lg:px-8 xl:px-10`). Vertical padding (`py-8`/`py-10`) komt via `className`-prop omdat dat per page verschilt.
  - Header + footer zijn ALTIJD `wide` (vaste frame), zodat alleen de inner content-area per page-type schuift — geen volledige layout-sprong.
  - Grid-pages gebruiken `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 [@media(min-width:1600px)]:grid-cols-6`. Sponsored-rows tonen tot 6 items met progressive disclosure per breakpoint.
  - Homepage-secties (`src/components/home/*.tsx`) gebruiken inline `mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10` (geen PageContainer omdat ze in `<section>`-tags met eigen background zitten).

## Key Architecture
- **Pokémon only** — no multi-TCG, Category always Pokémon
- **Internal wallet** — balance per user, tier-based seller commission (FREE 3%, PRO 1.5%, Unlimited 0%)
- **Escrow system** — `heldBalance` on User; `escrowCredit`/`releaseEscrow`/`refundEscrow` in `wallet.ts`
- **Shipping bundling** — ShippingBundle groups items per seller; links to claimsale, auction, or listing
- **Seller shipping methods** — SellerShippingMethod per seller, join tables with price snapshots
- **Address management** — buyer address snapshotted on ShippingBundle at checkout
- **Auction bidding** — 40% of bid amount reserved on `reservedBalance`; full amount deducted at auction end. If winner has <100% but >=40%: 5-day payment deadline (`paymentStatus: AWAITING_PAYMENT`). `completeAuctionPayment()` lets winner pay after topping up.
- **Auction runner-up rotation** — als de winnaar niet betaalt, schuift de cron `api/cron/auction-payment-deadline` automatisch door naar de volgende hoogste bieder die nog niet gepasseerd is. Velden: `Auction.runnerUpEnabled` (default true, opt-out per veiling), `Auction.failedBidderIds` (JSON array van gepasseerde bidders), `Auction.runnerUpAttempts` (teller). Per-user cap via `User.maxRunnerUpAttempts` (1-10, default 5, slider in profiel). Bij elke rotatie: vorige PENDING bundle verwijderd, nieuwe `createPendingBundle()` voor runner-up, `syncReservedBalance()` voor de oude winner. Cron is single source of truth — `completeAuctionPayment` muteert geen status meer bij verlopen deadline.
- **Proposal payment-deadline** — chat-proposals met partial balance (>=40% maar <100%) krijgen ook 5 dagen via `Proposal.paymentDeadline`. Cron `api/cron/proposal-payment-deadline` zet PAYMENT_FAILED, listing terug op ACTIVE, PENDING bundle weg, beide partijen genotificeerd. Geen runner-up (proposals hebben geen bod-volgorde).
- **Pending shipping-bundles** — bij AWAITING_PAYMENT (auction én listing-proposal) wordt direct een PENDING `ShippingBundle` aangemaakt via `src/lib/shipping-bundle.ts createPendingBundle()`. `completeAuctionPayment` / `completeProposalPayment` promoveren PENDING → PAID i.p.v. een tweede bundle aan te maken (auctionId/listingId zijn @unique). Address mag null zijn bij PENDING — wordt bij PAID-promotie ingevuld. Sales/purchases dashboards filteren PENDING uit hun lijsten; auction-pending heeft een eigen `pendingAuctions`-sectie op `/dashboard/verkopen`, listing-pending wordt afgehandeld via chat.
- **Reserved balance** — `reservedBalance` on User tracks 40% of active bids. `availableBalance = balance - reservedBalance`. All purchase actions check available balance. Per auction: reserves 40% of max(highestBid, autobidMaxAmount). Released when outbid (no autobid) or auction ends.
- **Account age restrictions** — config in `src/lib/account-age.ts`. 0-24h: max €50, 1-7d: max €200, 7+d unverified: max €500, verified: unlimited. Accounts before 2026-03-31 skip restrictions.
- **Account verification** — ID/passport/driver's license upload → admin review → `isVerified` + `verificationStatus` on User. `VerificationRequest` model. Actions in `verification.ts`. Pages: `dashboard/verificatie/` (user), `dashboard/geschillen/admin/verificaties/` (admin). Verified badge: `components/ui/verified-badge.tsx`.
- **Balance top-up** — Bank transfer with unique `bankTransferReference` per user (format: `[username][10digits]`, generated at registration, regenerated on username change). Admin confirms via `confirmBankTransfer()`. iDEAL: placeholder UI only.
- **IBAN / bankgegevens** — `User.iban` + `User.accountHolderName` voor uitbetalingen. Validatie via `src/lib/validations/iban.ts`: 37 EU/EER/CH/UK landen met exacte lengte per land + ISO 13616 mod-97 checksum. 30-dagen anti-fraude cooldown bij IBAN-wijziging via `User.lastIbanChange` (eerste keer is gratis). UI op `/dashboard/profiel` (BankDetailsForm). Helpers: `normalizeIban`, `isValidIbanFormat`, `formatIbanForDisplay`, `maskIban`.
- **Uitbetaalsysteem** — `WithdrawalRequest` model, status `PENDING → APPROVED → PAID` of `REJECTED`. User-flow: `requestWithdrawal()` deduct `User.balance` direct, IBAN+naam wordt gesnapshot. Eén actieve aanvraag tegelijk per user. Admin keurt goed (`approveWithdrawal`), doet handmatige overboeking en markeert PAID (`markWithdrawalPaid`). `rejectWithdrawal` met verplichte reden refundt balance terug. Min €10, geen fee, max = available balance. UI: `/dashboard/uitbetalingen` (user) + `/dashboard/uitbetalingen/admin`. Config-constante `WITHDRAWAL_MIN_AMOUNT` in `src/lib/withdrawal-config.ts` (apart bestand zodat client-componenten het kunnen importeren — actions.ts mag geen non-async exports).
- **Account-suspension** — `User.suspendedUntil` + `User.suspensionType` (TEMPORARY/PERMANENT) + `User.suspensionReason`. Helper `src/lib/suspension.ts isUserSuspended()` + `requireNotSuspended(userId)` async guard. Toegepast op alle write-paden: `createAuction`, `placeBid`, `buyNow`, `setAutoBid`, `createListing`, `buyListing`, `createClaimsale`, `claimItem`, `checkout`, `createProposal`, `respondToProposal`, `sendMessage`. Toegestaan tijdens suspension: payout-aanvragen, dispute-reacties, `markAsShipped` (lopende verzendingen). Banner in dashboard layout. Admin suspend/lift via `suspendUser`/`liftSuspension` (knoppen op `/dashboard/rapporten/admin`).
- **Blokkeren + rapporteren** — `UserBlock { blockerId, blockedId, reason? }` symmetrisch (A blokkeert B → niemand ziet elkaar's content). `UserReport` met reasons SCAM/SPAM/HARASSMENT/INAPPROPRIATE/FAKE_LISTING/OTHER, status `OPEN → REVIEWING → DISMISSED of ACTION_TAKEN`. Helper `getBlockedUserIds(userId)` retourneert beide-richtingen Set. Filtering: `marktplaats/page.tsx`, `veilingen/page.tsx`, `claimsales/page.tsx`, `berichten/page.tsx` (NOT participants in blocked set), `sendMessage` (bidirectional check). Search/homepage/recommendations zijn NIET gefilterd (follow-up). UI: `BlockReportButtons` component op `/verkoper/[userId]`. User-side `/dashboard/blokkeerlijst`. Admin `/dashboard/rapporten/admin` gegroepeerd per gerapporteerde user met inline suspend-knop.
- **Annuleringsverzoek** — `CancellationRequest` op PAID `ShippingBundle` (werkt voor alle 3 sale-types). Reasons: BUYER_CHANGED_MIND/SELLER_OUT_OF_STOCK/DAMAGED/UNRESPONSIVE/OTHER. 7-dagen-deadline, één actief verzoek per bundle. ACCEPT door wederpartij refundt escrow + bundle CANCELLED + claimsale items terug naar AVAILABLE + listing terug op ACTIVE. Cron `api/cron/cancellation-expiry` markeert verlopen als EXPIRED (verkoper blijft leveringsplichtig). UI: `CancellationsSection` bovenaan `/dashboard/aankopen` en `/dashboard/verkopen` (gehouden buiten bestaande Purchases/SalesContent voor regressie-veiligheid). Niet bedoeld voor SHIPPED bundles — daar treedt het bestaande dispute-systeem in.
- **Claimsales immutable** once LIVE (DRAFT → LIVE, no edits). `cardSetId` optional on ClaimsaleItem. Form uses front/back image uploads per card (stored as JSON array in `imageUrls`). `coverImage` on Claimsale for thumbnail. `reference` field stores card number.
- **Mobile card layout** — All 3 main pages (veilingen, marktplaats, claimsales) use horizontal cards on mobile (image left, info right) with fixed `Image` width/height (not `fill`+`aspect-ratio` — that breaks in flex containers on mobile). Desktop uses vertical cards with `fill`+`aspect-square`.
- **Page color theming** — Create buttons on main pages: Veilingen=blue (`bg-primary`), Marktplaats=green (`bg-emerald-600`), Claimsales=dark-yellow (`bg-amber-600`). Only on overview pages.
- **`upload.ts` is server-only** — contains `fs/promises`. Client components must NOT import from it. Use inline `parseImageUrls` instead.
- **Anti-snipe** — bids in last 2 min → +2 min extension
- **Bid increments** — per price tier (`src/lib/auction/bid-increments.ts`)
- **Account tiers** — FREE / PRO / UNLIMITED (config in `src/lib/subscription-tiers.ts`). ADMIN is a role, not a tier — maps to UNLIMITED perks. Limits: auctions, claimsales, listings, items/claimsale. Commission deducted at escrow release. Subscription model tracks billing history.
- **Seller levels** — 14-tier brand-neutral collector progression (`src/lib/seller-levels.ts`). XP earned via: 1 XP/day account age, 1 XP/€ sold, 1 XP/€ bought, 20 XP per 5-star review received, 5 XP per review given, 10 XP per completed transaction. Tiers: Beginner(0)→Rookie(100)→Scout(300)→Collector(750)→Hunter(1.5k)→Trader(3k)→Veteran(5k)→Curator(8k)→Elite(12k)→Appraiser(17k)→Master(23k)→Grandmaster(32k)→Legend(50k)→Champion(100k XP). `nameKey` field stays stable across renames so existing `User.profileBanner` references keep working. Banner image assets removed; level banners now render as branded gradients with the level icon. Data fetching sums revenue amounts, not counts.
- **Customization & Ember** — Earn-only currency (`User.emberBalance`); paid Ember purchases removed (gambling-risk pivot). Earn paths: completed purchase/sale (15), review given (10), review received (5), bid (3), listing (5), daily login (10–500 via `LOGIN_STREAK_REWARDS`). Daily caps per tier in `MAX_DAILY_EMBER_BY_TIER`. `EmberTransaction` logs every flow. Cosmetic items (`CosmeticItem`) live in named **Chapters** (`CosmeticBundle`); rarity display labels are TCG slang (Pull/Hit/Chase/Grail/One-of-One/Rainbow) but DB keys stay UNCOMMON–SHINY. Equipped via `User.profileBanner/profileEmblem/profileBackground` keys.
- **Achievements (tiered, CoD-style)** — `Achievement` (parent) + `AchievementTier` (1..N tiers per achievement). Engine in `src/lib/achievements.ts` defines 9 achievements (days-online, purchases-completed, total-spent, sales-completed, total-earned, reviews-given, five-stars-received, login-streak, founder-member) with up to 5 tiers each. `checkAchievements(userId)` recomputes raw progress and grants rewards (Ember + XP + optional cosmetic) for **every** newly-crossed tier in one transaction — handles back-fills cleanly. Triggered on purchase complete, sale complete (auto-confirm too), review submit, login-streak claim. Per-user state in `UserAchievement` (currentTier, acknowledgedTier, progress). Unshown unlocks (currentTier > acknowledgedTier) surface as Trophy-styled `sonner` toasts via `<AchievementUnlockListener>` in the locale layout — fires on mount + after each navigation. Catalog seeded via `prisma/seed-achievements.ts`.
- **Mascots** — Finn (red fox) and Sage (raccoon) live in `public/images/mascotte/`. `main/` holds canonical references (NOT used in UI directly). `Footer/footer.png` is the only production-active asset right now (rendered bottom-right of the desktop footer with a brand caption). Future poses + cosmetic-art will be added as transparent assets later.
- **Disputes** — buyer opens on SHIPPED bundle (10–30 days after shipment); seller responds; buyer accepts/rejects; mutual proposals; escalation (both parties agree) → admin resolves. Event-sourced timeline via `DisputeEvent` model. Auto-resolve cron for unresponded disputes. Actions in `dispute.ts`, UI in `dispute-detail-content.tsx`, page in `dashboard/geschillen/[disputeId]/page.tsx`
- **Chat proposals** — Buyer/seller can make buy/sell price proposals in chat linked to a listing. Proposal model with PENDING/ACCEPTED/REJECTED/WITHDRAWN status. 40% minimum balance rule applies. Accepted proposals: mark listing SOLD, create ShippingBundle, escrow flow. `withdrawProposal()` zet status WITHDRAWN (proposer trekt zelf in — onderscheidt van REJECTED waar wederpartij afwijst). UI toont andere tekst per status.
- **Listing.DELETED cascade** — `updateListingStatus(id, "DELETED")` rejecteert alle PENDING proposals automatisch met systeembericht in chat + notificatie naar de proposer.
- **Claimsale CLOSED** — auto-close via `closeClaimsaleIfDepleted()` zodra alle items SOLD/DELETED zijn (aangeroepen vanuit `deleteClaimsaleItem` en `cart.checkout` per affected claimsale). Manuele close via `closeClaimsale()` action ("Sluit claimsale"-knop in `claimsale-actions.tsx`) — race-safe transactie met re-check van CLAIMED items + CAS op `claimsale.status="LIVE"→"CLOSED"`. CLAIMED items (= items in iemands cart) blokkeren close. Belt-and-braces: cartItems opruimen na close. CLOSED claimsales worden uit publieke views gefilterd (alle bestaande queries gebruikten al `status: "LIVE"`).
- **Buy Now price** — Optional on auctions. Removed when bids reach 75% of buy now price (not after first bid). Check in both `placeBid()` and `resolveAutoBids()`.
- **Auction upsells** — `AuctionUpsell` model (same structure as `ListingUpsell`). Higher pricing than listings: Homepage Spotlight €0.75/day, Category Highlight €0.40/day, Urgent Label €0.25/day. Config in `upsell-config.ts` (`AUCTION_UPSELL_PRICING`).
- **Auction types** — `SINGLE_CARD | MULTI_CARD | COLLECTION | SEALED_PRODUCT | OTHER` (same as listing types). Type-specific fields: `cardItems`, `estimatedCardCount`, `conditionRange`, `productType`, `itemCategory`.
- **Auction durations** — 3, 5, 7, or 14 days (no 1-day).
- **Sponsored listings & auctions** — Items with active `CATEGORY_HIGHLIGHT` upsell appear in "Gesponsord" row on marketplace/veilingen page with tooltip explanation.
- **Marketplace/Auction pagination** — 40 items per page, sponsored excluded from main grid, 4-column layout.
- **Real-time bid updates** — Polling via `/api/auctions/[auctionId]/bids` endpoint. 5-second interval normally, 2-second in last 30 minutes. Client component: `live-auction-content.tsx`. Shows "Je bent de hoogste bieder" banner + hides bid form when user is highest bidder.
- **SQLite date handling** — no DATE_TRUNC; fetch raw + group in JS
- **Admin panel (Fase 15)** — gecentraliseerde backoffice op `/dashboard/admin/*`. Eigen sub-nav (`src/components/admin/admin-nav.tsx`) met 4 secties: Overview · Queues (disputes/verifications/withdrawals/buybacks/reports/bank-transfers) · Users & Content (users/moderation/catalog) · System (config/crons/audit). Toegang via header shield-icon (`AdminShield`, alleen zichtbaar bij `session.user.accountType === "ADMIN"`) + 1 sidebar-link in `dashboard-nav.tsx`. Layout-guard: `dashboard/admin/layout.tsx` roept `requireAdminPage()` aan. **Elke admin-write-action moet door 2 hekken: `requireAdmin()` van `@/lib/admin` (of `requireAdminPage()` voor pages) ÉN `logAdminAction()` van `@/lib/admin-audit` na succes.** Audit log is forward-only — `AdminAuditLog`-model, geen retro-backfill. Alle bestaande admin-actions in `admin-suspension.ts`, `withdrawal.ts`, `dispute.ts` (`adminResolveDispute`), `verification.ts` (`adminReviewVerification`), `buyback.ts` (`updateBuybackStatus`), `wallet.ts` (`confirmBankTransfer`), `block-report.ts` (`reviewReport`) zijn geïnstrumenteerd. JWT-callback in `auth.ts` exposeert `accountType` op `session.user` zodat client-componenten admin-status kunnen detecteren. Oude admin-paden (`/dashboard/geschillen/admin`, `/dashboard/uitbetalingen/admin`, `/dashboard/inkoop/admin[/id]`, `/dashboard/rapporten/admin`) zijn redirect-stubs naar het nieuwe `/dashboard/admin/*`-pad — nieuwe admin-flows nooit ergens anders dan onder `/dashboard/admin/*` plaatsen.
- **Cron-logging & manual run (Fase 15)** — alle cron-routes onder `src/app/api/cron/` zijn gewrapt met `withCronLogging(jobName, fn)` uit `@/lib/cron-logging`, wat per executie een `CronRun`-record produceert (status RUNNING → SUCCESS/FAILED, items processed, errorMessage, triggeredBy). Auth via `resolveCronTrigger(request)` uit `@/lib/cron-auth` — accepteert `Bearer CRON_SECRET` (scheduler) of een ingelogde admin-sessie (manual). Centrale registry in `src/lib/cron-jobs.ts`: `CRON_JOBS` (job-runners) + `CRON_JOB_META` (description, schedule, `allowManualRun`, optionele `runWarning`). De admin-page `/dashboard/admin/crons` toont status + "Run nu"-knop alleen voor jobs met `allowManualRun: true`. **Niet manueel runbaar:** `cleanup-archived-chats` (destructief, hard-delete). **Met waarschuwing:** `sync-pokewallet` (heavy: ~600 PokeWallet API-calls). `runCronManually` (in `src/actions/admin/crons.ts`) weigert een job als de meta `allowManualRun: false` heeft — backend-guard, niet alleen UI.

---

## Codebase Map

### Server Actions (`src/actions/`)
| File | Purpose |
|------|---------|
| `auth.ts` | Register, login |
| `profile.ts` | Update profile (avatar, bio, display name), username change (€3.99, cooldown) |
| `wallet.ts` | Balance, deposit, withdrawal, escrow (credit/release/refund), `getBalanceSummary`, `confirmBankTransfer` (admin) |
| `auction.ts` | Create auction, place bid (40% reserve), end auction, buyNow, `completeAuctionPayment`, `finalizeAuction` (with payment deadline) |
| `verification.ts` | Submit/review/revoke ID verification, admin approve/reject |
| `claimsale.ts` | Create/manage claimsales with items |
| `listing.ts` | CRUD listings + `buyListing` (escrow) |
| `cart.ts` | Cart checkout with shipping + address snapshot |
| `purchase.ts` | Purchase queries (bundles, status) |
| `dispute.ts` | Open/respond/escalate/resolve disputes |
| `proposal.ts` | Create/respond/withdraw/complete proposals via chat |
| `message.ts` | Conversations, send messages (with photo), archive/delete/restore |
| `watchlist.ts` | Add/remove watchlist items |
| `notification.ts` | Create notifications, mark read, unread count |
| `review.ts` | Submit seller reviews, `getSellerStats` (revenue-based XP + username history) |
| `search.ts` | Global search across auctions/listings/claimsales |
| `address.ts` | Update user address |
| `shipping-method.ts` | CRUD seller shipping methods |
| `subscription.ts` | Upgrade/cancel/downgrade tier, subscription info |
| `customization.ts` | Ember balance, login-streak claim, owned items, equip/unequip cosmetic slots, list active chapters/bundles |
| `achievements.ts` | `getPendingUnlocks` + `acknowledgeAllUnlocks` for the celebration listener |
| `withdrawal.ts` | `requestWithdrawal`, admin `approveWithdrawal`/`rejectWithdrawal`/`markWithdrawalPaid`, `getMyWithdrawals`, `getActiveWithdrawal`, `getAllWithdrawals` |
| `block-report.ts` | `blockUser`/`unblockUser`/`isUserBlocked`, `reportUser`, admin `getReports`/`reviewReport` |
| `admin-suspension.ts` | Admin `suspendUser` (TEMPORARY 1-365 dagen of PERMANENT) + `liftSuspension` + `getSuspendedUsers` |
| `cancellation.ts` | `requestCancellation`, `respondToCancellation` (ACCEPT refund + bundle CANCELLED, REJECT met reden), `getActiveCancellationRequest`. Reasons-enum geëxporteerd voor UI |
| `admin/users.ts` | `resetIbanCooldown`, `forceUsernameReset` (Fase 15) — **alle nieuwe admin user-management actions hier toevoegen** |
| `admin/catalog.ts` | `createSeries`/`updateSeries`/`createCardSet`/`updateCardSet`/`updateCardMeta` (Fase 15) |
| `admin/app-config.ts` | `upsertAppConfig`/`deleteAppConfig` (Fase 15) — JSON-validatie server-side |
| `admin/crons.ts` | `runCronManually(jobName)`, `getCronStatus()` (Fase 15) — guard via `CRON_JOB_META.allowManualRun` |
| `admin/moderation.ts` | `bulkRemoveListings`/`bulkRemoveAuctions`/`bulkRemoveClaimsales` met reden + notificaties (Fase 15). Auctions → CANCELLED, Claimsales → CLOSED, Listings → DELETED (geen DELETED-status in Auction/Claimsale schema) |

### Pages (`src/app/[locale]/`)
| Route | Page |
|-------|------|
| `/` | Homepage |
| `/veilingen/*` | Auction list, create, detail + bidding |
| `/claimsales/*` | Claimsale list, create, detail + claim |
| `/marktplaats/*` | Listing list (sponsored row + pagination), create, detail |
| `/winkelwagen` | Shopping cart + checkout |
| `/zoeken` | Search results |
| `/berichten/*` | Messages/conversations (photo upload, proposals) |
| `/verkoper/[userId]` | Public seller profile |
| **Dashboard** `/dashboard/` | |
| `…/` | Home: 4 essentials-widgets voor IEDEREEN (action-items, saldo, lopende activiteit, recente bundles); CTA naar `/dashboard/statistieken` alleen voor PRO/UNLIMITED |
| `…/statistieken` | Premium statistieken (PRO/UNLIMITED): sales/seller-performance/buyer/XP/commission-savings, periode-filter incl. month/ytd quick-ranges, CSV-export per sectie |
| `…/profiel` | Edit profile |
| `…/saldo` | Wallet/balance |
| `…/veilingen` | My auctions |
| `…/claimsales` | My claimsales |
| `…/marktplaats` | My listings |
| `…/aankopen` | My purchases |
| `…/verkopen` | My sales |
| `…/biedingen` | My bids |
| `…/volglijst` | My watchlist |
| `…/meldingen` | Notifications |
| `…/reviews` | My reviews |
| `…/verzending` | Shipping address + methods |
| `…/geschillen` | Disputes overview + detail |
| `…/verificatie` | Account verification upload/status |
| `…/abonnement` | Subscription tier management |
| `…/uitbetalingen` | Saldo + IBAN + uitbetalingsformulier + history |
| `…/uitbetalingen/admin` | Redirect-stub → `/dashboard/admin/withdrawals` (Fase 15) |
| `…/blokkeerlijst` | "Block-list" — geblokkeerde gebruikers met unblock-actie |
| `…/rapporten/admin` | Redirect-stub → `/dashboard/admin/reports` (Fase 15) |
| `…/geschillen/admin` | Redirect-stub → `/dashboard/admin/disputes` (Fase 15) |
| `…/geschillen/admin/verificaties` | Redirect-stub → `/dashboard/admin/verifications` (Fase 15) |
| `…/inkoop/admin` (+ `[id]`) | Redirect-stubs → `/dashboard/admin/buybacks(/[id])` (Fase 15) |
| **Admin Panel** `/dashboard/admin/` | **Admin-only**, eigen layout met `requireAdminPage()` + `AdminNav`-sidebar |
| `…/admin` | Overzicht: KPI-tegels per queue, financiële totalen, recent audit-feed, quick-actions |
| `…/admin/disputes` | Escalated disputes (verplaatst van `/dashboard/geschillen/admin`) |
| `…/admin/verifications` | PENDING ID-verificaties (verplaatst van `/dashboard/geschillen/admin/verificaties`) |
| `…/admin/withdrawals` | Withdrawals queue: pending/approved/paid/rejected |
| `…/admin/buybacks` (+ `[id]`) | Buyback-aanvragen overzicht + detail |
| `…/admin/reports` | User-reports gegroepeerd per gerapporteerde user, inline suspend-knop |
| `…/admin/bank-transfers` | Search + confirm-form voor `confirmBankTransfer`, recente confirmaties uit audit log |
| `…/admin/users` (+ `[userId]`) | User-search met filters + 360° detail-page met 11 tabs (profile/wallet/sales/purchases/disputes/withdrawals/reports/suspensions/reviews/ember/audit) |
| `…/admin/catalog` | Series/CardSets/Cards CRUD via sub-tabs |
| `…/admin/config` | AppConfig key/value editor met live JSON-validatie |
| `…/admin/crons` | Cron-status + description per job + "Run nu" (alleen voor jobs met `allowManualRun: true`) |
| `…/admin/moderation` | Listings/auctions/claimsales tabs met "alleen verkopers met open rapport"-filter + bulk-delete-met-reden |
| `…/admin/audit` | AdminAuditLog feed met filters (action, targetType, targetId-search) en paginatie |
| **Customization** `/customization/` | Hub: Ember balance, login streak, nav cards |
| `…/achievements` | Tiered achievements overview, progress per category |
| `…/packs` | Chapters overview (cosmetic collections) |
| `…/inventory` | Owned cosmetic items grid, filter/sort |
| `…/equip` | Equip banner / emblem / background slots |

### Components (`src/components/`)
| Folder | Key files |
|--------|-----------|
| `auction/` | `auction-card`, `multi-step-auction-form`, `steps/` (type, photos, details, pricing, upsells, review), `autobid-form`, `bid-section`, `quick-bid-buttons`, `countdown-timer`, `live-auction-content`, `sponsored-row` |
| `claimsale/` | `claimsale-form`, `claimsale-card`, `claimsale-actions`, `claimsale-items-filter`, `claim-button`, `add-to-cart-button` |
| `listing/` | `listing-form`, `multi-step-listing-form`, `steps/`, `listing-card`, `listing-actions`, `sponsored-row` |
| `cart/` | `cart-checkout`, `cart-content`, `cart-item-row` |
| `checkout/` | `shipping-method-picker` |
| `message/` | `chat-layout`, `conversation-list`, `message-thread`, `contact-seller-button`, `chat-actions`, `proposal-button`, `proposal-message` |
| `search/` | `search-bar`, `search-filters`, `search-result-card`, `search-sort-bar` |
| `dashboard/` | `dashboard-nav`, `dashboard-stats`, `dashboard-stats-locked`, `profile-form`, `address-form`, `purchases-content`, `sales-content`, `shipping-methods-manager`, `shipping-method-form`, `ship-bundle-form`, `buyer-shipping-info`, `disputes-overview`, `dispute-detail-content`, `open-dispute-form`, `admin-disputes-list`, `balance-summary`, `deposit-methods`, `pending-auction-payments`, `verification-form`, `admin-verification-list`, `banner-selector`, `bank-details-form` (Fase 5), `runner-up-settings` (Cluster A.followup), `withdrawal-form` / `withdrawal-history` / `admin-withdrawals-list` (Fase 6), `blocked-list-content` / `admin-reports-list` (Fase 7), `suspension-banner` (Fase 8), `cancellation-actions` / `cancellations-section` (Fase 9) |
| `customization/` | `ember-balance`, `ember-icon`, `login-streak`, `equip-selector`, `rarity-badge`, `cosmetic-banner-image`, `achievement-unlock-listener` |
| `home/` | `hero-email-form`, `pricing-section` |
| `layout/` | `header`, `footer`, `language-switcher`, `user-balance`, `page-container` (Fase 25 — narrow/default/wide tiers) |
| `ui/` | `button`, `card`, `cart-icon`, `chart`, `checkbox`, `input`, `select`, `slider`, `label`, `switch`, `image-gallery`, `image-uploader`, `rich-text-editor`, `item-carousel`, `breadcrumbs`, `social-share`, `notification-bell`, `notification-list`, `pagination`, `review-form`, `review-list`, `seller-level-badge`, `seller-reputation-card`, `seller-info-block`, `username-history-tooltip`, `shipping-method-selector`, `star-rating`, `watchlist-button`, `verified-badge`, `block-report-buttons` (Fase 7) |
| `admin/` | (Fase 15) `admin-nav` (sidebar met badges), `bank-transfer-form`, `user-action-bar` (suspend/lift/IBAN-reset modal), `catalog-edit-form` (generic CRUD), `app-config-editor` (JSON-validatie), `cron-run-now-button` (respects `allowManualRun`), `moderation-table` (bulk-select + delete-met-reden) |
| `layout/` (admin) | (Fase 15) `admin-shield` — header-icon, alleen zichtbaar voor `accountType === "ADMIN"` |
| `providers/` | `theme-provider` |

### Library (`src/lib/`)
| File | Purpose |
|------|---------|
| `auth.ts` | NextAuth config, JWT callbacks |
| `prisma.ts` | Prisma client singleton |
| `utils.ts` | `cn()` for Tailwind class merging |
| `upload.ts` | Image upload handling |
| `subscription-tiers.ts` | Central tier config (limits, commission, prices, features) + helpers |
| `account-limits.ts` | Tier-based limit checks (auctions, claimsales, listings) |
| `seller-levels.ts` | 20-tier seller level definitions, XP calculation (revenue-based), styling |
| `seller-info.ts` | `getSellerInfo()` — fetches seller data for info blocks on detail pages |
| `recommendations.ts` | Seller other items & similar items queries |
| `upsell-config.ts` | Tier-based upsell pricing for listings (`UPSELL_PRICING`) and auctions (`AUCTION_UPSELL_PRICING`, higher rates) |
| `auction/bid-increments.ts` | Min bid increment per price tier |
| `balance-check.ts` | Available balance, reserve calculation (40%), per-auction reserve tracking |
| `account-age.ts` | Account age tier restrictions (0-24h €50, 1-7d €200, 7+d €500, verified unlimited) |
| `auction/autobid.ts` | Autobid resolution (with 40% reserve on each bid step) |
| `shipping/countries.ts` | EU country list (code, name NL, name EN) |
| `shipping/carriers.ts` | Carrier suggestions per country |
| `validations/` | Zod schemas: `auth`, `auction`, `listing`, `address`, `shipping-method`, `cart`, `customization` |
| `cosmetic-config.ts` | Rarity table (display labels = TCG slang, schema keys stable), activity rewards, login-streak rewards |
| `achievements.ts` | Tiered achievement definitions, `checkAchievements`, `getUserAchievements`, `getPendingUnlocks`, `acknowledgeAllUnlocks`, `syncAchievementCatalog` |
| `shipping-bundle.ts` | `createPendingBundle()` voor AWAITING_PAYMENT pre-creation (auction én proposal-partial-balance) |
| `validations/iban.ts` | `IBAN_COOLDOWN_DAYS` constante, 37-land lengtetabel, mod-97 checksum (`isValidIbanFormat`), `normalizeIban`, `formatIbanForDisplay`, `maskIban` |
| `withdrawal-config.ts` | `WITHDRAWAL_MIN_AMOUNT` (apart bestand zodat client-componenten het kunnen importeren) |
| `blocking.ts` | `getBlockedUserIds(userId)` symmetrisch (beide richtingen), `sellerNotInBlockedFilter` helper voor Prisma where-clauses, `REPORT_REASONS` const-tuple |
| `suspension.ts` | `isUserSuspended(user)` (PERMANENT of `suspendedUntil` in toekomst), `requireNotSuspended(userId)` async guard voor write-actions |
| `admin.ts` | (Fase 15) `requireAdmin()` (action-variant: throws) en `requireAdminPage()` (page-variant: redirect). Returnt `{ adminId }`. **Vervangt inline `accountType !== "ADMIN"`-checks** |
| `admin-audit.ts` | (Fase 15) `logAdminAction({ adminId, action, targetType, targetId?, metadata? })` schrijft `AdminAuditLog`. `AdminAction`/`AdminTargetType` zijn const-unions — bij nieuwe actie eerst hier toevoegen |
| `cron-logging.ts` | (Fase 15) `withCronLogging(jobName, fn, triggeredBy?)` wrapper rond cron-werk. Maakt `CronRun` met RUNNING → SUCCESS/FAILED, vangt errors, schrijft itemsProcessed |
| `cron-jobs.ts` | (Fase 15) Centrale registry: `CRON_JOBS` (job-runners) + `CRON_JOB_META` (description/schedule/`allowManualRun`/runWarning) + `CRON_JOB_NAMES`. **Bij nieuwe cron toevoegen: registry + meta + route + withCronLogging — alle vier** |
| `cron-auth.ts` | (Fase 15) `resolveCronTrigger(request)` returnt `"cron"` (Bearer secret), `<adminId>` (admin sessie) of `null` (unauthorized). Gebruikt door alle cron-routes |

### Database (`prisma/schema.prisma`)
User, Category, Series, CardSet, Card, CardPriceHistory, CardWatchlist, Auction, AuctionBid, AuctionShippingMethod, AuctionUpsell, Claimsale, ClaimsaleItem, ClaimsaleShippingMethod, Listing, ListingShippingMethod, ListingUpsell, SellerShippingMethod, ShippingBundle, Transaction, Subscription, Conversation, ConversationParticipant, Message, Proposal, Watchlist, Notification, Review, AppConfig, AutoBid, CartItem, Dispute, DisputeEvent, UsernameHistory, VerificationRequest, CosmeticBundle, CosmeticItem, OwnedItem, EmberTransaction, ActivityLog, Achievement, AchievementTier, UserAchievement, BuybackRequest, BuybackItem, BulkBuybackItem, **WithdrawalRequest** (Fase 6), **UserBlock** + **UserReport** (Fase 7), **CancellationRequest** (Fase 9), **AdminAuditLog** + **CronRun** (Fase 15).

User-velden toegevoegd in roadmap-werk: `maxRunnerUpAttempts` (Cluster A), `iban`/`accountHolderName`/`lastIbanChange` (Fase 5), `suspendedUntil`/`suspensionType`/`suspensionReason`/`suspensionAdminId` (Fase 8). Auction-velden: `runnerUpEnabled`/`failedBidderIds`/`runnerUpAttempts` (Cluster A). Listing.expiresAt + `EXPIRED` enum-waarde **verwijderd** (Cluster C). User-relatie `adminAuditLogs` (Fase 15, named `AdminAuditLogActor`).

### i18n (`src/i18n/`)
`routing.ts` (locales: nl default, en) · `request.ts` (translations per request) · `navigation.ts` (i18n Link/redirect) · Proxy: `src/proxy.ts`

### i18n Namespaces (`src/messages/`)
`common`, `auth`, `home`, `auction`, `claimsale`, `wallet`, `dashboard`, `profile`, `chat`, `proposal`, `listing`, `watchlist`, `notifications`, `bids`, `search`, `reputation`, `carousel`, `breadcrumbs`, `seller`, `cart`, `shipping`, `sellerClaims`, `subscription`, `verification`, `sales`, `purchases`, `disputes`, `customization`, `footer`, `withdrawal` (Fase 6), `blockReport` (Fase 7), `suspension` (Fase 8), `cancellation` (Fase 9), `admin` (Fase 15 — bevat shieldTooltip/panelTitle/sectie-namen/nav-keys/KPI-labels/quick-actions; pagina-specifieke strings nog hardcoded NL als follow-up)

### API Routes (`src/app/api/`)
**Alle cron-routes** zijn vanaf Fase 15 gewrapt met `withCronLogging` (productie-logs in `CronRun`-tabel) en gebruiken `resolveCronTrigger` voor auth (Bearer secret OF admin-sessie). Bij toevoegen van een nieuwe cron: ook entry in `src/lib/cron-jobs.ts` (`CRON_JOBS` + `CRON_JOB_META` + `CRON_JOB_NAMES`) zodat manual-run via admin-panel werkt.

| Route | Purpose |
|-------|---------|
| `auth/[...nextauth]/route.ts` | NextAuth handlers (JWT-callback exposeert nu `accountType` op session, Fase 15) |
| `upload/route.ts` | Image upload (auth required) |
| `uploads/[filename]/route.ts` | Serve uploaded files |
| `balance/route.ts` | Get user balance (auth required) |
| `claimsales/[id]/status/route.ts` | Claimsale status check |
| `cron/auto-confirm/route.ts` | Auto-confirm shipped bundles after timeout |
| `cron/auto-resolve-disputes/route.ts` | Auto-resolve unresponded disputes |
| `cron/check-subscriptions/route.ts` | Downgrade expired subscriptions to FREE |
| `cron/expire-claims/route.ts` | Verloop CLAIMED claimsale-items >15min in cart |
| `cron/sync-pokewallet/route.ts` | Refresh pricing voor alle PokeWallet-gemapte sets (heavy: ~600 API-calls) |
| `cron/cleanup-archived-chats/route.ts` | Hard-delete conversations >60 dagen ARCHIVED (destructief — manual run geblokkeerd) |
| `cron/auction-payment-deadline/route.ts` | Mark expired AWAITING_PAYMENT auctions as PAYMENT_FAILED OF rotateer naar runner-up (Cluster A) |
| `cron/proposal-payment-deadline/route.ts` | Mark expired ACCEPTED-AWAITING_PAYMENT proposals as PAYMENT_FAILED, listing terug op ACTIVE (A3) |
| `cron/cancellation-expiry/route.ts` | Mark PENDING `CancellationRequest`s die >7 dagen open staan als EXPIRED (Fase 9) |
| `auctions/[auctionId]/bids/route.ts` | Real-time bid polling (GET: currentBid, bidCount, highestBidderId, recentBids) |

---

## Open Feature Fases

| Fase | Onderwerp |
|------|-----------|
| 16 | Email notificaties |
| 17 | Betaalmethoden (iDEAL/Stripe) |
| 18 | Veiling eindetijden pagina |
| 19 | Favoriete verkopers |
| 20 | Geavanceerd zoeken & filters |
| 21 | Mobile responsive polish |
| 22 | SEO & meta tags |
| 23 | Customization Chapter 1 — eigen cosmetic-art (banners/emblems/backgrounds) seeden + via `rewardCosmeticKey` koppelen aan achievement-tiers |
| 24 | Mascotte-uitbreiding — Finn & Sage poses transparant maken en integreren in empty-states, 404-page, achievement-celebration-toast, profile-page |

Afgerond: fases 0–12, 14 (3-tier abonnementssysteem), customization/achievement/IP-cleanup pivot, op 2026-04-29 de **9-fase audit-roadmap** (clusters A-D fundament-fixes + fases 5-9: IBAN/payouts/blocking+reports/account-suspension/cancellation-requests), op 2026-04-30 **Fase 15 — Admin panel** (volledige backoffice op `/dashboard/admin/*` met audit-logging, cron-status/run-now, user-360°-detail, catalog/AppConfig/moderation), op 2026-05-01 **Fase 13 — Premium statistieken** (dashboard-essentials voor IEDEREEN: action-items/saldo/activiteit/recente-bundles; premium-only statistieken-page polish: CSV-export per sectie, ChartEmptyState voor lege chart-blokken, month/ytd quick-ranges, mobile-polish; commission-sectie omgezet naar saved-only), op 2026-05-01 **Fase 25 — Full-width compact layout** (PageContainer met narrow/default/wide tiers, header-redesign met always-on zoekbalk en h-16, alle pages gemigreerd, grid-pages naar 5–6 cols op brede schermen, sponsored-rows tot 6 items met progressive disclosure), en op 2026-05-01 **Fase 26 — Light-mode redesign** (page-bg #ffffff → #f5f6f8 voor surface-hiërarchie, --card blijft wit, nieuwe shadow-card / shadow-card-hover utilities, glass-utilities in light naar solide card-look (dark behoudt glass), section-gradient ontblauwd, alle 15+ admin-pages/-components gestript van rauwe bg-white/border-slate-200, hover:bg-white/X overlays in forms naar hover:bg-muted). Update deze tabel na elke afgeronde fase.

### Bekende follow-ups (klein onderhoud, niet eigen fase)
- Search/homepage/recommendations filteren nog niet op `UserBlock` (alleen marktplaats/veilingen/claimsales/conversations doen dat). Helper `getBlockedUserIds()` bestaat al — hoeven alleen toe te passen.
- `src/app/[locale]/dashboard/claimsales/page.tsx` (en mogelijk meer) gebruikt `session!.user!.id!` met non-null asserts en crashed bij no-session i.p.v. te redirecten naar /login.
- PENDING `ShippingBundle`s zijn niet zichtbaar in `/dashboard/aankopen`/`verkopen` — daar wordt PENDING uitgefilterd. Pending auctions hebben aparte sectie, pending listing-proposals worden via chat afgehandeld. Eventueel een "Wachten op betaling"-sectie toevoegen.
- Admin-panel pagina's (`/dashboard/admin/bank-transfers`, `/users`, `/catalog`, `/config`, `/crons`, `/moderation`, `/audit`) gebruiken hardcoded NL-strings; alleen het `admin` i18n-namespace voor sectie/nav/KPI is gevuld. Pagina-strings progressief migreren wanneer EN echt gebruikt gaat worden.
- Admin user-detail "manuele verificatie" knop ontbreekt nog — bestaande `adminReviewVerification` werkt alleen op een bestaande `VerificationRequest`. Voor "verifieer zonder upload" zou een aparte action nodig zijn.

## Workflow
- Na elke grote verandering: herstart de dev server (`npm run dev`) en controleer of alles correct werkt voordat je verdergaat.
- **Branch-strategie:** één branch per fase/cluster (`fase-N-onderwerp` of `cluster-X-onderwerp`), commit-per-logische-stap, fast-forward merge naar main. Géén force-push, géén destructieve git-commando's.
- **Commit per logische stap:** voor grote features split je in `<fase>.schema`, `<fase>.cron`, `<fase>.ui`, `<fase>.actions`, etc. — commit-message dekt scope per stap. Heel handig om later te herleiden.

### Handige shortcuts (uit ervaring)
- **Compile-check zonder build:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/<path>` — Turbopack compileert lazy bij eerste request, zo zie je TS/runtime errors zonder `npm run build` (die de DB lockt).
- **Find dev server PID + kill:**
  ```
  netstat -ano | grep ":3000" | head -2
  taskkill //PID <pid> //F
  ```
- **Watch dev log voor errors zonder noise:**
  ```
  tail -50 <dev-server-log> | grep -iE "error|fail" | grep -v queryCommand | grep -v cz-shortcut
  ```
  (`queryCommandState` en `cz-shortcut-listen` zijn pre-existing browser-extensie noise — negeren)
- **Mod-97 IBAN sanity-test:** zie `src/lib/validations/iban.ts`; test met canonical NL91ABNA0417164300 + bewust-foute checksum NL91ABNA0417164301.

### Action guards in volgorde van toepassen
Bij een nieuwe write-action die door een gebruiker getriggerd wordt, voeg deze guards toe in deze volgorde (bovenaan de functie):
1. `await auth()` + check `session?.user?.id`
2. `await requireNotSuspended(userId)` (Fase 8) — slaat over voor: payouts, dispute-respondes, markAsShipped
3. Resource-check: bestaat het, ben ik geautoriseerd?
4. State-check: is het in de juiste status?
5. Account-age cap (`checkAmountAllowed` voor financiële commitments)
6. Balance/saldo-check
7. Race-safe write via `updateMany` met status-filter, of expliciete `prisma.$transaction`

### Action guards voor **admin-actions** (Fase 15)
Admin-only schrijfacties hebben een ander patroon — de eindgebruiker is hier geen "user", maar een admin die op iemand anders' state acteert:
1. `const { adminId } = await requireAdmin();` (uit `@/lib/admin`) — werpt bij niet-ADMIN. Page-variant: `requireAdminPage()` doet redirect.
2. Resource-check + state-check (existentie + correcte status)
3. **De eigenlijke schrijfactie** (transactie of single update)
4. **`await logAdminAction({ adminId, action, targetType, targetId?, metadata? })`** uit `@/lib/admin-audit` — direct na succes, niet bij faalpaden. Het `action`-string moet bestaan in de `AdminAction` const-union (uitbreiden in `admin-audit.ts`).
5. Optionele notificatie naar de getroffen user (zoals in `suspendUser`, `confirmBankTransfer`).
6. `revalidatePath()` voor de admin-page die het toont.

Voorbeeld: zie `src/actions/admin-suspension.ts:suspendUser` of `src/actions/withdrawal.ts:approveWithdrawal`.

### Nieuwe admin-feature toevoegen — checklist
Bij elk verzoek dat raakt aan "iets dat alleen admins doen" (queue, bulk-actie, instelling, log-view):
1. **Pagina** komt onder `/dashboard/admin/<feature>/page.tsx`. Géén nieuwe `*/admin/` paden ergens anders. `dashboard/admin/layout.tsx` doet de role-guard al — geen inline `accountType !== "ADMIN"` checks.
2. **Server actions** komen in `src/actions/admin/<feature>.ts`. Elke action begint met `await requireAdmin()` en eindigt met `await logAdminAction(...)` (zie patroon hierboven).
3. **AdminAction-union** in `src/lib/admin-audit.ts` uitbreiden met de nieuwe action-keys voordat je `logAdminAction()` aanroept.
4. **Nav-entry** in `src/components/admin/admin-nav.tsx` toevoegen onder de juiste sectie (Overview / Queues / Users & Content / System).
5. **i18n-keys** in het `admin` namespace (`src/messages/nl.json` + `en.json`) — minstens label + section, page-strings mogen hardcoded NL als de feature admin-only is.
6. **Overview-tegel** op `/dashboard/admin/page.tsx`? Alleen als het een queue is met "openstaand werk". Voeg een KPI-tegel + count-query toe.
7. **Audit-page filters** — als de nieuwe action veel zal voorkomen, voeg de action-key toe aan de `ACTIONS` const in `src/app/[locale]/dashboard/admin/audit/page.tsx` (en `targetType` aan `TARGET_TYPES` indien nieuw).

### Nieuwe cron toevoegen — checklist (Fase 15)
1. **Route** in `src/app/api/cron/<name>/route.ts` — gebruik `resolveCronTrigger(request)` voor auth en wrap business logic in `withCronLogging("<name>", async (run) => { ... }, trigger)`. `run.setItemsProcessed(n)` aanroepen voor zinvolle stats.
2. **Registry-entry** in `src/lib/cron-jobs.ts`:
   - Toevoegen aan `CRON_JOB_NAMES` const-tuple
   - Runner-functie in `CRON_JOBS` (zelfde shape als de andere — `{ itemsProcessed, result }` returnen)
   - Meta-entry in `CRON_JOB_META`: `description` (1-2 zinnen), `schedule`, `allowManualRun` (default true tenzij destructief), optionele `runWarning` voor heavy/risky jobs.
3. **Mag deze cron manueel?** Default ja. Zet `allowManualRun: false` voor:
   - Destructieve jobs (hard-delete, geen reversal mogelijk)
   - Jobs waarbij scheduling-frequentie precies belangrijk is en handmatig draaien de logica breekt
4. Heavy/risky maar wel manueel? Vul `runWarning` — die wordt zowel in de UI getoond als in de browser-confirm-prompt verwerkt.
5. CLAUDE.md API Routes-tabel hierboven bijwerken met de nieuwe route.

### Schema-velden die moeten meereizen bij nieuwe queries op publieke lijsten
- **Country filter:** `getSellerCountryFilter(buyerCountry)` (`src/lib/shipping/filter.ts`)
- **Block filter:** `sellerNotInBlockedFilter(await getBlockedUserIds(session?.user?.id))` (`src/lib/blocking.ts`)
- Deze twee samen → `where: { ...countryFilter, ...blockingFilter, status: "ACTIVE" }`

### Wat te doen als nieuwe Prisma-relatie circulair lijkt
Bij models met meerdere relaties naar dezelfde User (zoals `WithdrawalRequest.user` + `WithdrawalRequest.reviewedBy`), gebruik named relations:
```prisma
user        User @relation("WithdrawalUser", ...)
reviewedBy  User? @relation("WithdrawalReviewer", ...)
```
En in `User`:
```prisma
withdrawalRequests         WithdrawalRequest[] @relation("WithdrawalUser")
reviewedWithdrawalRequests WithdrawalRequest[] @relation("WithdrawalReviewer")
```
