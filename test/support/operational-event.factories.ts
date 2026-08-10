import type {
  InboundShipmentConfirmedEvent,
  InboundShipmentDelayedEvent,
  InventoryPositionReportedEvent,
  OrderPlacedEvent,
} from "../../src/events/operational-event.js";

export const defaultRequiredShipAt = "2026-08-10T17:00:00.000Z";

export function inventory(
  warehouseId: string,
  sku: string,
  usableQuantity: number,
  reservedQuantity = 0,
  unusableQuantity = 0,
): InventoryPositionReportedEvent {
  return {
    eventId: `inventory-${warehouseId}-${sku}`,
    eventType: "InventoryPositionReported",
    occurredAt: "2026-08-01T08:00:00.000Z",
    receivedAt: "2026-08-01T08:00:01.000Z",
    source: "WMS",
    payload: {
      warehouseId,
      sku,
      usableQuantity,
      reservedQuantity,
      unusableQuantity,
    },
  };
}

export function order(
  orderId: string,
  options: {
    placedAt?: string;
    requiredShipAt?: string;
    lines?: OrderPlacedEvent["payload"]["lines"];
  } = {},
): OrderPlacedEvent {
  const placedAt = options.placedAt ?? "2026-08-01T09:00:00.000Z";

  return {
    eventId: `order-${orderId}`,
    eventType: "OrderPlaced",
    occurredAt: placedAt,
    receivedAt: placedAt,
    source: "ERP",
    payload: {
      orderId,
      placedAt,
      requiredShipAt: options.requiredShipAt ?? defaultRequiredShipAt,
      lines: options.lines ?? [
        {
          orderLineId: `${orderId}-L1`,
          sku: "BRG-440",
          quantity: 4,
          fulfillmentWarehouseId: "CHI",
        },
      ],
    },
  };
}

export function inbound(
  shipmentId: string,
  options: {
    expectedAvailableAt: string;
    warehouseId?: string;
    sku?: string;
    quantity?: number;
  },
): InboundShipmentConfirmedEvent {
  return {
    eventId: `inbound-${shipmentId}`,
    eventType: "InboundShipmentConfirmed",
    occurredAt: "2026-08-02T10:00:00.000Z",
    receivedAt: "2026-08-02T10:00:01.000Z",
    source: "SUPPLIER_INTEGRATION",
    payload: {
      shipmentId,
      destinationWarehouseId: options.warehouseId ?? "CHI",
      expectedAvailableAt: options.expectedAvailableAt,
      lines: [
        {
          shipmentLineId: `${shipmentId}-L1`,
          sku: options.sku ?? "BRG-440",
          quantity: options.quantity ?? 4,
        },
      ],
    },
  };
}

export function delay(
  shipmentId: string,
  previousExpectedAvailableAt: string,
  newExpectedAvailableAt: string,
): InboundShipmentDelayedEvent {
  return {
    eventId: `delay-${shipmentId}`,
    eventType: "InboundShipmentDelayed",
    occurredAt: "2026-08-07T12:00:00.000Z",
    receivedAt: "2026-08-07T12:00:01.000Z",
    source: "TRANSPORTATION_INTEGRATION",
    payload: {
      shipmentId,
      previousExpectedAvailableAt,
      newExpectedAvailableAt,
      reason: "Carrier delay",
    },
  };
}
