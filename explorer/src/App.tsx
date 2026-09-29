import { useEffect, useState } from "react";

import type { ImpactExplorerView } from "../../src/demo/impact-explorer-view.js";
import { loadImpactExplorerView } from "./load-impact-explorer-view.js";
import { ImpactDetails } from "./ImpactDetails.js";

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
      <main className="explorer">
        <h1>Impact Explorer</h1>
        <p role="alert">The selected scenario step does not exist.</p>
      </main>
    );
  }

  return (
    <main className="explorer">
      <header className="hero">
        <p className="eyebrow">Operations Intelligence Engine</p>
        <h1>Impact Explorer</h1>
        <p className="hero-description">{view.scenario.description}</p>
      </header>
      <div className="explorer-grid">
        <section
          aria-labelledby="event-timeline-heading"
          className="timeline-panel"
        >
          <h2 id="event-timeline-heading">Operational events</h2>

          <ol className="timeline">
            {view.steps.map((step) => (
              <li key={step.event.eventId}>
                <button
                  type="button"
                  className={
                    step.index === selectedStepIndex
                      ? "timeline-button timeline-button--selected"
                      : "timeline-button"
                  }
                  aria-pressed={step.index === selectedStepIndex}
                  onClick={() => setSelectedStepIndex(step.index)}
                >
                  <span className="timeline-step">Step {step.index + 1}</span>
                  <span>{step.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="event-panel"
          aria-labelledby="selected-event-heading"
        >
          <h2 id="selected-event-heading">{selectedStep.title}</h2>

          <dl className="event-metadata">
            <dt>Event type</dt>
            <dd>{selectedStep.event.eventType}</dd>

            <dt>Occurred at</dt>
            <dd>{selectedStep.event.occurredAt}</dd>

            <dt>Source</dt>
            <dd>{selectedStep.event.source}</dd>
          </dl>

          <ImpactDetails impact={selectedStep.impact} />

          <details className="raw-event">
            <summary>View event data</summary>
            <pre>{JSON.stringify(selectedStep.event, null, 2)}</pre>
          </details>
        </section>
      </div>
    </main>
  );
}
