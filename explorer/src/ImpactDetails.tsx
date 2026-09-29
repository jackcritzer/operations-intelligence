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
      <h3 id="impact-heading">Order impact</h3>

      {impact.changedOrders.map((order) => (
        <article className="order-impact" key={order.orderId}>
          <header className="order-impact-header">
            <h4>{order.orderId}</h4>
            <p>{formatChangeType(order.type)}</p>
          </header>

          <dl className="status-transition">
            <dt>Before</dt>
            <dd>{order.before?.status ?? "Not assessed"}</dd>

            <dt>After</dt>
            <dd>{order.after?.status ?? "Not assessed"}</dd>
          </dl>

          {order.changedLines.map((line) => (
            <section className="line-impact" key={line.orderLineId}>
              <h5>Order line {line.orderLineId}</h5>

              <table className="comparison-table">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <th scope="row">Status</th>
                    <td>{line.before?.status ?? "—"}</td>
                    <td>{line.after?.status ?? "—"}</td>
                  </tr>

                  <tr>
                    <th scope="row">Projected allocation</th>
                    <td>{formatQuantity(line.before?.projectedAllocation)}</td>
                    <td>{formatQuantity(line.after?.projectedAllocation)}</td>
                  </tr>

                  <tr>
                    <th scope="row">Projected shortfall</th>
                    <td>{formatQuantity(line.before?.projectedShortfall)}</td>
                    <td>{formatQuantity(line.after?.projectedShortfall)}</td>
                  </tr>
                </tbody>
              </table>

              <LineEvidence line={line} />
            </section>
          ))}
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
        <h6>Supply counted after this event</h6>

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
        <h6>Blocking conditions</h6>

        {currentLine.blockingConditions.length === 0 ? (
          <p>No blocking conditions.</p>
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
          <h6>Triggering changes</h6>

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
      return `${contribution.quantity} units from shipment ${contribution.shipmentId}, expected ${formatDate(contribution.expectedAvailableAt)}`;
  }
}

function formatBlockingCondition(condition: BlockingCondition): string {
  switch (condition.type) {
    case "INBOUND_AVAILABLE_TOO_LATE":
      return `${condition.quantity} units from shipment ${condition.shipmentId} arrive ${formatDate(condition.expectedAvailableAt)}, after the required ship time of ${formatDate(condition.requiredShipAt)}`;

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
        change.reason === undefined ? "" : ` Reason: ${change.reason}.`;

      return `Shipment ${change.shipmentId} moved from ${formatDate(change.previousExpectedAvailableAt)} to ${formatDate(change.newExpectedAvailableAt)}.${reason}`;
    }
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
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
