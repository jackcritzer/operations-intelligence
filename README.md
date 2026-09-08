# Operations Intelligence Engine

An explainable TypeScript backend that combines orders, warehouse inventory, inbound supply, and transportation events to identify customer commitments at risk.

The project is organized around operational decisions rather than CRUD resources.

## What it answers

For an operations coordinator, the engine answers two related questions:

> Which open customer orders cannot currently be fulfilled by their required ship time, and why?

> When an operational event arrives, which fulfillment assessments changed because of it?

It returns structured evidence—not only a status—including projected allocation, shortfall, supply provenance, blocking conditions, and relevant triggering changes.

## Example: a shipment delay blocks an order

```mermaid
flowchart LR
    A["Before delay<br/>SO-2002: FULFILLABLE<br/>4 units inbound"]
    B["IN-901 delayed<br/>Aug 9 → Aug 11"]
    C["After delay<br/>SO-2002: BLOCKED<br/>Shortfall: 4"]

    A --> B --> C
```

The order must ship by August 10. Before the delay, four inbound units are expected on August 9 and complete its projected allocation. When the shipment moves to August 11, those units become too late and the order becomes blocked.

The event-ingestion response identifies the transition and preserves its evidence. This abridged example highlights the material changes; the actual response includes complete before-and-after order and line assessments:

```json
{
  "eventId": "delay-IN-901",
  "status": "APPLIED",
  "impact": {
    "changedOrders": [
      {
        "orderId": "SO-2002",
        "type": "BECAME_BLOCKED",
        "before": {
          "status": "FULFILLABLE"
        },
        "after": {
          "status": "BLOCKED"
        },
        "changedLines": [
          {
            "orderLineId": "SO-2002-L1",
            "before": {
              "projectedAllocation": 4,
              "projectedShortfall": 0
            },
            "after": {
              "projectedAllocation": 0,
              "projectedShortfall": 4,
              "blockingConditions": [
                {
                  "type": "INBOUND_AVAILABLE_TOO_LATE",
                  "shipmentId": "IN-901"
                }
              ],
              "triggeringChanges": [
                {
                  "type": "SHIPMENT_DELAYED",
                  "shipmentId": "IN-901"
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

The complete scenario is implemented as an executable specification, focused tests, and an end-to-end HTTP test.

## How it works

```mermaid
flowchart TD
    A["POST normalized event"] --> B["Validate and fingerprint"]
    B --> C["Serialize event processing"]
    C --> D["Clone current state"]
    D --> E["Calculate assessments before"]
    E --> F["Apply event to staged state"]
    F --> G["Persist accepted event"]
    G --> H["Calculate assessments after"]
    H --> I["Publish staged state"]
    I --> J["Return event impact"]

    K["PostgreSQL accepted-event log"] --> L["Replay accepted events at startup"]
    L --> M["Reconstructed operational state"]
    M --> C
    M --> N["GET current assessments"]
