"use client";

import { useTranslations } from "next-intl";
import { ImageUploader } from "@/components/ui/image-uploader";
import type { ListingType } from "@/types";

const MAX_IMAGES: Record<ListingType, number> = {
  SINGLE_CARD: 10,
  MULTI_CARD: 20,
  COLLECTION: 35,
  SEALED_PRODUCT: 10,
  OTHER: 15,
};

const TIP_KEYS: Record<ListingType, string> = {
  SINGLE_CARD: "photoTipSingleCard",
  MULTI_CARD: "photoTipMultiCard",
  COLLECTION: "photoTipCollection",
  SEALED_PRODUCT: "photoTipSealed",
  OTHER: "photoTipOther",
};

interface StepPhotosProps {
  listingType: ListingType;
  images: string[];
  onChange: (images: string[]) => void;
}

export function StepPhotos({ listingType, images, onChange }: StepPhotosProps) {
  const t = useTranslations("listing");
  const maxImages = MAX_IMAGES[listingType];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("photos")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("photoMinRequired")} {t("photoRecommend")}
        </p>
      </div>

      <div className="glass-subtle rounded-xl p-3 text-sm text-muted-foreground">
        {t(TIP_KEYS[listingType])}
      </div>

      <ImageUploader images={images} onChange={onChange} maxImages={maxImages} />
    </div>
  );
}
