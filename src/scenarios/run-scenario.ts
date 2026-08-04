import type { OperationalEvent } from "../events/operational-event.js";
import {
  type OrderFulfillmentAssessment,
  type FulfillmentStatus,
} from "../fulfillment/fulfillment-result.js";
import { calculateFulfillment } from "../fulfillment/calculate-fulfillment.js";
import { applyEvent } from "../state/apply-event.js";
import { createEmptyOperationalState } from "../state/operational-state.js";

export interface ScenarioDefinition {
  name: string;
  description: string;
  events: OperationalEvent[];
}

export interface FulfillmentStatusChange {
  orderId: string;
  previousStatus: FulfillmentStatus | null;
  currentStatus: FulfillmentStatus;
}

export interface ScenarioStep {
  event: OperationalEvent;
  assessments: OrderFulfillmentAssessment[];
  statusChanges: FulfillmentStatusChange[];
}

export interface ScenarioRun {
  scenario: ScenarioDefinition;
  steps: ScenarioStep[];
}

// Runs a scenario by applying each event in order, recalculating fulfillment after each event,
// and recording any changes in fulfillment status after each event. Returns a ScenarioRun object
// containing the scenario definition and the results of each step.
export function runScenario(scenario: ScenarioDefinition): ScenarioRun {
  const state = createEmptyOperationalState();
  const previousStatuses = new Map<string, FulfillmentStatus>();
  const steps: ScenarioStep[] = [];

  for (const event of scenario.events) {
    applyEvent(state, event);

    const assessments = calculateFulfillment(state);
    const statusChanges = assessments.flatMap((assessment) => {
      const previousStatus = previousStatuses.get(assessment.orderId) ?? null;

      if (previousStatus === assessment.status) {
        return [];
      }

      return [
        {
          orderId: assessment.orderId,
          previousStatus,
          currentStatus: assessment.status,
        },
      ];
    });

    for (const assessment of assessments) {
      previousStatuses.set(assessment.orderId, assessment.status);
    }

    steps.push({ event, assessments, statusChanges });
  }

  return { scenario, steps };
}
