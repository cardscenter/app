-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "profileBanner" TEXT,
    "profileEmblem" TEXT,
    "profileBackground" TEXT,
    "emberBalance" INTEGER NOT NULL DEFAULT 0,
    "bonusXP" INTEGER NOT NULL DEFAULT 0,
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoginDate" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "heldBalance" REAL NOT NULL DEFAULT 0,
    "reservedBalance" REAL NOT NULL DEFAULT 0,
    "bankTransferReference" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isIbanVerified" BOOLEAN NOT NULL DEFAULT false,
    "isAddressVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "addressVerificationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "suspendedUntil" DATETIME,
    "suspensionType" TEXT,
    "suspensionReason" TEXT,
    "suspensionAdminId" TEXT,
    "paymentFailureCount" INTEGER NOT NULL DEFAULT 0,
    "paymentFailureLastAt" DATETIME,
    "isBusinessBidExempt" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginIp" TEXT,
    "lastLoginIpAt" DATETIME,
    "accountType" TEXT NOT NULL DEFAULT 'FREE',
    "premiumExpiresAt" DATETIME,
    "tierRank" INTEGER NOT NULL DEFAULT 1,
    "shopSlug" TEXT,
    "freeUpsellsRemaining" INTEGER NOT NULL DEFAULT 0,
    "freeUpsellsResetAt" DATETIME,
    "skipBidConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "mollieCustomerId" TEXT,
    "accountKind" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "vatNumber" TEXT,
    "cocNumber" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "sellingCountries" TEXT NOT NULL DEFAULT 'DOMESTIC_AND_NEAR',
    "accountFocus" TEXT,
    "referralSource" TEXT,
    "termsAcceptedAt" DATETIME,
    "lastUsernameChange" DATETIME,
    "lastAddressChange" DATETIME,
    "maxRunnerUpAttempts" INTEGER NOT NULL DEFAULT 2,
    "iban" TEXT,
    "accountHolderName" TEXT,
    "lastIbanChange" DATETIME,
    "emailVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SellerShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "service" TEXT,
    "zone" TEXT,
    "priceOverride" REAL,
    "carrier" TEXT NOT NULL,
    "serviceName" TEXT,
    "price" REAL,
    "countries" TEXT,
    "shippingType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerShippingMethod_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tcgdexSeriesId" TEXT,
    "logoUrl" TEXT,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Series_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tcgdexSetId" TEXT,
    "pokewalletSetId" TEXT,
    "pokewalletSetCode" TEXT,
    "logoUrl" TEXT,
    "symbolUrl" TEXT,
    "releaseDate" TEXT,
    "cardCount" INTEGER,
    "seriesId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardSet_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pokewalletId" TEXT,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT,
    "cardSetId" TEXT NOT NULL,
    "rarity" TEXT,
    "hp" INTEGER,
    "types" TEXT,
    "illustrator" TEXT,
    "variants" TEXT,
    "imageUrl" TEXT,
    "imageUrlFull" TEXT,
    "priceAvg" REAL,
    "priceLow" REAL,
    "priceTrend" REAL,
    "priceAvg7" REAL,
    "priceAvg30" REAL,
    "priceReverseAvg" REAL,
    "priceReverseLow" REAL,
    "priceReverseTrend" REAL,
    "priceReverseAvg7" REAL,
    "priceReverseAvg30" REAL,
    "priceUpdatedAt" DATETIME,
    "priceTcgplayerNormalLow" REAL,
    "priceTcgplayerNormalMid" REAL,
    "priceTcgplayerNormalMarket" REAL,
    "priceTcgplayerHolofoilLow" REAL,
    "priceTcgplayerHolofoilMid" REAL,
    "priceTcgplayerHolofoilMarket" REAL,
    "priceTcgplayerReverseLow" REAL,
    "priceTcgplayerReverseMid" REAL,
    "priceTcgplayerReverseMarket" REAL,
    "priceTcgplayerUpdatedAt" DATETIME,
    "gameplayJson" TEXT,
    "spriteUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "priceVariantsJson" TEXT,
    "priceOverrideAvg" REAL,
    "priceOverrideReverseAvg" REAL,
    "priceOverrideReason" TEXT,
    CONSTRAINT "Card_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardPriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "priceNormal" REAL,
    "priceReverse" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardPriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardWatchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CardWatchlist_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrls" TEXT,
    "auctionType" TEXT NOT NULL DEFAULT 'SINGLE_CARD',
    "cardName" TEXT,
    "cardSetId" TEXT,
    "condition" TEXT,
    "tcgdexId" TEXT,
    "cardItems" TEXT,
    "estimatedCardCount" INTEGER,
    "conditionRange" TEXT,
    "productType" TEXT,
    "itemCategory" TEXT,
    "sellerId" TEXT NOT NULL,
    "startingBid" REAL NOT NULL,
    "reservePrice" REAL,
    "buyNowPrice" REAL,
    "currentBid" REAL,
    "duration" INTEGER NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME NOT NULL,
    "extendedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "winnerId" TEXT,
    "finalPrice" REAL,
    "paymentDeadline" DATETIME,
    "paymentStatus" TEXT,
    "runnerUpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "failedBidderIds" TEXT NOT NULL DEFAULT '[]',
    "runnerUpAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'SHIP',
    "pickupCity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Auction_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorKey" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionLabel_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionUpsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "dailyCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionUpsell_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "AuctionShippingMethod_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuctionShippingMethod_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "deliveryChoice" TEXT,
    "bidderIp" TEXT,
    CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuctionBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claimsale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "shippingCost" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CARDS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "startTime" DATETIME,
    "sellerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Claimsale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimsaleUpsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimsaleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "dailyCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimsaleUpsell_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimsaleLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimsaleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorKey" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimsaleLabel_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimsaleShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimsaleId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "ClaimsaleShippingMethod_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleShippingMethod_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimsaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "reference" TEXT,
    "sellerNote" TEXT,
    "itemDescription" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "tcgdexId" TEXT,
    "cardSetId" TEXT,
    "claimsaleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "buyerId" TEXT,
    "claimedAt" DATETIME,
    "claimedById" TEXT,
    "checkoutLockExpiresAt" DATETIME,
    "lastUnclaimAt" DATETIME,
    "lastUnclaimedById" TEXT,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shippingBundleId" TEXT,
    CONSTRAINT "ClaimsaleItem_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "listingType" TEXT NOT NULL DEFAULT 'SINGLE_CARD',
    "cardName" TEXT,
    "cardSetId" TEXT,
    "condition" TEXT,
    "tcgdexId" TEXT,
    "cardItems" TEXT,
    "allowPartialSale" BOOLEAN NOT NULL DEFAULT false,
    "estimatedCardCount" INTEGER,
    "conditionRange" TEXT,
    "productType" TEXT,
    "itemCategory" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 1,
    "pricingType" TEXT NOT NULL,
    "price" REAL,
    "suggestedPrice" REAL,
    "allowDirectBuy" BOOLEAN NOT NULL DEFAULT true,
    "acceptsOffers" BOOLEAN NOT NULL DEFAULT true,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'SHIP',
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "carriers" TEXT,
    "packageSize" TEXT,
    "packageCount" INTEGER NOT NULL DEFAULT 1,
    "pickupCity" TEXT,
    "allowPlatformPickup" BOOLEAN NOT NULL DEFAULT true,
    "allowExternalPickup" BOOLEAN NOT NULL DEFAULT true,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "buyerId" TEXT,
    CONSTRAINT "Listing_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorKey" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingLabel_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "ListingShippingMethod_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingShippingMethod_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingUpsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "dailyCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingUpsell_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL DEFAULT '',
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shippingCost" REAL NOT NULL,
    "totalItemCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "shippingMethodId" TEXT,
    "trackingUrl" TEXT,
    "shippingProofUrls" TEXT,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "buyerStreet" TEXT,
    "buyerHouseNumber" TEXT,
    "buyerPostalCode" TEXT,
    "buyerCity" TEXT,
    "buyerCountry" TEXT,
    "refundedAmount" REAL NOT NULL DEFAULT 0,
    "autoExpiredAt" DATETIME,
    "imagesPurgedAt" DATETIME,
    "lockedForPackingAt" DATETIME,
    "appendHistory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMode" TEXT NOT NULL DEFAULT 'PLATFORM',
    "deliveryMethod" TEXT NOT NULL DEFAULT 'SHIP',
    "pickupReservationExpiresAt" DATETIME,
    "auctionId" TEXT,
    "listingId" TEXT,
    "bundleProposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShippingBundle_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_bundleProposalId_fkey" FOREIGN KEY ("bundleProposalId") REFERENCES "BundleProposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingBundleId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" TEXT NOT NULL DEFAULT '[]',
    "sellerResponse" TEXT,
    "sellerEvidenceUrls" TEXT,
    "sellerRespondedAt" DATETIME,
    "partialRefundAmount" REAL,
    "proposedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "buyerAcceptsEscalation" BOOLEAN NOT NULL DEFAULT false,
    "sellerAcceptsEscalation" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "responseDeadline" DATETIME NOT NULL,
    "buyerReviewDeadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisputeEvent_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "relatedAuctionId" TEXT,
    "relatedClaimsaleItemId" TEXT,
    "relatedShippingBundleId" TEXT,
    "relatedListingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT,
    "claimsaleId" TEXT,
    "listingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastReadAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" DATETIME,
    "deletedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "proposalId" TEXT,
    "bundleProposalId" TEXT,
    "pickupScheduleId" TEXT,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Message_bundleProposalId_fkey" FOREIGN KEY ("bundleProposalId") REFERENCES "BundleProposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Message_pickupScheduleId_fkey" FOREIGN KEY ("pickupScheduleId") REFERENCES "PickupSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT,
    "conversationId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentDeadline" DATETIME,
    "paymentStatus" TEXT,
    "itemIds" TEXT,
    "requestInsuredShipping" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Proposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "auctionId" TEXT,
    "claimsaleId" TEXT,
    "listingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Watchlist_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Watchlist_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Watchlist_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "packagingRating" INTEGER,
    "shippingRating" INTEGER,
    "communicationRating" INTEGER,
    "reviewerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "auctionId" TEXT,
    "claimsaleItemId" TEXT,
    "listingId" TEXT,
    "shippingBundleId" TEXT,
    "sellerResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoBid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "maxAmount" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deliveryChoice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutoBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AutoBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "claimsaleItemId" TEXT NOT NULL,
    "snapshotPrice" REAL,
    "snapshotCardName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CartItem_claimsaleItemId_fkey" FOREIGN KEY ("claimsaleItemId") REFERENCES "ClaimsaleItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnterpriseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "estimatedMonthlyRevenue" REAL NOT NULL,
    "phone" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "approvedMonthlyPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EnterpriseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EnterpriseRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    "monthlyPrice" REAL NOT NULL,
    "yearlyPrice" REAL,
    "paymentMethod" TEXT,
    "mollieSubscriptionId" TEXT,
    "mollieCustomerId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "gracePeriodEnd" DATETIME,
    "nextBillingAt" DATETIME,
    "legacyPricing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ID',
    "documentType" TEXT,
    "addressDocumentType" TEXT,
    "frontImageUrl" TEXT NOT NULL,
    "backImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsernameHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "oldName" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsernameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CosmeticBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "assetPath" TEXT,
    "rewardValue" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CosmeticItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "CosmeticBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "obtainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    CONSTRAINT "OwnedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmberTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmberTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "embersAwarded" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AchievementTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "achievementKey" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardEmber" INTEGER,
    "rewardXP" INTEGER,
    "rewardCosmeticKey" TEXT,
    CONSTRAINT "AchievementTier_achievementKey_fkey" FOREIGN KEY ("achievementKey") REFERENCES "Achievement" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "currentTier" INTEGER NOT NULL DEFAULT 0,
    "acknowledgedTier" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "lastUnlockedAt" DATETIME,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementKey_fkey" FOREIGN KEY ("achievementKey") REFERENCES "Achievement" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuybackRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COLLECTION',
    "payoutMethod" TEXT NOT NULL DEFAULT 'BANK',
    "iban" TEXT,
    "accountHolder" TEXT,
    "totalItems" INTEGER NOT NULL,
    "estimatedPayout" REAL NOT NULL,
    "storeCreditBonus" REAL,
    "finalPayout" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "inspectedById" TEXT,
    "shippingDeadline" DATETIME,
    "shippingCarrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" DATETIME,
    "receivedAt" DATETIME,
    "inspectedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuybackRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuybackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buybackRequestId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardLocalId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "marketPrice" REAL NOT NULL,
    "buybackPrice" REAL NOT NULL,
    "isReverse" BOOLEAN NOT NULL DEFAULT false,
    "inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "priceCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctedMarketPrice" REAL,
    "correctedBuybackPrice" REAL,
    "priceCorrectionReason" TEXT,
    "userApprovedCorrection" BOOLEAN,
    "userRespondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuybackItem_buybackRequestId_fkey" FOREIGN KEY ("buybackRequestId") REFERENCES "BuybackRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingBundleId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" DATETIME,
    "respondedById" TEXT,
    "rejectionNote" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "escalatedShippingIssueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CancellationRequest_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CancellationRequest_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CancellationRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CancellationRequest_escalatedShippingIssueId_fkey" FOREIGN KEY ("escalatedShippingIssueId") REFERENCES "ShippingIssue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "iban" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WithdrawalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BulkBuybackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buybackRequestId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "approvedQuantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BulkBuybackItem_buybackRequestId_fkey" FOREIGN KEY ("buybackRequestId") REFERENCES "BuybackRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobName" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "triggeredBy" TEXT
);

