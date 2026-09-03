import { describe, expect, it } from "vitest";

import { applyEvent } from "../../src/state/apply-event.js";
import {
  cloneOperationalState,
  createEmptyOperationalState,
  replaceOperationalState,
} from "../../src/state/operational-state.js";
import { inventory } from "../support/operational-event.factories.js";

describe("operational state staging", () => {
  it("isolates staged changes from live state", () => {
    const liveState = createEmptyOperationalState();
    const stagedState = cloneOperationalState(liveState);

    applyEvent(stagedState, inventory("CHI", "BRG-440", 4));

    expect(stagedState.inventoryPositions.has("CHI:BRG-440")).toBe(true);
    expect(liveState.inventoryPositions.has("CHI:BRG-440")).toBe(false);
    expect(liveState.processedEventIds.size).toBe(0);
  });

  it("publishes staged state through the existing live-state reference", () => {
    const liveState = createEmptyOperationalState();
    const originalReference = liveState;
    const stagedState = cloneOperationalState(liveState);

    applyEvent(stagedState, inventory("CHI", "BRG-440", 4));
    replaceOperationalState(liveState, stagedState);

    expect(liveState).toBe(originalReference);
    expect(liveState.inventoryPositions.has("CHI:BRG-440")).toBe(true);
    expect(liveState.processedEventIds).toEqual(
      new Set(["inventory-CHI-BRG-440"]),
    );
  });
});
