import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/http/build-app.js";
import { applyEvent } from "../../src/state/apply-event.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";
import type { Clock } from "../../src/http/mappers/operational-event.mapper.js";

const fixedClock: Clock = {
  now: () => new Date("2026-08-03T17:00:01.123Z"),
};

describe("POST /v1/operational-events", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("rejects a structurally invalid event", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload: {
        eventId: "delay-1",
        eventType: "InboundShipmentDelayed",
        occurredAt: "2026-08-03T12:00:00-05:00",
        source: "TRANSPORTATION_INTEGRATION",
        receivedAt: "2026-08-03T17:00:01.123Z",
        payload: {},
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual(
      expect.objectContaining({
        statusCode: 400,
        code: "FST_ERR_VALIDATION",
        error: "Bad Request",
      }),
    );
  });

  it("applies a valid inbound shipment delay", async () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "confirmation-1",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-01T10:00:00-05:00",
      receivedAt: "2026-08-01T15:00:01.000Z",
      source: "SUPPLIER_INTEGRATION",
      payload: {
        shipmentId: "IN-900",
        destinationWarehouseId: "WH-CHI",
        expectedAvailableAt: "2026-08-06T09:00:00-05:00",
        lines: [
          {
            shipmentLineId: "line-1",
            sku: "BRG-440",
            quantity: 10,
          },
        ],
      },
    });

    app = buildApp({
      state,
      clock: fixedClock,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload: {
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
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      eventId: "delay-1",
      status: "APPLIED",
    });

    expect(state.inboundShipments.get("IN-900")).toEqual(
      expect.objectContaining({
        expectedAvailableAt: "2026-08-11T09:00:00-05:00",
      }),
    );
  });

  it("returns 409 when the shipment does not exist", async () => {
    app = buildApp({
      state: createEmptyOperationalState(),
      clock: fixedClock,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload: {
        eventId: "delay-1",
        eventType: "InboundShipmentDelayed",
        occurredAt: "2026-08-03T12:00:00-05:00",
        source: "TRANSPORTATION_INTEGRATION",
        payload: {
          shipmentId: "IN-999",
          previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
          newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(
      expect.objectContaining({
        code: "INBOUND_SHIPMENT_NOT_FOUND",
        message: "Inbound shipment IN-999 does not exist",
      }),
    );
  });

  it("returns 400 for malformed JSON", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      headers: {
        "content-type": "application/json",
      },
      payload: '{"eventId":',
    });

    expect(response.statusCode).toBe(400);
  });
});
