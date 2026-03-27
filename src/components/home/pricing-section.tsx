"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircleIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function PricingSection() {
  const t = useTranslations("home");
  const tc = useTranslations("common");

  return (
    <section className="relative overflow-hidden bg-muted/50 py-16 dark:bg-transparent md:py-32">
      {/* Dot grid background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Heading */}
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            {t("pricingTitle")}
          </h1>
          <p className="text-muted-foreground mt-4 text-sm md:text-base">
            {t("pricingSubtitle")}
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="bg-background grid rounded-xl border md:grid-cols-6">
          {/* Free Plan */}
          <div className="flex flex-col justify-between border-b p-6 md:col-span-2 md:border-r md:border-b-0">
            <div className="space-y-4">
              <div>
                <h2 className="inline rounded-[2px] p-1 text-xl font-semibold">
                  {t("planFreeTitle")}
                </h2>
                <span className="my-3 block text-3xl font-bold text-primary">
                  €0
                </span>
                <p className="text-muted-foreground text-sm">
                  {t("planFreeDesc")}
                </p>
              </div>

              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t("getStarted")}
              </Link>

              <div className="bg-border my-6 h-px w-full" />

              <ul className="text-muted-foreground space-y-3 text-sm">
                {[
                  t("planFreeFeature1"),
                  t("planFreeFeature2"),
                  t("planFreeFeature3"),
                  t("planFreeFeature4"),
                  t("planFreeFeature5"),
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="z-10 grid gap-8 overflow-hidden p-6 md:col-span-4 lg:grid-cols-2">
            {/* Pricing + Chart */}
            <div className="flex flex-col justify-between space-y-6">
              <div>
                <h2 className="text-xl font-semibold">{t("planProTitle")}</h2>
                <span className="my-3 block text-3xl font-bold text-primary">
                  {t("planProPrice")}
                </span>
                <p className="text-muted-foreground text-sm">
                  {t("planProDesc")}
                </p>
              </div>
              <div className="bg-muted/30 h-fit w-full rounded-lg border p-2">
                <InterestChart />
              </div>
            </div>
            {/* Features */}
            <div className="relative w-full">
              <div className="text-sm font-medium">{t("planProExtras")}</div>
              <ul className="text-muted-foreground mt-4 space-y-3 text-sm">
                {[
                  t("planProFeature1"),
                  t("planProFeature2"),
                  t("planProFeature3"),
                  t("planProFeature4"),
                  t("planProFeature5"),
                  t("planProFeature6"),
                  t("planProFeature7"),
                  t("planProFeature8"),
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* Call to Action */}
              <div className="mt-10 grid w-full grid-cols-2 gap-2.5">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {t("getStarted")}
                </Link>
                <Link
                  href="/veilingen"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {tc("auctions")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InterestChart() {
  const t = useTranslations("home");

  const chartData = [
    { month: "Jan", interest: 120 },
    { month: "Feb", interest: 180 },
    { month: "Mar", interest: 150 },
    { month: "Apr", interest: 210 },
    { month: "May", interest: 250 },
    { month: "Jun", interest: 300 },
    { month: "Jul", interest: 280 },
    { month: "Aug", interest: 320 },
    { month: "Sep", interest: 340 },
    { month: "Oct", interest: 390 },
    { month: "Nov", interest: 420 },
    { month: "Dec", interest: 500 },
  ];

  const chartConfig = {
    interest: {
      label: t("chartLabel"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="space-y-0 border-b p-3">
        <CardTitle className="text-lg">{t("chartTitle")}</CardTitle>
        <CardDescription className="text-xs">
          {t("chartDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3">
        <ChartContainer config={chartConfig}>
          <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="interest"
              type="monotone"
              stroke="var(--color-interest)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
