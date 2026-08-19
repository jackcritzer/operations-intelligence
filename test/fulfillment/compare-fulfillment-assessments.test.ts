import { describe, expect, it } from "vitest";

import { calculateFulfillment } from "../../src/fulfillment/calculate-fulfillment.js";
import { compareFulfillmentAssessments } from "../../src/fulfillment/compare-fulfillment-assessments.js";
import type {
  OrderFulfillmentAssessment,
  OrderLineFulfillmentAssessment,
} from "../../src/fulfillment/fulfillment-assessment.js";
import { applyEvent } from "../../src/state/apply-event.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";
import {
  delay,
  inbound,
  inventory,
  order,
} from "../support/operational-event.factories.js";

function createLineAssessment(
  overrides: Partial<OrderLineFulfillmentAssessment> = {},
): OrderLineFulfillmentAssessment {
  return {
    orderLineId: "SO-1001-L1",
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
    ...overrides,
  };
}

function createOrderAssessment(
  overrides: Partial<OrderFulfillmentAssessment> = {},
): OrderFulfillmentAssessment {
  return {
    orderId: "SO-1001",
    requiredShipAt: "2026-08-10T17:00:00.000Z",
    status: "FULFILLABLE",
    lines: [createLineAssessment()],
    ...overrides,
  };
}

