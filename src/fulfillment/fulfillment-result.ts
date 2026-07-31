export type FulfillmentStatus =
  | "FULFILLABLE"
  | "BLOCKED";

export interface OrderFulfillmentAssessment {
  orderId: string;
  requiredShipAt: string;
  status: FulfillmentStatus;
  lines: OrderLineFulfillmentAssessment[];
}



export interface OrderLineFulfillmentAssessment {
  orderLineId: string;
  sku: string;
  fulfillmentWarehouseId: string;
  requiredQuantity: number;
  projectedAllocation: number;
  projectedShortfall: number;
  status: FulfillmentStatus;
  supplyContributions: SupplyContribution[];
  blockingConditions: BlockingCondition[];
  triggeringChanges: TriggeringChange[];
}

export interface FulfillmentLineAssessment {
    orderLineId: string;
    sku: string;
    fulfillmentWarehouseId: string;
    requiredQuantity: number;
    projectedAllocation: number;
    projectedShortfall: number;
    status: FulfillmentStatus;
    supplyContributions: SupplyContribution[];
    blockingConditions: BlockingCondition[];
    triggeringChanges: TriggeringChange[];
}

export type SupplyContribution =
  | OnHandSupplyContribution
  | InboundSupplyContribution;

export interface OnHandSupplyContribution {
  type: "ON_HAND";
  warehouseId: string;
  sku: string;
  quantity: number;
}

export interface InboundSupplyContribution {
  type: "INBOUND";
  shipmentId: string;
  shipmentLineId: string;
  warehouseId: string;
  sku: string;
  quantity: number;
  expectedAvailableAt: string;
}

export type BlockingCondition =
  | LateInboundSupplyCondition
  | HigherPriorityDemandCondition;

export interface LateInboundSupplyCondition {
  type: "INBOUND_AVAILABLE_TOO_LATE";
  shipmentId: string;
  shipmentLineId: string;
  quantity: number;
  expectedAvailableAt: string;
  requiredShipAt: string;
}

export interface HigherPriorityDemandCondition {
  type: "SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND";
  quantity: number;
}

export type TriggeringChange =
  ShipmentDelayTrigger;

export interface ShipmentDelayTrigger {
  type: "SHIPMENT_DELAYED";
  shipmentId: string;
  previousExpectedAvailableAt: string;
  newExpectedAvailableAt: string;
  changedAt: string;
  reason?: string;
}