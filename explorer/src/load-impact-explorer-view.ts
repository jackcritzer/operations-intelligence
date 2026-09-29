import type { ImpactExplorerView } from "../../src/demo/impact-explorer-view.js";

const dataUrl = `${import.meta.env.BASE_URL}data/shipment-delay-blocks-order.json`;

export async function loadImpactExplorerView(): Promise<ImpactExplorerView> {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(`Could not load Impact Explorer data: ${response.status}`);
  }

  return (await response.json()) as ImpactExplorerView;
}