describe("compareFulfillmentAssessments", () => {
  it("identifies an order that became blocked after a shipment delay", () => {
    const state = createEmptyOperationalState();

    applyEvent(
      state,
      order("SO-2001", {
        placedAt: "2026-08-01T09:00:00.000Z",
        requiredShipAt: "2026-08-08T17:00:00.000Z",
      }),
    );

    applyEvent(
      state,
      order("SO-2002", {
        placedAt: "2026-08-02T09:00:00.000Z",
        requiredShipAt: "2026-08-10T17:00:00.000Z",
      }),
    );

    applyEvent(state, inventory("CHI", "BRG-440", 4));

    applyEvent(
      state,
      inbound("IN-901", {
        expectedAvailableAt: "2026-08-09T09:00:00.000Z",
      }),
    );

    const before = calculateFulfillment(state);

    applyEvent(
      state,
      delay("IN-901", "2026-08-09T09:00:00.000Z", "2026-08-11T09:00:00.000Z"),
    );

    const after = calculateFulfillment(state);

    const result = compareFulfillmentAssessments(before, after);

    expect(result.changedOrders).toHaveLength(1);

    expect(result.changedOrders[0]).toMatchObject({
      orderId: "SO-2002",
      type: "BECAME_BLOCKED",
      before: {
        status: "FULFILLABLE",
      },
      after: {
        status: "BLOCKED",
      },
      changedLines: [
        {
          orderLineId: "SO-2002-L1",
          before: {
            status: "FULFILLABLE",
            projectedAllocation: 4,
            projectedShortfall: 0,
          },
          after: {
            status: "BLOCKED",
            projectedAllocation: 0,
            projectedShortfall: 4,
          },
        },
      ],
    });
  });

  it("returns no changes for identical snapshots", () => {
    const assessment = createOrderAssessment();

    expect(compareFulfillmentAssessments([assessment], [assessment])).toEqual({
      changedOrders: [],
    });
  });

  it("identifies an order that became fulfillable", () => {
    const beforeLine = createLineAssessment({
      projectedAllocation: 0,
      projectedShortfall: 4,
      status: "BLOCKED",
      supplyContributions: [],
      blockingConditions: [
        {
          type: "SHORTFALL_CAUSE_UNDETERMINED",
          quantity: 4,
        },
      ],
    });

    const afterLine = createLineAssessment();

    const before = createOrderAssessment({
      status: "BLOCKED",
      lines: [beforeLine],
    });

    const after = createOrderAssessment({
      lines: [afterLine],
    });

    expect(compareFulfillmentAssessments([before], [after])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "BECAME_FULFILLABLE",
          before,
          after,
          changedLines: [
            {
              orderLineId: "SO-1001-L1",
              before: beforeLine,
              after: afterLine,
            },
          ],
        },
      ],
    });
  });

  it("identifies a blocked order whose shortfall increased", () => {
    const beforeLine = createLineAssessment({
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
    });

    const afterLine = createLineAssessment({
      projectedAllocation: 0,
      projectedShortfall: 4,
      status: "BLOCKED",
      supplyContributions: [],
      blockingConditions: [
        {
          type: "SHORTFALL_CAUSE_UNDETERMINED",
          quantity: 4,
        },
      ],
    });

    const before = createOrderAssessment({
      status: "BLOCKED",
      lines: [beforeLine],
    });

    const after = createOrderAssessment({
      status: "BLOCKED",
      lines: [afterLine],
    });

    expect(compareFulfillmentAssessments([before], [after])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "DETAILS_CHANGED",
          before,
          after,
          changedLines: [
            {
              orderLineId: "SO-1001-L1",
              before: beforeLine,
              after: afterLine,
            },
          ],
        },
      ],
    });
  });

  it("identifies changed blocker evidence when quantities remain the same", () => {
    const beforeLine = createLineAssessment({
      projectedAllocation: 0,
      projectedShortfall: 4,
      status: "BLOCKED",
      supplyContributions: [],
      blockingConditions: [
        {
          type: "SHORTFALL_CAUSE_UNDETERMINED",
          quantity: 4,
        },
      ],
    });

    const afterLine = createLineAssessment({
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
          expectedAvailableAt: "2026-08-11T09:00:00.000Z",
          requiredShipAt: "2026-08-10T17:00:00.000Z",
        },
      ],
    });

    const before = createOrderAssessment({
      status: "BLOCKED",
      lines: [beforeLine],
    });

    const after = createOrderAssessment({
      status: "BLOCKED",
      lines: [afterLine],
    });

    expect(compareFulfillmentAssessments([before], [after])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "DETAILS_CHANGED",
          before,
          after,
          changedLines: [
            {
              orderLineId: "SO-1001-L1",
              before: beforeLine,
              after: afterLine,
            },
          ],
        },
      ],
    });
  });

  it("identifies changed triggering evidence", () => {
    const beforeLine = createLineAssessment({
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
          expectedAvailableAt: "2026-08-11T09:00:00.000Z",
          requiredShipAt: "2026-08-10T17:00:00.000Z",
        },
      ],
    });

    const afterLine = createLineAssessment({
      projectedAllocation: 0,
      projectedShortfall: 4,
      status: "BLOCKED",
      supplyContributions: [],
      blockingConditions: beforeLine.blockingConditions,
      triggeringChanges: [
        {
          type: "SHIPMENT_DELAYED",
          shipmentId: "IN-901",
          previousExpectedAvailableAt: "2026-08-09T09:00:00.000Z",
          newExpectedAvailableAt: "2026-08-11T09:00:00.000Z",
          changedAt: "2026-08-07T12:00:00.000Z",
          reason: "Carrier delay",
        },
      ],
    });

    const before = createOrderAssessment({
      status: "BLOCKED",
      lines: [beforeLine],
    });

    const after = createOrderAssessment({
      status: "BLOCKED",
      lines: [afterLine],
    });

    expect(compareFulfillmentAssessments([before], [after])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "DETAILS_CHANGED",
          before,
          after,
          changedLines: [
            {
              orderLineId: "SO-1001-L1",
              before: beforeLine,
              after: afterLine,
            },
          ],
        },
      ],
    });
  });

  it("identifies an added order assessment", () => {
    const addedOrder = createOrderAssessment();

    expect(compareFulfillmentAssessments([], [addedOrder])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "ADDED",
          after: addedOrder,
          changedLines: [
            {
              orderLineId: "SO-1001-L1",
              after: addedOrder.lines[0],
            },
          ],
        },
      ],
    });
  });

  it("identifies a removed order assessment", () => {
    const removedOrder = createOrderAssessment();

    expect(compareFulfillmentAssessments([removedOrder], [])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "REMOVED",
          before: removedOrder,
          changedLines: [
            {
              orderLineId: "SO-1001-L1",
              before: removedOrder.lines[0],
            },
          ],
        },
      ],
    });
  });

  it("includes only changed lines from a multi-line order", () => {
    const unchangedBeforeLine = createLineAssessment({
      orderLineId: "SO-1001-L1",
    });

    const unchangedAfterLine = createLineAssessment({
      orderLineId: "SO-1001-L1",
    });

    const changedBeforeLine = createLineAssessment({
      orderLineId: "SO-1001-L2",
      sku: "VAL-200",
      supplyContributions: [
        {
          type: "ON_HAND",
          warehouseId: "CHI",
          sku: "VAL-200",
          quantity: 4,
        },
      ],
    });

    const changedAfterLine = createLineAssessment({
      orderLineId: "SO-1001-L2",
      sku: "VAL-200",
      projectedAllocation: 2,
      projectedShortfall: 2,
      status: "BLOCKED",
      supplyContributions: [
        {
          type: "ON_HAND",
          warehouseId: "CHI",
          sku: "VAL-200",
          quantity: 2,
        },
      ],
      blockingConditions: [
        {
          type: "SHORTFALL_CAUSE_UNDETERMINED",
          quantity: 2,
        },
      ],
    });

    const before = createOrderAssessment({
      lines: [unchangedBeforeLine, changedBeforeLine],
    });

    const after = createOrderAssessment({
      status: "BLOCKED",
      lines: [unchangedAfterLine, changedAfterLine],
    });

    expect(compareFulfillmentAssessments([before], [after])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "BECAME_BLOCKED",
          before,
          after,
          changedLines: [
            {
              orderLineId: "SO-1001-L2",
              before: changedBeforeLine,
              after: changedAfterLine,
            },
          ],
        },
      ],
    });
  });

  it("identifies a changed required ship time", () => {
    const before = createOrderAssessment({
      requiredShipAt: "2026-08-10T17:00:00.000Z",
    });

    const after = createOrderAssessment({
      requiredShipAt: "2026-08-11T17:00:00.000Z",
    });

    expect(compareFulfillmentAssessments([before], [after])).toEqual({
      changedOrders: [
        {
          orderId: "SO-1001",
          type: "DETAILS_CHANGED",
          before,
          after,
          changedLines: [],
        },
      ],
    });
  });

  it("ignores order and line array ordering", () => {
    const order1Line1 = createLineAssessment({
      orderLineId: "SO-1001-L1",
    });

    const order1Line2 = createLineAssessment({
      orderLineId: "SO-1001-L2",
      sku: "VAL-200",
      supplyContributions: [
        {
          type: "ON_HAND",
          warehouseId: "CHI",
          sku: "VAL-200",
          quantity: 4,
        },
      ],
    });

    const order1Before = createOrderAssessment({
      orderId: "SO-1001",
      lines: [order1Line1, order1Line2],
    });

    const order1After = createOrderAssessment({
      orderId: "SO-1001",
      lines: [order1Line2, order1Line1],
    });

    const order2 = createOrderAssessment({
      orderId: "SO-1002",
      lines: [
        createLineAssessment({
          orderLineId: "SO-1002-L1",
        }),
      ],
    });

    expect(
      compareFulfillmentAssessments(
        [order1Before, order2],
        [order2, order1After],
      ),
    ).toEqual({
      changedOrders: [],
    });
  });

  it("throws for duplicate order IDs in the before snapshot", () => {
    const duplicate1 = createOrderAssessment();
    const duplicate2 = createOrderAssessment();

    expect(() =>
      compareFulfillmentAssessments([duplicate1, duplicate2], []),
    ).toThrow('Duplicate order assessment "SO-1001" in before snapshot');
  });

  it("throws for duplicate order IDs in the after snapshot", () => {
    const duplicate1 = createOrderAssessment();
    const duplicate2 = createOrderAssessment();

    expect(() =>
      compareFulfillmentAssessments([], [duplicate1, duplicate2]),
    ).toThrow('Duplicate order assessment "SO-1001" in after snapshot');
  });

  it("throws for duplicate line IDs within an order", () => {
    const before = createOrderAssessment();

    const after = createOrderAssessment({
      lines: [
        createLineAssessment({
          orderLineId: "SO-1001-L1",
        }),
        createLineAssessment({
          orderLineId: "SO-1001-L1",
        }),
      ],
    });

    expect(() => compareFulfillmentAssessments([before], [after])).toThrow(
      'Duplicate order-line assessment "SO-1001-L1" in after snapshot',
    );
  });
});
