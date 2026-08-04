# Engineering Journal: Unfulfillable Orders

## Business question

> Which open customer orders cannot currently be fulfilled by their required ship time, and why?

The target user is an operations coordinator working across order, warehouse, and inbound-shipment information. A useful answer must identify the affected order and line, required quantity, projected supply, shortfall, current blocker, and any known operational change that caused it.

This engine is downstream from systems of record. It derives customer-order impact from facts those systems provide; it does not replace an ERP or WMS.

## Domain discoveries

“Inventory exists” does not mean an order is fulfillable. Supply must match the SKU and assigned warehouse. On-hand inventory must be usable and unreserved. Confirmed inbound supply must become operationally available by the order’s required ship time.

Orders also compete for shared supply. Assessing every order independently would double-count inventory, so the engine needs one deterministic projected allocation across all active demand.

A projected allocation is not a reservation. It explains how current supply would cover demand under the engine’s rules without changing upstream warehouse state.

## Decisions made

- Each order line uses one assigned fulfillment warehouse.
- Available on-hand quantity is `max(0, usableQuantity - reservedQuantity)`.
- Unusable inventory does not contribute supply.
- Confirmed inbound supply is eligible when `expectedAvailableAt <= requiredShipAt`.
- Demand priority is earlier required ship time, then earlier placement time, then order ID and order-line ID as deterministic tie-breakers.
- On-hand supply is used before eligible inbound supply.
- Each supply unit can be projected to at most one demand line.
- A line is `FULFILLABLE` when its projected shortfall is zero; otherwise it is `BLOCKED`.
- An order is fulfillable only when every active line is fulfillable.

The result separates three concepts:

- `supplyContributions`: what currently covers the demand;
- `blockingConditions`: why the remaining demand cannot be covered;
- `triggeringChanges`: what recorded change produced a selected condition.

Blocking-condition quantities must account for the complete projected shortfall.

## Alternatives considered

### Assess every order independently

This is simpler but wrong when orders share supply. It can make several orders appear fulfillable using the same units. The engine instead consumes a calculation-local supply pool as prioritized demand is processed.

### Prioritize only by order placement time

Pure first-come, first-served ignores customer commitments. A later order may have an earlier required ship time. Required ship time therefore takes precedence, while placement time resolves demand with the same deadline.

Customer tier, order value, expedite status, and manual overrides are excluded until the domain supplies those policies.

### Count every confirmed inbound shipment

Confirmation does not make supply useful for every order. Inbound supply arriving after an order’s deadline cannot prevent that order from being blocked.

### Store projected allocations as reservations

That would blur the boundary between an intelligence engine and an execution system. The current calculation does not authorize warehouse activity or mutate upstream reservations.

### Return explanation strings

Strings are easy to display but difficult to test, aggregate, or expose consistently through an API. Explanations are structured domain results; presentation code turns them into prose.

## Implementation approach

The slice follows this flow:

```text
operational events
→ current operational state
→ prioritized demand and matching supply
→ projected allocation
→ order- and line-level assessments
→ human-readable scenario output
```

Events represent facts learned from operational systems. `applyEvent` validates event-to-state consistency and updates the in-memory projection. The fulfillment calculator rebuilds a calculation-local supply pool, sorts active demand deterministically, allocates eligible supply, and constructs structured explanations for each shortfall.

The executable scenario recalculates fulfillment after each event and shows status transitions rather than only the final state.

## Explainability challenges

### Avoiding unsupported conclusions

If no matching supply exists, the engine cannot safely claim that inventory was lost, a supplier failed, or procurement should place an order. `SHORTFALL_CAUSE_UNDETERMINED` means only that the represented state contains no more specific evidence.

### Explaining competition for supply

When higher-priority demand consumes matching supply, allocation history must identify the consuming order and line. Otherwise the later order’s shortfall is mathematically correct but operationally opaque.

### Separating blocker from trigger

A blocker describes the current condition:

