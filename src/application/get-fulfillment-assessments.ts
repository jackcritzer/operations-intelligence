import { calculateFulfillment } from "../fulfillment/calculate-fulfillment.js";
import type { OrderFulfillmentAssessment } from "../fulfillment/fulfillment-result.js";
import type { OperationalState } from "../state/operational-state.js";

export function getFulfillmentAssessments(
  state: OperationalState,
): OrderFulfillmentAssessment[] {
  return calculateFulfillment(state);
}
