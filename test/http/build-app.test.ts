import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/http/build-app.js";
import { createInMemoryAcceptedEventStore } from "../support/accepted-event-store.fake.js";

describe("buildApp", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("builds a Fastify application that can become ready", async () => {
    app = buildApp({
      eventStore: createInMemoryAcceptedEventStore(),
    });

    await app.ready();

    expect(app).toBeDefined();
  });
});
