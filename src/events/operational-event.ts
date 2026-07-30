
export type EventSource =
  | "ERP"
  | "WMS"
  | "SUPPLIER_INTEGRATION"
  | "TRANSPORTATION_INTEGRATION";

export interface EventEnvelope {
  eventId: string;
  occurredAt: string;
  receivedAt: string;
  source: EventSource;
}

export interface OrderPlacedEvent extends EventEnvelope {
  eventType: "OrderPlaced";
  payload: {
    orderId: string;
    placedAt: string;
    requiredShipAt: string;
    lines: Array<{
      orderLineId: string;
      sku: string;
      quantity: number;
      fulfillmentWarehouseId: string;
    }>;
  };
}

export interface InventoryPositionReportedEvent extends EventEnvelope {
  eventType: "InventoryPositionReported";
  payload: {
    warehouseId: string;
    sku: string;
    usableQuantity: number;
    reservedQuantity: number;
    unusableQuantity: number;
  };
}

export interface InboundShipmentConfirmedEvent extends EventEnvelope {
  eventType: "InboundShipmentConfirmed";
  payload: {
    shipmentId: string;
    destinationWarehouseId: string;
    expectedAvailableAt: string;
    lines: Array<{
      shipmentLineId: string;
      sku: string;
      quantity: number;
    }>;
  };
}

export interface InboundShipmentDelayedEvent extends EventEnvelope {
  eventType: "InboundShipmentDelayed";
  payload: {
    shipmentId: string;
    previousExpectedAvailableAt: string;
    newExpectedAvailableAt: string;
    reason?: string;
  };
}

export type OperationalEvent =
  | OrderPlacedEvent
  | InventoryPositionReportedEvent
  | InboundShipmentConfirmedEvent
  | InboundShipmentDelayedEvent;