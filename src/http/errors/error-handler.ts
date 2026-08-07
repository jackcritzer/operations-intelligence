import { EventApplicationError } from "../../application/errors/event-application-error.js";
interface FastifyValidationError extends Error {
  code: string;
  validation: unknown;
}

export function isFastifyValidationError(
  error: unknown,
): error is FastifyValidationError {
  return (
    error instanceof Error &&
    "validation" in error &&
    "code" in error &&
    typeof error.code === "string"
  );
}

export interface HttpError extends Error {
  code?: string;
  statusCode: number;
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

export function statusForEventApplicationError(
  error: EventApplicationError,
): number {
  switch (error.code) {
    case "ORDER_ALREADY_EXISTS":
    case "INVENTORY_POSITION_ALREADY_EXISTS":
    case "INBOUND_SHIPMENT_ALREADY_EXISTS":
    case "INBOUND_SHIPMENT_NOT_FOUND":
    case "INBOUND_SHIPMENT_EXPECTATION_MISMATCH":
      return 409;

    case "INVALID_EVENT_DATA":
      return 422;
  }
}
