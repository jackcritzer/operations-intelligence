import { mixedCauseShortfallScenario } from "./mixed-cause-shortfall.js";
import { partialOnHandShortfallScenario } from "./partial-on-hand-shortfall.js";
import type { ScenarioDefinition } from "./run-scenario.js";
import { shipmentDelayBlocksOrderScenario } from "./shipment-delay-blocks-order.js";
import { twoOrdersShareTimePhasedSupplyScenario } from "./two-orders-share-time-phased-supply.js";

export const fulfillmentScenarios: ScenarioDefinition[] = [
  partialOnHandShortfallScenario,
  mixedCauseShortfallScenario,
  shipmentDelayBlocksOrderScenario,
  twoOrdersShareTimePhasedSupplyScenario,
];
