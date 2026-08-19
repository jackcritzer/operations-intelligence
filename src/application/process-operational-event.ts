import type { OperationalEvent } from "../events/operational-event.js";
import { calculateFulfillment } from "../fulfillment/calculate-fulfillment.js";
import { compareFulfillmentAssessments } from "../fulfillment/compare-fulfillment-assessments.js";
import type { FulfillmentAssessmentComparison } from "../fulfillment/fulfillment-assessment-comparison.js";
import { applyEvent } from "../state/apply-event.js";
import type { OperationalState } from "../state/operational-state.js";

export type ProcessOperationalEventResult =
  | {
      eventId: string;
      status: "APPLIED";
      impact: FulfillmentAssessmentComparison;
    }
  | {
      eventId: string;
      status: "DUPLICATE";
      impact: {
        changedOrders: [];
      };
    };

export function processOperationalEvent(
  state: OperationalState,
  event: OperationalEvent,
): ProcessOperationalEventResult {
  if (state.processedEventIds.has(event.eventId)) {
    return {
      eventId: event.eventId,
      status: "DUPLICATE",
      impact: {
        changedOrders: [],
      },
    };
  }

  const before = calculateFulfillment(state);

  const applicationResult = applyEvent(state, event);

  if (applicationResult.status === "DUPLICATE") {
    return {
      eventId: event.eventId,
      status: "DUPLICATE",
      impact: {
        changedOrders: [],
      },
    };
  }

  const after = calculateFulfillment(state);

  return {
    eventId: event.eventId,
    status: "APPLIED",
    impact: compareFulfillmentAssessments(before, after),
  };
}
