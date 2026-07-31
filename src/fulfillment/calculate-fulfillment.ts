import type {
  CustomerOrder,
  OperationalState,
} from "../state/operational-state.js";
import type {
  OrderFulfillmentAssessment,
  SupplyContribution,
  FulfillmentLineAssessment,
  BlockingCondition,
  TriggeringChange,
  ShipmentDelayTrigger,
} from "./fulfillment-result.js";

interface DemandItem {
  orderId: string;
  orderLineId: string;
  sku: string;
  fulfillmentWarehouseId: string;
  requiredQuantity: number;
  requiredShipAt: string;
  placedAt: string;
}

export function calculateFulfillment(
  state: OperationalState,
): OrderFulfillmentAssessment[] {
  const demandItems = collectDemandItems(state);
  demandItems.sort(compareDemandPriority);

  const supplyItems = collectSupplyItems(state);

  const allocations = demandItems.map((demandItem) =>
    allocateDemandItem(demandItem, supplyItems),
  );

  return buildOrderAssessments(allocations, state);
}

function collectDemandItems(
  state: OperationalState,
): DemandItem[] {
  return [...state.orders.values()]
    .filter((order) => order.status === "OPEN")
    .flatMap(toDemandItems);
}

function toDemandItems(order: CustomerOrder): DemandItem[] {
  return order.lines.map((line) => ({
    orderId: order.orderId,
    orderLineId: line.orderLineId,
    sku: line.sku,
    fulfillmentWarehouseId: line.fulfillmentWarehouseId,
    requiredQuantity: line.quantity,
    requiredShipAt: order.requiredShipAt,
    placedAt: order.placedAt,
  }));
}

// Compare two demand items to determine their priority for fulfillment allocation.
// Compare by requiredShipAt, then placedAt, then orderId, then orderLineId.
function compareDemandPriority(
  left: DemandItem,
  right: DemandItem,
): number {
  return (
    Date.parse(left.requiredShipAt) -
      Date.parse(right.requiredShipAt) ||
    Date.parse(left.placedAt) -
      Date.parse(right.placedAt) ||
    left.orderId.localeCompare(right.orderId) ||
    left.orderLineId.localeCompare(right.orderLineId)
  );
}

interface OnHandSupplyItem {
  type: "ON_HAND";
  warehouseId: string;
  sku: string;
  remainingQuantity: number;
}

interface InboundSupplyItem {
  type: "INBOUND";
  shipmentId: string;
  shipmentLineId: string;
  warehouseId: string;
  sku: string;
  expectedAvailableAt: string;
  remainingQuantity: number;
}

type SupplyItem = OnHandSupplyItem | InboundSupplyItem;

function collectSupplyItems(
  state: OperationalState,
): SupplyItem[] {
  return [
    ...collectOnHandSupply(state),
    ...collectInboundSupply(state),
  ];
}


function collectOnHandSupply(
  state: OperationalState,
): OnHandSupplyItem[] {
  return [...state.inventoryPositions.values()]
    .map((position) => ({
      type: "ON_HAND" as const,
      warehouseId: position.warehouseId,
      sku: position.sku,
      remainingQuantity: Math.max(
        0,
        position.usableQuantity - position.reservedQuantity,
      ),
    }))
    .filter((supply) => supply.remainingQuantity > 0);
}

function collectInboundSupply(
  state: OperationalState,
): InboundSupplyItem[] {
  return [...state.inboundShipments.values()].flatMap(
    (shipment) =>
      shipment.lines
        .map((line) => ({
          type: "INBOUND" as const,
          shipmentId: shipment.shipmentId,
          shipmentLineId: line.shipmentLineId,
          warehouseId: shipment.destinationWarehouseId,
          sku: line.sku,
          expectedAvailableAt: shipment.expectedAvailableAt,
          remainingQuantity: line.quantity,
        }))
        .filter((supply) => supply.remainingQuantity > 0),
  );
}

interface DemandAllocation {
  demand: DemandItem;
  contributions: SupplyContribution[];
  lateInboundSupply: InboundSupplyItem[];
}

function allocateDemandItem(
  demand: DemandItem,
  supplyItems: SupplyItem[],
): DemandAllocation {
  let remainingDemand = demand.requiredQuantity;
  const contributions: SupplyContribution[] = [];

  const matchingSupply = supplyItems.filter(
    (supply) =>
      supply.sku === demand.sku &&
      supply.warehouseId === demand.fulfillmentWarehouseId &&
      supply.remainingQuantity > 0,
  );

  const lateInboundSupply = matchingSupply.filter(
    (supply): supply is InboundSupplyItem =>
      supply.type === "INBOUND" &&
      Date.parse(supply.expectedAvailableAt) >
        Date.parse(demand.requiredShipAt),
  );

  const eligibleSupply = supplyItems
    .filter((supply) => isSupplyEligible(supply, demand))
    .sort(compareSupplyPriority);

  for (const supply of eligibleSupply) {
    if (remainingDemand === 0) {
      break;
    }

    const allocatedQuantity = Math.min(
      remainingDemand,
      supply.remainingQuantity,
    );

    if (allocatedQuantity === 0) {
      continue;
    }

    supply.remainingQuantity -= allocatedQuantity;
    remainingDemand -= allocatedQuantity;

    contributions.push(
      toSupplyContribution(supply, allocatedQuantity),
    );
  }

  return {
    demand,
    contributions,
    lateInboundSupply,
  };
}

