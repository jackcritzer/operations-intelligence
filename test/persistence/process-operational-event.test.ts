import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { processOperationalEvent } from "../../src/application/process-operational-event.js";
import { AcceptedEventRepository } from "../../src/persistence/accepted-event-repository.js";
import { createDatabasePool } from "../../src/persistence/database.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";
import { inventory } from "../support/operational-event.factories.js";
import { EventIdentityConflictError } from "../../src/application/errors/event-identity-conflict-error.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

if (databaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required for persistence tests");
}

const pool = createDatabasePool(databaseUrl);
const repository = new AcceptedEventRepository(pool);

describe("durable operational-event processing", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
  });

  afterAll(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
    await pool.end();
  });

  it("persists an accepted event before publishing its state", async () => {
    const state = createEmptyOperationalState();
    const event = inventory("CHI", "BRG-440", 4);
    const fingerprint = "inventory-fingerprint";

    const result = await processOperationalEvent(
      state,
      event,
      fingerprint,
      repository,
    );

    const storedEvent = await repository.findByEventId(event.eventId);

    expect(result).toMatchObject({
      eventId: event.eventId,
      status: "APPLIED",
    });

    expect(storedEvent).toMatchObject({
      eventId: event.eventId,
      eventFingerprint: fingerprint,
      eventData: event,
    });

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      warehouseId: "CHI",
      sku: "BRG-440",
      usableQuantity: 4,
    });

    expect(state.processedEventIds).toEqual(new Set([event.eventId]));
  });

  it("classifies an identical persisted event as a duplicate", async () => {
    const state = createEmptyOperationalState();
    const event = inventory("CHI", "BRG-440", 4);
    const fingerprint = "inventory-fingerprint";

    await processOperationalEvent(state, event, fingerprint, repository);

    const duplicateResult = await processOperationalEvent(
      state,
      event,
      fingerprint,
      repository,
    );

    const storedEvents = await repository.listForReplay();

    expect(duplicateResult).toEqual({
      eventId: event.eventId,
      status: "DUPLICATE",
      impact: {
        changedOrders: [],
      },
    });

    expect(storedEvents).toHaveLength(1);

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      usableQuantity: 4,
    });
  });

  it("rejects conflicting content persisted under the same event ID", async () => {
    const state = createEmptyOperationalState();

    const originalEvent = inventory("CHI", "BRG-440", 4);
    const conflictingEvent = inventory("CHI", "BRG-440", 10);

    await processOperationalEvent(
      state,
      originalEvent,
      "original-fingerprint",
      repository,
    );

    await expect(
      processOperationalEvent(
        state,
        conflictingEvent,
        "conflicting-fingerprint",
        repository,
      ),
    ).rejects.toBeInstanceOf(EventIdentityConflictError);

    const storedEvents = await repository.listForReplay();

    expect(storedEvents).toHaveLength(1);

    expect(storedEvents[0]).toMatchObject({
      eventId: originalEvent.eventId,
      eventFingerprint: "original-fingerprint",
      eventData: originalEvent,
    });

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      usableQuantity: 4,
    });
  });
});
