"use client";

import { useTranslations } from "next-intl";
import { CARD_CONDITIONS } from "@/types";
import type { AuctionType } from "@/types";
import type { Series, CardSet } from "@prisma/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

type SeriesWithSets = Series & { cardSets: CardSet[] };

interface StepDetailsProps {
  auctionType: AuctionType;
  seriesList: SeriesWithSets[];
  title: string;
  description: string;
  cardName: string;
  cardSetId: string;
  selectedSeries: string;
  condition: string;
  onChange: (field: string, value: unknown) => void;
}

export function StepDetails({
  auctionType,
  seriesList,
  title,
  description,
  cardName,
  cardSetId,
  selectedSeries,
  condition,
  onChange,
}: StepDetailsProps) {
  const t = useTranslations("auction");
  const ttcg = useTranslations("tcg");

  const series = seriesList.find((s) => s.id === selectedSeries);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepDetails")}</h2>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground">{t("title")}</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => onChange("title", e.target.value)}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t("description")}</label>
        <RichTextEditor
          value={description}
          onChange={(html) => onChange("description", html)}
          rows={4}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>

      {/* SINGLE_CARD specific */}
      {auctionType === "SINGLE_CARD" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">{ttcg("selectSeries")}</label>
              <select
                value={selectedSeries}
                onChange={(e) => {
                  onChange("selectedSeries", e.target.value);
                  onChange("cardSetId", "");
                }}
                className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
              >
                <option value="">--</option>
                {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">{ttcg("selectSet")}</label>
              <select
                value={cardSetId}
                onChange={(e) => onChange("cardSetId", e.target.value)}
                className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
              >
                <option value="">--</option>
                {series?.cardSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cardName" className="block text-sm font-medium text-foreground">{t("cardName")}</label>
            <input
              id="cardName"
              type="text"
              value={cardName}
              onChange={(e) => onChange("cardName", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">{t("condition")}</label>
            <select
              value={condition}
              onChange={(e) => onChange("condition", e.target.value)}
              className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
            >
              {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
