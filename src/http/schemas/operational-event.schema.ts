import { Type, type Static } from "@sinclair/typebox";

import {
  EventSourceSchema,
  NonBlankStringSchema,
  TimestampSchema,
} from "./common.schema.js";

const PositiveIntegerSchema = Type.Integer({
  minimum: 1,
});

const NonNegativeIntegerSchema = Type.Integer({
  minimum: 0,
});

export const OrderPlacedRequestSchema = Type.Object(
  {
    eventId: NonBlankStringSchema,
    eventType: Type.Literal("OrderPlaced"),
    occurredAt: TimestampSchema,
    source: EventSourceSchema,
    payload: Type.Object(
      {
        orderId: NonBlankStringSchema,
        placedAt: TimestampSchema,
        requiredShipAt: TimestampSchema,
        lines: Type.Array(
          Type.Object(
            {
              orderLineId: NonBlankStringSchema,
              sku: NonBlankStringSchema,
              quantity: PositiveIntegerSchema,
              fulfillmentWarehouseId: NonBlankStringSchema,
            },
            {
              additionalProperties: false,
            },
          ),
          {
            minItems: 1,
          },
        ),
      },
      {
        additionalProperties: false,
      },
    ),
  },
  {
    additionalProperties: false,
  },
);

export const InventoryPositionReportedRequestSchema = Type.Object(
  {
    eventId: NonBlankStringSchema,
    eventType: Type.Literal("InventoryPositionReported"),
    occurredAt: TimestampSchema,
    source: EventSourceSchema,
    payload: Type.Object(
      {
        warehouseId: NonBlankStringSchema,
        sku: NonBlankStringSchema,
        usableQuantity: NonNegativeIntegerSchema,
        reservedQuantity: NonNegativeIntegerSchema,
        unusableQuantity: NonNegativeIntegerSchema,
      },
      {
        additionalProperties: false,
      },
    ),
  },
  {
    additionalProperties: false,
  },
);

export const InboundShipmentConfirmedRequestSchema = Type.Object(
  {
    eventId: NonBlankStringSchema,
    eventType: Type.Literal("InboundShipmentConfirmed"),
    occurredAt: TimestampSchema,
    source: EventSourceSchema,
    payload: Type.Object(
      {
        shipmentId: NonBlankStringSchema,
        destinationWarehouseId: NonBlankStringSchema,
        expectedAvailableAt: TimestampSchema,
        lines: Type.Array(
          Type.Object(
            {
              shipmentLineId: NonBlankStringSchema,
              sku: NonBlankStringSchema,
              quantity: PositiveIntegerSchema,
            },
            {
              additionalProperties: false,
            },
          ),
          {
            minItems: 1,
          },
        ),
      },
      {
        additionalProperties: false,
      },
    ),
  },
  {
    additionalProperties: false,
  },
);

export const InboundShipmentDelayedRequestSchema = Type.Object(
  {
    eventId: NonBlankStringSchema,
    eventType: Type.Literal("InboundShipmentDelayed"),
    occurredAt: TimestampSchema,
    source: EventSourceSchema,
    payload: Type.Object(
      {
        shipmentId: NonBlankStringSchema,
        previousExpectedAvailableAt: TimestampSchema,
        newExpectedAvailableAt: TimestampSchema,
        reason: Type.Optional(
          Type.String({
            minLength: 1,
            maxLength: 500,
            pattern: ".*\\S.*",
          }),
        ),
      },
      {
        additionalProperties: false,
      },
    ),
  },
  {
    additionalProperties: false,
  },
);

export const OperationalEventRequestSchema = Type.Union([
  OrderPlacedRequestSchema,
  InventoryPositionReportedRequestSchema,
  InboundShipmentConfirmedRequestSchema,
  InboundShipmentDelayedRequestSchema,
]);

export type OrderPlacedRequest = Static<typeof OrderPlacedRequestSchema>;

export type InventoryPositionReportedRequest = Static<
  typeof InventoryPositionReportedRequestSchema
>;

export type InboundShipmentConfirmedRequest = Static<
  typeof InboundShipmentConfirmedRequestSchema
>;

export type InboundShipmentDelayedRequest = Static<
  typeof InboundShipmentDelayedRequestSchema
>;

export type OperationalEventRequest = Static<
  typeof OperationalEventRequestSchema
>;
