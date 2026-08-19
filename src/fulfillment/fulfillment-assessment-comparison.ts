import type {
  OrderFulfillmentAssessment,
  OrderLineFulfillmentAssessment,
} from "./fulfillment-assessment.js";

export type OrderFulfillmentChangeType =
  | "ADDED"
  | "REMOVED"
  | "BECAME_BLOCKED"
  | "BECAME_FULFILLABLE"
  | "DETAILS_CHANGED";

export interface FulfillmentAssessmentComparison {
  changedOrders: OrderFulfillmentChange[];
}

export interface OrderFulfillmentChange {
  orderId: string;
  type: OrderFulfillmentChangeType;
  before?: OrderFulfillmentAssessment;
  after?: OrderFulfillmentAssessment;
  changedLines: OrderLineFulfillmentChange[];
}

export interface OrderLineFulfillmentChange {
  orderLineId: string;
  before?: OrderLineFulfillmentAssessment;
  after?: OrderLineFulfillmentAssessment;
}
