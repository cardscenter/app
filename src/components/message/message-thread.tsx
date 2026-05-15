"use client";

import { sendMessage } from "@/actions/message";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, ImagePlus, X, Package, ShoppingBasket } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ProposalButton } from "@/components/message/proposal-button";
import { ProposalMessage } from "@/components/message/proposal-message";
import { BundleOfferMessage, type BundleProposalData } from "@/components/message/bundle-offer-message";
import { BundleOfferForm } from "@/components/message/bundle-offer-form";
import { PartialSaleForm } from "@/components/message/partial-sale-form";
import { useChatPolling, type PolledPickupState } from "@/hooks/use-chat-polling";
import { containsPickupCodeShape } from "@/lib/pickup-config";
import { toast } from "sonner";

type Message = {
  id: string;
  body: string;
  imageUrl?: string | null;
  senderName: string;
  senderId: string;
  createdAt: string;
  proposalId?: string | null;
  bundleProposalId?: string | null;
};

// Compacte handtekening van pickup-state om te detecteren of er iets is
// veranderd dat een page-refresh waard is. Identifies only meaningful flips
// (status, schedule status, proposer, time) — niet bv. pickupCodeAttempts.
function pickupSignature(s: PolledPickupState): string {
  return [s.bundleStatus, s.scheduleStatus ?? "_", s.proposedById ?? "_", s.proposedFor ?? "_", s.windowStart ?? "_", s.windowEnd ?? "_"].join("|");
}

type ProposalData = {
  id: string;
  amount: number;
  type: string;
  status: string;
  proposerId: string;
  paymentStatus?: string | null;
  paymentDeadline?: string | null;
};

interface SellerShippingMethodLite {
  id: string;
  carrier: string;
  service: string;
  zone: string;
  effectivePrice: number;
}

type ListingContext = {
  id: string;
  title: string;
  price: number | null;
  shippingCost: number | null;
  status: string;
  sellerId: string;
  listingType: string;
  allowPartialSale: boolean;
};