-- CreateTable
CREATE TABLE "BundleProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "requestInsuredShipping" BOOLEAN NOT NULL DEFAULT false,
    "paymentMode" TEXT NOT NULL DEFAULT 'PLATFORM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT,
    "paymentDeadline" DATETIME,
    "expiresAt" DATETIME,
    "pickupReservationExpiresAt" DATETIME,
    "parentProposalId" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BundleProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BundleProposal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BundleProposal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BundleProposal_parentProposalId_fkey" FOREIGN KEY ("parentProposalId") REFERENCES "BundleProposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleProposalListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleProposalId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "priceSnapshot" REAL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemIds" TEXT,
    CONSTRAINT "BundleProposalListing_bundleProposalId_fkey" FOREIGN KEY ("bundleProposalId") REFERENCES "BundleProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleProposalListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingBundleId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "priceSnapshot" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundleListing_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PickupSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shippingBundleId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedFor" DATETIME NOT NULL,
    "windowStart" TEXT NOT NULL,
    "windowEnd" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "pickupCode" TEXT NOT NULL,
    "pickupCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "pickupLockedUntil" DATETIME,
    "respondedAt" DATETIME,
    "completedAt" DATETIME,
    "reminderSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PickupSchedule_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PickupSchedule_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingCardItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardSetId" TEXT,
    "tcgdexId" TEXT,
    "condition" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "buyerId" TEXT,
    "soldAt" DATETIME,
    "shippingBundleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListingCardItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingCardItem_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionRunnerUpOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "bidAmount" REAL NOT NULL,
    "premiumAmount" REAL NOT NULL,
    "deliveryChoice" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_DECISION',
    "decisionDeadline" DATETIME NOT NULL,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionRunnerUpOffer_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuctionRunnerUpOffer_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingPlatformFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "originalAmount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "relatedAuctionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    CONSTRAINT "PendingPlatformFee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageModerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "context" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageModerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeV2" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reasonCategory" TEXT NOT NULL,
    "reasonSubCategory" TEXT,
    "buyerStatement" TEXT NOT NULL,
    "sellerStatement" TEXT,
    "evidenceBuyer" TEXT NOT NULL DEFAULT '[]',
    "evidenceSeller" TEXT NOT NULL DEFAULT '[]',
    "proposedRefund" REAL,
    "proposedById" TEXT,
    "finalRefund" REAL,
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "adminId" TEXT,
    "adminNotes" TEXT,
    "adminSLADeadline" DATETIME,
    "responseDeadline" DATETIME NOT NULL,
    "buyerReviewDeadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "escalatedFromShippingIssueId" TEXT,
    CONSTRAINT "DisputeV2_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ShippingBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisputeV2_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisputeV2_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisputeV2_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisputeV2_escalatedFromShippingIssueId_fkey" FOREIGN KEY ("escalatedFromShippingIssueId") REFERENCES "ShippingIssue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeV2Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "message" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisputeV2Event_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "DisputeV2" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DisputeV2Event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShippingIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "adminId" TEXT,
    "goodwillTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ShippingIssue_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ShippingBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingIssue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingIssue_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "User_bankTransferReference_key" ON "User"("bankTransferReference");

