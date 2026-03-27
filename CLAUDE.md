@AGENTS.md

# TCG Marketplace

## Project Overview
Pokémon trading card marketplace with auctions, claimsales, marketplace listings, wallet, messaging, reviews, watchlist and notifications.

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
- **Internal wallet** — balance per user, commission via AppConfig (default 5%)
- **Shipping bundling** — ShippingBundle model groups items from same seller
- **Claimsales immutable** once LIVE (DRAFT → LIVE, no edits)
- **Anti-snipe** — bids in last 2 min → +2 min extension
- **Bid increments** — per price tier (`src/lib/auction/bid-increments.ts`)
- **Account tiers** — FREE (1 auction, 1 claimsale, 20 cards) vs PREMIUM (unlimited)
- **Seller levels** — progression badges (`src/lib/seller-levels.ts`)
- **SQLite date handling** — no DATE_TRUNC; fetch raw + group in JS

---

## Codebase Map

### Server Actions (`src/actions/`)
| File | Purpose |
|------|---------|
| `auth.ts` | Register, login |
| `profile.ts` | Update profile, bio, display name, shipping cost |
| `wallet.ts` | Get balance, deposit, withdrawal |
| `auction.ts` | Create auction, place bid, end auction |
| `claimsale.ts` | Create/manage claimsales with items |
| `listing.ts` | CRUD for marketplace listings |
| `message.ts` | Start conversations, send messages, archive/delete/restore |
| `watchlist.ts` | Add/remove watchlist items |
| `notification.ts` | Create notifications, mark read, unread count |
| `review.ts` | Submit seller reviews with ratings |

### Pages (`src/app/[locale]/`)
| Route | Page |
|-------|------|
| `/` | Homepage |
| `/veilingen` | Auction list |
| `/veilingen/nieuw` | Create auction |
| `/veilingen/[auctionId]` | Auction detail + bidding |
| `/claimsales` | Claimsale list |
| `/claimsales/nieuw` | Create claimsale |
| `/claimsales/[claimsaleId]` | Claimsale detail + claim |
| `/marktplaats` | Marketplace listings |
| `/marktplaats/nieuw` | Create listing |
| `/marktplaats/[listingId]` | Listing detail |
| `/berichten` | Messages/conversations |
| `/berichten/[conversationId]` | Conversation thread |
| `/verkoper/[userId]` | Public seller profile |
| `/dashboard` | Dashboard home (stats + charts) |
| `/dashboard/profiel` | Edit profile |
| `/dashboard/saldo` | Wallet/balance |
| `/dashboard/veilingen` | My auctions |
| `/dashboard/claimsales` | My claimsales |
| `/dashboard/marktplaats` | My listings |
| `/dashboard/aankopen` | My purchases |
| `/dashboard/biedingen` | My bids |
| `/dashboard/volglijst` | My watchlist |
| `/dashboard/meldingen` | Notifications |
| `/dashboard/reviews` | My reviews |

### Components (`src/components/`)
| Folder | Contains |
|--------|----------|
| `auction/` | `auction-form`, `bid-section`, `countdown-timer` |
| `claimsale/` | `claimsale-form`, `claimsale-actions`, `claim-button` |
| `listing/` | `listing-form`, `listing-card`, `listing-actions` |
| `message/` | `chat-layout`, `conversation-list`, `message-thread`, `contact-seller-button`, `chat-actions` |
| `dashboard/` | `dashboard-nav`, `profile-form`, `charts/` (sales-overview, activity, distribution), `recent-transactions`, `recent-reviews` |
| `home/` | `hero-email-form`, `pricing-section` |
| `layout/` | `header`, `footer`, `language-switcher`, `user-balance` |
| `search/` | `search-bar` |
| `ui/` | `button`, `card`, `chart`, `checkbox`, `image-gallery`, `image-uploader`, `item-carousel`, `breadcrumbs`, `social-share`, `label`, `notification-bell`, `notification-list`, `review-form`, `review-list`, `seller-level-badge`, `seller-reputation-card`, `star-rating`, `switch`, `watchlist-button` |
| `providers/` | `theme-provider` |

### Library (`src/lib/`)
| File | Purpose |
|------|---------|
| `auth.ts` | NextAuth config, JWT callbacks |
| `prisma.ts` | Prisma client singleton |
| `utils.ts` | `cn()` for Tailwind class merging |
| `upload.ts` | Image upload handling |
| `account-limits.ts` | FREE/PREMIUM tier limit checks |
| `seller-levels.ts` | Seller level definitions + styling |
| `recommendations.ts` | Seller other items & similar items queries |
| `auction/bid-increments.ts` | Min bid increment per price tier |
| `validations/auth.ts` | Zod: registration/login |
| `validations/auction.ts` | Zod: auction creation |
| `validations/listing.ts` | Zod: listing creation |

### Database Models (`prisma/schema.prisma`)
User, Category, Series, CardSet, Auction, AuctionBid, Claimsale, ClaimsaleItem, Listing, ShippingBundle, Transaction, Conversation, ConversationParticipant, Message, Watchlist, Notification, Review, AppConfig

### i18n (`src/i18n/`)
- `routing.ts` — locales: nl (default), en
- `request.ts` — loads translations per request
- `navigation.ts` — i18n-aware Link, redirect, etc.
- Middleware at `src/middleware.ts` handles locale detection

### API Routes (`src/app/api/`)
| Route | Purpose |
|-------|---------|
| `auth/[...nextauth]/route.ts` | NextAuth handlers |
| `upload/route.ts` | Image upload endpoint (auth required) |
| `balance/route.ts` | Get user balance (auth required) |

---

## Feature Fases — Voortgang

Het volledige plan staat in `.claude/plans/glowing-frolicking-walrus.md`.

| Fase | Onderwerp | Status |
|------|-----------|--------|
| 0 | Pokémon-only vereenvoudiging | ✅ Klaar |
| 1 | Matte Glass UI & styling | ✅ Klaar |
| 2 | Image upload systeem | ✅ Klaar |
| 3 | Marktplaats | ✅ Klaar |
| 4 | Chat redesign | ✅ Klaar |
| 5 | Watchlist & notificaties | ✅ Klaar |
| 6 | Reviews & reputatie | ✅ Klaar |
| 7 | Autobid & snelle biedknoppen | ✅ Klaar |
| 8 | Zoeken & filteren | ✅ Klaar |
| 9 | Carousels, breadcrumbs & sharing | ✅ Klaar |
| 10 | Winkelwagen & bulk claimen | ⬚ Nog niet begonnen |
| 11 | Dashboard redesign (Nexus-stijl) | ✅ Klaar |
| 12 | Homepage verrijking | ⬚ Nog niet begonnen |
| 13 | Premium statistieken | ⬚ Nog niet begonnen |

> **Regel:** Update deze tabel na elke afgeronde fase zodat een nieuwe chat-sessie direct weet waar we gebleven zijn.