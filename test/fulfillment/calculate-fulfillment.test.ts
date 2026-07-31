import { describe, expect, it } from "vitest";
import type {
  InboundShipmentConfirmedEvent,
  InboundShipmentDelayedEvent,
  InventoryPositionReportedEvent,
  OrderPlacedEvent,
} from "../../src/events/operational-event.js";
import { calculateFulfillment } from "../../src/fulfillment/calculate-fulfillment.js";
import type { OrderFulfillmentAssessment } from "../../src/fulfillment/fulfillment-result.js";
import { applyEvent } from "../../src/state/apply-event.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";

const order1PlacedEvent: OrderPlacedEvent = {
  eventId: "EVT-ORDER-2001",
  eventType: "OrderPlaced",
  occurredAt: "2026-08-01T09:00:00-05:00",
  receivedAt: "2026-08-01T09:00:01-05:00",
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

const order2PlacedEvent: OrderPlacedEvent = {
  eventId: "EVT-ORDER-2002",
  eventType: "OrderPlaced",
  occurredAt: "2026-08-02T09:00:00-05:00",
  receivedAt: "2026-08-02T09:00:01-05:00",
  source: "ERP",
  payload: {
    orderId: "SO-2002",
    placedAt: "2026-08-02T09:00:00-05:00",
    requiredShipAt: "2026-08-10T17:00:00-05:00",
    lines: [
      {
        orderLineId: "SO-2002-L1",
        sku: "BRG-440",
        quantity: 4,
        fulfillmentWarehouseId: "CHI",
      },
    ],
  },
};

const inventoryReportedEvent: InventoryPositionReportedEvent = {
  eventId: "EVT-INVENTORY-CHI-BRG-440",
  eventType: "InventoryPositionReported",
  occurredAt: "2026-08-01T08:00:00-05:00",
  receivedAt: "2026-08-01T08:00:01-05:00",
  source: "WMS",
  payload: {
    warehouseId: "CHI",
    sku: "BRG-440",
    usableQuantity: 4,
    reservedQuantity: 0,
    unusableQuantity: 0,
  },
};

const inboundShipmentConfirmedEvent: InboundShipmentConfirmedEvent = {
  eventId: "EVT-INBOUND-901-CONFIRMED",
  eventType: "InboundShipmentConfirmed",
  occurredAt: "2026-08-03T10:00:00-05:00",
  receivedAt: "2026-08-03T10:00:01-05:00",
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

const inboundShipmentDelayedEvent: InboundShipmentDelayedEvent = {
  eventId: "EVT-INBOUND-901-DELAYED",
  eventType: "InboundShipmentDelayed",
  occurredAt: "2026-08-07T12:00:00-05:00",
  receivedAt: "2026-08-07T12:00:01-05:00",
  source: "TRANSPORTATION_INTEGRATION",
  payload: {
    shipmentId: "IN-901",
    previousExpectedAvailableAt: "2026-08-09T09:00:00-05:00",
    newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
    reason: "Carrier delay",
  },
};

const order1BeforeDelay: OrderFulfillmentAssessment = {
  orderId: "SO-2001",
  requiredShipAt: "2026-08-08T17:00:00-05:00",
  status: "FULFILLABLE",
  lines: [
    {
      orderLineId: "SO-2001-L1",
      sku: "BRG-440",
      fulfillmentWarehouseId: "CHI",
      requiredQuantity: 4,
      projectedAllocation: 4,
      projectedShortfall: 0,
      status: "FULFILLABLE",
      supplyContributions: [
        {
          type: "ON_HAND",
          warehouseId: "CHI",
          sku: "BRG-440",
          quantity: 4,
        },
      ],
      blockingConditions: [],
      triggeringChanges: [],
    },
  ],
};

const order2BeforeDelay: OrderFulfillmentAssessment = {
  orderId: "SO-2002",
  requiredShipAt: "2026-08-10T17:00:00-05:00",
  status: "FULFILLABLE",
  lines: [
    {
      orderLineId: "SO-2002-L1",
      sku: "BRG-440",
      fulfillmentWarehouseId: "CHI",
      requiredQuantity: 4,
      projectedAllocation: 4,
      projectedShortfall: 0,
      status: "FULFILLABLE",
      supplyContributions: [
        {
          type: "INBOUND",
          shipmentId: "IN-901",
          shipmentLineId: "IN-901-L1",
          warehouseId: "CHI",
          sku: "BRG-440",
          quantity: 4,
          expectedAvailableAt: "2026-08-09T09:00:00-05:00",
        },
      ],
      blockingConditions: [],
      triggeringChanges: [],
    },
  ],
};

const order1AfterDelay: OrderFulfillmentAssessment = {
  orderId: "SO-2001",
  requiredShipAt: "2026-08-08T17:00:00-05:00",
  status: "FULFILLABLE",
  lines: [
    {
      orderLineId: "SO-2001-L1",
      sku: "BRG-440",
      fulfillmentWarehouseId: "CHI",
      requiredQuantity: 4,
      projectedAllocation: 4,
      projectedShortfall: 0,
      status: "FULFILLABLE",
      supplyContributions: [
        {
          type: "ON_HAND",
          warehouseId: "CHI",
          sku: "BRG-440",
          quantity: 4,
        },
      ],
      blockingConditions: [],
      triggeringChanges: [],
    },
  ],
};

const order2AfterDelay: OrderFulfillmentAssessment = {
  orderId: "SO-2002",
  requiredShipAt: "2026-08-10T17:00:00-05:00",
  status: "BLOCKED",
  lines: [
    {
      orderLineId: "SO-2002-L1",
      sku: "BRG-440",
      fulfillmentWarehouseId: "CHI",
      requiredQuantity: 4,
      projectedAllocation: 0,
      projectedShortfall: 4,
      status: "BLOCKED",
      supplyContributions: [],
      blockingConditions: [
        {
          type: "INBOUND_AVAILABLE_TOO_LATE",
          shipmentId: "IN-901",
          shipmentLineId: "IN-901-L1",
          quantity: 4,
          expectedAvailableAt: "2026-08-11T09:00:00-05:00",
          requiredShipAt: "2026-08-10T17:00:00-05:00",
        },
      ],
      triggeringChanges: [
        {
          type: "SHIPMENT_DELAYED",
          shipmentId: "IN-901",
          previousExpectedAvailableAt: "2026-08-09T09:00:00-05:00",
          newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
          changedAt: "2026-08-07T12:00:00-05:00",
          reason: "Carrier delay",
        },
      ],
    },
  ],
};

describe("calculateFulfillment", () => {
  it("recalculates fulfillment when inbound supply moves past an order deadline", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, inventoryReportedEvent);
    applyEvent(state, order1PlacedEvent);
    applyEvent(state, order2PlacedEvent);
    applyEvent(state, inboundShipmentConfirmedEvent);

    expect(calculateFulfillment(state)).toEqual([
      order1BeforeDelay,
      order2BeforeDelay,
    ]);

    applyEvent(state, inboundShipmentDelayedEvent);

    expect(calculateFulfillment(state)).toEqual([
      order1AfterDelay,
      order2AfterDelay,
    ]);
  });
});