export type OrderStatus = "OPEN";

export interface CustomerOrder {
  orderId: string;
  placedAt: string;
  requiredShipAt: string;
  status: OrderStatus;
  lines: OrderLine[];
}

export interface OrderLine {
  orderLineId: string;
  sku: string;
  quantity: number;
  fulfillmentWarehouseId: string;
}

export interface InventoryPosition {
  warehouseId: string;
  sku: string;
  usableQuantity: number;
  reservedQuantity: number;
  unusableQuantity: number;
  reportedAt: string;
}

export interface InboundShipment {
  shipmentId: string;
  destinationWarehouseId: string;
  expectedAvailableAt: string;
  status: "CONFIRMED";
  lines: InboundShipmentLine[];
}

export interface InboundShipmentLine {
  shipmentLineId: string;
  sku: string;
  quantity: number;
}

export interface ShipmentAvailabilityChange {
  shipmentId: string;
  previousExpectedAvailableAt: string;
  newExpectedAvailableAt: string;
  changedAt: string;
  reason?: string;
}

export interface OperationalState {
  orders: Map<string, CustomerOrder>;
  inventoryPositions: Map<string, InventoryPosition>;
  inboundShipments: Map<string, InboundShipment>;
  shipmentAvailabilityChanges: Map<
    string,
    ShipmentAvailabilityChange
  >;
  processedEventIds: Set<string>;
}

export function createEmptyOperationalState(): OperationalState {
  return {
    orders: new Map(),
    inventoryPositions: new Map(),
    inboundShipments: new Map(),
    shipmentAvailabilityChanges: new Map(),
    processedEventIds: new Set(),
  };
}

export function inventoryPositionKey(
  warehouseId: string,
  sku: string,
): string {
  return `${warehouseId}:${sku}`;
}