import { describe, expect, it } from "vitest";

import {
  processOperationalEvent,
  AcceptedEventStore,
} from "../../src/application/process-operational-event.js";
import { applyEvent } from "../../src/state/apply-event.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";
import { EventIdentityConflictError } from "../../src/application/errors/event-identity-conflict-error.js";
import {
  delay,
  inbound,
  inventory,
  order,
} from "../support/operational-event.factories.js";
import { createInMemoryAcceptedEventStore } from "../support/accepted-event-store.fake.js";

describe("processOperationalEvent", () => {
  it("returns the fulfillment impact of an applied shipment delay", async () => {
    const state = createEmptyOperationalState();
    const eventStore = createInMemoryAcceptedEventStore();

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

    const event = delay(
      "IN-901",
      "2026-08-09T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
    );

    const result = await processOperationalEvent(
      state,
      event,
      "event-fingerprint",
      eventStore,
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

  it("returns no new impact for a duplicate event", async () => {
    const state = createEmptyOperationalState();
    const eventStore = createInMemoryAcceptedEventStore();
    const event = inventory("CHI", "BRG-440", 4);

    const firstResult = await processOperationalEvent(
      state,
      event,
      "event-fingerprint",
      eventStore,
    );
    const duplicateResult = await processOperationalEvent(
      state,
      event,
      "event-fingerprint",
      eventStore,
    );

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

  it("returns an added assessment when an order is placed", async () => {
    const state = createEmptyOperationalState();
    const eventStore = createInMemoryAcceptedEventStore();
    const event = order("SO-1001");

    const result = await processOperationalEvent(
      state,
      event,
      "event-fingerprint",
      eventStore,
    );

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

  it("returns no changed orders when an event has no fulfillment impact", async () => {
    const state = createEmptyOperationalState();
    const eventStore = createInMemoryAcceptedEventStore();

    const result = await processOperationalEvent(
      state,
      inventory("CHI", "UNUSED-SKU", 20),
      "event-fingerprint",
      eventStore,
    );

    expect(result).toEqual({
      eventId: "inventory-CHI-UNUSED-SKU",
      status: "APPLIED",
      impact: {
        changedOrders: [],
      },
    });
  });

  it("propagates an application error without marking the event as processed", async () => {
    const state = createEmptyOperationalState();
    const eventStore = createInMemoryAcceptedEventStore();

    const invalidDelay = delay(
      "IN-MISSING",
      "2026-08-09T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
    );

    await expect(
      processOperationalEvent(
        state,
        invalidDelay,
        "invalid-delay-fingerprint",
        eventStore,
      ),
    ).rejects.toThrow("Inbound shipment IN-MISSING does not exist");

    expect(state.processedEventIds.has(invalidDelay.eventId)).toBe(false);
    expect(state.inboundShipments.size).toBe(0);
    expect(state.shipmentAvailabilityChanges.size).toBe(0);
  });

  it("does not change live state when persistence fails", async () => {
    const state = createEmptyOperationalState();
    const event = inventory("CHI", "BRG-440", 4);

    const eventStore: AcceptedEventStore = {
      insertOrGet: async () => {
        throw new Error("Database unavailable");
      },
    };

    await expect(
      processOperationalEvent(state, event, "event-fingerprint", eventStore),
    ).rejects.toThrow("Database unavailable");

    expect(state.inventoryPositions.size).toBe(0);
    expect(state.processedEventIds.size).toBe(0);
  });

  it("rejects an event ID reused with different content", async () => {
    const state = createEmptyOperationalState();
    const eventStore = createInMemoryAcceptedEventStore();

    const originalEvent = inventory("CHI", "BRG-440", 4);
    const conflictingEvent = inventory("CHI", "BRG-440", 10);

    await processOperationalEvent(
      state,
      originalEvent,
      "original-fingerprint",
      eventStore,
    );

    await expect(
      processOperationalEvent(
        state,
        conflictingEvent,
        "different-fingerprint",
        eventStore,
      ),
    ).rejects.toBeInstanceOf(EventIdentityConflictError);

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      usableQuantity: 4,
    });

    expect(state.processedEventIds).toEqual(new Set([originalEvent.eventId]));
  });
});
