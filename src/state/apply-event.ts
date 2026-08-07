import type { OperationalEvent } from "../events/operational-event.js";
import {
  inventoryPositionKey,
  type OperationalState,
  type InboundShipment,
  type InventoryPosition,
  type ShipmentAvailabilityChange,
  type CustomerOrder,
} from "./operational-state.js";
import { EventApplicationError } from "../application/errors/event-application-error.js";

export function applyEvent(
  state: OperationalState,
  event: OperationalEvent,
): void {
  if (state.processedEventIds.has(event.eventId)) {
    return;
  }

  switch (event.eventType) {
    case "OrderPlaced":
      applyOrderPlaced(state, event);
      break;

    case "InventoryPositionReported":
      applyInventoryPositionReported(state, event);
      break;

    case "InboundShipmentConfirmed":
      applyInboundShipmentConfirmed(state, event);
      break;

    case "InboundShipmentDelayed":
      applyInboundShipmentDelayed(state, event);
      break;

    default:
      assertNever(event);
  }

  state.processedEventIds.add(event.eventId);
}

function applyOrderPlaced(
  state: OperationalState,
  event: Extract<OperationalEvent, { eventType: "OrderPlaced" }>,
): void {
  if (event.payload.lines.length === 0) {
    throw new EventApplicationError({
      code: "INVALID_EVENT_DATA",
      message: `Order ${event.payload.orderId} must contain at least one line`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        orderId: event.payload.orderId,
      },
    });
  }

  if (state.orders.has(event.payload.orderId)) {
    throw new EventApplicationError({
      code: "ORDER_ALREADY_EXISTS",
      message: `Order ${event.payload.orderId} already exists`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        orderId: event.payload.orderId,
      },
    });
  }

  validatePositiveQuantities(
    event.payload.lines.map((line) => ({
      name: `Order line ${line.orderLineId}`,
      quantity: line.quantity,
    })),
  );

  const newOrder: CustomerOrder = {
    orderId: event.payload.orderId,
    placedAt: event.payload.placedAt,
    requiredShipAt: event.payload.requiredShipAt,
    status: "OPEN",
    lines: event.payload.lines.map((line) => ({
      orderLineId: line.orderLineId,
      sku: line.sku,
      quantity: line.quantity,
      fulfillmentWarehouseId: line.fulfillmentWarehouseId,
    })),
  };

  state.orders.set(newOrder.orderId, newOrder);
}

function applyInventoryPositionReported(
  state: OperationalState,
  event: Extract<OperationalEvent, { eventType: "InventoryPositionReported" }>,
): void {
  if (event.payload.reservedQuantity > event.payload.usableQuantity) {
    throw new EventApplicationError({
      code: "INVALID_EVENT_DATA",
      message:
        `Reserved quantity cannot exceed usable quantity for ` +
        `${event.payload.warehouseId}:${event.payload.sku}`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        warehouseId: event.payload.warehouseId,
        sku: event.payload.sku,
      },
    });
  }

  validateNonNegativeQuantities([
    {
      name: "Usable quantity",
      quantity: event.payload.usableQuantity,
    },
    {
      name: "Reserved quantity",
      quantity: event.payload.reservedQuantity,
    },
    {
      name: "Unusable quantity",
      quantity: event.payload.unusableQuantity,
    },
  ]);

  const position: InventoryPosition = {
    warehouseId: event.payload.warehouseId,
    sku: event.payload.sku,
    usableQuantity: event.payload.usableQuantity,
    reservedQuantity: event.payload.reservedQuantity,
    unusableQuantity: event.payload.unusableQuantity,
    reportedAt: event.occurredAt,
  };

  state.inventoryPositions.set(
    inventoryPositionKey(position.warehouseId, position.sku),
    position,
  );
}

function applyInboundShipmentConfirmed(
  state: OperationalState,
  event: Extract<OperationalEvent, { eventType: "InboundShipmentConfirmed" }>,
): void {
  if (state.inboundShipments.has(event.payload.shipmentId)) {
    throw new EventApplicationError({
      code: "INBOUND_SHIPMENT_ALREADY_EXISTS",
      message: `Inbound shipment ${event.payload.shipmentId} already exists`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        shipmentId: event.payload.shipmentId,
      },
    });
  }

  if (event.payload.lines.length === 0) {
    throw new EventApplicationError({
      code: "INVALID_EVENT_DATA",
      message: `Inbound shipment ${event.payload.shipmentId} must contain at least one line`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        shipmentId: event.payload.shipmentId,
      },
    });
  }

  validatePositiveQuantities(
    event.payload.lines.map((line) => ({
      name: `Shipment line ${line.shipmentLineId}`,
      quantity: line.quantity,
    })),
    event.eventId,
    event.eventType,
    event.payload.shipmentId,
  );

  const shipment: InboundShipment = {
    shipmentId: event.payload.shipmentId,
    destinationWarehouseId: event.payload.destinationWarehouseId,
    expectedAvailableAt: event.payload.expectedAvailableAt,
    status: "CONFIRMED",
    lines: event.payload.lines.map((line) => ({
      shipmentLineId: line.shipmentLineId,
      sku: line.sku,
      quantity: line.quantity,
    })),
  };

  state.inboundShipments.set(shipment.shipmentId, shipment);
}