export function MessageThread({
  conversationId,
  messages,
  currentUserId,
  listingContext,
  proposals,
  bundleProposals,
  otherUserId,
  currentUserSellerShippingMethods,
  contextType,
  availableBalance,
}: {
  conversationId: string;
  messages: Message[];
  currentUserId: string;
  listingContext?: ListingContext | null;
  proposals?: ProposalData[];
  bundleProposals?: BundleProposalData[];
  otherUserId?: string | null;
  currentUserSellerShippingMethods?: SellerShippingMethodLite[];
  contextType?: "auction" | "claimsale" | "listing" | null;
  availableBalance?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("chat");
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prefill message from URL param (e.g. cancel request from purchases page)
  useEffect(() => {
    const prefill = searchParams.get("prefill");
    if (prefill && textareaRef.current) {
      textareaRef.current.value = prefill;
      textareaRef.current.focus();
      // Clean up URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const proposalMap = new Map((proposals ?? []).map((p) => [p.id, p]));
  const bundleProposalMap = new Map((bundleProposals ?? []).map((bp) => [bp.id, bp]));
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [showPartialSaleForm, setShowPartialSaleForm] = useState(false);

  // Live-chat polling (Fase 27.55) — append nieuwe messages aan de
  // initial-load-set. Server-rendered messages blijven onveranderd; nieuwe
  // berichten worden lokaal toegevoegd via state.
  const initialSince = messages.length > 0
    ? messages[messages.length - 1].createdAt
    : new Date(0).toISOString();
  const { newMessages, pickupState } = useChatPolling({
    conversationId,
    initialSince,
  });

  // Bij pickup-state wijziging (bv. tegenpartij accepteert/wijzigt): refresh
  // de hele page zodat de sticky widget + bundle-statusses opnieuw worden
  // opgehaald met de nieuwste data. Gebeurt zelden — alleen bij echte
  // status-flips, niet elke poll.
  const lastPickupSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!pickupState) {
      if (lastPickupSignature.current !== null) {
        lastPickupSignature.current = null;
        router.refresh();
      }
      return;
    }
    const signature = pickupSignature(pickupState);
    if (lastPickupSignature.current !== null && lastPickupSignature.current !== signature) {
      router.refresh();
    }
    lastPickupSignature.current = signature;
  }, [pickupState, router]);

  // Bij elke nieuwe message met proposalId of bundleProposalId: trigger
  // router.refresh() zodat de proposal/bundle-status opnieuw wordt opgehaald
  // (REJECT, ACCEPT, COUNTER, etc.). Zonder dit blijft de chat-bubble bij
  // de andere partij in z'n oude status hangen tot een handmatige reload.
  // Plus: forceer scroll-to-bottom NA de rerender want bundle-bubbles zijn
  // groot en passen niet binnen de standaard auto-scroll-drempel.
  const lastProposalRefreshRef = useRef<string | null>(null);
  useEffect(() => {
    const proposalRelated = newMessages.filter((m) => m.proposalId || m.bundleProposalId);
    if (proposalRelated.length === 0) return;
    const signature = proposalRelated.map((m) => m.id).join("|");
    if (signature !== lastProposalRefreshRef.current) {
      lastProposalRefreshRef.current = signature;
      router.refresh();
      // Wacht 2 frames + 200ms tot de re-rendered bundle-bubble in de DOM zit,
      // dan scroll forced naar bottom. Zonder timeout zou scrollHeight nog
      // de oude waarde kunnen zijn en zou de scroll niet onderaan komen.
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = scrollContainerRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }, 250);
      });
    }
  }, [newMessages, router]);

  // Combineer initial + nieuwe messages, dedupliceer op id (eigen sends
  // komen via router.refresh terug in de initial-set en óók via polling).
  const allMessages = useMemo(() => {
    const seen = new Set(messages.map((m) => m.id));
    const combined: Message[] = [...messages];
    for (const nm of newMessages) {
      if (!seen.has(nm.id)) {
        combined.push({
          id: nm.id,
          body: nm.body,
          imageUrl: nm.imageUrl,
          senderName: nm.senderName,
          senderId: nm.senderId,
          createdAt: nm.createdAt,
          proposalId: nm.proposalId,
          bundleProposalId: nm.bundleProposalId,
        });
        seen.add(nm.id);
      }
    }
    return combined;
  }, [messages, newMessages]);

  // Auto-scroll: bij mount/conversation-switch altijd naar bottom (zoals
  // WhatsApp). Bij nieuwe messages alleen meescrollen als gebruiker al
  // onderaan zat — anders niet onderbreken (oudere berichten lezen).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  // Mount + conversation-switch: scroll altijd naar bottom (geen check).
  // useLayoutEffect zou flicker schelen maar useEffect is genoeg voor MVP.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastMessageCountRef.current = allMessages.length;
    // Disable lint: bewust geen allMessages.length-dep — dit is mount-only
    // per conversation. Updates worden door de andere useEffect afgehandeld.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Nieuwe messages: meescrollen wanneer (a) jij zelf het laatste bericht
  // gestuurd hebt, (b) je binnen 800px van bottom zit, (c) er meerdere
  // messages tegelijk binnenkomen, of (d) het bericht een proposal/bundle is
  // (die zijn primary actie van het moment, dus altijd zichtbaar maken).
  useEffect(() => {
    if (allMessages.length === lastMessageCountRef.current) return;
    const newCount = allMessages.length;
    const prevCount = lastMessageCountRef.current;
    lastMessageCountRef.current = newCount;
    const el = scrollContainerRef.current;
    if (!el) return;
    const lastMessage = allMessages[allMessages.length - 1];
    const isOwnLastMessage = lastMessage?.senderId === currentUserId;
    const isProposalMessage = !!(lastMessage?.proposalId || lastMessage?.bundleProposalId);
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (isOwnLastMessage || isProposalMessage || distanceFromBottom < 800 || newCount > prevCount + 1) {
      el.scrollTop = el.scrollHeight;
      // Tweede scroll na DOM-update voor grote bubbles met images
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }, [allMessages, currentUserId]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    formData.append("context", "chat");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { urls?: string[]; errors?: string[] };
      if (data.urls && data.urls.length > 0) {
        setUploadedImageUrl(data.urls[0]);
      }
      if (data.errors?.length) {
        setImagePreview(null);
        for (const message of data.errors) toast.error(message);
      }
    } catch {
      setImagePreview(null);
      toast.error("Upload mislukt. Probeer het opnieuw.");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setImagePreview(null);
    setUploadedImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Pickup-code-anti-fraude (Fase 27.56): als de buyer/seller een pickup-
  // code-patroon (LCLCC: letter-cijfer-letter-cijfer-cijfer) typt, vragen we expliciete
  // bevestiging vóór versturen. Klassieke fraude: oplichter zegt "stuur de
  // code zodat ik je kan helpen" — koper geeft 'm zonder ooit op te halen,
  // oplichter activeert ergens anders escrow-release.
  const [pickupCodeWarning, setPickupCodeWarning] = useState<{
    body: string;
    imageUrl: string | null;
  } | null>(null);

  async function performSend(body: string, imageUrl: string | null) {
    setLoading(true);
    await sendMessage(conversationId, body, imageUrl || undefined);
    clearImage();
    formRef.current?.reset();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    router.refresh();
    setLoading(false);
  }

  async function handleSend(formData: FormData) {
    const body = (formData.get("body") as string) ?? "";
    if (!body.trim() && !uploadedImageUrl) return;

    // Detecteer pickup-code-patroon → toon waarschuwingsmodal i.p.v. direct sturen
    if (containsPickupCodeShape(body)) {
      setPickupCodeWarning({ body, imageUrl: uploadedImageUrl });
      return;
    }

    await performSend(body, uploadedImageUrl);
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const isSeller = listingContext?.sellerId === currentUserId;

  return (
    <div className="flex h-full flex-col">
      {/* Messages — scrollable area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {allMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
          ) : (
            allMessages.map((msg) => {
              const isOwn = msg.senderId === currentUserId;

              // Render proposal message
              if (msg.proposalId) {
                const proposal = proposalMap.get(msg.proposalId);
                if (proposal) {
                  return (
                    <ProposalMessage
                      key={msg.id}
                      proposal={proposal}
                      currentUserId={currentUserId}
                      conversationId={conversationId}
                      isOwn={isOwn}
                    />
                  );
                }
              }

              // Render bundle-offer message (Fase 27)
              if (msg.bundleProposalId) {
                const bp = bundleProposalMap.get(msg.bundleProposalId);
                if (bp) {
                  return (
                    <BundleOfferMessage
                      key={msg.id}
                      bundleProposal={bp}
                      currentUserId={currentUserId}
                      isOwn={isOwn}
                      sellerShippingMethods={currentUserSellerShippingMethods ?? []}
                    />
                  );
                }
              }

              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                    isOwn
                      ? "bg-primary text-white"
                      : "glass-subtle text-foreground"
                  }`}>
                    <p className={`text-xs font-medium mb-1 ${isOwn ? "text-white/70" : "text-muted-foreground"}`}>{msg.senderName}</p>
                    {msg.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden">
                        <Image
                          src={msg.imageUrl}
                          alt=""
                          width={300}
                          height={300}
                          className="max-w-full h-auto rounded-lg cursor-pointer"
                          onClick={() => window.open(msg.imageUrl!, "_blank")}
                        />
                      </div>
                    )}
                    {msg.body && <p className="text-sm whitespace-pre-wrap">{msg.body}</p>}
                    <p className={`text-[10px] mt-1 ${isOwn ? "text-white/50" : "text-muted-foreground/50"}`}>
                      {new Date(msg.createdAt).toLocaleString("nl-NL")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bundle-offer modal (buyer-only) */}
      {showBundleForm && otherUserId && (
        <BundleOfferForm
          conversationId={conversationId}
          sellerId={otherUserId}
          onClose={() => setShowBundleForm(false)}
        />
      )}

      {/* Partial-sale modal (buyer-only, listing-context required) */}
      {showPartialSaleForm && listingContext && (
        <PartialSaleForm
          conversationId={conversationId}
          listingId={listingContext.id}
          listingTitle={listingContext.title}
          onClose={() => setShowPartialSaleForm(false)}
        />
      )}

      {/* Send form — fixed at bottom */}
      <div className="flex-shrink-0 border-t border-border bg-background px-4 py-3">
        {/* Image preview */}
        {imagePreview && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              <img src={imagePreview} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {uploading && (
              <span className="text-xs text-muted-foreground">{t("photoUploading")}</span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Photo upload */}
          <label className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted/50 transition-colors" title={t("attachPhoto")}>
            <ImagePlus className="h-5 w-5" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>

          {/* Proposal button — listing conversations (active) + direct messages (no context) */}
          {contextType !== "auction" && contextType !== "claimsale" && (
            listingContext ? (
              listingContext.status === "ACTIVE" && (
                <ProposalButton
                  conversationId={conversationId}
                  listingTitle={listingContext.title}
                  listingPrice={listingContext.price}
                  listingShippingCost={listingContext.shippingCost}
                  isSeller={isSeller}
                  availableBalance={availableBalance}
                />
              )
            ) : (
              <ProposalButton
                conversationId={conversationId}
                isSeller={false}
                availableBalance={availableBalance}
              />
            )
          )}

          {/* Bundle-offer button — alleen buyer (= niet seller van listingContext)
              en alleen bij chats met een seller-tegenpartij (Fase 27) */}
          {!isSeller && otherUserId && contextType !== "auction" && contextType !== "claimsale" && (
            <button
              type="button"
              onClick={() => setShowBundleForm(true)}
              title={t("bundleOffer")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Package className="h-5 w-5" />
            </button>
          )}

          {/* Partial-sale button — buyer in chat met een MULTI_CARD listing
              die allowPartialSale=true heeft (Fase 27.13) */}
          {!isSeller
            && listingContext
            && listingContext.listingType === "MULTI_CARD"
            && listingContext.allowPartialSale
            && (listingContext.status === "ACTIVE" || listingContext.status === "PARTIALLY_SOLD") && (
            <button
              type="button"
              onClick={() => setShowPartialSaleForm(true)}
              title={t("partialSale")}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <ShoppingBasket className="h-5 w-5" />
            </button>
          )}

          <form ref={formRef} action={handleSend} className="flex flex-1 items-end gap-2">
            <textarea
              ref={textareaRef}
              name="body"
              rows={1}
              placeholder={t("messagePlaceholder")}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">{t("send")}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Pickup-code-anti-fraude modal (Fase 27.56) */}
      {pickupCodeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl border border-red-300 dark:border-red-900">
            <h3 className="flex items-center gap-2 text-lg font-bold text-red-700 dark:text-red-300">
              ⚠ {t("pickupCodeWarning.title")}
            </h3>
            <div className="mt-3 space-y-2 text-sm text-foreground">
              <p>{t("pickupCodeWarning.intro")}</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{t("pickupCodeWarning.bullet1")}</li>
                <li>{t("pickupCodeWarning.bullet2")}</li>
                <li>{t("pickupCodeWarning.bullet3")}</li>
              </ul>
              <p className="mt-3 font-medium text-foreground">
                {t("pickupCodeWarning.confirmQuestion")}
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPickupCodeWarning(null)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                {t("pickupCodeWarning.cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const w = pickupCodeWarning;
                  setPickupCodeWarning(null);
                  await performSend(w.body, w.imageUrl);
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                {t("pickupCodeWarning.sendAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
