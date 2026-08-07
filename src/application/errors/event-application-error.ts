export type EventApplicationErrorCode =
  | "ORDER_ALREADY_EXISTS"
  | "INVENTORY_POSITION_ALREADY_EXISTS"
  | "INBOUND_SHIPMENT_ALREADY_EXISTS"
  | "INBOUND_SHIPMENT_NOT_FOUND"
  | "INBOUND_SHIPMENT_EXPECTATION_MISMATCH"
  | "INVALID_EVENT_DATA";

export interface EventApplicationErrorOptions {
  code: EventApplicationErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}
export class EventApplicationError extends Error {
  readonly code: EventApplicationErrorCode;
  readonly details?: Record<string, unknown> | undefined;

  constructor(options: EventApplicationErrorOptions) {
    super(options.message, {
      cause: options.cause,
    });

    this.name = "EventApplicationError";
    this.code = options.code;
    this.details = options.details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
