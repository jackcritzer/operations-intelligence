# Development Roadmap

## Purpose

This roadmap sequences work by operational capability and system guarantee rather than by technology.

Each milestone must answer a business or operational question, make a testable guarantee, and justify any new infrastructure it introduces.

Milestones are labeled as:

- **Completed** — implemented and verified.
- **Committed next** — selected as the next major capability.
- **Candidate** — valuable, but reassessed after the preceding milestone.
- **Deferred pending evidence** — introduced only when a concrete requirement justifies the additional system boundary.

## Completed: Current fulfillment assessment

### Business question

> Which open customer orders cannot currently be fulfilled by their required ship time, and why?

### Implemented capability

The service can:

- ingest normalized order, inventory-position, inbound-shipment, and shipment-delay events;
- maintain current operational state in memory;
- project shared supply across competing customer demand;
- prevent projected double allocation;
- expose order- and line-level fulfillment assessments;
- identify projected allocations and shortfalls;
- explain shortfalls using structured supply contributions, blocking conditions, and triggering changes.

### Current business boundaries

- Each order line has one fulfillment warehouse.
- Supply cannot move between warehouses.
- Demand priority is earlier required ship time, then earlier placement time.
- Order and line IDs provide deterministic tie-breaking only.
- Projected allocation does not create an upstream inventory reservation.
- Customers currently have no priority attributes.

## Completed: Immediate event impact

### Business question

> When an operational event arrives, which customer-order fulfillment assessments changed because of it?

### Implemented capability

The service now:

1. calculates fulfillment assessments before a new event;
2. applies the event to operational state;
3. recalculates fulfillment afterward;
4. compares the two assessment sets;
5. returns the material changes through the ingestion API.

The comparison distinguishes:

- an added or removed order assessment;
- an order becoming blocked;
- an order becoming fulfillable;
- an order retaining its status while its allocation, shortfall, supply evidence, blocker evidence, triggering evidence, or required ship time changes;
- unchanged orders, which are omitted.

Complete before-and-after assessments are preserved in the impact result. Duplicate events do not report new impact, and rejected events do not return a partial impact result.

The end-to-end HTTP scenario proves that delaying inbound supply beyond an order deadline changes the affected order from `FULFILLABLE` to `BLOCKED` and returns its resulting allocation, shortfall, blocker, and triggering change.

## Completed: Durable operational state

### Operational question

> Can the service preserve and reconstruct its operational understanding across restarts?

### Implemented capability

The service now:

- stores accepted normalized events in PostgreSQL as its durable source of truth;
- assigns each accepted event a database-generated replay sequence;
- fingerprints normalized event content for durable identity comparison;
- recognizes the same event ID and content as a duplicate;
- rejects an event ID reused with different content;
- rebuilds operational state deterministically from accepted events during startup;
- finishes replay before opening the HTTP port;
- stages state changes before persistence;
- publishes staged state only after successful database acceptance;
- leaves live state unchanged when validation or persistence fails;
- serializes the complete event-processing operation within one Node.js process;
- closes HTTP and database resources during shutdown or failed startup;
- verifies repository, replay, HTTP, concurrency, runtime, and restart behavior through automated and manual tests.

### Acceptance boundary

For one running service instance, an event is processed in this order:

1. wait for earlier event processing to finish;
2. clone the current operational state;
3. calculate fulfillment assessments before the event;
4. validate and apply the event to staged state;
5. insert or classify the event in PostgreSQL;
6. for a newly accepted event, calculate the resulting assessments and impact;
7. publish staged state.

The database event log survives process restarts. The in-memory operational projection and current fulfillment assessments remain derived data and are reconstructed through replay.

### Completion demonstration

```text
start service
→ ingest operational events
→ observe current assessment and event impact
→ stop service
→ restart service
→ recover the same current assessment
→ resend an accepted event
→ receive DUPLICATE
→ reuse its ID with different content
→ receive HTTP 409 Conflict
```

### Deliberately deferred boundaries

- Multiple service instances are not coordinated.
- Event-impact and assessment history are not persisted.
- Database migrations are not yet tracked by a dedicated migration tool.
- Deployment, readiness, metrics, backup, and recovery procedures remain future operational work.

## Candidate: Multi-instance concurrency correctness

### Operational question

> Can the service remain correct when more than one service instance processes events concurrently?

The current serial queue prevents lost updates between overlapping requests within one Node.js process. It does not coordinate independently running processes, because each process maintains its own in-memory projection and queue.

Potential work includes:

- database-backed coordination between instances;
- projection versioning or optimistic concurrency checks;
- synchronization after another instance accepts an event;
- transaction-isolation requirements;
- query consistency while remote events are being incorporated;
- controlled behavior while an instance restarts or falls behind.

This capability should be introduced only when running multiple instances becomes a concrete requirement. The current single-instance guarantee is explicit and tested.

## Candidate: Audit and impact history

### Business questions

> What happened, when did it happen, and which customer commitments did it affect?

Potential work includes:

- accepted-event history;
- event-impact history;
- order fulfillment history;
- complete shipment availability history;
- traceability from a current blocker to historical evidence;
- calculation or rule-version metadata for historical conclusions.

Persisted assessment or impact snapshots become justified when the system must preserve what it concluded at a specific time rather than recalculate the answer using current rules.

## Candidate: Impact explorer

### User question

> Can an operator quickly see how an event changed supply allocation and customer-order risk?

A bounded visualization may provide:

- an operational-event timeline;
- current order status;
- affected-order highlighting;
- before-and-after allocation and shortfall;
- blocker and triggering-change evidence;
- replay of representative scenarios.

This should remain a demonstration surface for the backend, not expand into a general administrative frontend.

## Candidate: Operable deployment

### Operational question

> Can the service be deployed, observed, diagnosed, and recovered safely?

Potential work includes:

- structured request and event logging;
- correlation identifiers;
- health and readiness endpoints;
- applied, duplicate, conflicting, rejected, and failed event metrics;
- processing and calculation latency metrics;
- configuration validation;
- graceful startup and shutdown;
- migration, deployment, backup, and recovery procedures;
- controlled database-outage behavior.

## Portfolio checkpoints

After every committed milestone, reassess whether further work provides enough learning and portfolio value to justify its opportunity cost.

A portfolio checkpoint should include:

- concise setup instructions;
- a visual explanation of the primary scenario;
- representative HTTP behavior;
- a current architecture diagram;
- documented rules and limitations;
- executable scenarios;
- passing automated verification;
- explicit design tradeoffs and deferred scope.

## Deferred pending evidence

The following technologies and architectural changes are not scheduled milestones by themselves:

- Kafka or another message broker;
- Redis;
- microservice decomposition;
- Kubernetes;
- extensive cloud infrastructure;
- persisted current assessments;
- generalized caching.

They should be introduced only when a concrete requirement—such as independent consumers, measured performance limits, cross-instance coordination, or deployment constraints—makes their additional consistency and operational costs worthwhile.

## Deferred product capabilities

These require new business scenarios and rules:

- customer tiers or strategic-account priority;
- expedite and manual-allocation policies;
- inventory transfers between warehouses;
- split fulfillment;
- order cancellation and line changes;
- alternate products or substitutions;
- recommended recovery actions;
- a generalized plugin framework for business rules.

The existing explicit rules should reveal the correct extension boundaries before a generalized rule system is designed.
