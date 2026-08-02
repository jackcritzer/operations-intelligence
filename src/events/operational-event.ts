export type EventSource =
  "ERP" | "WMS" | "SUPPLIER_INTEGRATION" | "TRANSPORTATION_INTEGRATION";

export interface EventEnvelope {
  eventId: string;
  occurredAt: string;
  receivedAt: string;
  source: EventSource;
}

export interface OrderPlacedPayload {
  orderId: string;
  placedAt: string;
  requiredShipAt: string;
  lines: OrderPlacedLine[];
}

export interface OrderPlacedLine {
  orderLineId: string;
  sku: string;
  quantity: number;
  fulfillmentWarehouseId: string;
}

export interface OrderPlacedEvent extends EventEnvelope {
  eventType: "OrderPlaced";
  payload: OrderPlacedPayload;
}

export interface InventoryPositionReportedPayload {
  warehouseId: string;
  sku: string;
  usableQuantity: number;
  reservedQuantity: number;
  unusableQuantity: number;
}
export interface InventoryPositionReportedEvent extends EventEnvelope {
  eventType: "InventoryPositionReported";
  payload: InventoryPositionReportedPayload;
}

export interface InboundShipmentConfirmedPayload {
  shipmentId: string;
  destinationWarehouseId: string;
  expectedAvailableAt: string;
  lines: InboundShipmentConfirmedLine[];
}

export interface InboundShipmentConfirmedLine {
  shipmentLineId: string;
  sku: string;
  quantity: number;
}
export interface InboundShipmentConfirmedEvent extends EventEnvelope {
  eventType: "InboundShipmentConfirmed";
  payload: InboundShipmentConfirmedPayload;
}

export interface InboundShipmentDelayedEvent extends EventEnvelope {
  eventType: "InboundShipmentDelayed";
  payload: InboundShipmentDelayedPayload;
}

export interface InboundShipmentDelayedPayload {
  shipmentId: string;
  previousExpectedAvailableAt: string;
  newExpectedAvailableAt: string;
  reason?: string;
}

export type OperationalEvent =
  | OrderPlacedEvent
  | InventoryPositionReportedEvent
  | InboundShipmentConfirmedEvent
  | InboundShipmentDelayedEvent;