function applyInboundShipmentDelayed(
  state: OperationalState,
  event: Extract<OperationalEvent, { eventType: "InboundShipmentDelayed" }>,
): void {
  const shipment = state.inboundShipments.get(event.payload.shipmentId);
  if (!shipment) {
    throw new EventApplicationError({
      code: "INBOUND_SHIPMENT_NOT_FOUND",
      message: `Inbound shipment ${event.payload.shipmentId} does not exist`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        shipmentId: event.payload.shipmentId,
      },
    });
  }

  // Confirm that the event was based on the current shipment state.
  // A mismatch indicates a stale or out-of-order update.
  if (
    shipment.expectedAvailableAt !== event.payload.previousExpectedAvailableAt
  ) {
    throw new EventApplicationError({
      code: "INBOUND_SHIPMENT_EXPECTATION_MISMATCH",
      message:
        `Shipment ${shipment.shipmentId} expected availability does not match ` +
        `the delay event's previous value`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        shipmentId: event.payload.shipmentId,
      },
    });
  }

  if (
    parseTimestamp(
      event.payload.newExpectedAvailableAt,
      "New expected availability",
    ) <=
    parseTimestamp(
      event.payload.previousExpectedAvailableAt,
      "Previous expected availability",
    )
  ) {
    throw new EventApplicationError({
      code: "INVALID_EVENT_DATA",
      message: `Shipment ${shipment.shipmentId} delay must move availability later`,
      details: {
        eventId: event.eventId,
        eventType: event.eventType,
        shipmentId: event.payload.shipmentId,
      },
    });
  }

  const updatedShipment: InboundShipment = {
    ...shipment,
    expectedAvailableAt: event.payload.newExpectedAvailableAt,
  };

  state.inboundShipments.set(updatedShipment.shipmentId, updatedShipment);

  const change: ShipmentAvailabilityChange = {
    shipmentId: shipment.shipmentId,
    previousExpectedAvailableAt: event.payload.previousExpectedAvailableAt,
    newExpectedAvailableAt: event.payload.newExpectedAvailableAt,
    changedAt: event.occurredAt,
  };

  if (event.payload.reason !== undefined) {
    change.reason = event.payload.reason;
  }

  state.shipmentAvailabilityChanges.set(shipment.shipmentId, change);
}

function validatePositiveQuantities(
  values: Array<{ name: string; quantity: number }> = [],
  eventId?: string,
  eventType?: string,
  shipmentId?: string,
): void {
  for (const value of values) {
    if (!Number.isInteger(value.quantity) || value.quantity <= 0) {
      throw new EventApplicationError({
        code: "INVALID_EVENT_DATA",
        message: `${value.name} quantity must be a positive integer`,
        details: {
          eventId: eventId,
          eventType: eventType,
          shipmentId: shipmentId,
        },
      });
    }
  }
}

function validateNonNegativeQuantities(
  values: Array<{ name: string; quantity: number }>,
  eventId?: string,
  eventType?: string,
  shipmentId?: string,
): void {
  for (const value of values) {
    if (!Number.isInteger(value.quantity) || value.quantity < 0) {
      throw new EventApplicationError({
        code: "INVALID_EVENT_DATA",
        message: `${value.name} must be a non-negative integer`,
        details: {
          eventId: eventId,
          eventType: eventType,
          shipmentId: shipmentId,
        },
      });
    }
  }
}

function assertNever(value: never): never {
  throw new EventApplicationError({
    code: "INVALID_EVENT_DATA",
    message: `Unsupported event: ${JSON.stringify(value)}`,
  });
}

function parseTimestamp(value: string, fieldName: string): number {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new EventApplicationError({
      code: "INVALID_EVENT_DATA",
      message: `${fieldName} must be a valid timestamp`,
    });
  }

  return parsed;
}
