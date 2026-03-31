@AGENTS.md

# TCG Marketplace

Pokémon trading card marketplace — auctions, claimsales, listings, wallet, messaging, reviews, watchlist, notifications, disputes.

## CRITICAL RULES
- **NOOIT destructieve git commando's** (`git stash`, `git reset --hard`, `git checkout .`, `git clean`) gebruiken zonder EERST te committen. Op 2026-03-31 zijn alle unstaged wijzigingen verloren gegaan door een mislukte `git stash`.
- **Altijd committen** na elke grote wijziging zodat werk niet verloren gaat.
- **Nooit `npm run build` draaien vanuit achtergrond agents** terwijl de dev server draait — dit veroorzaakt database locks en frozen pages.

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
- `npx prisma migrate dev` — Run database migrations
- `npx prisma db seed` — Seed the database
- `npx prisma generate` — Regenerate Prisma client

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
- **Auction bidding** — 40% of bid amount reserved on `reservedBalance`; full amount deducted at auction end. If winner has <100% but >=40%: 5-day payment deadline (`paymentStatus: AWAITING_PAYMENT`). `completeAuctionPayment()` lets winner pay after topping up. Cron: `api/cron/auction-payment-deadline` marks expired as `PAYMENT_FAILED`.
- **Reserved balance** — `reservedBalance` on User tracks 40% of active bids. `availableBalance = balance - reservedBalance`. All purchase actions check available balance. Per auction: reserves 40% of max(highestBid, autobidMaxAmount). Released when outbid (no autobid) or auction ends.
- **Account age restrictions** — config in `src/lib/account-age.ts`. 0-24h: max €50, 1-7d: max €200, 7+d unverified: max €500, verified: unlimited. Accounts before 2026-03-31 skip restrictions.
- **Account verification** — ID/passport/driver's license upload → admin review → `isVerified` + `verificationStatus` on User. `VerificationRequest` model. Actions in `verification.ts`. Pages: `dashboard/verificatie/` (user), `dashboard/geschillen/admin/verificaties/` (admin). Verified badge: `components/ui/verified-badge.tsx`.
- **Balance top-up** — Bank transfer with unique `bankTransferReference` per user (format: `[username][10digits]`, generated at registration, regenerated on username change). Admin confirms via `confirmBankTransfer()`. iDEAL: placeholder UI only.
- **Claimsales immutable** once LIVE (DRAFT → LIVE, no edits)
- **Anti-snipe** — bids in last 2 min → +2 min extension
- **Bid increments** — per price tier (`src/lib/auction/bid-increments.ts`)
- **Account tiers** — FREE / PRO / UNLIMITED (config in `src/lib/subscription-tiers.ts`). ADMIN is a role, not a tier — maps to UNLIMITED perks. Limits: auctions, claimsales, listings, items/claimsale. Commission deducted at escrow release. Subscription model tracks billing history.
- **Seller levels** — 20-tier progression system (`src/lib/seller-levels.ts`). XP earned via: 1 XP/day account age, 1 XP/€ sold, 1 XP/€ bought, 20 XP per 5-star review. Tiers: Tin→Copper→Bronze→Silver→Gold→Platinum→Titanium→Cobalt→Jade→Amethyst→Sapphire→Ruby→Emerald→Diamond→Obsidian→Champion→Elite→Legend→Mythic→Transcendent (95k XP). Data fetching sums revenue amounts, not counts.
- **Disputes** — buyer opens on SHIPPED bundle (10–30 days after shipment); seller responds; buyer accepts/rejects; mutual proposals; escalation (both parties agree) → admin resolves. Event-sourced timeline via `DisputeEvent` model. Auto-resolve cron for unresponded disputes. Actions in `dispute.ts`, UI in `dispute-detail-content.tsx`, page in `dashboard/geschillen/[disputeId]/page.tsx`
- **Chat proposals** — Buyer/seller can make buy/sell price proposals in chat linked to a listing. Proposal model with PENDING/ACCEPTED/REJECTED status. 40% minimum balance rule applies. Accepted proposals: mark listing SOLD, create ShippingBundle, escrow flow. `withdrawProposal()` for retracting pending offers.
- **Sponsored listings** — Listings with active `CATEGORY_HIGHLIGHT` upsell appear in "Gesponsord" row on marketplace page with tooltip explanation.
- **Marketplace pagination** — 40 listings per page, sponsored excluded from main grid.
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

