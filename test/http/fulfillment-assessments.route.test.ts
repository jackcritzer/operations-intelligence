import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/http/build-app.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";

describe("GET /v1/fulfillment-assessments", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("returns explainable assessments from events ingested through HTTP", async () => {
    app = buildApp({
      state: createEmptyOperationalState(),
    });

    const orderResponse = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload: {
        eventId: "order-SO-2001",
        eventType: "OrderPlaced",
        occurredAt: "2026-08-01T09:00:00.000Z",
        source: "ERP",
        payload: {
          orderId: "SO-2001",
          placedAt: "2026-08-01T09:00:00.000Z",
          requiredShipAt: "2026-08-10T17:00:00.000Z",
          lines: [
            {
              orderLineId: "SO-2001-L1",
              sku: "BRG-440",
              quantity: 4,
              fulfillmentWarehouseId: "CHI",
            },
          ],
        },
      },
    });

    const inventoryResponse = await app.inject({
      method: "POST",
      url: "/v1/operational-events",
      payload: {
        eventId: "inventory-CHI-BRG-440",
        eventType: "InventoryPositionReported",
        occurredAt: "2026-08-01T08:00:00.000Z",
        source: "WMS",
        payload: {
          warehouseId: "CHI",
          sku: "BRG-440",
          usableQuantity: 2,
          reservedQuantity: 0,
          unusableQuantity: 0,
        },
      },
    });

    expect(orderResponse.statusCode).toBe(200);
    expect(inventoryResponse.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: "/v1/fulfillment-assessments",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        orderId: "SO-2001",
        requiredShipAt: "2026-08-10T17:00:00.000Z",
        status: "BLOCKED",
        lines: [
          {
            orderLineId: "SO-2001-L1",
            sku: "BRG-440",
            fulfillmentWarehouseId: "CHI",
            requiredQuantity: 4,
            projectedAllocation: 2,
            projectedShortfall: 2,
            status: "BLOCKED",
            supplyContributions: [
              {
                type: "ON_HAND",
                warehouseId: "CHI",
                sku: "BRG-440",
                quantity: 2,
              },
            ],
            blockingConditions: [
              {
                type: "SHORTFALL_CAUSE_UNDETERMINED",
                quantity: 2,
              },
            ],
            triggeringChanges: [],
          },
        ],
      },
    ]);
  });
});