```text
Inbound supply becomes available after the required ship time.
```

A trigger describes the earlier change:

```text
The shipment was delayed from its previous availability time to a later time.
```

The scenario CLI avoids printing these facts twice when the event being displayed is itself the trigger, while the engine preserves both structures for later queries.

### Preserving supply provenance

Showing only allocation totals hid the scenario’s causal story. The output now shows that the fulfillable order is covered by 70 on-hand units plus 30 inbound units, making it clear why delaying those 30 inbound units creates a 30-unit shortfall.

## Testing and validation

Event-application tests cover:

- order, inventory-position, and inbound-shipment creation;
- inventory-position replacement;
- shipment-delay state updates;
- duplicate-event handling and duplicate business-entity rejection;
- rejection of delays for unknown shipments;
- rejection of inconsistent `previousExpectedAvailableAt` values;
- rejection of delay events whose new availability is not later.

The final three checks are state-transition invariants in the `InboundShipmentDelayed` branch of `applyEvent`. They protect the meaning of a delay event; they are not fulfillment-allocation rules.

Fulfillment tests cover:

- on-hand and timely inbound allocation;
- competition between orders;
- required-time and placement-time priority;
- deterministic ID tie-breaking;
- partial fulfillment and multi-line rollup;
- mixed-cause shortfalls;
- shipment-delay blockers and triggers.

Boundary tests cover:

- inbound supply exactly at and immediately after the deadline;
- warehouse and SKU isolation;
- reserved and unusable inventory;
- prevention of double allocation;
- omission of blockers and triggers for fulfillable lines;
- selection of only relevant shipment-delay triggers.

The scenario applies four events:

1. Warehouse inventory is reported.
2. An order is placed and is initially blocked.
3. Timely inbound supply is confirmed and the order becomes fulfillable.
4. That supply is delayed beyond the deadline and the order becomes blocked again.

Verification includes automated tests, TypeScript typechecking, formatting checks, CI, and manual review of the executable scenario as an operational story.

## How AI was used

AI helped translate the business question into an information model, challenge allocation assumptions, propose TypeScript structures, generate implementation candidates, identify boundary cases, and review consistency across code, tests, scenarios, and documentation.

Generated output was not treated as authoritative. Business rules were accepted only after being made explicit and checked against scenarios, tests, and project boundaries. The most valuable contribution was exposing hidden assumptions, not producing code volume.

## What changed in my understanding

The problem initially looked like:

```text
required quantity - available quantity = shortfall
```

The actual problem also requires reconstructing state from events, distinguishing usable and projected supply, evaluating time-phased supply against commitments, allocating shared supply deterministically, and preserving enough evidence to explain the result.

Explainability cannot be attached afterward as generated prose. The calculation must retain supply provenance, excluded supply, allocation history, and relevant state changes while producing the result.

## Interview story

I started with a business question rather than an API or database schema. I modeled orders, inventory, inbound supply, and delays as facts from separate operational systems. The main technical challenges were preventing double allocation across competing demand and producing explanations that did not claim more than the available evidence supported.

I implemented deterministic demand priority, a calculation-local supply pool, structured supply contributions, blocking conditions, and triggering changes. The executable scenario demonstrates an order moving from blocked to fulfillable and back to blocked when inbound availability crosses its deadline.

The current result is an in-memory domain engine, not yet a production service. Its value is that the core business behavior and explanation contracts are explicit and tested before HTTP and persistence concerns are added.

## Follow-up work

Near-term system work:

1. Define validated HTTP contracts for event submission and fulfillment queries.
2. Persist accepted events with durable idempotency.
3. Rebuild state through deterministic replay.
4. Add structured errors, logging, deployment, and basic observability.

Future operational questions include:

- Which orders became newly at risk, and what changed?
- Which inbound disruption affects the most customer demand?
- Which blocked orders have no identified recovery supply?
- Which feasible intervention could restore fulfillment?
