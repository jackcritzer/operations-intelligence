import type {
  FulfillmentAssessmentComparison,
  OrderFulfillmentChangeType,
  OrderLineFulfillmentChange,
} from "../../src/fulfillment/fulfillment-assessment-comparison.js";

import type {
  BlockingCondition,
  SupplyContribution,
  TriggeringChange,
} from "../../src/fulfillment/fulfillment-assessment.js";

interface ImpactDetailsProps {
  impact: FulfillmentAssessmentComparison;
}

export function ImpactDetails({ impact }: ImpactDetailsProps) {
  if (impact.changedOrders.length === 0) {
    return (
      <section className="impact" aria-labelledby="impact-heading">
        <h3 id="impact-heading">Order impact</h3>
        <p>No order impact at this step.</p>
      </section>
    );
  }

  return (
    <section className="impact" aria-labelledby="impact-heading">
      <h3 id="impact-heading">Customer order impact</h3>

      {impact.changedOrders.map((order) => (
        <article
          className={getOrderImpactClass(order.type, order.after?.status)}
          key={order.orderId}
        >
          <header className="order-impact-header">
            <h4>{order.orderId}</h4>
            <p>{formatChangeType(order.type)}</p>
          </header>

          {order.changedLines.map((line) => {
            const sku = line.after?.sku ?? line.before?.sku;
            return (
              <section className="line-impact" key={line.orderLineId}>
                <h4>Product: {sku}</h4>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th>Before this event</th>
                      <th aria-hidden="true" className="change-arrow-column" />
                      <th>After this event</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Status</th>
                      <td>{order.before?.status ?? "—"}</td>
                      <td aria-hidden="true" className="change-arrow">
                        →
                      </td>
                      <td className="after-status">
                        {order.after?.status ?? "—"}
                      </td>
                    </tr>

                    <tr>
                      <th scope="row">Units available by ship deadline</th>
                      <td>
                        {formatQuantity(line.before?.projectedAllocation)}
                      </td>
                      <td aria-hidden="true" className="change-arrow">
                        →
                      </td>
                      <td>{formatQuantity(line.after?.projectedAllocation)}</td>
                    </tr>

                    <tr>
                      <th scope="row">Units missing by ship deadline</th>
                      <td>{formatQuantity(line.before?.projectedShortfall)}</td>
                      <td aria-hidden="true" className="change-arrow">
                        →
                      </td>
                      <td>{formatQuantity(line.after?.projectedShortfall)}</td>
                    </tr>
                  </tbody>
                </table>

                <LineEvidence line={line} />
              </section>
            );
          })}
        </article>
      ))}
    </section>
  );
}

interface LineEvidenceProps {
  line: OrderLineFulfillmentChange;
}

function LineEvidence({ line }: LineEvidenceProps) {
  const currentLine = line.after ?? line.before;

  if (currentLine === undefined) {
    return null;
  }

  return (
    <div className="evidence-grid">
      <section className="evidence-card">
        <h5>Supply available by ship deadline</h5>

        {currentLine.supplyContributions.length === 0 ? (
          <p>No usable supply was identified.</p>
        ) : (
          <ul>
            {currentLine.supplyContributions.map((contribution, index) => (
              <li key={`${contribution.type}-${index}`}>
                {formatSupplyContribution(contribution)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="evidence-card">
        <h5>
          {currentLine.blockingConditions.length === 0
            ? "Order readiness"
            : "Why the order cannot ship"}
        </h5>

        {currentLine.blockingConditions.length === 0 ? (
          <p>All required units are available by the ship deadline</p>
        ) : (
          <ul>
            {currentLine.blockingConditions.map((condition, index) => (
              <li key={`${condition.type}-${index}`}>
                {formatBlockingCondition(condition)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {currentLine.triggeringChanges.length > 0 && (
        <section className="evidence-card">
          <h5>What changed</h5>

          <ul>
            {currentLine.triggeringChanges.map((change, index) => (
              <li key={`${change.type}-${index}`}>
                {formatTriggeringChange(change)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatSupplyContribution(contribution: SupplyContribution): string {
  switch (contribution.type) {
    case "ON_HAND":
      return `${contribution.quantity} units available on hand at ${contribution.warehouseId}`;

    case "INBOUND":
      return `${contribution.quantity} units from shipment ${contribution.shipmentId}, expected ${formatBusinessDate(contribution.expectedAvailableAt)}`;
  }
}

function formatBlockingCondition(condition: BlockingCondition): string {
  switch (condition.type) {
    case "INBOUND_AVAILABLE_TOO_LATE":
      return `${condition.quantity} units from shipment ${condition.shipmentId} arrive ${formatBusinessDate(condition.expectedAvailableAt)}, after the required ship date of ${formatBusinessDate(condition.requiredShipAt)}`;

    case "SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND":
      return `${condition.quantity} units are allocated to higher-priority order ${condition.consumingOrderId}`;

    case "SHORTFALL_CAUSE_UNDETERMINED":
      return `${condition.quantity} units have no identified source of supply`;
  }
}

function formatTriggeringChange(change: TriggeringChange): string {
  switch (change.type) {
    case "SHIPMENT_DELAYED": {
      const reason =
        change.reason === undefined
          ? ""
          : ` due to ${formatDelayReason(change.reason)}`;

      return `Shipment ${change.shipmentId} was delayed from ${formatBusinessDate(change.previousExpectedAvailableAt)} to ${formatBusinessDate(change.newExpectedAvailableAt)}${reason}`;
    }
  }
}

function formatDelayReason(reason: string): string {
  switch (reason) {
    case "Carrier delay":
      return "a carrier delay";

    default:
      return lowercaseFirst(reason);
  }
}

function formatBusinessDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

function formatChangeType(type: OrderFulfillmentChangeType): string {
  switch (type) {
    case "ADDED":
      return "Order added";

    case "REMOVED":
      return "Order removed";

    case "BECAME_BLOCKED":
      return "Fulfillment risk detected";

    case "BECAME_FULFILLABLE":
      return "Fulfillment restored";

    case "DETAILS_CHANGED":
      return "Fulfillment details changed";
  }
}

function formatQuantity(quantity: number | undefined): string {
  return quantity === undefined ? "—" : `${quantity} units`;
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function getOrderImpactClass(
  type: OrderFulfillmentChangeType,
  resultingStatus: string | undefined,
): string {
  if (type === "BECAME_BLOCKED") {
    return "order-impact order-impact--blocked";
  }

  if (type === "BECAME_FULFILLABLE") {
    return "order-impact order-impact--fulfillable";
  }

  if (type === "ADDED" && resultingStatus === "BLOCKED") {
    return "order-impact order-impact--blocked";
  }

  return "order-impact order-impact--neutral";
}
