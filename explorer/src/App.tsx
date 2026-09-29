import { useEffect, useState } from "react";

import type { ImpactExplorerView } from "../../src/demo/impact-explorer-view.js";
import { loadImpactExplorerView } from "./load-impact-explorer-view.js";

export function App() {
  const [view, setView] = useState<ImpactExplorerView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadView() {
      try {
        setView(await loadImpactExplorerView());
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load Impact Explorer data",
        );
      }
    }

    void loadView();
  }, []);

  if (error !== null) {
    return (
      <main>
        <h1>Impact Explorer</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }

  if (view === null) {
    return (
      <main>
        <h1>Impact Explorer</h1>
        <p>Loading scenario…</p>
      </main>
    );
  }

  return <Explorer view={view} />;
}

interface ExplorerProps {
  view: ImpactExplorerView;
}

function Explorer({ view }: ExplorerProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState(
    view.defaultStepIndex,
  );

  const selectedStep = view.steps[selectedStepIndex];

  if (selectedStep === undefined) {
    return (
      <main>
        <h1>Impact Explorer</h1>
        <p role="alert">The selected scenario step does not exist.</p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <p>Operations Intelligence Engine</p>
        <h1>Impact Explorer</h1>
        <p>{view.scenario.description}</p>
      </header>

      <section aria-labelledby="event-timeline-heading">
        <h2 id="event-timeline-heading">Operational events</h2>

        <ol>
          {view.steps.map((step) => (
            <li key={step.event.eventId}>
              <button
                type="button"
                aria-pressed={step.index === selectedStepIndex}
                onClick={() => setSelectedStepIndex(step.index)}
              >
                {step.title}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="selected-event-heading">
        <h2 id="selected-event-heading">{selectedStep.title}</h2>

        <dl>
          <dt>Event type</dt>
          <dd>{selectedStep.event.eventType}</dd>

          <dt>Occurred at</dt>
          <dd>{selectedStep.event.occurredAt}</dd>

          <dt>Source</dt>
          <dd>{selectedStep.event.source}</dd>
        </dl>

        <h3>Affected orders</h3>

        {selectedStep.impact.changedOrders.length === 0 ? (
          <p>No order impact at this step.</p>
        ) : (
          <ul>
            {selectedStep.impact.changedOrders.map((order) => (
              <li key={order.orderId}>
                <strong>{order.orderId}</strong>:{" "}
                {order.before?.status ?? "Not present"} →{" "}
                {order.after?.status ?? "Not present"}
              </li>
            ))}
          </ul>
        )}

        <details>
          <summary>View event data</summary>
          <pre>{JSON.stringify(selectedStep.event, null, 2)}</pre>
        </details>
      </section>
    </main>
  );
}
