import type { ScenarioDefinition } from "./run-scenario.js";

export const mixedCauseShortfallScenario: ScenarioDefinition = {
  name: "mixed-cause-shortfall",
  description:
    "A shortfall is partitioned among higher-priority demand, late inbound supply, and an undetermined remainder.",
  events: [
    {
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
    },
    {
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
    },
    {
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
    },
    {
      eventId: "event-inbound-7001",
      eventType: "InboundShipmentConfirmed",
      occurredAt: "2026-08-02T09:00:00-05:00",
      receivedAt: "2026-08-02T09:00:01-05:00",
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
    },
  ],
  checkpoints: [
    {
      name: "mixed causes partition the shortfall",
      afterEventCount: 4,
      expectedAssessments: [
        {
          orderId: "SO-7001",
          status: "FULFILLABLE",
          lines: [
            {
              orderLineId: "SO-7001-L1",
              status: "FULFILLABLE",
              projectedAllocation: 3,
              projectedShortfall: 0,
              supplyContributions: [
                {
                  type: "ON_HAND",
                  warehouseId: "CHI",
                  sku: "BRG-440",
                  quantity: 3,
                },
              ],
              blockingConditions: [],
              triggeringChanges: [],
            },
          ],
        },
        {
          orderId: "SO-7002",
          status: "BLOCKED",
          lines: [
            {
              orderLineId: "SO-7002-L1",
              status: "BLOCKED",
              projectedAllocation: 2,
              projectedShortfall: 8,
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
                  quantity: 3,
                  consumingOrderId: "SO-7001",
                  consumingOrderLineId: "SO-7001-L1",
                },
                {
                  type: "INBOUND_AVAILABLE_TOO_LATE",
                  shipmentId: "SHIP-7001",
                  shipmentLineId: "SHIP-7001-L1",
                  quantity: 2,
                  expectedAvailableAt: "2026-08-11T09:00:00-05:00",
                  requiredShipAt: "2026-08-10T17:00:00-05:00",
                },
                { type: "SHORTFALL_CAUSE_UNDETERMINED", quantity: 3 },
              ],
              triggeringChanges: [],
            },
          ],
        },
      ],
    },
  ],
};