```

The accepted-event log in PostgreSQL is the durable source of truth. At startup, the service loads accepted events in database-assigned replay order and applies them to an empty operational state before opening its HTTP port.

For a new event, the service clones the current state and applies the event to that staged copy. The staged state replaces the live state only after the event has been accepted by PostgreSQL. This prevents validation or persistence failures from leaving memory ahead of durable history.

Event processing is serialized within one Node.js process so overlapping requests cannot publish stale staged states over newer ones. Coordination across multiple service instances remains outside the current guarantee.

## Implemented capabilities

- Ingest normalized `OrderPlaced`, `InventoryPositionReported`, `InboundShipmentConfirmed`, and `InboundShipmentDelayed` events.
- Validate event structure and state-transition consistency.
- Persist accepted normalized events in PostgreSQL.
- Assign accepted events a stable database replay sequence.
- Reconstruct operational state deterministically when the service starts.
- Recognize the same event ID and normalized content as a durable duplicate.
- Reject an event ID reused with different content.
- Stage state changes before persistence and publish them only after successful event acceptance.
- Serialize event processing within one service instance to prevent overlapping requests from losing state updates.
- Maintain current orders, inventory positions, inbound shipments, and represented shipment changes.
- Allocate on-hand and timely inbound supply without double-counting units across orders.
- Prioritize demand deterministically by required ship time, placement time, order ID, and line ID.
- Return order- and line-level fulfillment status, projected allocation, and shortfall.
- Explain late inbound supply, supply consumed by higher-priority demand, and otherwise undetermined shortfalls.
- Compare assessments before and after an event.
- Classify orders as added, removed, newly blocked, newly fulfillable, or changed in material detail.
- Return immediate event impact through the ingestion API.
- Run as a standalone Fastify server with validated runtime configuration and graceful shutdown.

## HTTP API

```http
POST /v1/operational-events
GET /v1/fulfillment-assessments
```

`POST /v1/operational-events` validates, fingerprints, stages, and durably accepts a normalized event before publishing its resulting operational state.

A newly accepted event returns `APPLIED` with its immediate fulfillment impact. Resending the same event ID with identical normalized content returns `DUPLICATE` with no new impact. Reusing an accepted event ID with different content returns HTTP `409 Conflict`.

`GET /v1/fulfillment-assessments` returns the explainable current assessment for every open order.

The API can be exercised through Fastify tests using `app.inject()` or through the standalone server started with `npm run dev` or `npm start`.

## Run locally

Requirements:

- Node.js 22
- npm
- Docker with Docker Compose

Install dependencies and start PostgreSQL:

```bash
npm install
npm run db:up
```

Start the development server:

```bash
DATABASE_URL=postgresql://operations:operations@localhost:5432/operations_intelligence npm run dev
```

The service listens on port `3000` by default. Supply `HOST` or `PORT` to override those defaults.

Run the complete verification suite:

```bash
npm run verify
```

This checks formatting, unit tests, PostgreSQL integration tests, executable scenarios, TypeScript types, and the production build.

Run one executable business scenario independently:

```bash
npm run scenario -- shipment-delay-blocks-order
```

Stop the local database services:

```bash
npm run db:down
```

## Current business rules

| Rule                 | Current behavior                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Warehouse scope      | Each order line uses one fulfillment warehouse; supply does not move between warehouses.         |
| On-hand availability | `max(0, usableQuantity - reservedQuantity)`; unusable inventory does not contribute.             |
| Inbound eligibility  | Confirmed inbound supply contributes only when available by the required ship time.              |
| Demand priority      | Earlier required ship time, then earlier placement time; IDs provide deterministic tie-breaking. |
| Supply use           | On-hand supply is allocated before timely inbound supply.                                        |
| Order status         | An order is fulfillable only when every line has zero projected shortfall.                       |
| Explanation          | Structured blocker quantities account for the shortfall without exceeding it.                    |
| Projection boundary  | Projected allocation does not create an upstream reservation.                                    |

## Current limitations

- Event processing is serialized only within one Node.js process; multiple service instances are not coordinated.
- The live operational projection is held in memory and reconstructed from the durable accepted-event log after restart.
- Only the latest represented availability change is retained in current state for each shipment.
- Event-impact results and historical assessments are not persisted.
- Database initialization currently relies on PostgreSQL container initialization scripts rather than a version-tracking migration tool.
- Health, readiness, metrics, structured operational logging, deployment automation, backup, and recovery procedures are not yet implemented.
- Customer priority, transfers, split fulfillment, substitutions, cancellations, and recovery recommendations are outside the current scope.

The durable operational-state milestone is complete. The next major capability will be selected after reviewing concurrency, audit-history, visualization, and operable-deployment needs.

## Documentation

- [`docs/domain-overview.md`](docs/domain-overview.md) — business context, users, terminology, and scope
- [`docs/ecosystem.md`](docs/ecosystem.md) — upstream systems and the engine's place in the operational ecosystem
- [`docs/product-journey.md`](docs/product-journey.md) — journey of one industrial product from supplier to customer
- [`docs/vertical-slice-01.md`](docs/vertical-slice-01.md) — first vertical-slice specification
- [`docs/architecture/fulfillment-engine.md`](docs/architecture/fulfillment-engine.md) — fulfillment engine structure and allocation flow
- [`docs/architecture/durable-operational-state.md`](docs/architecture/durable-operational-state.md) — event persistence, staged state publication, replay, failure handling, and concurrency boundaries
- [`docs/scenarios/`](docs/scenarios/) — documented executable business scenarios
- [`docs/journal/01-unfulfillable-orders.md`](docs/journal/01-unfulfillable-orders.md) — engineering decisions, discoveries, and implementation notes
- [`docs/roadmap.md`](docs/roadmap.md) — completed, committed, candidate, and deferred milestones

## Technology

- TypeScript
- Node.js
- Fastify
- TypeBox
- PostgreSQL
- Vitest
- Docker Compose
- GitHub Actions
