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
| `…/` | Home (stats + charts, PRO/UNLIMITED only) |
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
| `…/uitbetalingen/admin` | Admin: pending/approved/paid/rejected withdrawal-requests |
| `…/blokkeerlijst` | "Block-list" — geblokkeerde gebruikers met unblock-actie |
| `…/rapporten/admin` | Admin: meldingen gegroepeerd per gerapporteerde user, inline suspend-knop |
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
| `layout/` | `header`, `footer`, `language-switcher`, `user-balance` |
| `ui/` | `button`, `card`, `cart-icon`, `chart`, `checkbox`, `input`, `select`, `slider`, `label`, `switch`, `image-gallery`, `image-uploader`, `rich-text-editor`, `item-carousel`, `breadcrumbs`, `social-share`, `notification-bell`, `notification-list`, `pagination`, `review-form`, `review-list`, `seller-level-badge`, `seller-reputation-card`, `seller-info-block`, `username-history-tooltip`, `shipping-method-selector`, `star-rating`, `watchlist-button`, `verified-badge`, `block-report-buttons` (Fase 7) |
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

### Database (`prisma/schema.prisma`)
User, Category, Series, CardSet, Card, CardPriceHistory, CardWatchlist, Auction, AuctionBid, AuctionShippingMethod, AuctionUpsell, Claimsale, ClaimsaleItem, ClaimsaleShippingMethod, Listing, ListingShippingMethod, ListingUpsell, SellerShippingMethod, ShippingBundle, Transaction, Subscription, Conversation, ConversationParticipant, Message, Proposal, Watchlist, Notification, Review, AppConfig, AutoBid, CartItem, Dispute, DisputeEvent, UsernameHistory, VerificationRequest, CosmeticBundle, CosmeticItem, OwnedItem, EmberTransaction, ActivityLog, Achievement, AchievementTier, UserAchievement, BuybackRequest, BuybackItem, BulkBuybackItem, **WithdrawalRequest** (Fase 6), **UserBlock** + **UserReport** (Fase 7), **CancellationRequest** (Fase 9).

User-velden toegevoegd in roadmap-werk: `maxRunnerUpAttempts` (Cluster A), `iban`/`accountHolderName`/`lastIbanChange` (Fase 5), `suspendedUntil`/`suspensionType`/`suspensionReason`/`suspensionAdminId` (Fase 8). Auction-velden: `runnerUpEnabled`/`failedBidderIds`/`runnerUpAttempts` (Cluster A). Listing.expiresAt + `EXPIRED` enum-waarde **verwijderd** (Cluster C).

### i18n (`src/i18n/`)
`routing.ts` (locales: nl default, en) · `request.ts` (translations per request) · `navigation.ts` (i18n Link/redirect) · Proxy: `src/proxy.ts`

### i18n Namespaces (`src/messages/`)
`common`, `auth`, `home`, `auction`, `claimsale`, `wallet`, `dashboard`, `profile`, `chat`, `proposal`, `listing`, `watchlist`, `notifications`, `bids`, `search`, `reputation`, `carousel`, `breadcrumbs`, `seller`, `cart`, `shipping`, `sellerClaims`, `subscription`, `verification`, `sales`, `purchases`, `disputes`, `customization`, `footer`, `withdrawal` (Fase 6), `blockReport` (Fase 7), `suspension` (Fase 8), `cancellation` (Fase 9)

### API Routes (`src/app/api/`)
| Route | Purpose |
|-------|---------|
| `auth/[...nextauth]/route.ts` | NextAuth handlers |
| `upload/route.ts` | Image upload (auth required) |
| `uploads/[filename]/route.ts` | Serve uploaded files |
| `balance/route.ts` | Get user balance (auth required) |
| `claimsales/[id]/status/route.ts` | Claimsale status check |
| `cron/auto-confirm/route.ts` | Auto-confirm shipped bundles after timeout |
| `cron/auto-resolve-disputes/route.ts` | Auto-resolve unresponded disputes |
| `cron/check-subscriptions/route.ts` | Downgrade expired subscriptions to FREE |
| `cron/auction-payment-deadline/route.ts` | Mark expired AWAITING_PAYMENT auctions as PAYMENT_FAILED OF rotateer naar runner-up (Cluster A) |
| `cron/proposal-payment-deadline/route.ts` | Mark expired ACCEPTED-AWAITING_PAYMENT proposals as PAYMENT_FAILED, listing terug op ACTIVE (A3) |
| `cron/cancellation-expiry/route.ts` | Mark PENDING `CancellationRequest`s die >7 dagen open staan als EXPIRED (Fase 9) |
| `auctions/[auctionId]/bids/route.ts` | Real-time bid polling (GET: currentBid, bidCount, highestBidderId, recentBids) |

---

## Open Feature Fases

| Fase | Onderwerp |
|------|-----------|
| 13 | Premium statistieken |
| 15 | Admin panel (gecentraliseerd dashboard voor users/disputes/verificaties/payouts/reports) |
| 16 | Email notificaties |
| 17 | Betaalmethoden (iDEAL/Stripe) |
| 18 | Veiling eindetijden pagina |
| 19 | Favoriete verkopers |
| 20 | Geavanceerd zoeken & filters |
| 21 | Mobile responsive polish |
| 22 | SEO & meta tags |
| 23 | Customization Chapter 1 — eigen cosmetic-art (banners/emblems/backgrounds) seeden + via `rewardCosmeticKey` koppelen aan achievement-tiers |
| 24 | Mascotte-uitbreiding — Finn & Sage poses transparant maken en integreren in empty-states, 404-page, achievement-celebration-toast, profile-page |

Afgerond: fases 0–12, 14 (3-tier abonnementssysteem), customization/achievement/IP-cleanup pivot, en op 2026-04-29 de **9-fase audit-roadmap** (clusters A-D fundament-fixes + fases 5-9: IBAN/payouts/blocking+reports/account-suspension/cancellation-requests). Update deze tabel na elke afgeronde fase.

### Bekende follow-ups (klein onderhoud, niet eigen fase)
- Search/homepage/recommendations filteren nog niet op `UserBlock` (alleen marktplaats/veilingen/claimsales/conversations doen dat). Helper `getBlockedUserIds()` bestaat al — hoeven alleen toe te passen.
- `src/app/[locale]/dashboard/claimsales/page.tsx` (en mogelijk meer) gebruikt `session!.user!.id!` met non-null asserts en crashed bij no-session i.p.v. te redirecten naar /login.
- PENDING `ShippingBundle`s zijn niet zichtbaar in `/dashboard/aankopen`/`verkopen` — daar wordt PENDING uitgefilterd. Pending auctions hebben aparte sectie, pending listing-proposals worden via chat afgehandeld. Eventueel een "Wachten op betaling"-sectie toevoegen.

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
