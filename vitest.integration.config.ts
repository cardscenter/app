import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

// Integratietests tegen de lokale SQLite (dev.db): draaien de echte
// statusmachine (inschrijven, betalen, wachtlijst, check-in) zonder Next.
// `server-only` wordt gestubd; `@/actions/notification` wordt in de test
// zelf gemockt (trekt anders de hele auth-/mail-keten mee).
//   npm run test:int
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
