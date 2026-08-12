import type {
  FulfillmentAssessmentComparison,
  OrderFulfillmentChange,
  OrderFulfillmentChangeType,
  OrderLineFulfillmentChange,
} from "./fulfillment-assessment-change.js";
import type {
  OrderFulfillmentAssessment,
  OrderLineFulfillmentAssessment,
} from "./fulfillment-result.js";

export function compareFulfillmentAssessments(
  before: OrderFulfillmentAssessment[],
  after: OrderFulfillmentAssessment[],
): FulfillmentAssessmentComparison {
  const beforeByOrderId = indexOrders(before, "before");
  const afterByOrderId = indexOrders(after, "after");

  const orderIds = new Set<string>([
    ...beforeByOrderId.keys(),
    ...afterByOrderId.keys(),
  ]);

  const changedOrders: OrderFulfillmentChange[] = [...orderIds]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((orderId): OrderFulfillmentChange[] => {
      const beforeOrder = beforeByOrderId.get(orderId);
      const afterOrder = afterByOrderId.get(orderId);

      // Determine the change type based on the presence of assessments
      let type: OrderFulfillmentChangeType;
      if (!beforeOrder && afterOrder) {
        return [
          {
            orderId,
            type: "ADDED",
            after: afterOrder,
            changedLines: afterOrder.lines.map((line) => ({
              orderLineId: line.orderLineId,
              after: line,
            })),
          },
        ];
      }

      if (beforeOrder && !afterOrder) {
        return [
          {
            orderId,
            type: "REMOVED",
            before: beforeOrder,
            changedLines: beforeOrder.lines.map((line) => ({
              orderLineId: line.orderLineId,
              before: line,
            })),
          },
        ];
      }

      if (!beforeOrder || !afterOrder) {
        return [];
      }

      const changedLines: OrderLineFulfillmentChange[] = compareLines(
        beforeOrder.lines,
        afterOrder.lines,
      );

      if (
        beforeOrder.status === afterOrder.status &&
        beforeOrder.requiredShipAt === afterOrder.requiredShipAt &&
        changedLines.length === 0
      ) {
        return [];
      }

      return [
        {
          orderId,
          type: classifyChange(beforeOrder, afterOrder),
          before: beforeOrder,
          after: afterOrder,
          changedLines,
        },
      ];
    });

  return { changedOrders };
}

function compareLines(
  before: OrderLineFulfillmentAssessment[],
  after: OrderLineFulfillmentAssessment[],
): OrderLineFulfillmentChange[] {
  const beforeByLineId = indexLines(before, "before");
  const afterByLineId = indexLines(after, "after");

  const lineIds = new Set([...beforeByLineId.keys(), ...afterByLineId.keys()]);

  return [...lineIds]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((orderLineId): OrderLineFulfillmentChange[] => {
      const beforeLine = beforeByLineId.get(orderLineId);
      const afterLine = afterByLineId.get(orderLineId);

      if (!beforeLine && afterLine) {
        return [{ orderLineId, after: afterLine }];
      }

      if (beforeLine && !afterLine) {
        return [{ orderLineId, before: beforeLine }];
      }

      if (
        beforeLine &&
        afterLine &&
        !areLineAssessmentsEqual(beforeLine, afterLine)
      ) {
        return [{ orderLineId, before: beforeLine, after: afterLine }];
      }

      return [];
    });
}

function indexOrders(
  assessments: OrderFulfillmentAssessment[],
  snapshotName: string,
): Map<string, OrderFulfillmentAssessment> {
  const indexed = new Map<string, OrderFulfillmentAssessment>();

  for (const assessment of assessments) {
    if (indexed.has(assessment.orderId)) {
      throw new Error(
        `Duplicate order assessment "${assessment.orderId}" in ${snapshotName} snapshot`,
      );
    }

    indexed.set(assessment.orderId, assessment);
  }

  return indexed;
}

function indexLines(
  assessments: OrderLineFulfillmentAssessment[],
  snapshotName: string,
): Map<string, OrderLineFulfillmentAssessment> {
  const indexed = new Map<string, OrderLineFulfillmentAssessment>();

  for (const assessment of assessments) {
    if (indexed.has(assessment.orderLineId)) {
      throw new Error(
        `Duplicate order-line assessment "${assessment.orderLineId}" in ${snapshotName} snapshot`,
      );
    }

    indexed.set(assessment.orderLineId, assessment);
  }

  return indexed;
}

function classifyChange(
  before: OrderFulfillmentAssessment,
  after: OrderFulfillmentAssessment,
): OrderFulfillmentChangeType {
  if (before.status === "FULFILLABLE" && after.status === "BLOCKED") {
    return "BECAME_BLOCKED";
  }

  if (before.status === "BLOCKED" && after.status === "FULFILLABLE") {
    return "BECAME_FULFILLABLE";
  }

  return "DETAILS_CHANGED";
}

// Fulfillment assessments are deterministic JSON-shaped domain results.
// Array order is currently part of their explainable representation.
function areLineAssessmentsEqual(
  before: OrderLineFulfillmentAssessment,
  after: OrderLineFulfillmentAssessment,
): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}
