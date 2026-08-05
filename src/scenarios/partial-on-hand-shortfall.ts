import type { ScenarioDefinition } from "./run-scenario.js";

export const partialOnHandShortfallScenario: ScenarioDefinition = {
  name: "partial-on-hand-shortfall",
  description:
    "An order is partially covered by on-hand inventory and the remaining shortfall has no represented cause.",
  events: [
    {
      eventId: "event-inventory-4001",
      eventType: "InventoryPositionReported",
      occurredAt: "2026-08-01T08:00:00-05:00",
      receivedAt: "2026-08-01T08:00:01-05:00",
      source: "WMS",
      payload: {
        warehouseId: "CHI",
        sku: "BRG-440",
        usableQuantity: 7,
        reservedQuantity: 0,
        unusableQuantity: 0,
      },
    },
    {
      eventId: "event-order-4001",
      eventType: "OrderPlaced",
      occurredAt: "2026-08-01T09:00:00-05:00",
      receivedAt: "2026-08-01T09:00:01-05:00",
      source: "ERP",
      payload: {
        orderId: "SO-4001",
        placedAt: "2026-08-01T09:00:00-05:00",
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
    },
  ],
  checkpoints: [
    {
      name: "partial on-hand allocation",
      afterEventCount: 2,
      expectedAssessments: [
        {
          orderId: "SO-4001",
          status: "BLOCKED",
          lines: [
            {
              orderLineId: "SO-4001-L1",
              status: "BLOCKED",
              projectedAllocation: 7,
              projectedShortfall: 3,
              supplyContributions: [
                {
                  type: "ON_HAND",
                  warehouseId: "CHI",
                  sku: "BRG-440",
                  quantity: 7,
                },
              ],
              blockingConditions: [
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
