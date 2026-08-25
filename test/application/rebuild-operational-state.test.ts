import { describe, expect, it } from "vitest";

import {
  rebuildOperationalState,
  type ReplayEventSource,
} from "../../src/application/rebuild-operational-state.js";
import {
  inventory,
  order,
  inbound,
  delay,
} from "../support/operational-event.factories.js";

describe("rebuildOperationalState", () => {
  it("rebuilds operational state from accepted events", async () => {
    const inventoryEvent = inventory("CHI", "BRG-440", 4);
    const orderEvent = order("SO-2001");

    const eventSource: ReplayEventSource = {
      listForReplay: async () => [
        { eventData: inventoryEvent },
        { eventData: orderEvent },
      ],
    };

    const state = await rebuildOperationalState(eventSource);

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      warehouseId: "CHI",
      sku: "BRG-440",
      usableQuantity: 4,
    });

    expect(state.orders.get("SO-2001")).toMatchObject({
      orderId: "SO-2001",
      status: "OPEN",
    });

    expect(state.processedEventIds).toEqual(
      new Set([inventoryEvent.eventId, orderEvent.eventId]),
    );
  });

  it("replays accepted events in the order supplied by the event source", async () => {
    const confirmedEvent = inbound("IN-901", {
      expectedAvailableAt: "2026-08-09T09:00:00.000Z",
    });

    const delayedEvent = delay(
      "IN-901",
      "2026-08-09T09:00:00.000Z",
      "2026-08-11T09:00:00.000Z",
    );

    const eventSource: ReplayEventSource = {
      listForReplay: async () => [
        { eventData: confirmedEvent },
        { eventData: delayedEvent },
      ],
    };

    const state = await rebuildOperationalState(eventSource);

    expect(state.inboundShipments.get("IN-901")).toMatchObject({
      shipmentId: "IN-901",
      expectedAvailableAt: "2026-08-11T09:00:00.000Z",
    });

    expect(state.processedEventIds).toEqual(
      new Set([confirmedEvent.eventId, delayedEvent.eventId]),
    );
  });
});
