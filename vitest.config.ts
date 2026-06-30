import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        // test files
        "src/**/*.test.ts",
        "src/**/*.d.ts",

        // needs Prisma / Supabase — integration-test territory
        "src/app/actions.ts",
        "src/app/auth/actions.ts",
        "src/app/auth/callback/route.ts",
        "src/app/api/**",
        "src/server/**",
        "src/lib/supabase/**",
        "src/lib/prisma.ts",

        // thin wrappers with no logic of their own
        "src/lib/workspace-sync.ts",
        "src/lib/utils.ts",

        // needs Next.js request context
        "src/middleware.ts",

        // needs DOM / window
        "src/components/use-hotkeys.ts"
      ],
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
