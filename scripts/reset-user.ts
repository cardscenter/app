import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });
const USERNAME = "atomicsnipz";

async function main() {
  const user = await prisma.user.findFirst({ where: { displayName: USERNAME } });
  if (!user) {
    console.log("User not found:", USERNAME);
    return;
  }

  console.log("Found user:", user.id, user.displayName);
  console.log("Balance:", user.balance, "Reserved:", user.reservedBalance, "Held:", user.heldBalance);

  // Delete in correct order (foreign key constraints)

  // Messages first (references proposals, conversations)
  const msgDel = await prisma.message.deleteMany({ where: { senderId: user.id } });
  console.log("Deleted messages:", msgDel.count);

  // Also delete messages IN conversations where user participates (from other users)
  const userConvos = await prisma.conversationParticipant.findMany({ where: { userId: user.id } });
  const convoIds = userConvos.map(c => c.conversationId);
  if (convoIds.length > 0) {
    const allMsgDel = await prisma.message.deleteMany({ where: { conversationId: { in: convoIds } } });
    console.log("Deleted all messages in conversations:", allMsgDel.count);

    // Proposals in these conversations
    const propDel = await prisma.proposal.deleteMany({ where: { conversationId: { in: convoIds } } });
    console.log("Deleted proposals:", propDel.count);

    // Conversation participants
    const partDel = await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: convoIds } } });
    console.log("Deleted participants:", partDel.count);

    // Conversations themselves
    const convDel = await prisma.conversation.deleteMany({ where: { id: { in: convoIds } } });
    console.log("Deleted conversations:", convDel.count);
  }

  // Auction bids by user
  const bidDel = await prisma.auctionBid.deleteMany({ where: { bidderId: user.id } });
  console.log("Deleted bids:", bidDel.count);

  // AutoBids
  const autoBidDel = await prisma.autoBid.deleteMany({ where: { userId: user.id } });
  console.log("Deleted autobids:", autoBidDel.count);

  // User's auctions (and their bids, shipping methods, upsells)
  const userAuctions = await prisma.auction.findMany({ where: { sellerId: user.id }, select: { id: true } });
  const auctionIds = userAuctions.map(a => a.id);
  if (auctionIds.length > 0) {
    await prisma.auctionBid.deleteMany({ where: { auctionId: { in: auctionIds } } });
    await prisma.auctionShippingMethod.deleteMany({ where: { auctionId: { in: auctionIds } } });
    await prisma.auctionUpsell.deleteMany({ where: { auctionId: { in: auctionIds } } });
    await prisma.autoBid.deleteMany({ where: { auctionId: { in: auctionIds } } });
    const aDel = await prisma.auction.deleteMany({ where: { sellerId: user.id } });
    console.log("Deleted auctions:", aDel.count);
  }

  // User's listings (and their shipping methods, upsells)
  const userListings = await prisma.listing.findMany({ where: { sellerId: user.id }, select: { id: true } });
  const listingIds = userListings.map(l => l.id);
  if (listingIds.length > 0) {
    await prisma.listingShippingMethod.deleteMany({ where: { listingId: { in: listingIds } } });
    await prisma.listingUpsell.deleteMany({ where: { listingId: { in: listingIds } } });
    const lDel = await prisma.listing.deleteMany({ where: { sellerId: user.id } });
    console.log("Deleted listings:", lDel.count);
  }

  // User's claimsales (and their items, shipping methods)
  const userClaimsales = await prisma.claimsale.findMany({ where: { sellerId: user.id }, select: { id: true } });
  const claimsaleIds = userClaimsales.map(c => c.id);
  if (claimsaleIds.length > 0) {
    await prisma.claimsaleItem.deleteMany({ where: { claimsaleId: { in: claimsaleIds } } });
    await prisma.claimsaleShippingMethod.deleteMany({ where: { claimsaleId: { in: claimsaleIds } } });
    const cDel = await prisma.claimsale.deleteMany({ where: { sellerId: user.id } });
    console.log("Deleted claimsales:", cDel.count);
  }

  // Shipping bundles (buyer or seller)
  const sbDel = await prisma.shippingBundle.deleteMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
  });
  console.log("Deleted shipping bundles:", sbDel.count);

  // Other user data
  const txDel = await prisma.transaction.deleteMany({ where: { userId: user.id } });
  console.log("Deleted transactions:", txDel.count);

  const notifDel = await prisma.notification.deleteMany({ where: { userId: user.id } });
  console.log("Deleted notifications:", notifDel.count);

  const wlDel = await prisma.watchlist.deleteMany({ where: { userId: user.id } });
  console.log("Deleted watchlist:", wlDel.count);

  const cartDel = await prisma.cartItem.deleteMany({ where: { userId: user.id } });
  console.log("Deleted cart items:", cartDel.count);

  const revDel = await prisma.review.deleteMany({ where: { OR: [{ reviewerId: user.id }, { sellerId: user.id }] } });
  console.log("Deleted reviews:", revDel.count);

  const subDel = await prisma.subscription.deleteMany({ where: { userId: user.id } });
  console.log("Deleted subscriptions:", subDel.count);

  const verDel = await prisma.verificationRequest.deleteMany({ where: { userId: user.id } });
  console.log("Deleted verification requests:", verDel.count);

  const sellerSmDel = await prisma.sellerShippingMethod.deleteMany({ where: { sellerId: user.id } });
  console.log("Deleted seller shipping methods:", sellerSmDel.count);

  const unhDel = await prisma.usernameHistory.deleteMany({ where: { userId: user.id } });
  console.log("Deleted username history:", unhDel.count);

  // Reset user to fresh state
  await prisma.$executeRawUnsafe(
    `UPDATE User SET balance=0, reservedBalance=0, heldBalance=0, bio=NULL, avatarUrl=NULL, street=NULL, houseNumber=NULL, postalCode=NULL, city=NULL, country=NULL, isVerified=0, verificationStatus='NONE', accountType='FREE', premiumExpiresAt=NULL, lastUsernameChange=NULL WHERE id=?`,
    user.id
  );

  console.log("\nUser", USERNAME, "has been fully reset to fresh state.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
