"use client";

import { getFullName } from "@/lib/user-name";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useTranslations } from "next-intl";
import { StarRating } from "@/components/ui/star-rating";
import { useState } from "react";
import { respondToReview } from "@/actions/review";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  sellerResponse: string | null;
  createdAt: Date;
  reviewer: {
    displayName: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl: string | null;
  };
};

interface ReviewListProps {
  reviews: ReviewItem[];
  isOwner?: boolean;
}

export function ReviewList({ reviews, isOwner = false }: ReviewListProps) {
  const t = useTranslations("reputation");

  if (reviews.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">{t("noReviews")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewItem key={review.id} review={review} isOwner={isOwner} />
      ))}
    </div>
  );
}

function ReviewItem({ review, isOwner }: { review: ReviewItem; isOwner: boolean }) {
  const t = useTranslations("reputation");
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [response, setResponse] = useState(review.sellerResponse || "");
  const [submitting, setSubmitting] = useState(false);

  async function handleRespond() {
    if (!response.trim()) return;
    setSubmitting(true);
    try {
      await respondToReview(review.id, response);
      setShowResponseForm(false);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  const dateStr = new Date(review.createdAt).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="glass-subtle rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar src={review.reviewer.avatarUrl} name={getFullName(review.reviewer)} size="sm" />
          <div>
            <span className="font-semibold text-foreground">{getFullName(review.reviewer)}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">@{review.reviewer.displayName}</span>
            <span className="ml-2 text-xs text-muted-foreground">{dateStr}</span>
          </div>
        </div>
        <StarRating value={review.rating} size="sm" readonly />
      </div>

      {review.comment && (
        <p className="mt-2 text-sm text-foreground">{review.comment}</p>
      )}

      {review.sellerResponse && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">{t("sellerResponse")}</p>
          <p className="mt-1 text-sm text-foreground">{review.sellerResponse}</p>
        </div>
      )}

      {isOwner && !review.sellerResponse && (
        <>
          {!showResponseForm ? (
            <button
              onClick={() => setShowResponseForm(true)}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              {t("respond")}
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="glass-input w-full rounded-xl p-3 text-sm"
                rows={2}
                placeholder={t("responsePlaceholder")}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRespond}
                  disabled={submitting}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {t("sendResponse")}
                </button>
                <button
                  onClick={() => setShowResponseForm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
