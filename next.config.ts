import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Telefoon/tablet op het thuisnetwerk mag de dev-server gebruiken (Next 16 blokkeert anders de
  // HMR-websocket en React hydrateert niet: pagina zonder menu en zonder animaties). Het laptop-IP
  // wisselt (DHCP), vandaar de wildcard voor het hele 10.0.0.x-net.
  allowedDevOrigins: ["localhost", "127.0.0.1", "10.0.0.*"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cards-center.nl",
        pathname: "/cdn/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/images.pricecharting.com/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
