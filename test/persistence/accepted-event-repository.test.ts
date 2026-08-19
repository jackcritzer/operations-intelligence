import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabasePool } from "../../src/persistence/database.js";
import { AcceptedEventRepository } from "../../src/persistence/accepted-event-repository.js";
import { order } from "../support/operational-event.factories.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

if (databaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required for persistence tests");
}

const pool = createDatabasePool(databaseUrl);
const repository = new AcceptedEventRepository(pool);

describe("AcceptedEventRepository", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
  });

  afterAll(async () => {
    await pool.query("TRUNCATE TABLE accepted_events RESTART IDENTITY");
    await pool.end();
  });

  it("inserts and returns a new accepted event", async () => {
    const event = order("SO-1001");

    const result = await repository.insertOrGet(event, "fingerprint-one");

    expect(result).toMatchObject({
      status: "INSERTED",
      event: {
        replaySequence: "1",
        eventId: event.eventId,
        eventFingerprint: "fingerprint-one",
        eventData: event,
      },
    });

    expect(result.event.acceptedAt).toEqual(expect.any(String));
  });

  it("returns the existing event when its event ID is already stored", async () => {
    const event = order("SO-1001");

    await repository.insertOrGet(event, "fingerprint-one");

    const result = await repository.insertOrGet(event, "fingerprint-one");

    expect(result).toMatchObject({
      status: "EXISTING",
      event: {
        replaySequence: "1",
        eventId: event.eventId,
        eventFingerprint: "fingerprint-one",
        eventData: event,
      },
    });
  });

  it("preserves the original event when the same ID is submitted with a different fingerprint", async () => {
    const event = order("SO-1001");

    await repository.insertOrGet(event, "fingerprint-one");

    const result = await repository.insertOrGet(event, "fingerprint-two");

    expect(result).toMatchObject({
      status: "EXISTING",
      event: {
        eventId: event.eventId,
        eventFingerprint: "fingerprint-one",
      },
    });

    const events = await repository.listForReplay();

    expect(events).toHaveLength(1);
  });

  it("loads accepted events in replay order", async () => {
    const firstEvent = order("SO-1001");
    const secondEvent = order("SO-1002");

    await repository.insertOrGet(firstEvent, "fingerprint-one");
    await repository.insertOrGet(secondEvent, "fingerprint-two");

    const events = await repository.listForReplay();

    expect(events.map((event) => event.eventId)).toEqual([
      firstEvent.eventId,
      secondEvent.eventId,
    ]);

    expect(events.map((event) => event.replaySequence)).toEqual(["1", "2"]);
  });

  it("returns null when an event ID has not been accepted", async () => {
    const result = await repository.findByEventId("missing-event");

    expect(result).toBeNull();
  });
});
