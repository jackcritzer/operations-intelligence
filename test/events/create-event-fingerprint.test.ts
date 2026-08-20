import { describe, expect, it } from "vitest";
import { createEventFingerprint } from "../../src/events/create-event-fingerprint.js";
import { order } from "../support/operational-event.factories.js";

describe("createEventFingerprint", () => {
  it("changes the fingerprint when event content changes", () => {
    const event1 = order("SO-2001");
    const event2 = order("SO-2002");

    const fingerprint1 = createEventFingerprint(event1);
    const fingerprint2 = createEventFingerprint(event2);

    expect(fingerprint1).not.toEqual(fingerprint2);
  });

  it("creates the same fingerprint for the same event content", () => {
    const event = order("SO-2001");

    expect(createEventFingerprint(event)).toBe(createEventFingerprint(event));
  });

  it("ignores the event ID", () => {
    const event = order("SO-2001");
    const deliveryWithAnotherId = {
      ...event,
      eventId: "another-event-id",
    };

    expect(createEventFingerprint(event)).toBe(
      createEventFingerprint(deliveryWithAnotherId),
    );
  });

  it("changes when payload content changes", () => {
    const event = order("SO-2001");
    const changedEvent = {
      ...event,
      payload: {
        ...event.payload,
        requiredShipAt: "2026-08-11T17:00:00.000Z",
      },
    };

    expect(createEventFingerprint(event)).not.toBe(
      createEventFingerprint(changedEvent),
    );
  });
});
