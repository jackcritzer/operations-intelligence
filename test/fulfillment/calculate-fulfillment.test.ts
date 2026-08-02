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

  it("explains when higher-priority demand consumes supply needed by earlier placed orders", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "event-inventory-1",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T08:00:00-05:00",
      receivedAt: "2026-08-01T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 6,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    });

    applyEvent(state, {
      eventId: "event-order-3001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T09:00:00-05:00",
      receivedAt: "2026-08-01T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-3001",
        placedAt: "2026-08-01T09:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-3001-L1",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    applyEvent(state, {
      eventId: "event-order-3002",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T10:00:00-05:00",
      receivedAt: "2026-08-01T10:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-3002",
        placedAt: "2026-08-01T10:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-3002-L1",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    expect(calculateFulfillment(state)).toEqual([
      {
        orderId: "SO-3001",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        status: "FULFILLABLE",
        lines: [
          {
            orderLineId: "SO-3001-L1",
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
      },
      {
        orderId: "SO-3002",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        status: "BLOCKED",
        lines: [
          {
            orderLineId: "SO-3002-L1",
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
                type: "SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND",
                quantity: 2,
                consumingOrderId: "SO-3001",
                consumingOrderLineId: "SO-3001-L1",
              },
            ],
            triggeringChanges: [],
          },
        ],
      },
    ]);
  });

  it("prioritizes an earlier required ship date over an earlier placement time", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "event-inventory-1",
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
    });

    applyEvent(state, {
      eventId: "event-order-5001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T09:00:00-05:00",
      receivedAt: "2026-08-01T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-5001",
        placedAt: "2026-08-01T09:00:00-05:00",
        requiredShipAt: "2026-08-10T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-5001-L1",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    applyEvent(state, {
      eventId: "event-order-5002",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T10:00:00-05:00",
      receivedAt: "2026-08-01T10:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-5002",
        placedAt: "2026-08-02T10:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-5002-L1",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    expect(calculateFulfillment(state)).toEqual([
      {
        orderId: "SO-5002",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        status: "FULFILLABLE",
        lines: [
          {
            orderLineId: "SO-5002-L1",
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
      },
      {
        orderId: "SO-5001",
        requiredShipAt: "2026-08-10T17:00:00-05:00",
        status: "BLOCKED",
        lines: [
          {
            orderLineId: "SO-5001-L1",
            sku: "BRG-440",
            fulfillmentWarehouseId: "CHI",
            requiredQuantity: 4,
            projectedAllocation: 0,
            projectedShortfall: 4,
            status: "BLOCKED",
            supplyContributions: [],
            blockingConditions: [
              {
                type: "SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND",
                quantity: 4,
                consumingOrderId: "SO-5002",
                consumingOrderLineId: "SO-5002-L1",
              }
            ],
            triggeringChanges: [],
          },
        ],
      },
      
    ]);
  });

  it("partially fulfills an order and identifies an unexplained remaining shortfall", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "event-inventory-4001",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-02T08:00:00-05:00",
      receivedAt: "2026-08-02T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 7,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    });

    applyEvent(state, {
      eventId: "event-order-4001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-02T09:00:00-05:00",
      receivedAt: "2026-08-02T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-4001",
        placedAt: "2026-08-02T09:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-4001-L1",
            sku: "BRG-440",
            quantity: 10,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    expect(calculateFulfillment(state)).toEqual([
      {
        orderId: "SO-4001",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        status: "BLOCKED",
        lines: [
          {
            orderLineId: "SO-4001-L1",
            sku: "BRG-440",
            fulfillmentWarehouseId: "CHI",
            requiredQuantity: 10,
            projectedAllocation: 7,
            projectedShortfall: 3,
            status: "BLOCKED",
            supplyContributions: [
              {
                type: "ON_HAND",
                warehouseId: "CHI",
                sku: "BRG-440",
                quantity: 7,
              },
            ],
            blockingConditions: [
              {
                type: "SHORTFALL_CAUSE_UNDETERMINED",
                quantity: 3,
              },
            ],
            triggeringChanges: [],
          },
        ],
      },
    ]);
  });

  it("partially fulfills an order from warehouse + inbound shipment and identifies an unexplained remaining shortfall", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "event-inventory-4001",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-02T08:00:00-05:00",
      receivedAt: "2026-08-02T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 4,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    });

    applyEvent(state, {
      eventId: "event-order-4001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-02T09:00:00-05:00",
      receivedAt: "2026-08-02T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-4001",
        placedAt: "2026-08-02T09:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-4001-L1",
            sku: "BRG-440",
            quantity: 10,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    applyEvent(state, {
      eventId: "EVT-INBOUND-901-CONFIRMED",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-03T10:00:00-05:00",
      receivedAt: "2026-08-03T10:00:01-05:00",
      source: "SUPPLIER_INTEGRATION",
      payload: {
        shipmentId: "SHIP-4001",
        destinationWarehouseId: "CHI",
        expectedAvailableAt: "2026-08-07T12:00:00-05:00",
        lines: [
          {
            shipmentLineId: "SHIP-4001-L1",
            sku: "BRG-440",
            quantity: 3,
          },
        ],
      },
    });

    expect(calculateFulfillment(state)).toEqual([
      {
        orderId: "SO-4001",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        status: "BLOCKED",
        lines: [
          {
            orderLineId: "SO-4001-L1",
            sku: "BRG-440",
            fulfillmentWarehouseId: "CHI",
            requiredQuantity: 10,
            projectedAllocation: 7,
            projectedShortfall: 3,
            status: "BLOCKED",
            supplyContributions: [
              {
                type: "ON_HAND",
                warehouseId: "CHI",
                sku: "BRG-440",
                quantity: 4,
              },
              {
                type: "INBOUND",
                shipmentId: "SHIP-4001",
                shipmentLineId: "SHIP-4001-L1",
                warehouseId: "CHI",
                sku: "BRG-440",
                quantity: 3,
                expectedAvailableAt: "2026-08-07T12:00:00-05:00",
              },
            ],
            blockingConditions: [
              {
                type: "SHORTFALL_CAUSE_UNDETERMINED",
                quantity: 3,
              },
            ],
            triggeringChanges: [],
          },
        ],
      },
    ]);
  });

  it("explains unfulfillable multiline order", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "event-inventory-1",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T08:00:00-05:00",
      receivedAt: "2026-08-01T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 6,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    });

    applyEvent(state, {
      eventId: "event-inventory-2",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-02T08:00:00-05:00",
      receivedAt: "2026-08-02T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BLT-210",
        usableQuantity: 2,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    });

    applyEvent(state, {
      eventId: "event-order-6001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T09:00:00-05:00",
      receivedAt: "2026-08-01T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-6001",
        placedAt: "2026-08-01T09:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-6001-L1",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
          {
            orderLineId: "SO-6001-L2",
            sku: "BLT-210",
            quantity: 6,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    expect(calculateFulfillment(state)).toEqual([
      {
        orderId: "SO-6001",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        status: "BLOCKED",
        lines: [
          {
            orderLineId: "SO-6001-L1",
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
          {
            orderLineId: "SO-6001-L2",
            sku: "BLT-210",
            fulfillmentWarehouseId: "CHI",
            requiredQuantity: 6,
            projectedAllocation: 2,
            projectedShortfall: 4,
            status: "BLOCKED",
            supplyContributions: [
              {
                type: "ON_HAND",
                warehouseId: "CHI",
                sku: "BLT-210",
                quantity: 2,
              },
            ],
            blockingConditions: [
              {
                type: "SHORTFALL_CAUSE_UNDETERMINED",
                quantity: 4
              },
            ],
            triggeringChanges: [],
          },
        ],
      },
    ]);
  });

  it("partitions a shortfall across higher-priority demand, late inbound, and an undetermined remainder", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, {
      eventId: "event-inventory-7001",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T08:00:00-05:00",
      receivedAt: "2026-08-01T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 5,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    });

    applyEvent(state, {
      eventId: "event-order-7001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T09:00:00-05:00",
      receivedAt: "2026-08-01T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-7001",
        placedAt: "2026-08-01T09:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-7001-L1",
            sku: "BRG-440",
            quantity: 3,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    applyEvent(state, {
      eventId: "event-order-7002",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T10:00:00-05:00",
      receivedAt: "2026-08-01T10:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-7002",
        placedAt: "2026-08-01T10:00:00-05:00",
        requiredShipAt: "2026-08-10T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-7002-L1",
            sku: "BRG-440",
            quantity: 10,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    });

    applyEvent(state, {
      eventId: "event-inbound-7001",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-02T10:00:00-05:00",
      receivedAt: "2026-08-02T10:00:01-05:00",
      source: "SUPPLIER_INTEGRATION",
      payload: {
        shipmentId: "SHIP-7001",
        destinationWarehouseId: "CHI",
        expectedAvailableAt: "2026-08-11T09:00:00-05:00",
        lines: [
          {
            shipmentLineId: "SHIP-7001-L1",
            sku: "BRG-440",
            quantity: 2,
          },
        ],
      },
    });

    const assessments = calculateFulfillment(state);
    const blockedLine = assessments
      .find((order) => order.orderId === "SO-7002")
      ?.lines.find((line) => line.orderLineId === "SO-7002-L1");

    expect(blockedLine).toMatchObject({
      projectedAllocation: 2,
      projectedShortfall: 8,
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
          type: "INBOUND_AVAILABLE_TOO_LATE",
          shipmentId: "SHIP-7001",
          shipmentLineId: "SHIP-7001-L1",
          quantity: 2,
          expectedAvailableAt: "2026-08-11T09:00:00-05:00",
          requiredShipAt: "2026-08-10T17:00:00-05:00",
        },
        {
          type: "SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND",
          quantity: 3,
          consumingOrderId: "SO-7001",
          consumingOrderLineId: "SO-7001-L1",
        },
        {
          type: "SHORTFALL_CAUSE_UNDETERMINED",
          quantity: 3,
        },
      ],
      triggeringChanges: [],
    });

    expect(
      blockedLine?.blockingConditions.reduce(
        (total, condition) => total + condition.quantity,
        0,
      ),
    ).toBe(blockedLine?.projectedShortfall);
  });

});
