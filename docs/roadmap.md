# Development Roadmap

## Purpose

This roadmap sequences work by operational capability rather than technical layer.

Each product slice begins with a business question, extends the engine only as required to answer it, and carries that answer through domain, application, and HTTP boundaries.

Infrastructure is introduced when it protects or preserves an established business capability.

## Completed milestone: Current fulfillment assessment

### Business question

> Which open customer orders cannot currently be fulfilled by their required ship time, and why?

### Implemented capability

The service can:

- ingest normalized order, inventory, inbound-shipment, and shipment-delay events;
- maintain current operational state in memory;
- project shared supply across competing customer demand;
- expose current order- and line-level fulfillment assessments;
- identify projected allocations and shortfalls;
- explain shortfalls using structured blocking conditions;
- identify a shipment delay as a triggering change when it crossed an order deadline.

### Current boundaries

- Each order line has one fulfillment warehouse.
- Supply cannot move between warehouses.
- Demand priority is earlier required ship time, then earlier placement time.
- Order and line IDs provide deterministic tie-breaking only.
- Projected allocation does not create an upstream inventory reservation.
- State and processed event IDs exist only in memory.
- Only the latest represented shipment availability change is retained.

## Next milestone: Event impact

### Business question

> When an operational event arrives, which customer-order fulfillment assessments changed because of it?

A shipment delay is the initial concrete case:

> Which orders became blocked or otherwise deteriorated because this inbound shipment was delayed?

### Phase 1: Assessment comparison

Define a pure comparison model for fulfillment assessments.

It must distinguish:

- an order becoming blocked;
- an order becoming fulfillable;
- an order remaining blocked while its projected shortfall changes;
- an order retaining its status while line-level allocation changes;
- unchanged orders, which should not appear in the result.

The comparison must preserve enough before-and-after information to explain the material change without recalculating it later.

### Phase 2: Event-impact orchestration

Introduce an application operation that:

1. calculates fulfillment assessments before an event;
2. applies the event;
3. calculates assessments after the event;
4. compares the two assessment sets;
5. returns event-application status and material fulfillment impact.

Duplicate events must not report new impact.

Failure to apply an event must not return a partially constructed impact result.

### Phase 3: Event-impact HTTP contract

Expose the application result through the operational-event ingestion boundary.

The response should identify:

- the accepted event;
- whether it was applied or recognized as a duplicate;
- affected orders;
- each material before-and-after change.

The first end-to-end scenario should prove that delaying inbound supply beyond an order deadline changes the affected order from `FULFILLABLE` to `BLOCKED`.

## Production milestone: Durable operational state

### Business question

> Can the service preserve and recover its operational understanding across restarts and concurrent event delivery?

### Persistence design

Decide:

- whether the accepted event log is the authoritative persisted record;
- which derived projections, if any, are persisted;
- how replay order is determined;
- how invalid or out-of-order events are represented;
- how event identity and payload conflicts are handled;
- what transaction contains event acceptance and state projection.

### Durable ingestion

Implement:

- persistent accepted events;
- durable idempotency;
- detection of one event ID reused for different content;
- deterministic state recovery;
- transactional event application.

### Concurrency correctness

Define and test behavior when:

- duplicate events arrive concurrently;
- two updates affect the same shipment;
- inventory reports for the same warehouse and SKU overlap;
- a query executes while an event is being accepted.

## Audit and history milestone

### Business questions

> What happened, when did it happen, and which customer commitments did it affect?

Add:

- event-history queries;
- event-impact history;
- complete shipment availability history;
- traceability from a current blocker to relevant historical evidence.

Historical attribution must distinguish current conditions from the events that originally created them.

## Operational hardening milestone

Prepare the service to run as a diagnosable backend:

- structured request and event logging;
- correlation identifiers;
- health and readiness endpoints;
- metrics for accepted, duplicate, rejected, and failed events;
- latency metrics for ingestion and assessment calculation;
- configuration validation;
- graceful shutdown;
- deployment and recovery documentation.

## Portfolio release milestone

Make the system quickly evaluable by another engineer:

- concise setup instructions;
- representative HTTP examples;
- current architecture diagram;
- documented business rules and limitations;
- executable operational scenarios;
- passing automated verification;
- a clear explanation of design tradeoffs and deferred scope.

## Deferred product capabilities

These should not be introduced until a business scenario requires them:

- customer tiers or strategic-account priority;
- expedite and manual-allocation rules;
- inventory transfers between warehouses;
- split fulfillment;
- order cancellation and line changes;
- alternate products or substitutions;
- recommended recovery actions;
- a generalized plugin framework for business rules.

The existing explicit rules should reveal the correct extension boundaries before a generalized rule system is designed.