-- CreateIndex
CREATE UNIQUE INDEX "User_shopSlug_key" ON "User"("shopSlug");

-- CreateIndex
CREATE INDEX "SellerShippingMethod_sellerId_idx" ON "SellerShippingMethod"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerShippingMethod_sellerId_service_zone_key" ON "SellerShippingMethod"("sellerId", "service", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Series_tcgdexSeriesId_key" ON "Series"("tcgdexSeriesId");

-- CreateIndex
CREATE INDEX "Series_categoryId_idx" ON "Series"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_tcgdexSetId_key" ON "CardSet"("tcgdexSetId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_pokewalletSetId_key" ON "CardSet"("pokewalletSetId");

-- CreateIndex
CREATE INDEX "CardSet_seriesId_idx" ON "CardSet"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_pokewalletId_key" ON "Card"("pokewalletId");

-- CreateIndex
CREATE INDEX "Card_cardSetId_idx" ON "Card"("cardSetId");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_searchName_idx" ON "Card"("searchName");

-- CreateIndex
CREATE INDEX "Card_priceUpdatedAt_idx" ON "Card"("priceUpdatedAt");

-- CreateIndex
CREATE INDEX "Card_lastViewedAt_idx" ON "Card"("lastViewedAt");

-- CreateIndex
CREATE INDEX "CardPriceHistory_cardId_idx" ON "CardPriceHistory"("cardId");

