import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildImpactExplorerView } from "./impact-explorer-view.js";
import { runScenario } from "../scenarios/run-scenario.js";
import { shipmentDelayBlocksOrderScenario } from "../scenarios/shipment-delay-blocks-order.js";

const outputPath = resolve(
  "explorer/public/data/shipment-delay-blocks-order.json",
);

const scenarioRun = runScenario(shipmentDelayBlocksOrderScenario);

const explorerView = buildImpactExplorerView(
  scenarioRun,
  "event-inbound-1001-delayed",
);

await mkdir(dirname(outputPath), { recursive: true });

await writeFile(
  outputPath,
  `${JSON.stringify(explorerView, null, 2)}\n`,
  "utf8",
);

console.log(`Generated Impact Explorer data at ${outputPath}`);
