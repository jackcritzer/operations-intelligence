import type { OperationalEvent } from "../events/operational-event.js";
import type {
  BlockingCondition,
  OrderFulfillmentAssessment,
  SupplyContribution,
  TriggeringChange,
} from "../fulfillment/fulfillment-result.js";
import { fulfillmentScenarios } from "./index.js";
import { runScenario } from "./run-scenario.js";

const scenarios = new Map(
  fulfillmentScenarios.map((scenario) => [scenario.name, scenario]),
);
const requestedName = process.argv[2];
const selectedScenarios = requestedName
  ? [scenarios.get(requestedName)].filter((scenario) => scenario !== undefined)
  : fulfillmentScenarios;

if (requestedName && selectedScenarios.length === 0) {
  console.error(
    `Unknown scenario "${requestedName}". Available scenarios: ${[
      ...scenarios.keys(),
    ].join(", ")}`,
  );
  process.exitCode = 1;
} else {
  selectedScenarios.forEach((scenario, scenarioIndex) => {
    if (scenarioIndex > 0) {
      console.log("\n" + "=".repeat(80) + "\n");
    }

    printScenario(scenario);
  });
}

function printScenario(scenario: (typeof fulfillmentScenarios)[number]): void {
  const result = runScenario(scenario);

  console.log(`Scenario: ${result.scenario.name}`);
  console.log(result.scenario.description);

  result.steps.forEach((step, index) => {
    console.log(
      `\n[${index + 1}/${result.steps.length}] ${step.event.eventType} (${step.event.eventId})`,
    );
    console.log(formatEventSummary(step.event));

    if (step.assessments.length === 0) {
      console.log("No orders to assess.");
      return;
    }

    if (step.statusChanges.length === 0) {
      console.log("No fulfillment status changes.");
      return;
    }

    for (const change of step.statusChanges) {
      const transition =
        change.previousStatus === null
          ? `initial assessment ${change.currentStatus}`
          : `${change.previousStatus} -> ${change.currentStatus}`;

      console.log(`\n${change.orderId}: ${transition}`);

      const assessment = step.assessments.find(
        (candidate) => candidate.orderId === change.orderId,
      );

      if (assessment) {
        printAssessment(assessment, step.event);
      }
    }
  });
}

function formatEventSummary(event: OperationalEvent): string {
  switch (event.eventType) {
    case "InventoryPositionReported": {
      const {
        warehouseId,
        sku,
        usableQuantity,
        reservedQuantity,
        unusableQuantity,
      } = event.payload;

      return (
        `${warehouseId} / ${sku}: ${usableQuantity} usable, ` +
        `${reservedQuantity} reserved, ${unusableQuantity} unusable`
      );
    }

    case "OrderPlaced": {
      const { orderId, requiredShipAt, lines } = event.payload;

      return lines
        .map(
          (line) =>
            `${orderId}: ${line.quantity} ${line.sku} units required ` +
            `from ${line.fulfillmentWarehouseId} by ${requiredShipAt}`,
        )
        .join("\n");
    }

    case "InboundShipmentConfirmed": {
      const { shipmentId, destinationWarehouseId, expectedAvailableAt, lines } =
        event.payload;

      return lines
        .map(
          (line) =>
            `${shipmentId}: ${line.quantity} ${line.sku} units expected ` +
            `at ${destinationWarehouseId} on ${expectedAvailableAt}`,
        )
        .join("\n");
    }

    case "InboundShipmentDelayed": {
      const {
        shipmentId,
        previousExpectedAvailableAt,
        newExpectedAvailableAt,
      } = event.payload;

      return (
        `${shipmentId}: delayed from ${previousExpectedAvailableAt} ` +
        `to ${newExpectedAvailableAt}`
      );
    }
  }
}

function printAssessment(
  assessment: OrderFulfillmentAssessment,
  currentEvent: OperationalEvent,
): void {
  console.log(`Required ship time: ${assessment.requiredShipAt}`);

  for (const line of assessment.lines) {
    console.log(
      `  ${line.orderLineId} / ${line.sku} / ${line.fulfillmentWarehouseId}`,
    );
    console.log(`    Required: ${line.requiredQuantity}`);
    console.log(`    Projected allocation: ${line.projectedAllocation}`);

    for (const contribution of line.supplyContributions) {
      console.log(`      - ${formatSupplyContribution(contribution)}`);
    }

    console.log(`    Shortfall: ${line.projectedShortfall}`);

    for (const condition of line.blockingConditions) {
      console.log(`    Blocker: ${formatBlockingCondition(condition)}`);
    }

    for (const change of line.triggeringChanges) {
      if (shouldPrintTrigger(change, currentEvent)) {
        console.log(`    Trigger: ${formatTriggeringChange(change)}`);
      }
    }
  }
}

function formatSupplyContribution(contribution: SupplyContribution): string {
  switch (contribution.type) {
    case "ON_HAND":
      return `${contribution.quantity} on hand at ${contribution.warehouseId}`;

    case "INBOUND":
      return (
        `${contribution.quantity} from ${contribution.shipmentId}, expected ` +
        `${contribution.expectedAvailableAt}`
      );
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

function shouldPrintTrigger(
  change: TriggeringChange,
  currentEvent: OperationalEvent,
): boolean {
  return (
    currentEvent.eventType === "InboundShipmentDelayed" &&
    change.type === "SHIPMENT_DELAYED" &&
    change.shipmentId === currentEvent.payload.shipmentId
  );
}

function formatTriggeringChange(change: TriggeringChange): string {
  switch (change.type) {
    case "SHIPMENT_DELAYED":
      return (
        `${change.shipmentId} delayed from ` +
        `${change.previousExpectedAvailableAt} to ` +
        `${change.newExpectedAvailableAt}`
      );
  }
}
