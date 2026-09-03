import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createEventFingerprint } from "../../src/events/create-event-fingerprint.js";
import { buildApp } from "../../src/http/build-app.js";
import type { InventoryPositionReportedRequest } from "../../src/http/schemas/operational-event.schema.js";
import { AcceptedEventRepository } from "../../src/persistence/accepted-event-repository.js";
import { createDatabasePool } from "../../src/persistence/database.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

if (databaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required for persistence tests");
}

const pool = createDatabasePool(databaseUrl);
const repository = new AcceptedEventRepository(pool);

describe("operational-event HTTP persistence", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
  });

  afterAll(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
    await pool.end();
  });

  it("persists an accepted HTTP event and publishes its state", async () => {
    const state = createEmptyOperationalState();
    const receivedAt = "2026-09-03T12:00:00.000Z";

    const request: InventoryPositionReportedRequest = {
      eventId: "inventory-CHI-BRG-440",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-09-03T11:00:00.000Z",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 4,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    };

    const app = buildApp({
      state,
      eventStore: repository,
      clock: {
        now: () => new Date(receivedAt),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload: request,
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      eventId: request.eventId,
      status: "APPLIED",
    });

    const storedEvent = await repository.findByEventId(request.eventId);

    expect(storedEvent).toMatchObject({
      eventId: request.eventId,
      eventFingerprint: createEventFingerprint(request),
      eventData: {
        ...request,
        receivedAt,
      },
    });

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      warehouseId: "CHI",
      sku: "BRG-440",
      usableQuantity: 4,
      reservedQuantity: 0,
      unusableQuantity: 0,
    });

    await app.close();
  });
});
