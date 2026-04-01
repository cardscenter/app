"use client";

import { sendMessage } from "@/actions/message";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ProposalButton } from "@/components/message/proposal-button";
import { ProposalMessage } from "@/components/message/proposal-message";

type Message = {
  id: string;
  body: string;
  imageUrl?: string | null;
  senderName: string;
  senderId: string;
  createdAt: string;
  proposalId?: string | null;
};

type ProposalData = {
  id: string;
  amount: number;
  type: string;
  status: string;
  proposerId: string;
  paymentStatus?: string | null;
  paymentDeadline?: string | null;
};

type ListingContext = {
  id: string;
  title: string;
  price: number | null;
  status: string;
  sellerId: string;
};

export function MessageThread({
  conversationId,
  messages,
  currentUserId,
  listingContext,
  proposals,
  contextType,
}: {
  conversationId: string;
  messages: Message[];
  currentUserId: string;
  listingContext?: ListingContext | null;
  proposals?: ProposalData[];
  contextType?: "auction" | "claimsale" | "listing" | null;
}) {
  const router = useRouter();
  const t = useTranslations("chat");
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const proposalMap = new Map((proposals ?? []).map((p) => [p.id, p]));

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls && data.urls.length > 0) {
        setUploadedImageUrl(data.urls[0]);
      }
    } catch {
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setImagePreview(null);
    setUploadedImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(formData: FormData) {
    const body = formData.get("body") as string;
    if (!body.trim() && !uploadedImageUrl) return;
    setLoading(true);
    await sendMessage(conversationId, body, uploadedImageUrl || undefined);
    clearImage();
    formRef.current?.reset();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    router.refresh();
    setLoading(false);
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
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
          ) : (
            messages.map((msg) => {
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

        <form ref={formRef} action={handleSend} className="flex items-end gap-2">
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
                  isSeller={isSeller}
                />
              )
            ) : (
              <ProposalButton
                conversationId={conversationId}
                isSeller={false}
              />
            )
          )}

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
  );
}
