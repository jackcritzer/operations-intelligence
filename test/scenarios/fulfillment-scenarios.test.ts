import { describe, expect, it } from "vitest";
import type { OrderFulfillmentAssessment } from "../../src/fulfillment/fulfillment-result.js";
import { fulfillmentScenarios } from "../../src/scenarios/index.js";
import {
  runScenario,
  type ExpectedOrderAssessment,
} from "../../src/scenarios/run-scenario.js";

describe.each(fulfillmentScenarios)("$name", (scenario) => {
  const result = runScenario(scenario);

  it("recalculates fulfillment after every event", () => {
    expect(result.steps).toHaveLength(scenario.events.length);
  });

  it.each(scenario.checkpoints)("$name", (checkpoint) => {
    const step = result.steps[checkpoint.afterEventCount - 1];

    expect(step, "checkpoint must reference an existing event").toBeDefined();
    expect(toExpectedAssessments(step?.assessments ?? [])).toEqual(
      checkpoint.expectedAssessments,
    );
  });
});

function toExpectedAssessments(
  assessments: OrderFulfillmentAssessment[],
): ExpectedOrderAssessment[] {
  return assessments.map(({ orderId, status, lines }) => ({
    orderId,
    status,
    lines: lines.map(
      ({
        orderLineId,
        status: lineStatus,
        projectedAllocation,
        projectedShortfall,
        supplyContributions,
        blockingConditions,
        triggeringChanges,
      }) => ({
        orderLineId,
        status: lineStatus,
        projectedAllocation,
        projectedShortfall,
        supplyContributions,
        blockingConditions,
        triggeringChanges,
      }),
    ),
  }));
}
