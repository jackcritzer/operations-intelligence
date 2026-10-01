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
      overview: [
        {
          label: "Customer order",
          value: "100 units",
          detail: "SO-1001 · BEARING-440",
        },
        {
          label: "Available now",
          value: "70 units",
          detail: "BEARING-440 · Warehouse CHI",
        },
        {
          label: "Incoming shipment",
          value: "30 additional units",
          detail: "Originally due Aug 6, 2026; delayed to Aug 11, 2026",
        },
        {
          label: "Customer ship deadline",
          value: "Aug 8, 2026",
          detail: "Required customer ship date",
        },
      ],
    });

    expect(view.defaultStepIndex).toBe(3);

    expect(view.steps.map((step) => step.title)).toEqual([
      "70 units reported in stock",
      "Customer orders 100 units",
      "30 incoming units confirmed",
      "Inbound delivery delayed",
    ]);

    expect(view.steps.map((step) => step.summary)).toEqual([
      "CHI reports 70 usable units of BEARING-440.",
      "Order SO-1001 requests 100 units by Aug 8, 2026. 70 units are available, leaving 30 units missing.",
      "Shipment IN-900 adds 30 units expected Aug 6, 2026. This makes order SO-1001 fulfillable.",
      "Shipment IN-900 is delayed from Aug 6, 2026 to Aug 11, 2026, after order SO-1001's Aug 8, 2026 deadline. Only 70 of 100 required units will be available on time.",
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
