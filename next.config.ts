import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "10.0.0.11"],
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
    ],
  },
};

export default withNextIntl(nextConfig);
