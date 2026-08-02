import { describe, expect, it } from "vitest";
import { runScenario } from "../../src/scenarios/run-scenario.js";
import { shipmentDelayBlocksOrderScenario } from "../../src/scenarios/shipment-delay-blocks-order.js";

describe("runScenario", () => {
  it("recalculates fulfillment after every event and records status changes", () => {
    const result = runScenario(shipmentDelayBlocksOrderScenario);

    expect(result.steps).toHaveLength(
      shipmentDelayBlocksOrderScenario.events.length,
    );

    expect(result.steps.map((step) => step.statusChanges)).toEqual([
      [],
      [
        {
          orderId: "SO-1001",
          previousStatus: null,
          currentStatus: "BLOCKED",
        },
      ],
      [
        {
          orderId: "SO-1001",
          previousStatus: "BLOCKED",
          currentStatus: "FULFILLABLE",
        },
      ],
      [
        {
          orderId: "SO-1001",
          previousStatus: "FULFILLABLE",
          currentStatus: "BLOCKED",
        },
      ],
    ]);

    const finalAssessment = result.steps.at(-1)?.assessments[0];

    expect(finalAssessment).toMatchObject({
      orderId: "SO-1001",
      status: "BLOCKED",
      lines: [
        {
          orderLineId: "SO-1001-L1",
          projectedAllocation: 70,
          projectedShortfall: 30,
          blockingConditions: [
            {
              type: "INBOUND_AVAILABLE_TOO_LATE",
              shipmentId: "IN-900",
              quantity: 30,
            },
          ],
          triggeringChanges: [
            {
              type: "SHIPMENT_DELAYED",
              shipmentId: "IN-900",
              reason: "Carrier delay",
            },
          ],
        },
      ],
    });
  });
});