function isSupplyEligible(
  supply: SupplyItem,
  demand: DemandItem,
): boolean {
  if (
    supply.sku !== demand.sku ||
    supply.warehouseId !== demand.fulfillmentWarehouseId ||
    supply.remainingQuantity <= 0
  ) {
    return false;
  }

  if (supply.type === "ON_HAND") {
    return true;
  }

  return (
    Date.parse(supply.expectedAvailableAt) <=
    Date.parse(demand.requiredShipAt)
  );
}

function compareSupplyPriority(
  left: SupplyItem,
  right: SupplyItem,
): number {
  if (left.type !== right.type) {
    return left.type === "ON_HAND" ? -1 : 1;
  }

  if (left.type === "INBOUND" && right.type === "INBOUND") {
    return (
      Date.parse(left.expectedAvailableAt) -
        Date.parse(right.expectedAvailableAt) ||
      left.shipmentId.localeCompare(right.shipmentId) ||
      left.shipmentLineId.localeCompare(right.shipmentLineId)
    );
  }

  return 0;
}

function toSupplyContribution(
  supply: SupplyItem,
  quantity: number,
): SupplyContribution {
  if (supply.type === "ON_HAND") {
    return {
      type: "ON_HAND",
      warehouseId: supply.warehouseId,
      sku: supply.sku,
      quantity,
    };
  }

  return {
    type: "INBOUND",
    shipmentId: supply.shipmentId,
    shipmentLineId: supply.shipmentLineId,
    warehouseId: supply.warehouseId,
    sku: supply.sku,
    quantity,
    expectedAvailableAt: supply.expectedAvailableAt,
  };
}

function toLineAssessment(
  allocation: DemandAllocation,
  state: OperationalState,
): FulfillmentLineAssessment {
  const projectedAllocation = allocation.contributions.reduce(
    (total, contribution) => total + contribution.quantity,
    0,
  );

  const projectedShortfall = Math.max(
    0,
    allocation.demand.requiredQuantity - projectedAllocation,
  );

  const isBlocked = projectedShortfall > 0;

  const blockingConditions = isBlocked
    ? toBlockingConditions(allocation, projectedShortfall)
    : [];

  const triggeringChanges = isBlocked
    ? toTriggeringChanges(allocation, state)
    : [];

  return {
    orderLineId: allocation.demand.orderLineId,
    sku: allocation.demand.sku,
    fulfillmentWarehouseId:
      allocation.demand.fulfillmentWarehouseId,
    requiredQuantity: allocation.demand.requiredQuantity,
    projectedAllocation,
    projectedShortfall,
    status: isBlocked ? "BLOCKED" : "FULFILLABLE",
    supplyContributions: allocation.contributions,
    blockingConditions,
    triggeringChanges,
  };
}

function buildOrderAssessments(
  allocations: DemandAllocation[],
  state: OperationalState,
): OrderFulfillmentAssessment[] {
  const assessmentsByOrderId = new Map<
    string,
    OrderFulfillmentAssessment
  >();

  for (const allocation of allocations) {
    const lineAssessment = toLineAssessment(allocation, state);
    const existingOrder = assessmentsByOrderId.get(
      allocation.demand.orderId,
    );

    if (existingOrder) {
      existingOrder.lines.push(lineAssessment);

      if (lineAssessment.status === "BLOCKED") {
        existingOrder.status = "BLOCKED";
      }

      continue;
    }

    assessmentsByOrderId.set(allocation.demand.orderId, {
      orderId: allocation.demand.orderId,
      requiredShipAt: allocation.demand.requiredShipAt,
      status: lineAssessment.status,
      lines: [lineAssessment],
    });
  }

  return [...assessmentsByOrderId.values()];
}


function toBlockingConditions(
  allocation: DemandAllocation,
  projectedShortfall: number,
): BlockingCondition[] {
  let unexplainedShortfall = projectedShortfall;
  const conditions: BlockingCondition[] = [];

  for (const supply of allocation.lateInboundSupply) {
    if (unexplainedShortfall === 0) {
      break;
    }

    const relevantQuantity = Math.min(
      unexplainedShortfall,
      supply.remainingQuantity,
    );

    conditions.push({
      type: "INBOUND_AVAILABLE_TOO_LATE",
      shipmentId: supply.shipmentId,
      shipmentLineId: supply.shipmentLineId,
      quantity: relevantQuantity,
      expectedAvailableAt: supply.expectedAvailableAt,
      requiredShipAt: allocation.demand.requiredShipAt,
    });

    unexplainedShortfall -= relevantQuantity;
  }

  return conditions;
}

function toTriggeringChanges(
  allocation: DemandAllocation,
  state: OperationalState,
): TriggeringChange[] {
  const changes: TriggeringChange[] = [];
  const includedShipmentIds = new Set<string>();

  for (const supply of allocation.lateInboundSupply) {
    if (includedShipmentIds.has(supply.shipmentId)) {
      continue;
    }

    const change = state.shipmentAvailabilityChanges.get(
      supply.shipmentId,
    );

    if (!change) {
      continue;
    }

    const shipmentDelayTrigger: ShipmentDelayTrigger = {
      type: "SHIPMENT_DELAYED",
      shipmentId: supply.shipmentId,
      previousExpectedAvailableAt:
        change.previousExpectedAvailableAt,
      newExpectedAvailableAt: change.newExpectedAvailableAt,
      changedAt: change.changedAt,
    };

    if (change.reason !== undefined) {
        shipmentDelayTrigger.reason = change.reason;
    }

    changes.push(shipmentDelayTrigger);

    includedShipmentIds.add(supply.shipmentId);
  }

  return changes;
}