import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/http/build-app.js";
import { applyEvent } from "../../src/state/apply-event.js";
import {
  createEmptyOperationalState,
  inventoryPositionKey,
} from "../../src/state/operational-state.js";
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

    expect(response.json()).toEqual(
      expect.objectContaining({
        statusCode: 400,
        code: "FST_ERR_CTP_INVALID_JSON_BODY",
      }),
    );
  });

  it("constructs operational state from all supported event types", async () => {
    const state = createEmptyOperationalState();

    app = buildApp({
      state,
      clock: fixedClock,
    });

    const requests = [
      {
        eventId: "order-placed-1",
        eventType: "OrderPlaced",
        occurredAt: "2026-08-01T09:00:00-05:00",
        source: "ERP",
        payload: {
          orderId: "SO-2001",
          placedAt: "2026-08-01T09:00:00-05:00",
          requiredShipAt: "2026-08-08T17:00:00-05:00",
          lines: [
            {
              orderLineId: "SO-2001-L1",
              sku: "BRG-440",
              quantity: 6,
              fulfillmentWarehouseId: "CHI",
            },
          ],
        },
      },
      {
        eventId: "inventory-reported-1",
        eventType: "InventoryPositionReported",
        occurredAt: "2026-08-01T10:00:00-05:00",
        source: "WMS",
        payload: {
          warehouseId: "CHI",
          sku: "BRG-440",
          usableQuantity: 4,
          reservedQuantity: 0,
          unusableQuantity: 0,
        },
      },
      {
        eventId: "shipment-confirmed-1",
        eventType: "InboundShipmentConfirmed",
        occurredAt: "2026-08-03T10:00:00-05:00",
        source: "SUPPLIER_INTEGRATION",
        payload: {
          shipmentId: "IN-901",
          destinationWarehouseId: "CHI",
          expectedAvailableAt: "2026-08-06T09:00:00-05:00",
          lines: [
            {
              shipmentLineId: "IN-901-L1",
              sku: "BRG-440",
              quantity: 4,
            },
          ],
        },
      },
      {
        eventId: "shipment-delayed-1",
        eventType: "InboundShipmentDelayed",
        occurredAt: "2026-08-04T12:00:00-05:00",
        source: "TRANSPORTATION_INTEGRATION",
        payload: {
          shipmentId: "IN-901",
          previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
          newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
          reason: "Carrier delay",
        },
      },
    ];

    for (const payload of requests) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/operational-events",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        eventId: payload.eventId,
        status: "APPLIED",
      });
    }

    expect(state.orders.get("SO-2001")).toEqual(
      expect.objectContaining({
        orderId: "SO-2001",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
      }),
    );

    expect(state.inboundShipments.get("IN-901")).toEqual(
      expect.objectContaining({
        shipmentId: "IN-901",
        expectedAvailableAt: "2026-08-11T09:00:00-05:00",
      }),
    );

    expect(state.processedEventIds).toEqual(
      new Set([
        "order-placed-1",
        "inventory-reported-1",
        "shipment-confirmed-1",
        "shipment-delayed-1",
      ]),
    );

    expect(
      state.inventoryPositions.get(inventoryPositionKey("CHI", "BRG-440")),
    ).toEqual(
      expect.objectContaining({
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 4,
      }),
    );
  });

  it("reports a previously processed event as a duplicate", async () => {
    const state = createEmptyOperationalState();

    app = buildApp({
      state,
      clock: fixedClock,
    });

    const payload = {
      eventId: "inventory-reported-1",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T10:00:00-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 4,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    };

    const firstResponse = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload,
    });

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload,
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({
      eventId: "inventory-reported-1",
      status: "APPLIED",
    });

    expect(duplicateResponse.statusCode).toBe(200);
    expect(duplicateResponse.json()).toEqual({
      eventId: "inventory-reported-1",
      status: "DUPLICATE",
    });

    expect(state.processedEventIds).toEqual(new Set(["inventory-reported-1"]));
  });
});
