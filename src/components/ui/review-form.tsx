"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StarRating } from "@/components/ui/star-rating";
import { createReview } from "@/actions/review";

interface ReviewFormProps {
  sellerId: string;
  auctionId?: string;
  claimsaleItemId?: string;
  listingId?: string;
  onSuccess?: () => void;
}

export function ReviewForm({ sellerId, auctionId, claimsaleItemId, listingId, onSuccess }: ReviewFormProps) {
  const t = useTranslations("reputation");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError(t("selectRating"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("sellerId", sellerId);
      formData.set("rating", rating.toString());
      if (comment) formData.set("comment", comment);
      if (auctionId) formData.set("auctionId", auctionId);
      if (claimsaleItemId) formData.set("claimsaleItemId", claimsaleItemId);
      if (listingId) formData.set("listingId", listingId);

      await createReview(formData);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is iets misgegaan");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="glass-subtle rounded-xl p-4 text-center text-green-600 dark:text-green-400">
        {t("reviewSubmitted")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-subtle space-y-4 rounded-xl p-4">
      <h3 className="font-semibold text-foreground">{t("writeReview")}</h3>

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">{t("yourRating")}</label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">{t("comment")}</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="glass-input w-full rounded-xl p-3 text-sm"
          rows={3}
          placeholder={t("commentPlaceholder")}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("submitReview")}
      </button>
    </form>
  );
}
