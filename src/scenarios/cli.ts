import type {
  BlockingCondition,
  OrderFulfillmentAssessment,
} from "../fulfillment/fulfillment-result.js";
import { runScenario } from "./run-scenario.js";
import { shipmentDelayBlocksOrderScenario } from "./shipment-delay-blocks-order.js";

const scenarios = new Map([
  [shipmentDelayBlocksOrderScenario.name, shipmentDelayBlocksOrderScenario],
]);

const scenarioName = process.argv[2] ?? shipmentDelayBlocksOrderScenario.name;
const scenario = scenarios.get(scenarioName);

if (!scenario) {
  console.error(
    `Unknown scenario "${scenarioName}". Available scenarios: ${[
      ...scenarios.keys(),
    ].join(", ")}`,
  );
  process.exitCode = 1;
} else {
  const result = runScenario(scenario);

  console.log(`Scenario: ${result.scenario.name}`);
  console.log(result.scenario.description);

  result.steps.forEach((step, index) => {
    console.log(
      `\n[${index + 1}/${result.steps.length}] ${step.event.eventType} (${step.event.eventId})`,
    );

    if (step.statusChanges.length === 0) {
      console.log("No fulfillment status changes.");
      return;
    }

    for (const change of step.statusChanges) {
      const transition =
        change.previousStatus === null
          ? change.currentStatus
          : `${change.previousStatus} -> ${change.currentStatus}`;

      console.log(`${change.orderId}: ${transition}`);

      const assessment = step.assessments.find(
        (candidate) => candidate.orderId === change.orderId,
      );

      if (assessment) {
        printAssessment(assessment);
      }
    }
  });
}

function printAssessment(assessment: OrderFulfillmentAssessment): void {
  console.log(`Required ship time: ${assessment.requiredShipAt}`);

  for (const line of assessment.lines) {
    console.log(
      `  ${line.orderLineId} ${line.sku}: ${line.projectedAllocation}/${line.requiredQuantity} allocated, ${line.projectedShortfall} short`,
    );

    for (const condition of line.blockingConditions) {
      console.log(`    Blocker: ${formatBlockingCondition(condition)}`);
    }

    for (const change of line.triggeringChanges) {
      console.log(
        `    Trigger: ${change.shipmentId} delayed from ${change.previousExpectedAvailableAt} to ${change.newExpectedAvailableAt}`,
      );
    }
  }
}

function formatBlockingCondition(condition: BlockingCondition): string {
  switch (condition.type) {
    case "INBOUND_AVAILABLE_TOO_LATE":
      return (
        `${condition.quantity} units on ${condition.shipmentId} arrive at ` +
        `${condition.expectedAvailableAt}, after the required ship time`
      );
    case "SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND":
      return (
        `${condition.quantity} units allocated to higher-priority order ` +
        `${condition.consumingOrderId} line ${condition.consumingOrderLineId}`
      );
    case "SHORTFALL_CAUSE_UNDETERMINED":
      return `${condition.quantity} units have no identified supply source`;
  }
}