### Components (`src/components/`)
| Folder | Key files |
|--------|-----------|
| `auction/` | `auction-card`, `auction-form`, `multi-step-auction-form`, `steps/`, `autobid-form`, `bid-section`, `quick-bid-buttons`, `countdown-timer` |
| `claimsale/` | `claimsale-form`, `claimsale-card`, `claimsale-actions`, `claimsale-items-filter`, `claim-button`, `add-to-cart-button` |
| `listing/` | `listing-form`, `multi-step-listing-form`, `steps/`, `listing-card`, `listing-actions`, `sponsored-row` |
| `cart/` | `cart-checkout`, `cart-content`, `cart-item-row` |
| `checkout/` | `shipping-method-picker` |
| `message/` | `chat-layout`, `conversation-list`, `message-thread`, `contact-seller-button`, `chat-actions`, `proposal-button`, `proposal-message` |
| `search/` | `search-bar`, `search-filters`, `search-result-card`, `search-sort-bar` |
| `dashboard/` | `dashboard-nav`, `dashboard-stats`, `dashboard-stats-locked`, `profile-form`, `address-form`, `purchases-content`, `sales-content`, `shipping-methods-manager`, `shipping-method-form`, `ship-bundle-form`, `buyer-shipping-info`, `disputes-overview`, `dispute-detail-content`, `open-dispute-form`, `admin-disputes-list`, `balance-summary`, `deposit-methods`, `pending-auction-payments`, `verification-form`, `admin-verification-list` |
| `home/` | `hero-email-form`, `pricing-section` |
| `layout/` | `header`, `footer`, `language-switcher`, `user-balance` |
| `ui/` | `button`, `card`, `cart-icon`, `chart`, `checkbox`, `input`, `select`, `slider`, `label`, `switch`, `image-gallery`, `image-uploader`, `rich-text-editor`, `item-carousel`, `breadcrumbs`, `social-share`, `notification-bell`, `notification-list`, `pagination`, `review-form`, `review-list`, `seller-level-badge`, `seller-reputation-card`, `seller-info-block`, `username-history-tooltip`, `shipping-method-selector`, `star-rating`, `watchlist-button`, `verified-badge` |
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
| `upsell-config.ts` | Tier-based upsell pricing (discount per account tier) |
| `auction/bid-increments.ts` | Min bid increment per price tier |
| `balance-check.ts` | Available balance, reserve calculation (40%), per-auction reserve tracking |
| `account-age.ts` | Account age tier restrictions (0-24h €50, 1-7d €200, 7+d €500, verified unlimited) |
| `auction/autobid.ts` | Autobid resolution (with 40% reserve on each bid step) |
| `shipping/countries.ts` | EU country list (code, name NL, name EN) |
| `shipping/carriers.ts` | Carrier suggestions per country |
| `validations/` | Zod schemas: `auth`, `auction`, `listing`, `address`, `shipping-method`, `cart` |

### Database (`prisma/schema.prisma`)
User, Category, Series, CardSet, Auction, AuctionBid, AuctionShippingMethod, Claimsale, ClaimsaleItem, ClaimsaleShippingMethod, Listing, ListingShippingMethod, ListingUpsell, SellerShippingMethod, ShippingBundle, Transaction, Subscription, Conversation, ConversationParticipant, Message, Proposal, Watchlist, Notification, Review, AppConfig, AutoBid, CartItem, Dispute, DisputeEvent, UsernameHistory, VerificationRequest

### i18n (`src/i18n/`)
`routing.ts` (locales: nl default, en) · `request.ts` (translations per request) · `navigation.ts` (i18n Link/redirect) · Middleware: `src/middleware.ts`

### i18n Namespaces (`src/messages/`)
`common`, `auth`, `home`, `auction`, `claimsale`, `wallet`, `dashboard`, `profile`, `chat`, `proposal`, `listing`, `watchlist`, `notifications`, `bids`, `search`, `reputation`, `carousel`, `breadcrumbs`, `seller`, `cart`, `shipping`, `sellerClaims`, `subscription`, `verification`, `sales`, `purchases`, `disputes`

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
| `cron/auction-payment-deadline/route.ts` | Mark expired AWAITING_PAYMENT auctions as PAYMENT_FAILED |

---

## Open Feature Fases

| Fase | Onderwerp |
|------|-----------|
| 12 | Homepage verrijking |
| 13 | Premium statistieken |
| 15 | Admin panel |
| 16 | Email notificaties |
| 17 | Betaalmethoden (iDEAL/Stripe) |
| 18 | Veiling eindetijden pagina |
| 19 | Favoriete verkopers |
| 20 | Geavanceerd zoeken & filters |
| 21 | Mobile responsive polish |
| 22 | SEO & meta tags |

Fases 0–11, 14 (3-tier abonnementssysteem) zijn afgerond. Update deze tabel na elke afgeronde fase.

## Workflow
- Na elke grote verandering: herstart de dev server (`npm run dev`) en controleer of alles correct werkt voordat je verdergaat.
