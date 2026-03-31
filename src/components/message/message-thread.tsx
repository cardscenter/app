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
}: {
  conversationId: string;
  messages: Message[];
  currentUserId: string;
  listingContext?: ListingContext | null;
  proposals?: ProposalData[];
}) {
  const router = useRouter();
  const t = useTranslations("chat");
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const proposalMap = new Map((proposals ?? []).map((p) => [p.id, p]));

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setUploadedImageUrl(data.url);
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
    setLoading(true);
    const body = formData.get("body") as string;
    await sendMessage(conversationId, body, uploadedImageUrl || undefined);
    clearImage();
    formRef.current?.reset();
    router.refresh();
    setLoading(false);
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

      {/* Send form — sticky at bottom */}
      <div className="border-t border-border px-4 py-3 sticky bottom-0 bg-background z-10">
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

        <form ref={formRef} action={handleSend} className="flex items-center gap-2">
          {/* Photo upload */}
          <label className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-white/60 dark:hover:bg-white/5 transition-colors" title={t("attachPhoto")}>
            <ImagePlus className="h-5 w-5" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>

          {/* Proposal button */}
          {listingContext && listingContext.status === "ACTIVE" && (
            <ProposalButton
              conversationId={conversationId}
              listingId={listingContext.id}
              listingTitle={listingContext.title}
              listingPrice={listingContext.price}
              isSeller={isSeller}
            />
          )}

          <input
            name="body"
            type="text"
            placeholder={t("messagePlaceholder")}
            className="flex-1 glass-input px-4 py-2.5 text-sm text-foreground"
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
