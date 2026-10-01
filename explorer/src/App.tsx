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
        <p className="eyebrow">
          Operations Intelligence Engine · Impact Explorer
        </p>

        <h1>Why did this customer order become impossible to ship on time?</h1>

        <p className="hero-description">
          Follow one fixed scenario as inventory, a customer order, and an
          incoming shipment change the fulfillment result.
        </p>
      </header>
      <section
        className="scenario-overview"
        aria-labelledby="scenario-overview-heading"
      >
        <header>
          <p className="eyebrow">Fixed demonstration scenario</p>
          <h2 id="scenario-overview-heading">Scenario at a glance</h2>
        </header>

        <div className="overview-grid">
          {view.scenario.overview.map((item) => (
            <article className="overview-item" key={item.label}>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <span>{item.detail}</span>
            </article>
          ))}
        </div>
      </section>
      <div className="explorer-grid">
        <section
          aria-labelledby="event-timeline-heading"
          className="timeline-panel"
        >
          <h2 id="event-timeline-heading">Scenario timeline</h2>

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

        <section className="event-panel">
          <h2>{selectedStep.title}</h2>

          <p className="event-summary">{selectedStep.summary}</p>

          <ImpactDetails impact={selectedStep.impact} />

          <details className="raw-event">
            <summary>Technical event details</summary>

            <dl className="event-metadata">
              <dt>Backend event type</dt>
              <dd>
                <code>{selectedStep.event.eventType}</code>
              </dd>

              <dt>Reported at</dt>
              <dd>{formatTechnicalTimestamp(selectedStep.event.occurredAt)}</dd>

              <dt>Source system</dt>
              <dd>{formatSourceSystem(selectedStep.event.source)}</dd>
            </dl>

            <pre>{JSON.stringify(selectedStep.event, null, 2)}</pre>
          </details>
        </section>
      </div>
      <section className="about-demo" aria-labelledby="about-demo-heading">
        <div>
          <p className="eyebrow">About this demonstration</p>
          <h2 id="about-demo-heading">
            A visualization of a tested backend service
          </h2>

          <p>
            The browser does not calculate fulfillment. It displays the output
            of the TypeScript engine as it processes a fixed sequence of
            operational events.
          </p>

          <p className="about-demo-scope">
            This demonstration uses synthetic data and one representative
            scenario. Authentication, administration screens, live integrations,
            and arbitrary scenario editing are intentionally outside its scope.
          </p>
        </div>

        <nav className="about-demo-links" aria-label="Project resources">
          <a
            href="https://github.com/jackcritzer/operations-intelligence"
            target="_blank"
            rel="noreferrer"
          >
            View source code
          </a>

          <a
            href="https://github.com/jackcritzer/operations-intelligence/blob/main/docs/architecture/durable-operational-state.md"
            target="_blank"
            rel="noreferrer"
          >
            Read the architecture
          </a>
        </nav>
      </section>
    </main>
  );
}

function formatEventTime(value: string): string {
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

function formatTechnicalTimestamp(value: string): string {
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

import type { OperationalEvent } from "../../src/events/operational-event.js";

const sourceSystemLabels = {
  WMS: "Warehouse management system (WMS)",
  //OMS: "Order management system (OMS)",
  ERP: "Enterprise resource planning system (ERP)",
  SUPPLIER_INTEGRATION: "Supplier system integration",
  TRANSPORTATION_INTEGRATION: "Transportation provider integration",
} satisfies Record<OperationalEvent["source"], string>;

function formatSourceSystem(source: OperationalEvent["source"]): string {
  return sourceSystemLabels[source];
}
