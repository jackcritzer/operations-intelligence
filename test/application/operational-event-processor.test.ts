import { describe, expect, it } from "vitest";

import { createOperationalEventProcessor } from "../../src/application/operational-event-processor.js";
import type { AcceptedEventStore } from "../../src/application/process-operational-event.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";
import { inventory } from "../support/operational-event.factories.js";

describe("OperationalEventProcessor", () => {
  it("serializes overlapping events so neither state update is lost", async () => {
    const state = createEmptyOperationalState();

    let insertCallCount = 0;

    let markFirstInsertStarted!: () => void;
    const firstInsertStarted = new Promise<void>((resolve) => {
      markFirstInsertStarted = resolve;
    });

    let releaseFirstInsert!: () => void;
    const firstInsertCanFinish = new Promise<void>((resolve) => {
      releaseFirstInsert = resolve;
    });

    const eventStore: AcceptedEventStore = {
      insertOrGet: async (event, fingerprint) => {
        insertCallCount += 1;

        if (insertCallCount === 1) {
          markFirstInsertStarted();
          await firstInsertCanFinish;
        }

        return {
          status: "INSERTED",
          event: {
            eventFingerprint: fingerprint,
          },
        };
      },
    };

    const processor = createOperationalEventProcessor(state, eventStore);

    const firstEvent = inventory("CHI", "BRG-440", 4);
    const secondEvent = inventory("CHI", "BLT-210", 6);

    const firstProcessing = processor.process(firstEvent, "first-fingerprint");

    await firstInsertStarted;

    const secondProcessing = processor.process(
      secondEvent,
      "second-fingerprint",
    );

    expect(insertCallCount).toBe(1);
    expect(state.inventoryPositions.size).toBe(0);

    releaseFirstInsert();

    await Promise.all([firstProcessing, secondProcessing]);

    expect(insertCallCount).toBe(2);

    expect(state.inventoryPositions.get("CHI:BRG-440")).toMatchObject({
      usableQuantity: 4,
    });

    expect(state.inventoryPositions.get("CHI:BLT-210")).toMatchObject({
      usableQuantity: 6,
    });

    expect(state.processedEventIds).toEqual(
      new Set([firstEvent.eventId, secondEvent.eventId]),
    );
  });
});
