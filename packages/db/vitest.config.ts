import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // These are integration tests against a real Postgres; a cold serverless
    // connection is slower than the default unit-test timeout allows.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
