import type { OperationalEvent } from "../events/operational-event.js";
import type { OrderFulfillmentAssessment } from "../fulfillment/fulfillment-assessment.js";
import type { FulfillmentAssessmentComparison } from "../fulfillment/fulfillment-assessment-comparison.js";
import type { ScenarioRun } from "../scenarios/run-scenario.js";

export interface ImpactExplorerView {
  scenario: {
    name: string;
    description: string;
  };
  defaultStepIndex: number;
  steps: ImpactExplorerStep[];
}

export interface ImpactExplorerStep {
  index: number;
  title: string;
  event: OperationalEvent;
  assessments: OrderFulfillmentAssessment[];
  impact: FulfillmentAssessmentComparison;
}

export function buildImpactExplorerView(
  scenarioRun: ScenarioRun,
  defaultEventId: string,
): ImpactExplorerView {
  const defaultStepIndex = scenarioRun.steps.findIndex(
    (step) => step.event.eventId === defaultEventId,
  );

  if (defaultStepIndex === -1) {
    throw new Error(`Default explorer event "${defaultEventId}" was not found`);
  }

  return {
    scenario: {
      name: scenarioRun.scenario.name,
      description: scenarioRun.scenario.description,
    },
    defaultStepIndex,
    steps: scenarioRun.steps.map((step, index) => ({
      index,
      title: getEventTitle(step.event),
      event: step.event,
      assessments: step.assessments,
      impact: step.impact,
    })),
  };
}

function getEventTitle(event: OperationalEvent): string {
  switch (event.eventType) {
    case "InventoryPositionReported":
      return "Inventory position reported";

    case "OrderPlaced":
      return "Customer order placed";

    case "InboundShipmentConfirmed":
      return "Inbound shipment confirmed";

    case "InboundShipmentDelayed":
      return "Inbound shipment delayed";
  }
}
