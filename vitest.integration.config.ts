import { defineConfig } from "vitest/config";

const localDatabaseUrl =
  "postgresql://operations:operations@localhost:5432/operations_intelligence_test";

export default defineConfig({
  test: {
    include: ["test/persistence/**/*.test.ts"],
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? localDatabaseUrl,
    },
    fileParallelism: false,
  },
});
