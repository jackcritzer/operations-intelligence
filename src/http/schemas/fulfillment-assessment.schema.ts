import { Type, type Static } from "@sinclair/typebox";

import { NonBlankStringSchema, TimestampSchema } from "./common.schema.js";

const NonNegativeIntegerSchema = Type.Integer({
  minimum: 0,
});

const FulfillmentStatusSchema = Type.Union([
  Type.Literal("FULFILLABLE"),
  Type.Literal("BLOCKED"),
]);

const OnHandSupplyContributionSchema = Type.Object(
  {
    type: Type.Literal("ON_HAND"),
    warehouseId: NonBlankStringSchema,
    sku: NonBlankStringSchema,
    quantity: NonNegativeIntegerSchema,
  },
  {
    additionalProperties: false,
  },
);

const InboundSupplyContributionSchema = Type.Object(
  {
    type: Type.Literal("INBOUND"),
    shipmentId: NonBlankStringSchema,
    shipmentLineId: NonBlankStringSchema,
    warehouseId: NonBlankStringSchema,
    sku: NonBlankStringSchema,
    quantity: NonNegativeIntegerSchema,
    expectedAvailableAt: TimestampSchema,
  },
  {
    additionalProperties: false,
  },
);

const SupplyContributionSchema = Type.Union([
  OnHandSupplyContributionSchema,
  InboundSupplyContributionSchema,
]);

const LateInboundSupplyConditionSchema = Type.Object(
  {
    type: Type.Literal("INBOUND_AVAILABLE_TOO_LATE"),
    shipmentId: NonBlankStringSchema,
    shipmentLineId: NonBlankStringSchema,
    quantity: NonNegativeIntegerSchema,
    expectedAvailableAt: TimestampSchema,
    requiredShipAt: TimestampSchema,
  },
  {
    additionalProperties: false,
  },
);

const HigherPriorityDemandConditionSchema = Type.Object(
  {
    type: Type.Literal("SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND"),
    quantity: NonNegativeIntegerSchema,
    consumingOrderId: NonBlankStringSchema,
    consumingOrderLineId: NonBlankStringSchema,
  },
  {
    additionalProperties: false,
  },
);

const UndeterminedShortfallConditionSchema = Type.Object(
  {
    type: Type.Literal("SHORTFALL_CAUSE_UNDETERMINED"),
    quantity: NonNegativeIntegerSchema,
  },
  {
    additionalProperties: false,
  },
);

const BlockingConditionSchema = Type.Union([
  LateInboundSupplyConditionSchema,
  HigherPriorityDemandConditionSchema,
  UndeterminedShortfallConditionSchema,
]);

const TriggeringChangeSchema = Type.Object(
  {
    type: Type.Literal("SHIPMENT_DELAYED"),
    shipmentId: NonBlankStringSchema,
    previousExpectedAvailableAt: TimestampSchema,
    newExpectedAvailableAt: TimestampSchema,
    changedAt: TimestampSchema,
    reason: Type.Optional(NonBlankStringSchema),
  },
  {
    additionalProperties: false,
  },
);

export const OrderLineFulfillmentAssessmentSchema = Type.Object(
  {
    orderLineId: NonBlankStringSchema,
    sku: NonBlankStringSchema,
    fulfillmentWarehouseId: NonBlankStringSchema,
    requiredQuantity: NonNegativeIntegerSchema,
    projectedAllocation: NonNegativeIntegerSchema,
    projectedShortfall: NonNegativeIntegerSchema,
    status: FulfillmentStatusSchema,
    supplyContributions: Type.Array(SupplyContributionSchema),
    blockingConditions: Type.Array(BlockingConditionSchema),
    triggeringChanges: Type.Array(TriggeringChangeSchema),
  },
  {
    additionalProperties: false,
  },
);

export const OrderFulfillmentAssessmentSchema = Type.Object(
  {
    orderId: NonBlankStringSchema,
    requiredShipAt: TimestampSchema,
    status: FulfillmentStatusSchema,
    lines: Type.Array(OrderLineFulfillmentAssessmentSchema),
  },
  {
    additionalProperties: false,
  },
);

export const FulfillmentAssessmentsResponseSchema = Type.Array(
  OrderFulfillmentAssessmentSchema,
);

export type FulfillmentAssessmentsResponse = Static<
  typeof FulfillmentAssessmentsResponseSchema
>;
