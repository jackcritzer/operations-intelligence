import { Type } from "@sinclair/typebox";

export const NonBlankStringSchema = Type.String({
  minLength: 1,
  maxLength: 200,
  pattern: ".*\\S.*",
});

export const TimestampSchema = Type.String({
  format: "date-time",
});

export const EventSourceSchema = Type.Union([
  Type.Literal("ERP"),
  Type.Literal("WMS"),
  Type.Literal("SUPPLIER_INTEGRATION"),
  Type.Literal("TRANSPORTATION_INTEGRATION"),
]);