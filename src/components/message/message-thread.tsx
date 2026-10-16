"use client";

import { sendMessage, markConversationRead } from "@/actions/message";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, ImagePlus, X, Package, ShoppingBasket, AlertTriangle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";
import { ProposalButton } from "@/components/message/proposal-button";
import { ProposalMessage } from "@/components/message/proposal-message";
import { BundleOfferMessage, type BundleProposalData } from "@/components/message/bundle-offer-message";
import { BundleOfferForm } from "@/components/message/bundle-offer-form";
import { PartialSaleForm } from "@/components/message/partial-sale-form";
import { useChatPolling, type PolledPickupState } from "@/hooks/use-chat-polling";
import { containsPickupCodeShape } from "@/lib/pickup-config";
import { toast } from "sonner";

// Chat-thread in TailAdmin-stijl (sept 2026): berichten gegroepeerd per
// afzender (binnen 5 min), datum-scheiders per dag, alleen een tijdstip
// onder het laatste bericht van een groep, vlakke bubbles (eigen = primary,
// ander = muted). Live-berichten van de ander markeren het gesprek direct
// als gelezen zodat de badges in sidebar/header meelopen.

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

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

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
  const format = useFormatter();
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

  // Live binnengekomen bericht van de ander → gesprek als gelezen markeren
  // (server zet lastReadAt en publisht unread-changed voor de badges).
  const lastReadMarkRef = useRef<string | null>(null);
  useEffect(() => {
    const last = [...newMessages].reverse().find((m) => m.senderId !== currentUserId);
    if (!last || lastReadMarkRef.current === last.id) return;
    if (typeof document !== "undefined" && document.hidden) return;
    lastReadMarkRef.current = last.id;
    void markConversationRead(conversationId);
  }, [newMessages, conversationId, currentUserId]);

  // Bij pickup-state wijziging (bv. tegenpartij accepteert/wijzigt): refresh
  // de hele page zodat de sticky widget + bundle-statusses opnieuw worden
  // opgehaald met de nieuwste data.
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

  // Bij elke nieuwe message met proposalId of bundleProposalId: refresh zodat
  // de proposal/bundle-status opnieuw wordt opgehaald, en forceer daarna een
  // scroll-to-bottom (bundle-bubbles zijn groot).
  const lastProposalRefreshRef = useRef<string | null>(null);
  useEffect(() => {
    const proposalRelated = newMessages.filter((m) => m.proposalId || m.bundleProposalId);
    if (proposalRelated.length === 0) return;
    const signature = proposalRelated.map((m) => m.id).join("|");
    if (signature !== lastProposalRefreshRef.current) {
      lastProposalRefreshRef.current = signature;
      router.refresh();
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = scrollContainerRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }, 250);
      });
    }
  }, [newMessages, router]);

  // Combineer initial + nieuwe messages, dedupliceer op id.
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  // Mount + conversation-switch: altijd naar bottom.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    lastMessageCountRef.current = allMessages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Nieuwe messages: meescrollen als jij het stuurde, je bijna onderaan zat,
  // er meerdere tegelijk binnenkomen, of het een proposal/bundle is.
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

  // Pickup-code-anti-fraude (Fase 27.56): expliciete bevestiging vóór het
  // versturen van iets dat op een ophaalcode lijkt.
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

  function dayLabel(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return t("today");
    if (d.toDateString() === yesterday.toDateString()) return t("yesterday");
    return format.dateTime(d, {
      day: "numeric",
      month: "long",
      ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    });
  }

  const isRich = (m: Message) => !!(m.proposalId || m.bundleProposalId);

  const toolButton =
    "flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Berichten — scrollbaar */}
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        {allMessages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          allMessages.map((msg, i) => {
            const isOwn = msg.senderId === currentUserId;
            const prev = allMessages[i - 1];
            const next = allMessages[i + 1];
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt);
            const startsGroup =
              newDay ||
              prev.senderId !== msg.senderId ||
              isRich(prev) ||
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_WINDOW_MS;
            const endsGroup =
              !next ||
              next.senderId !== msg.senderId ||
              isRich(next) ||
              dayKey(next.createdAt) !== dayKey(msg.createdAt) ||
              new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > GROUP_WINDOW_MS;

            const separator = newDay ? (
              <div className="my-4 flex items-center gap-3 first:mt-0">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {dayLabel(msg.createdAt)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null;

            // Proposal-bubble
            if (msg.proposalId) {
              const proposal = proposalMap.get(msg.proposalId);
              if (proposal) {
                return (
                  <div key={msg.id} className="mt-3 first:mt-0">
                    {separator}
                    <ProposalMessage
                      proposal={proposal}
                      currentUserId={currentUserId}
                      conversationId={conversationId}
                      isOwn={isOwn}
                    />
                  </div>
                );
              }
            }

            // Bundle-offer-bubble (Fase 27)
            if (msg.bundleProposalId) {
              const bp = bundleProposalMap.get(msg.bundleProposalId);
              if (bp) {
                return (
                  <div key={msg.id} className="mt-3 first:mt-0">
                    {separator}
                    <BundleOfferMessage
                      bundleProposal={bp}
                      currentUserId={currentUserId}
                      isOwn={isOwn}
                      sellerShippingMethods={currentUserSellerShippingMethods ?? []}
                    />
                  </div>
                );
              }
            }

            return (
              <div key={msg.id} className={startsGroup ? "mt-3 first:mt-0" : "mt-1"}>
                {separator}
                <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[78%] flex-col md:max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                    {startsGroup && !isOwn && (
                      <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{msg.senderName}</p>
                    )}
                    <div
                      className={`px-3.5 py-2 text-sm ${
                        isOwn
                          ? `rounded-md bg-primary text-primary-foreground ${endsGroup ? "rounded-br-sm" : ""}`
                          : `rounded-md bg-muted text-foreground ${endsGroup ? "rounded-bl-sm" : ""}`
                      }`}
                    >
                      {msg.imageUrl && (
                        <div className={`overflow-hidden rounded ${msg.body ? "mb-2" : ""}`}>
                          <Image
                            src={msg.imageUrl}
                            alt=""
                            width={320}
                            height={320}
                            className="h-auto max-w-full cursor-zoom-in rounded"
                            onClick={() => window.open(msg.imageUrl!, "_blank")}
                          />
                        </div>
                      )}
                      {msg.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>}
                    </div>
                    {endsGroup && (
                      <p className="mt-1 px-1 text-[10px] tabular-nums text-muted-foreground">
                        {format.dateTime(new Date(msg.createdAt), { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-card px-3 py-3">
        {imagePreview && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" className="size-16 rounded-md border border-border object-cover" />
              <button
                type="button"
                onClick={clearImage}
                aria-label={t("pickupCodeWarning.cancel")}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
            {uploading && <span className="text-xs text-muted-foreground">{t("photoUploading")}</span>}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <label className={`${toolButton} cursor-pointer`} title={t("attachPhoto")}>
            <ImagePlus className="size-5" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>

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

          {!isSeller && otherUserId && contextType !== "auction" && contextType !== "claimsale" && (
            <button type="button" onClick={() => setShowBundleForm(true)} title={t("bundleOffer")} className={toolButton}>
              <Package className="size-5" />
            </button>
          )}

          {!isSeller
            && listingContext
            && listingContext.listingType === "MULTI_CARD"
            && listingContext.allowPartialSale
            && (listingContext.status === "ACTIVE" || listingContext.status === "PARTIALLY_SOLD") && (
            <button type="button" onClick={() => setShowPartialSaleForm(true)} title={t("partialSale")} className={toolButton}>
              <ShoppingBasket className="size-5" />
            </button>
          )}

          <form ref={formRef} action={handleSend} className="flex min-w-0 flex-1 items-end gap-2">
            <textarea
              ref={textareaRef}
              name="body"
              rows={1}
              placeholder={t("messagePlaceholder")}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              className="min-h-9 flex-1 resize-none rounded-[14px] border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || uploading}
              className="cc-pill flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Send className="size-4" />
              <span className="hidden sm:inline">{t("send")}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Pickup-code-anti-fraude modal (Fase 27.56) */}
      {pickupCodeWarning && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-dash border border-red-500/40 bg-card p-5 shadow-2xl">
            <h3 className="flex items-center gap-2 text-base font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="size-5 shrink-0" />
              {t("pickupCodeWarning.title")}
            </h3>
            <div className="mt-3 space-y-2 text-sm text-foreground">
              <p>{t("pickupCodeWarning.intro")}</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>{t("pickupCodeWarning.bullet1")}</li>
                <li>{t("pickupCodeWarning.bullet2")}</li>
                <li>{t("pickupCodeWarning.bullet3")}</li>
              </ul>
              <p className="mt-3 font-medium text-foreground">{t("pickupCodeWarning.confirmQuestion")}</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPickupCodeWarning(null)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
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
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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
