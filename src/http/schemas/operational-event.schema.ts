import { Type, type Static } from "@sinclair/typebox";

import {
  EventSourceSchema,
  NonBlankStringSchema,
  TimestampSchema,
} from "./common.schema.js";

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

export type InboundShipmentDelayedRequest = Static<
  typeof InboundShipmentDelayedRequestSchema
>;
