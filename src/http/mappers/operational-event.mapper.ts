import type { InboundShipmentDelayedEvent } from "../../events/operational-event.js";
import type { InboundShipmentDelayedRequest } from "../schemas/operational-event.schema.js";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function mapInboundShipmentDelayedRequest(
  request: InboundShipmentDelayedRequest,
  clock: Clock = systemClock,
): InboundShipmentDelayedEvent {
  return {
    eventId: request.eventId,
    eventType: request.eventType,
    occurredAt: request.occurredAt,
    receivedAt: clock.now().toISOString(),
    source: request.source,
    payload: {
      shipmentId: request.payload.shipmentId,
      previousExpectedAvailableAt:
        request.payload.previousExpectedAvailableAt,
      newExpectedAvailableAt: request.payload.newExpectedAvailableAt,
      ...(request.payload.reason === undefined
        ? {}
        : { reason: request.payload.reason }),
    },
  };
}