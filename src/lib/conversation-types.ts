// Gedeelde, import-vrije types voor de berichten-module (client én server).

export type ConversationContextType = "auction" | "claimsale" | "listing";

export type ConversationPreview = {
  id: string;
  otherUserId: string | null;
  otherUserName: string;
  otherUserInitial: string;
  otherUserAvatar: string | null;
  lastMessage: string | null;
  /** ISO-timestamp van het laatste bericht (client formatteert locale-bewust). */
  lastMessageAt: string | null;
  lastMessageFromMe: boolean;
  context: string | null;
  contextType: ConversationContextType | null;
  hasUnread: boolean;
  participantStatus: string;
};
