import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Route handlers are server-side code; run them in a Node environment.
    environment: "node",
    include: ["app/**/*.test.ts", "lib/**/*.test.ts"],
  },
  resolve: {
    // Mirror the "@/*" path alias from tsconfig so tests can import "@/lib/...".
    alias: { "@": new URL("./", import.meta.url).pathname },
  },
});
