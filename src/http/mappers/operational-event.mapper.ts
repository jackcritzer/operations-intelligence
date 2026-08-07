import type { OperationalEvent } from "../../events/operational-event.js";
import type { OperationalEventRequest } from "../schemas/operational-event.schema.js";

export interface Clock {
  now(): Date;
}

export function mapOperationalEventRequest(
  request: OperationalEventRequest,
  clock: Clock,
): OperationalEvent {
  const receivedAt = clock.now().toISOString();

  switch (request.eventType) {
    case "OrderPlaced":
      return {
        eventId: request.eventId,
        eventType: request.eventType,
        occurredAt: request.occurredAt,
        receivedAt,
        source: request.source,
        payload: request.payload,
      };

    case "InventoryPositionReported":
      return {
        eventId: request.eventId,
        eventType: request.eventType,
        occurredAt: request.occurredAt,
        receivedAt,
        source: request.source,
        payload: request.payload,
      };

    case "InboundShipmentConfirmed":
      return {
        eventId: request.eventId,
        eventType: request.eventType,
        occurredAt: request.occurredAt,
        receivedAt,
        source: request.source,
        payload: request.payload,
      };

    case "InboundShipmentDelayed":
      return {
        eventId: request.eventId,
        eventType: request.eventType,
        occurredAt: request.occurredAt,
        receivedAt,
        source: request.source,
        payload: request.payload,
      };

    default:
      return assertNever(request);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported operational event: ${JSON.stringify(value)}`);
}
