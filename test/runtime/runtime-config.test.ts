import { describe, expect, it } from "vitest";

import { loadRuntimeConfig } from "../../src/runtime/runtime-config.js";

describe("loadRuntimeConfig", () => {
  it("loads required configuration and applies server defaults", () => {
    const config = loadRuntimeConfig({
      DATABASE_URL:
        "postgresql://operations:operations@localhost:5432/operations_intelligence",
    });

    expect(config).toEqual({
      databaseUrl:
        "postgresql://operations:operations@localhost:5432/operations_intelligence",
      host: "0.0.0.0",
      port: 3000,
    });
  });

  it("loads an explicitly configured host and port", () => {
    const config = loadRuntimeConfig({
      DATABASE_URL: "postgresql://database.example/operations",
      HOST: "127.0.0.1",
      PORT: "8080",
    });

    expect(config).toEqual({
      databaseUrl: "postgresql://database.example/operations",
      host: "127.0.0.1",
      port: 8080,
    });
  });

  it("rejects missing database configuration", () => {
    expect(() => loadRuntimeConfig({})).toThrow("DATABASE_URL is required");
  });

  it.each(["0", "65536", "3000.5", "not-a-port"])(
    "rejects invalid port %s",
    (port) => {
      expect(() =>
        loadRuntimeConfig({
          DATABASE_URL: "postgresql://database.example/operations",
          PORT: port,
        }),
      ).toThrow(
        `PORT must be an integer between 1 and 65535; received ${port}`,
      );
    },
  );
});
