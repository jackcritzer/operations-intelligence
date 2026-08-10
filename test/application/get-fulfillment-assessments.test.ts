import { describe, expect, it } from "vitest";
import { inventory, order } from "../support/operational-event.factories.js";
import { applyEvent } from "../../src/state/apply-event.js";
import { getFulfillmentAssessments } from "../../src/application/get-fulfillment-assessments.js";
import { createEmptyOperationalState } from "../../src/state/operational-state.js";

describe("getFulfillmentAssessments", () => {
  it("returns fulfillment assessments for the current operational state", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, inventory("CHI", "BRG-440", 2));
    applyEvent(state, order("SO-2001"));

    const assessments = getFulfillmentAssessments(state);

    expect(assessments).toEqual([
      expect.objectContaining({
        orderId: "SO-2001",
        status: "BLOCKED",
      }),
    ]);
  });
});
