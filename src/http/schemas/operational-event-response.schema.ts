import { Type, type Static } from "@sinclair/typebox";

import {
  OrderFulfillmentAssessmentSchema,
  OrderLineFulfillmentAssessmentSchema,
} from "./fulfillment-assessment.schema.js";
import { NonBlankStringSchema } from "./common.schema.js";

const OrderFulfillmentChangeTypeSchema = Type.Union([
  Type.Literal("ADDED"),
  Type.Literal("REMOVED"),
  Type.Literal("BECAME_BLOCKED"),
  Type.Literal("BECAME_FULFILLABLE"),
  Type.Literal("DETAILS_CHANGED"),
]);

const OrderLineFulfillmentChangeSchema = Type.Object(
  {
    orderLineId: NonBlankStringSchema,
    before: Type.Optional(OrderLineFulfillmentAssessmentSchema),
    after: Type.Optional(OrderLineFulfillmentAssessmentSchema),
  },
  {
    additionalProperties: false,
  },
);

const OrderFulfillmentChangeSchema = Type.Object(
  {
    orderId: NonBlankStringSchema,
    type: OrderFulfillmentChangeTypeSchema,
    before: Type.Optional(OrderFulfillmentAssessmentSchema),
    after: Type.Optional(OrderFulfillmentAssessmentSchema),
    changedLines: Type.Array(OrderLineFulfillmentChangeSchema),
  },
  {
    additionalProperties: false,
  },
);

const FulfillmentImpactSchema = Type.Object(
  {
    changedOrders: Type.Array(OrderFulfillmentChangeSchema),
  },
  {
    additionalProperties: false,
  },
);

export const OperationalEventResponseSchema = Type.Object(
  {
    eventId: NonBlankStringSchema,
    status: Type.Union([Type.Literal("APPLIED"), Type.Literal("DUPLICATE")]),
    impact: FulfillmentImpactSchema,
  },
  {
    additionalProperties: false,
  },
);

export type OperationalEventResponse = Static<
  typeof OperationalEventResponseSchema
>;
