"use client";

import { useTranslations, useLocale } from "next-intl";
import { deleteShippingMethod, toggleShippingMethod } from "@/actions/shipping-method";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from "lucide-react";
import { ShippingMethodForm } from "./shipping-method-form";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { getCountryName } from "@/lib/shipping/countries";
import type { SellerShippingMethod } from "@prisma/client";

export function ShippingMethodsManager({ methods }: { methods: SellerShippingMethod[] }) {
  const t = useTranslations("shipping");
  const locale = useLocale();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<SellerShippingMethod | null>(null);

  function getCarrierName(carrierId: string) {
    return KNOWN_CARRIERS.find((c) => c.id === carrierId)?.name ?? carrierId;
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const result = await deleteShippingMethod(id);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleToggle(id: string) {
    await toggleShippingMethod(id);
    router.refresh();
  }

  function handleFormDone() {
    setShowForm(false);
    setEditingMethod(null);
    router.refresh();
  }

  if (showForm || editingMethod) {
    return (
      <div className="glass-subtle rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-medium text-foreground">
          {editingMethod ? t("editMethod") : t("addMethod")}
        </h3>
        <ShippingMethodForm method={editingMethod ?? undefined} onDone={handleFormDone} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMethods")}</p>
      ) : (
        methods.map((method) => {
          const countries: string[] = JSON.parse(method.countries);
          return (
            <div
              key={method.id}
              className={`glass-subtle rounded-2xl p-4 ${!method.isActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {getCarrierName(method.carrier)} — {method.serviceName}
                    </p>
                    {method.isDefault && (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {t("defaultBadge")}
                      </span>
                    )}
                    {method.isSigned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <ShieldCheck className="h-3 w-3" />
                        {t("signed")}
                      </span>
                    )}
                    {method.isTracked && !method.isSigned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Shield className="h-3 w-3" />
                        {t("tracked")}
                      </span>
                    )}
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      method.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {method.isActive ? t("active") : t("inactive")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    €{method.price.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {countries.map((c) => getCountryName(c, locale)).join(", ")}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggle(method.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    title={method.isActive ? t("inactive") : t("active")}
                  >
                    <div className={`h-4 w-7 rounded-full transition-colors ${method.isActive ? "bg-green-500" : "bg-muted-foreground"}`}>
                      <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${method.isActive ? "translate-x-3" : "translate-x-0"}`} />
                    </div>
                  </button>
                  <button
                    onClick={() => setEditingMethod(method)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!method.isDefault && (
                    <button
                      onClick={() => handleDelete(method.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" />
        {t("addMethod")}
      </button>
    </div>
  );
}