-- CreateIndex
CREATE INDEX "CardPriceHistory_date_idx" ON "CardPriceHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CardPriceHistory_cardId_date_key" ON "CardPriceHistory"("cardId", "date");

-- CreateIndex
CREATE INDEX "CardWatchlist_userId_idx" ON "CardWatchlist"("userId");

-- CreateIndex
CREATE INDEX "CardWatchlist_cardId_idx" ON "CardWatchlist"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardWatchlist_userId_cardId_key" ON "CardWatchlist"("userId", "cardId");

-- CreateIndex
CREATE INDEX "Auction_sellerId_idx" ON "Auction"("sellerId");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "Auction_cardSetId_idx" ON "Auction"("cardSetId");

-- CreateIndex
CREATE INDEX "Auction_tcgdexId_idx" ON "Auction"("tcgdexId");

-- CreateIndex
CREATE INDEX "Auction_status_startTime_idx" ON "Auction"("status", "startTime");

-- CreateIndex
CREATE INDEX "AuctionLabel_auctionId_idx" ON "AuctionLabel"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionUpsell_auctionId_idx" ON "AuctionUpsell"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionUpsell_type_expiresAt_idx" ON "AuctionUpsell"("type", "expiresAt");

-- CreateIndex
CREATE INDEX "AuctionShippingMethod_auctionId_idx" ON "AuctionShippingMethod"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionShippingMethod_auctionId_shippingMethodId_key" ON "AuctionShippingMethod"("auctionId", "shippingMethodId");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_amount_idx" ON "AuctionBid"("auctionId", "amount");

