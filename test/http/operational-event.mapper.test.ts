import { describe, expect, it } from "vitest";

import { mapOperationalEventRequest } from "../../src/http/mappers/operational-event.mapper.js";
import type {
  InboundShipmentConfirmedRequest,
  InboundShipmentDelayedRequest,
  InventoryPositionReportedRequest,
  OrderPlacedRequest,
} from "../../src/http/schemas/operational-event.schema.js";

const receivedAt = "2026-08-07T17:00:01.123Z";

const fixedClock = {
  now: () => new Date(receivedAt),
};

describe("mapOperationalEventRequest", () => {
  it("maps an OrderPlaced request", () => {
    const request: OrderPlacedRequest = {
      eventId: "EVT-ORDER-2001",
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
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    };

    expect(mapOperationalEventRequest(request, fixedClock)).toEqual({
      ...request,
      receivedAt,
    });
  });

  it("maps an InventoryPositionReported request", () => {
    const request: InventoryPositionReportedRequest = {
      eventId: "EVT-INVENTORY-CHI-BRG-440",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T08:00:00-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 4,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    };

    expect(mapOperationalEventRequest(request, fixedClock)).toEqual({
      ...request,
      receivedAt,
    });
  });

  it("maps an InboundShipmentConfirmed request", () => {
    const request: InboundShipmentConfirmedRequest = {
      eventId: "EVT-INBOUND-901-CONFIRMED",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-03T10:00:00-05:00",
      source: "SUPPLIER_INTEGRATION",
      payload: {
        shipmentId: "IN-901",
        destinationWarehouseId: "CHI",
        expectedAvailableAt: "2026-08-09T09:00:00-05:00",
        lines: [
          {
            shipmentLineId: "IN-901-L1",
            sku: "BRG-440",
            quantity: 4,
          },
        ],
      },
    };

    expect(mapOperationalEventRequest(request, fixedClock)).toEqual({
      ...request,
      receivedAt,
    });
  });

  it("maps an InboundShipmentDelayed request", () => {
    const request: InboundShipmentDelayedRequest = {
      eventId: "EVT-INBOUND-901-DELAYED",
      eventType: "InboundShipmentDelayed",
      occurredAt: "2026-08-07T12:00:00-05:00",
      source: "TRANSPORTATION_INTEGRATION",
      payload: {
        shipmentId: "IN-901",
        previousExpectedAvailableAt: "2026-08-09T09:00:00-05:00",
        newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
        reason: "Carrier delay",
      },
    };

    expect(mapOperationalEventRequest(request, fixedClock)).toEqual({
      ...request,
      receivedAt,
    });
  });
});
