import { describe, expect, it } from "vitest";

import { processOperationalEvent } from "../../src/application/process-operational-event.js";
import { applyEvent } from "../../src/state/apply-event.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";
import {
  delay,
  inbound,
  inventory,
  order,
} from "../support/operational-event.factories.js";

describe("processOperationalEvent", () => {
  it("returns the fulfillment impact of an applied shipment delay", () => {
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

    const result = processOperationalEvent(
      state,
      delay("IN-901", "2026-08-09T09:00:00.000Z", "2026-08-11T09:00:00.000Z"),
    );

    expect(result).toMatchObject({
      eventId: "delay-IN-901",
      status: "APPLIED",
      impact: {
        changedOrders: [
          {
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
                  projectedAllocation: 4,
                  projectedShortfall: 0,
                  status: "FULFILLABLE",
                },
                after: {
                  projectedAllocation: 0,
                  projectedShortfall: 4,
                  status: "BLOCKED",
                },
              },
            ],
          },
        ],
      },
    });

    expect(state.inboundShipments.get("IN-901")).toMatchObject({
      expectedAvailableAt: "2026-08-11T09:00:00.000Z",
    });
  });

  it("returns no new impact for a duplicate event", () => {
    const state = createEmptyOperationalState();
    const event = inventory("CHI", "BRG-440", 4);

    const firstResult = processOperationalEvent(state, event);
    const duplicateResult = processOperationalEvent(state, event);

    expect(firstResult).toMatchObject({
      eventId: "inventory-CHI-BRG-440",
      status: "APPLIED",
    });

    expect(duplicateResult).toEqual({
      eventId: "inventory-CHI-BRG-440",
      status: "DUPLICATE",
      impact: {
        changedOrders: [],
      },
    });

    expect(state.processedEventIds).toEqual(new Set(["inventory-CHI-BRG-440"]));
  });

  it("returns an added assessment when an order is placed", () => {
    const state = createEmptyOperationalState();

    const result = processOperationalEvent(state, order("SO-1001"));

    expect(result).toMatchObject({
      eventId: "order-SO-1001",
      status: "APPLIED",
      impact: {
        changedOrders: [
          {
            orderId: "SO-1001",
            type: "ADDED",
            after: {
              status: "BLOCKED",
            },
          },
        ],
      },
    });
  });

  it("returns no changed orders when an event has no fulfillment impact", () => {
    const state = createEmptyOperationalState();

    const result = processOperationalEvent(
      state,
      inventory("CHI", "UNUSED-SKU", 20),
    );

    expect(result).toEqual({
      eventId: "inventory-CHI-UNUSED-SKU",
      status: "APPLIED",
      impact: {
        changedOrders: [],
      },
    });
  });

  it("propagates an application error without marking the event as processed", () => {
    const state = createEmptyOperationalState();

    const invalidDelay = delay(
      "IN-MISSING",
      "2026-08-09T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
    );

    expect(() => processOperationalEvent(state, invalidDelay)).toThrow(
      "Inbound shipment IN-MISSING does not exist",
    );

    expect(state.processedEventIds.has(invalidDelay.eventId)).toBe(false);
    expect(state.inboundShipments.size).toBe(0);
    expect(state.shipmentAvailabilityChanges.size).toBe(0);
  });
});
