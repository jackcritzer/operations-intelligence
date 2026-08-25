import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabasePool } from "../../src/persistence/database.js";
import { AcceptedEventRepository } from "../../src/persistence/accepted-event-repository.js";
import {
  order,
  inventory,
  inbound,
  delay,
} from "../support/operational-event.factories.js";
import { rebuildOperationalState } from "../../src/application/rebuild-operational-state.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

if (databaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required for persistence tests");
}

const pool = createDatabasePool(databaseUrl);
const repository = new AcceptedEventRepository(pool);

describe("rebuildOperationalState with PostgreSQL", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
  });

  afterAll(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
    await pool.end();
  });

  it("replays accepted events in replay-sequence order", async () => {
    const confirmedEvent = inbound("IN-901", {
      expectedAvailableAt: "2026-08-09T09:00:00.000Z",
    });

    const delayedEvent = delay(
      "IN-901",
      "2026-08-09T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
    );

    await repository.insertOrGet(confirmedEvent, "fingerprint-one");
    await repository.insertOrGet(delayedEvent, "fingerprint-two");

    const state = await rebuildOperationalState(repository);

    expect(state.inboundShipments.get("IN-901")).toMatchObject({
      shipmentId: "IN-901",
      expectedAvailableAt: "2026-08-11T09:00:00.000Z",
    });

    expect(state.processedEventIds).toEqual(
      new Set([confirmedEvent.eventId, delayedEvent.eventId]),
    );
  });

  it("fails when persisted events cannot be applied in replay-sequence order", async () => {
    const confirmedEvent = inbound("IN-901", {
      expectedAvailableAt: "2026-08-09T09:00:00.000Z",
    });

    const delayedEvent = delay(
      "IN-901",
      "2026-08-09T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
    );

    await repository.insertOrGet(delayedEvent, "fingerprint-one");
    await repository.insertOrGet(confirmedEvent, "fingerprint-two");

    await expect(rebuildOperationalState(repository)).rejects.toThrow();
  });
});
