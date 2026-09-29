import { describe, expect, it } from "vitest";

import { buildImpactExplorerView } from "../../src/demo/impact-explorer-view.js";
import { runScenario } from "../../src/scenarios/run-scenario.js";
import { shipmentDelayBlocksOrderScenario } from "../../src/scenarios/shipment-delay-blocks-order.js";

describe("buildImpactExplorerView", () => {
  it("converts a scenario run into the explorer read model", () => {
    const scenarioRun = runScenario(shipmentDelayBlocksOrderScenario);

    const view = buildImpactExplorerView(
      scenarioRun,
      "event-inbound-1001-delayed",
    );

    expect(view.scenario).toEqual({
      name: "shipment-delay-blocks-order",
      description:
        "An inbound shipment moves past an order deadline, changing the order from fulfillable to blocked.",
    });

    expect(view.defaultStepIndex).toBe(3);

    expect(view.steps.map((step) => step.title)).toEqual([
      "Inventory position reported",
      "Customer order placed",
      "Inbound shipment confirmed",
      "Inbound shipment delayed",
    ]);

    expect(view.steps[3]).toMatchObject({
      index: 3,
      event: {
        eventId: "event-inbound-1001-delayed",
        eventType: "InboundShipmentDelayed",
      },
      impact: {
        changedOrders: [
          {
            orderId: "SO-1001",
            type: "BECAME_BLOCKED",
          },
        ],
      },
    });
  });

  it("rejects an unknown default event", () => {
    const scenarioRun = runScenario(shipmentDelayBlocksOrderScenario);

    expect(() => buildImpactExplorerView(scenarioRun, "missing-event")).toThrow(
      'Default explorer event "missing-event" was not found',
    );
  });
});
