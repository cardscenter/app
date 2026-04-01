"use client";

import { useTranslations } from "next-intl";
import { ImageUploader } from "@/components/ui/image-uploader";
import type { AuctionType } from "@/types";

const MAX_IMAGES: Record<AuctionType, number> = {
  SINGLE_CARD: 10,
  MULTI_CARD: 15,
  COLLECTION: 20,
  SEALED_PRODUCT: 10,
  OTHER: 10,
};

const TIP_KEYS: Record<AuctionType, string> = {
  SINGLE_CARD: "photoTipSingleCard",
  MULTI_CARD: "photoTipMultiCard",
  COLLECTION: "photoTipCollection",
  SEALED_PRODUCT: "photoTipSealed",
  OTHER: "photoTipOther",
};

interface StepPhotosProps {
  auctionType: AuctionType;
  images: string[];
  onChange: (images: string[]) => void;
}

export function StepPhotos({ auctionType, images, onChange }: StepPhotosProps) {
  const t = useTranslations("auction");
  const maxImages = MAX_IMAGES[auctionType];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("photos")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("photoMinRequired")} {t("photoRecommend")}
        </p>
      </div>

      <div className="glass-subtle rounded-xl p-3 text-sm text-muted-foreground">
        {t(TIP_KEYS[auctionType])}
      </div>

      <ImageUploader images={images} onChange={onChange} maxImages={maxImages} />
    </div>
  );
}
