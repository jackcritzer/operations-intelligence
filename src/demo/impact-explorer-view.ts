import type { OperationalEvent } from "../events/operational-event.js";
import type { OrderFulfillmentAssessment } from "../fulfillment/fulfillment-assessment.js";
import type { FulfillmentAssessmentComparison } from "../fulfillment/fulfillment-assessment-comparison.js";
import type { ScenarioRun, ScenarioStep } from "../scenarios/run-scenario.js";

export interface ImpactExplorerView {
  scenario: {
    name: string;
    description: string;
    overview: ImpactExplorerOverviewItem[];
  };
  defaultStepIndex: number;
  steps: ImpactExplorerStep[];
}

export interface ImpactExplorerOverviewItem {
  label: string;
  value: string;
  detail: string;
}

export interface ImpactExplorerStep {
  index: number;
  title: string;
  summary: string;
  event: OperationalEvent;
  assessments: OrderFulfillmentAssessment[];
  impact: FulfillmentAssessmentComparison;
}

export function buildImpactExplorerView(
  scenarioRun: ScenarioRun,
  defaultEventId: string,
): ImpactExplorerView {
  const defaultStepIndex = scenarioRun.steps.findIndex(
    (step) => step.event.eventId === defaultEventId,
  );

  if (defaultStepIndex === -1) {
    throw new Error(`Default explorer event "${defaultEventId}" was not found`);
  }

  return {
    scenario: {
      name: scenarioRun.scenario.name,
      description: scenarioRun.scenario.description,
      overview: buildScenarioOverview(scenarioRun),
    },
    defaultStepIndex,
    steps: scenarioRun.steps.map((step, index) => ({
      index,
      title: getEventTitle(step.event),
      summary: getEventSummary(step),
      event: step.event,
      assessments: step.assessments,
      impact: step.impact,
    })),
  };
}

function getEventTitle(event: OperationalEvent): string {
  switch (event.eventType) {
    case "InventoryPositionReported":
      return `${event.payload.usableQuantity} units reported in stock`;

    case "OrderPlaced":
      return `Customer orders ${sumQuantities(event.payload.lines)} units`;

    case "InboundShipmentConfirmed":
      return `${sumQuantities(event.payload.lines)} incoming units confirmed`;

    case "InboundShipmentDelayed":
      return "Inbound delivery delayed";
  }
}

function sumQuantities(lines: ReadonlyArray<{ quantity: number }>): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

function getEventSummary(step: ScenarioStep): string {
  const { event } = step;

  switch (event.eventType) {
    case "InventoryPositionReported":
      return `${event.payload.warehouseId} reports ${event.payload.usableQuantity} usable units of ${event.payload.sku}.`;

    case "OrderPlaced": {
      const changedOrder = step.impact.changedOrders.find(
        (order) => order.orderId === event.payload.orderId,
      );

      const availableQuantity =
        changedOrder?.after?.lines.reduce(
          (total, line) => total + line.projectedAllocation,
          0,
        ) ?? 0;

      const missingQuantity =
        changedOrder?.after?.lines.reduce(
          (total, line) => total + line.projectedShortfall,
          0,
        ) ?? 0;

      const requestedQuantity = event.payload.lines.reduce(
        (total, line) => total + line.quantity,
        0,
      );

      return `Order ${event.payload.orderId} requests ${requestedQuantity} units by ${formatDate(event.payload.requiredShipAt)}. ${availableQuantity} units are available, leaving ${missingQuantity} units missing.`;
    }

    case "InboundShipmentConfirmed": {
      const inboundQuantity = event.payload.lines.reduce(
        (total, line) => total + line.quantity,
        0,
      );

      const restoredOrder = step.impact.changedOrders.find(
        (order) => order.type === "BECAME_FULFILLABLE",
      );

      const restoredResult =
        restoredOrder === undefined
          ? ""
          : ` This makes order ${restoredOrder.orderId} fulfillable.`;

      return `Shipment ${event.payload.shipmentId} adds ${inboundQuantity} units expected ${formatDate(event.payload.expectedAvailableAt)}.${restoredResult}`;
    }

    case "InboundShipmentDelayed": {
      const blockedOrder = step.impact.changedOrders.find(
        (order) => order.type === "BECAME_BLOCKED",
      );

      const requiredShipAt = blockedOrder?.after?.requiredShipAt;
      const changedLine = blockedOrder?.changedLines[0];

      const allocation = changedLine?.after?.projectedAllocation;
      const requiredQuantity = changedLine?.after?.requiredQuantity;

      const deadlineExplanation =
        blockedOrder === undefined || requiredShipAt === undefined
          ? ""
          : `, after order ${blockedOrder.orderId}'s ${formatDate(requiredShipAt)} deadline`;

      const supplyExplanation =
        allocation === undefined || requiredQuantity === undefined
          ? ""
          : ` Only ${allocation} of ${requiredQuantity} required units will be available on time.`;

      return `Shipment ${event.payload.shipmentId} is delayed from ${formatDate(event.payload.previousExpectedAvailableAt)} to ${formatDate(event.payload.newExpectedAvailableAt)}${deadlineExplanation}.${supplyExplanation}`;
    }
  }
}

function formatDate(value: string): string {
  const dateOnly = value.slice(0, 10);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

function buildScenarioOverview(
  scenarioRun: ScenarioRun,
): ImpactExplorerOverviewItem[] {
  const events = scenarioRun.scenario.events;

  const inventoryEvent = events.find(
    (event) => event.eventType === "InventoryPositionReported",
  );

  const orderEvent = events.find((event) => event.eventType === "OrderPlaced");

  const inboundEvent = events.find(
    (event) => event.eventType === "InboundShipmentConfirmed",
  );

  const delayEvent = events.find(
    (event) => event.eventType === "InboundShipmentDelayed",
  );

  const overview: ImpactExplorerOverviewItem[] = [];

  if (orderEvent?.eventType === "OrderPlaced") {
    overview.push({
      label: "Customer order",
      value: `${sumQuantities(orderEvent.payload.lines)} units`,
      detail: `${orderEvent.payload.orderId} · ${formatSkus(orderEvent.payload.lines)}`,
    });
  }

  if (inventoryEvent?.eventType === "InventoryPositionReported") {
    overview.push({
      label: "Available now",
      value: `${inventoryEvent.payload.usableQuantity} units`,
      detail: `${inventoryEvent.payload.sku} · Warehouse ${inventoryEvent.payload.warehouseId}`,
    });
  }

  if (
    inboundEvent?.eventType === "InboundShipmentConfirmed" &&
    delayEvent?.eventType === "InboundShipmentDelayed"
  ) {
    overview.push({
      label: "Incoming shipment",
      value: `${sumQuantities(inboundEvent.payload.lines)} additional units`,
      detail: `Originally due ${formatDate(inboundEvent.payload.expectedAvailableAt)}; delayed to ${formatDate(delayEvent.payload.newExpectedAvailableAt)}`,
    });
  }

  if (orderEvent?.eventType === "OrderPlaced") {
    overview.push({
      label: "Customer ship deadline",
      value: formatDate(orderEvent.payload.requiredShipAt),
      detail: "Required customer ship date",
    });
  }

  return overview;
}

function formatSkus(lines: ReadonlyArray<{ sku: string }>): string {
  return [...new Set(lines.map((line) => line.sku))].join(", ");
}