-- CreateIndex
CREATE INDEX "AuctionBid_bidderId_idx" ON "AuctionBid"("bidderId");

-- CreateIndex
CREATE INDEX "Claimsale_sellerId_idx" ON "Claimsale"("sellerId");

-- CreateIndex
CREATE INDEX "Claimsale_status_idx" ON "Claimsale"("status");

-- CreateIndex
CREATE INDEX "Claimsale_status_startTime_idx" ON "Claimsale"("status", "startTime");

-- CreateIndex
CREATE INDEX "ClaimsaleUpsell_claimsaleId_idx" ON "ClaimsaleUpsell"("claimsaleId");

-- CreateIndex
CREATE INDEX "ClaimsaleUpsell_type_expiresAt_idx" ON "ClaimsaleUpsell"("type", "expiresAt");

-- CreateIndex
CREATE INDEX "ClaimsaleLabel_claimsaleId_idx" ON "ClaimsaleLabel"("claimsaleId");

-- CreateIndex
CREATE INDEX "ClaimsaleShippingMethod_claimsaleId_idx" ON "ClaimsaleShippingMethod"("claimsaleId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimsaleShippingMethod_claimsaleId_shippingMethodId_key" ON "ClaimsaleShippingMethod"("claimsaleId", "shippingMethodId");

-- CreateIndex
CREATE INDEX "ClaimsaleItem_claimsaleId_idx" ON "ClaimsaleItem"("claimsaleId");

-- CreateIndex
CREATE INDEX "ClaimsaleItem_cardSetId_idx" ON "ClaimsaleItem"("cardSetId");

-- CreateIndex
CREATE INDEX "ClaimsaleItem_buyerId_idx" ON "ClaimsaleItem"("buyerId");

-- CreateIndex
CREATE INDEX "ClaimsaleItem_claimedById_idx" ON "ClaimsaleItem"("claimedById");

-- CreateIndex
CREATE INDEX "ClaimsaleItem_status_idx" ON "ClaimsaleItem"("status");

-- CreateIndex
CREATE INDEX "ClaimsaleItem_tcgdexId_idx" ON "ClaimsaleItem"("tcgdexId");

-- CreateIndex
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_cardSetId_idx" ON "Listing"("cardSetId");

-- CreateIndex
CREATE INDEX "Listing_listingType_idx" ON "Listing"("listingType");

-- CreateIndex
CREATE INDEX "Listing_tcgdexId_idx" ON "Listing"("tcgdexId");

-- CreateIndex
CREATE INDEX "ListingLabel_listingId_idx" ON "ListingLabel"("listingId");

-- CreateIndex
CREATE INDEX "ListingShippingMethod_listingId_idx" ON "ListingShippingMethod"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingShippingMethod_listingId_shippingMethodId_key" ON "ListingShippingMethod"("listingId", "shippingMethodId");

-- CreateIndex
CREATE INDEX "ListingUpsell_listingId_idx" ON "ListingUpsell"("listingId");

-- CreateIndex
CREATE INDEX "ListingUpsell_type_expiresAt_idx" ON "ListingUpsell"("type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingBundle_orderNumber_key" ON "ShippingBundle"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingBundle_auctionId_key" ON "ShippingBundle"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingBundle_listingId_key" ON "ShippingBundle"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingBundle_bundleProposalId_key" ON "ShippingBundle"("bundleProposalId");

-- CreateIndex
CREATE INDEX "ShippingBundle_buyerId_idx" ON "ShippingBundle"("buyerId");

-- CreateIndex
CREATE INDEX "ShippingBundle_sellerId_idx" ON "ShippingBundle"("sellerId");

-- CreateIndex
CREATE INDEX "ShippingBundle_buyerId_sellerId_status_idx" ON "ShippingBundle"("buyerId", "sellerId", "status");

-- CreateIndex
CREATE INDEX "ShippingBundle_paymentMode_status_idx" ON "ShippingBundle"("paymentMode", "status");

-- CreateIndex
CREATE INDEX "ShippingBundle_pickupReservationExpiresAt_idx" ON "ShippingBundle"("pickupReservationExpiresAt");

-- CreateIndex
CREATE INDEX "ShippingBundle_status_imagesPurgedAt_idx" ON "ShippingBundle"("status", "imagesPurgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_shippingBundleId_key" ON "Dispute"("shippingBundleId");

-- CreateIndex
CREATE INDEX "Dispute_openedById_idx" ON "Dispute"("openedById");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "DisputeEvent_disputeId_idx" ON "DisputeEvent"("disputeId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_auctionId_idx" ON "Conversation"("auctionId");

-- CreateIndex
CREATE INDEX "Conversation_claimsaleId_idx" ON "Conversation"("claimsaleId");

-- CreateIndex
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_userId_conversationId_key" ON "ConversationParticipant"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Proposal_listingId_idx" ON "Proposal"("listingId");

-- CreateIndex
CREATE INDEX "Proposal_conversationId_idx" ON "Proposal"("conversationId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_auctionId_key" ON "Watchlist"("userId", "auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_claimsaleId_key" ON "Watchlist"("userId", "claimsaleId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_listingId_key" ON "Watchlist"("userId", "listingId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_sellerId_idx" ON "Review"("sellerId");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "AutoBid_auctionId_isActive_idx" ON "AutoBid"("auctionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AutoBid_userId_auctionId_key" ON "AutoBid"("userId", "auctionId");

-- CreateIndex
CREATE INDEX "CartItem_userId_idx" ON "CartItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_claimsaleItemId_key" ON "CartItem"("userId", "claimsaleItemId");

-- CreateIndex
CREATE INDEX "EnterpriseRequest_userId_status_idx" ON "EnterpriseRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseRequest_status_createdAt_idx" ON "EnterpriseRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_expiresAt_idx" ON "Subscription"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_paymentStatus_gracePeriodEnd_idx" ON "Subscription"("paymentStatus", "gracePeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");

-- CreateIndex
CREATE INDEX "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");

-- CreateIndex
CREATE INDEX "VerificationRequest_type_idx" ON "VerificationRequest"("type");

-- CreateIndex
CREATE INDEX "UsernameHistory_userId_idx" ON "UsernameHistory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticBundle_key_key" ON "CosmeticBundle"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItem_key_key" ON "CosmeticItem"("key");

-- CreateIndex
CREATE INDEX "CosmeticItem_bundleId_idx" ON "CosmeticItem"("bundleId");

-- CreateIndex
CREATE INDEX "CosmeticItem_type_idx" ON "CosmeticItem"("type");

-- CreateIndex
CREATE INDEX "CosmeticItem_rarity_idx" ON "CosmeticItem"("rarity");

-- CreateIndex
CREATE INDEX "OwnedItem_userId_idx" ON "OwnedItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedItem_userId_itemId_key" ON "OwnedItem"("userId", "itemId");

-- CreateIndex
CREATE INDEX "EmberTransaction_userId_idx" ON "EmberTransaction"("userId");

-- CreateIndex
CREATE INDEX "EmberTransaction_createdAt_idx" ON "EmberTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_action_createdAt_idx" ON "ActivityLog"("userId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");

-- CreateIndex
CREATE INDEX "AchievementTier_achievementKey_idx" ON "AchievementTier"("achievementKey");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementTier_achievementKey_tier_key" ON "AchievementTier"("achievementKey", "tier");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementKey_idx" ON "UserAchievement"("achievementKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementKey_key" ON "UserAchievement"("userId", "achievementKey");

-- CreateIndex
CREATE INDEX "BuybackRequest_userId_idx" ON "BuybackRequest"("userId");

-- CreateIndex
CREATE INDEX "BuybackRequest_status_idx" ON "BuybackRequest"("status");

-- CreateIndex
CREATE INDEX "BuybackRequest_type_idx" ON "BuybackRequest"("type");

-- CreateIndex
CREATE INDEX "BuybackRequest_createdAt_idx" ON "BuybackRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BuybackItem_buybackRequestId_idx" ON "BuybackItem"("buybackRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationRequest_escalatedShippingIssueId_key" ON "CancellationRequest"("escalatedShippingIssueId");

-- CreateIndex
CREATE INDEX "CancellationRequest_shippingBundleId_idx" ON "CancellationRequest"("shippingBundleId");

-- CreateIndex
CREATE INDEX "CancellationRequest_proposedById_idx" ON "CancellationRequest"("proposedById");

-- CreateIndex
CREATE INDEX "CancellationRequest_status_idx" ON "CancellationRequest"("status");

-- CreateIndex
CREATE INDEX "CancellationRequest_expiresAt_idx" ON "CancellationRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "UserReport_reporterId_idx" ON "UserReport"("reporterId");

-- CreateIndex
CREATE INDEX "UserReport_reportedId_idx" ON "UserReport"("reportedId");

-- CreateIndex
CREATE INDEX "UserReport_status_idx" ON "UserReport"("status");

-- CreateIndex
CREATE INDEX "UserReport_createdAt_idx" ON "UserReport"("createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_idx" ON "WithdrawalRequest"("userId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_createdAt_idx" ON "WithdrawalRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BulkBuybackItem_buybackRequestId_idx" ON "BulkBuybackItem"("buybackRequestId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorType_idx" ON "AdminAuditLog"("actorType");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CronRun_jobName_startedAt_idx" ON "CronRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "CronRun_status_idx" ON "CronRun"("status");

-- CreateIndex
CREATE INDEX "BundleProposal_conversationId_idx" ON "BundleProposal"("conversationId");

-- CreateIndex
CREATE INDEX "BundleProposal_status_idx" ON "BundleProposal"("status");

-- CreateIndex
CREATE INDEX "BundleProposal_buyerId_idx" ON "BundleProposal"("buyerId");

-- CreateIndex
CREATE INDEX "BundleProposal_sellerId_idx" ON "BundleProposal"("sellerId");

-- CreateIndex
CREATE INDEX "BundleProposal_status_expiresAt_idx" ON "BundleProposal"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BundleProposalListing_listingId_idx" ON "BundleProposalListing"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleProposalListing_bundleProposalId_listingId_key" ON "BundleProposalListing"("bundleProposalId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleListing_listingId_key" ON "BundleListing"("listingId");

-- CreateIndex
CREATE INDEX "BundleListing_shippingBundleId_idx" ON "BundleListing"("shippingBundleId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupSchedule_shippingBundleId_key" ON "PickupSchedule"("shippingBundleId");

-- CreateIndex
CREATE INDEX "PickupSchedule_shippingBundleId_status_idx" ON "PickupSchedule"("shippingBundleId", "status");

-- CreateIndex
CREATE INDEX "PickupSchedule_status_proposedFor_idx" ON "PickupSchedule"("status", "proposedFor");

-- CreateIndex
CREATE INDEX "ListingCardItem_listingId_status_idx" ON "ListingCardItem"("listingId", "status");

-- CreateIndex
CREATE INDEX "ListingCardItem_shippingBundleId_idx" ON "ListingCardItem"("shippingBundleId");

-- CreateIndex
CREATE INDEX "AuctionRunnerUpOffer_auctionId_status_idx" ON "AuctionRunnerUpOffer"("auctionId", "status");

-- CreateIndex
CREATE INDEX "AuctionRunnerUpOffer_bidderId_status_idx" ON "AuctionRunnerUpOffer"("bidderId", "status");

-- CreateIndex
CREATE INDEX "PendingPlatformFee_userId_settledAt_idx" ON "PendingPlatformFee"("userId", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "ImageModerationLog_userId_createdAt_idx" ON "ImageModerationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageModerationLog_verdict_createdAt_idx" ON "ImageModerationLog"("verdict", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeV2_bundleId_key" ON "DisputeV2"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeV2_escalatedFromShippingIssueId_key" ON "DisputeV2"("escalatedFromShippingIssueId");

-- CreateIndex
CREATE INDEX "DisputeV2_buyerId_idx" ON "DisputeV2"("buyerId");

-- CreateIndex
CREATE INDEX "DisputeV2_sellerId_idx" ON "DisputeV2"("sellerId");

-- CreateIndex
CREATE INDEX "DisputeV2_status_idx" ON "DisputeV2"("status");

-- CreateIndex
CREATE INDEX "DisputeV2_adminSLADeadline_idx" ON "DisputeV2"("adminSLADeadline");

-- CreateIndex
CREATE INDEX "DisputeV2Event_disputeId_idx" ON "DisputeV2Event"("disputeId");

-- CreateIndex
CREATE INDEX "ShippingIssue_bundleId_idx" ON "ShippingIssue"("bundleId");

-- CreateIndex
CREATE INDEX "ShippingIssue_reporterId_idx" ON "ShippingIssue"("reporterId");

-- CreateIndex
CREATE INDEX "ShippingIssue_status_idx" ON "ShippingIssue"("status");

