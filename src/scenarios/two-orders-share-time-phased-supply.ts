import type { ScenarioDefinition } from "./run-scenario.js";

export const twoOrdersShareTimePhasedSupplyScenario: ScenarioDefinition = {
  name: "two-orders-share-time-phased-supply",
  description:
    "Two prioritized orders share on-hand and time-phased inbound supply before a delay blocks only the later order.",
  events: [
    {
      eventId: "event-inventory-2001",
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
    },
    {
      eventId: "event-order-2001",
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
    },
    {
      eventId: "event-order-2002",
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
    },
    {
      eventId: "event-inbound-901-confirmed",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-03T10:00:00-05:00",
      receivedAt: "2026-08-03T10:00:01-05:00",
      source: "SUPPLIER_INTEGRATION",
      payload: {
        shipmentId: "IN-901",
        destinationWarehouseId: "CHI",
        expectedAvailableAt: "2026-08-09T09:00:00-05:00",
        lines: [{ shipmentLineId: "IN-901-L1", sku: "BRG-440", quantity: 4 }],
      },
    },
    {
      eventId: "event-inbound-901-delayed",
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
    },
  ],
  checkpoints: [
    {
      name: "time-phased supply fulfills both orders",
      afterEventCount: 4,
      expectedAssessments: [
        {
          orderId: "SO-2001",
          status: "FULFILLABLE",
          lines: [
            {
              orderLineId: "SO-2001-L1",
              status: "FULFILLABLE",
              projectedAllocation: 4,
              projectedShortfall: 0,
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
          orderId: "SO-2002",
          status: "FULFILLABLE",
          lines: [
            {
              orderLineId: "SO-2002-L1",
              status: "FULFILLABLE",
              projectedAllocation: 4,
              projectedShortfall: 0,
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
        },
      ],
    },
    {
      name: "delay blocks only the later order",
      afterEventCount: 5,
      expectedAssessments: [
        {
          orderId: "SO-2001",
          status: "FULFILLABLE",
          lines: [
            {
              orderLineId: "SO-2001-L1",
              status: "FULFILLABLE",
              projectedAllocation: 4,
              projectedShortfall: 0,
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
          orderId: "SO-2002",
          status: "BLOCKED",
          lines: [
            {
              orderLineId: "SO-2002-L1",
              status: "BLOCKED",
              projectedAllocation: 0,
              projectedShortfall: 4,
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
        },
      ],
    },
  ],
};
