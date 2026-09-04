import { describe, expect, it } from "vitest";

import {
  createRuntime,
  type OperationalEventRepository,
} from "../../src/runtime/create-runtime.js";
import { createInMemoryAcceptedEventStore } from "../support/accepted-event-store.fake.js";
import {
  delay,
  inventory,
  order,
} from "../support/operational-event.factories.js";

describe("createRuntime", () => {
  it("builds the application with reconstructed operational state", async () => {
    const inventoryEvent = inventory("CHI", "BRG-440", 4);
    const orderEvent = order("SO-2001");

    const eventStore = createInMemoryAcceptedEventStore();

    const repository: OperationalEventRepository = {
      ...eventStore,
      listForReplay: async () => [
        {
          eventData: inventoryEvent,
        },
        {
          eventData: orderEvent,
        },
      ],
    };

    const runtime = await createRuntime(repository);

    expect(runtime.state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      usableQuantity: 4,
    });

    expect(runtime.state.orders.get("SO-2001")).toMatchObject({
      orderId: "SO-2001",
      status: "OPEN",
    });

    expect(runtime.state.processedEventIds).toEqual(
      new Set([inventoryEvent.eventId, orderEvent.eventId]),
    );

    await runtime.app.close();
  });

  it("rejects runtime creation when persisted history cannot be replayed", async () => {
    const invalidDelayEvent = delay(
      "IN-MISSING",
      "2026-09-03T09:00:00.000Z",
      "2026-09-05T09:00:00.000Z",
    );

    const eventStore = createInMemoryAcceptedEventStore();

    const repository: OperationalEventRepository = {
      ...eventStore,
      listForReplay: async () => [
        {
          eventData: invalidDelayEvent,
        },
      ],
    };

    await expect(createRuntime(repository)).rejects.toThrow(
      "Inbound shipment IN-MISSING does not exist",
    );
  });
});
