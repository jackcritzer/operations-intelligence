import type { ScenarioDefinition } from "./run-scenario.js";

export const shipmentDelayBlocksOrderScenario: ScenarioDefinition = {
  name: "shipment-delay-blocks-order",
  description:
    "An inbound shipment moves past an order deadline, changing the order from fulfillable to blocked.",
  events: [
    {
      eventId: "event-inventory-1001",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T08:00:00-05:00",
      receivedAt: "2026-08-01T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BEARING-440",
        usableQuantity: 70,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    },
    {
      eventId: "event-order-1001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T09:00:00-05:00",
      receivedAt: "2026-08-01T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-1001",
        placedAt: "2026-08-01T09:00:00-05:00",
        requiredShipAt: "2026-08-08T17:00:00-05:00",
        lines: [
          {
            orderLineId: "SO-1001-L1",
            sku: "BEARING-440",
            quantity: 100,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      },
    },
    {
      eventId: "event-inbound-1001",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-02T10:00:00-05:00",
      receivedAt: "2026-08-02T10:00:01-05:00",
      source: "SUPPLIER_INTEGRATION",
      payload: {
        shipmentId: "IN-900",
        destinationWarehouseId: "CHI",
        expectedAvailableAt: "2026-08-06T09:00:00-05:00",
        lines: [
          {
            shipmentLineId: "IN-900-L1",
            sku: "BEARING-440",
            quantity: 30,
          },
        ],
      },
    },
    {
      eventId: "event-inbound-1001-delayed",
      eventType: "InboundShipmentDelayed",
      occurredAt: "2026-08-03T12:00:00-05:00",
      receivedAt: "2026-08-03T12:00:01-05:00",
      source: "TRANSPORTATION_INTEGRATION",
      payload: {
        shipmentId: "IN-900",
        previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
        newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
        reason: "Carrier delay",
      },
    },
  ],
  checkpoints: [
    {
      name: "timely inbound makes the order fulfillable",
      afterEventCount: 3,
      expectedAssessments: [
        {
          orderId: "SO-1001",
          status: "FULFILLABLE",
          lines: [
            {
              orderLineId: "SO-1001-L1",
              status: "FULFILLABLE",
              projectedAllocation: 100,
              projectedShortfall: 0,
              supplyContributions: [
                {
                  type: "ON_HAND",
                  warehouseId: "CHI",
                  sku: "BEARING-440",
                  quantity: 70,
                },
                {
                  type: "INBOUND",
                  shipmentId: "IN-900",
                  shipmentLineId: "IN-900-L1",
                  warehouseId: "CHI",
                  sku: "BEARING-440",
                  quantity: 30,
                  expectedAvailableAt: "2026-08-06T09:00:00-05:00",
                },
              ],
              blockingConditions: [],
              triggeringChanges: [],
            },
          ],
        },
      ],
    },
    {
      name: "deadline-crossing delay blocks the order",
      afterEventCount: 4,
      expectedAssessments: [
        {
          orderId: "SO-1001",
          status: "BLOCKED",
          lines: [
            {
              orderLineId: "SO-1001-L1",
              status: "BLOCKED",
              projectedAllocation: 70,
              projectedShortfall: 30,
              supplyContributions: [
                {
                  type: "ON_HAND",
                  warehouseId: "CHI",
                  sku: "BEARING-440",
                  quantity: 70,
                },
              ],
              blockingConditions: [
                {
                  type: "INBOUND_AVAILABLE_TOO_LATE",
                  shipmentId: "IN-900",
                  shipmentLineId: "IN-900-L1",
                  quantity: 30,
                  expectedAvailableAt: "2026-08-11T09:00:00-05:00",
                  requiredShipAt: "2026-08-08T17:00:00-05:00",
                },
              ],
              triggeringChanges: [
                {
                  type: "SHIPMENT_DELAYED",
                  shipmentId: "IN-900",
                  previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
                  newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
                  changedAt: "2026-08-03T12:00:00-05:00",
                  reason: "Carrier delay",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
