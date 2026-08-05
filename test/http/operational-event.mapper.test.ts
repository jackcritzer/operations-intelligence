import { describe, expect, it } from "vitest";

import type { Clock } from "../../src/http/mappers/operational-event.mapper.js";
import { mapInboundShipmentDelayedRequest } from "../../src/http/mappers/operational-event.mapper.js";
import type { InboundShipmentDelayedRequest } from "../../src/http/schemas/operational-event.schema.js";

const fixedClock: Clock = {
  now: () => new Date("2026-08-03T17:00:01.123Z"),
};

function createRequest(): InboundShipmentDelayedRequest {
  return {
    eventId: "delay-1",
    eventType: "InboundShipmentDelayed",
    occurredAt: "2026-08-03T12:00:00-05:00",
    source: "TRANSPORTATION_INTEGRATION",
    payload: {
      shipmentId: "IN-900",
      previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
      newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
      reason: "Carrier delay",
    },
  };
}

describe("mapInboundShipmentDelayedRequest", () => {
  it("maps the HTTP request into a domain event", () => {
    const event = mapInboundShipmentDelayedRequest(
      createRequest(),
      fixedClock,
    );

    expect(event).toEqual({
      eventId: "delay-1",
      eventType: "InboundShipmentDelayed",
      occurredAt: "2026-08-03T12:00:00-05:00",
      receivedAt: "2026-08-03T17:00:01.123Z",
      source: "TRANSPORTATION_INTEGRATION",
      payload: {
        shipmentId: "IN-900",
        previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
        newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
        reason: "Carrier delay",
      },
    });
  });

  it("uses the server clock for receivedAt", () => {
    const request = createRequest();

    const event = mapInboundShipmentDelayedRequest(request, fixedClock);

    expect(event.receivedAt).toBe("2026-08-03T17:00:01.123Z");
    expect(event.receivedAt).not.toBe(event.occurredAt);
  });

  it("omits an optional reason when the request does not contain one", () => {
    const request = createRequest();
    delete request.payload.reason;

    const event = mapInboundShipmentDelayedRequest(request, fixedClock);

    expect(event.payload).not.toHaveProperty("reason");
  });
});