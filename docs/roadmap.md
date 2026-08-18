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

## Committed next: Durable operational state

### Operational question

> Can the service preserve and reconstruct its operational understanding across restarts?

### Intended guarantees

The milestone should provide:

- PostgreSQL storage for accepted normalized events;
- durable event-ID uniqueness;
- recognition of the same event ID and content as a duplicate;
- rejection of an event ID reused with different content;
- deterministic replay into operational state;
- restart recovery that produces the same current fulfillment assessments;
- an explicit transaction and failure boundary for event acceptance;
- database-backed integration tests and local development infrastructure.

### Design questions to resolve before implementation

- Is the accepted event log the durable source of truth?
- Which data, if any, should be persisted in addition to accepted events?
- What database-assigned sequence determines replay order?
- How is normalized event content fingerprinted?
- How can an event be validated and staged without partially mutating live state?
- What happens if database persistence or in-memory application fails?
- At what point is the service ready to answer queries during startup replay?

Assessments and event-impact results remain derived unless a later historical requirement justifies persisting them.

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
→ receive a conflict
```

## Candidate: Concurrency correctness

### Operational question

> Can the service remain correct when requests overlap or more than one instance processes events?

Potential work includes:

- simultaneous duplicate delivery;
- concurrent changes to the same shipment or inventory position;
- query consistency during event acceptance;
- transaction isolation and database-backed coordination;
- projection versioning or synchronization across service instances;
- controlled behavior during instance restart.

This milestone will be designed after durable single-instance behavior reveals the actual consistency boundaries.

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

