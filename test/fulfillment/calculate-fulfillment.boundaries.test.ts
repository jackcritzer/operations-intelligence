import { describe, expect, it } from "vitest";
import { calculateFulfillment } from "../../src/fulfillment/calculate-fulfillment.js";
import { applyEvent } from "../../src/state/apply-event.js";
import {
  createEmptyOperationalState,
  type OperationalState,
} from "../../src/state/operational-state.js";
import {
  defaultRequiredShipAt as deadline,
  inbound,
  inventory,
  order,
  delay,
} from "../support/operational-event.factories.js";

function apply(
  state: OperationalState,
  ...events: Parameters<typeof applyEvent>[1][]
) {
  for (const event of events) {
    applyEvent(state, event);
  }
}

function line(
  state: OperationalState,
  orderId: string,
  orderLineId = `${orderId}-L1`,
) {
  return calculateFulfillment(state)
    .find((assessment) => assessment.orderId === orderId)
    ?.lines.find((assessment) => assessment.orderLineId === orderLineId);
}

describe("calculateFulfillment boundaries", () => {
  it("treats inbound available exactly at requiredShipAt as eligible", () => {
    const state = createEmptyOperationalState();
    apply(
      state,
      order("SO-8001"),
      inbound("IN-8001", { expectedAvailableAt: deadline }),
    );

    expect(line(state, "SO-8001")).toMatchObject({
      status: "FULFILLABLE",
      projectedAllocation: 4,
      projectedShortfall: 0,
      blockingConditions: [],
      triggeringChanges: [],
      supplyContributions: [
        {
          type: "INBOUND",
          shipmentId: "IN-8001",
          quantity: 4,
          expectedAvailableAt: deadline,
        },
      ],
    });
  });

  it("treats inbound available one millisecond after requiredShipAt as late", () => {
    const state = createEmptyOperationalState();
    apply(
      state,
      order("SO-8002"),
      inbound("IN-8002", {
        expectedAvailableAt: "2026-08-10T17:00:00.001Z",
      }),
    );

    expect(line(state, "SO-8002")).toMatchObject({
      status: "BLOCKED",
      projectedAllocation: 0,
      projectedShortfall: 4,
      supplyContributions: [],
      blockingConditions: [
        {
          type: "INBOUND_AVAILABLE_TOO_LATE",
          shipmentId: "IN-8002",
          quantity: 4,
        },
      ],
    });
  });

  it("ignores supply for a different SKU", () => {
    const state = createEmptyOperationalState();
    apply(state, inventory("CHI", "BLT-210", 4), order("SO-8003"));

    expect(line(state, "SO-8003")).toMatchObject({
      status: "BLOCKED",
      projectedAllocation: 0,
      projectedShortfall: 4,
      blockingConditions: [
        { type: "SHORTFALL_CAUSE_UNDETERMINED", quantity: 4 },
      ],
    });
  });

  it("ignores supply at a different warehouse", () => {
    const state = createEmptyOperationalState();
    apply(state, inventory("DAL", "BRG-440", 4), order("SO-8004"));

    expect(line(state, "SO-8004")).toMatchObject({
      status: "BLOCKED",
      projectedAllocation: 0,
      projectedShortfall: 4,
      blockingConditions: [
        { type: "SHORTFALL_CAUSE_UNDETERMINED", quantity: 4 },
      ],
    });
  });

  it("does not allocate reserved inventory", () => {
    const state = createEmptyOperationalState();
    apply(state, inventory("CHI", "BRG-440", 10, 8), order("SO-8005"));

    expect(line(state, "SO-8005")).toMatchObject({
      projectedAllocation: 2,
      projectedShortfall: 2,
      supplyContributions: [{ type: "ON_HAND", quantity: 2 }],
    });
  });

  it("does not allocate unusable inventory", () => {
    const state = createEmptyOperationalState();
    apply(state, inventory("CHI", "BRG-440", 2, 0, 8), order("SO-8006"));

    expect(line(state, "SO-8006")).toMatchObject({
      projectedAllocation: 2,
      projectedShortfall: 2,
      supplyContributions: [{ type: "ON_HAND", quantity: 2 }],
    });
  });

  it("never allocates the same supply twice", () => {
    const state = createEmptyOperationalState();
    apply(
      state,
      inventory("CHI", "BRG-440", 4),
      order("SO-8007-A", { placedAt: "2026-08-01T09:00:00.000Z" }),
      order("SO-8007-B", { placedAt: "2026-08-01T10:00:00.000Z" }),
    );

    const assessments = calculateFulfillment(state);
    const totalAllocated = assessments
      .flatMap((assessment) => assessment.lines)
      .reduce((total, assessment) => total + assessment.projectedAllocation, 0);

    expect(totalAllocated).toBe(4);
    expect(line(state, "SO-8007-A")?.projectedAllocation).toBe(4);
    expect(line(state, "SO-8007-B")?.projectedAllocation).toBe(0);
  });

  it("uses placedAt when requiredShipAt values are equal", () => {
    const state = createEmptyOperationalState();
    apply(
      state,
      inventory("CHI", "BRG-440", 4),
      order("SO-8008-LATER", { placedAt: "2026-08-02T09:00:00.000Z" }),
      order("SO-8008-EARLIER", { placedAt: "2026-08-01T09:00:00.000Z" }),
    );

    expect(line(state, "SO-8008-EARLIER")?.projectedAllocation).toBe(4);
    expect(line(state, "SO-8008-LATER")?.projectedAllocation).toBe(0);
  });

  it("uses orderId and then orderLineId as deterministic tie-breakers", () => {
    const orderState = createEmptyOperationalState();
    apply(
      orderState,
      inventory("CHI", "BRG-440", 4),
      order("SO-B"),
      order("SO-A"),
    );

    expect(line(orderState, "SO-A")?.projectedAllocation).toBe(4);
    expect(line(orderState, "SO-B")?.projectedAllocation).toBe(0);

    const lineState = createEmptyOperationalState();
    apply(
      lineState,
      inventory("CHI", "BRG-440", 4),
      order("SO-8009", {
        lines: [
          {
            orderLineId: "SO-8009-L2",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
          {
            orderLineId: "SO-8009-L1",
            sku: "BRG-440",
            quantity: 4,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      }),
    );

    expect(line(lineState, "SO-8009", "SO-8009-L1")?.projectedAllocation).toBe(
      4,
    );
    expect(line(lineState, "SO-8009", "SO-8009-L2")?.projectedAllocation).toBe(
      0,
    );
  });

  it("returns no blockers or triggers for fulfillable lines", () => {
    const state = createEmptyOperationalState();
    apply(state, inventory("CHI", "BRG-440", 4), order("SO-8010"));

    expect(line(state, "SO-8010")).toMatchObject({
      status: "FULFILLABLE",
      projectedShortfall: 0,
      blockingConditions: [],
      triggeringChanges: [],
    });
  });

  it("includes triggering changes only for delayed shipments selected as blockers", () => {
    const state = createEmptyOperationalState();
    const originalArrival = "2026-08-09T09:00:00.000Z";
    const delayedArrival = "2026-08-11T09:00:00.000Z";

    apply(
      state,
      inbound("IN-8011-A", {
        expectedAvailableAt: originalArrival,
        quantity: 2,
      }),
      inbound("IN-8011-B", {
        expectedAvailableAt: originalArrival,
        quantity: 2,
      }),
      delay("IN-8011-A", originalArrival, delayedArrival),
      delay("IN-8011-B", originalArrival, delayedArrival),
      order("SO-8011", {
        lines: [
          {
            orderLineId: "SO-8011-L1",
            sku: "BRG-440",
            quantity: 2,
            fulfillmentWarehouseId: "CHI",
          },
        ],
      }),
    );

    expect(line(state, "SO-8011")).toMatchObject({
      projectedShortfall: 2,
      blockingConditions: [
        {
          type: "INBOUND_AVAILABLE_TOO_LATE",
          shipmentId: "IN-8011-A",
          quantity: 2,
        },
      ],
      triggeringChanges: [
        {
          type: "SHIPMENT_DELAYED",
          shipmentId: "IN-8011-A",
        },
      ],
    });
  });
});
