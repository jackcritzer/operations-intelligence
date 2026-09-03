import type { OperationalEvent } from "../events/operational-event.js";
import { calculateFulfillment } from "../fulfillment/calculate-fulfillment.js";
import { compareFulfillmentAssessments } from "../fulfillment/compare-fulfillment-assessments.js";
import type { FulfillmentAssessmentComparison } from "../fulfillment/fulfillment-assessment-comparison.js";
import { applyEvent } from "../state/apply-event.js";
import {
  cloneOperationalState,
  replaceOperationalState,
  type OperationalState,
} from "../state/operational-state.js";
import { EventIdentityConflictError } from "./errors/event-identity-conflict-error.js";

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

export interface AcceptedEventStore {
  insertOrGet(
    event: OperationalEvent,
    fingerprint: string,
  ): Promise<
    | {
        status: "INSERTED";
        event: {
          eventFingerprint: string;
        };
      }
    | {
        status: "EXISTING";
        event: {
          eventFingerprint: string;
        };
      }
  >;
}

export async function processOperationalEvent(
  state: OperationalState,
  event: OperationalEvent,
  fingerprint: string,
  eventStore: AcceptedEventStore,
): Promise<ProcessOperationalEventResult> {
  const stagedState = cloneOperationalState(state);
  const before = calculateFulfillment(state);

  const applicationResult = applyEvent(stagedState, event);

  const persistenceResult = await eventStore.insertOrGet(event, fingerprint);

  if (persistenceResult.status === "EXISTING") {
    if (persistenceResult.event.eventFingerprint !== fingerprint) {
      throw new EventIdentityConflictError(event.eventId);
    }

    return {
      eventId: event.eventId,
      status: "DUPLICATE",
      impact: {
        changedOrders: [],
      },
    };
  }

  if (applicationResult.status === "DUPLICATE") {
    throw new Error(
      `Event ${event.eventId} exists in operational state but not in durable history`,
    );
  }

  const after = calculateFulfillment(stagedState);
  const impact = compareFulfillmentAssessments(before, after);

  replaceOperationalState(state, stagedState);

  return {
    eventId: event.eventId,
    status: "APPLIED",
    impact,
  };
}
