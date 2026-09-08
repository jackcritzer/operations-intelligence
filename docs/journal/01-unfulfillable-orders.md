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
- When blocking evidence overlaps, shortfall is attributed by explanatory strength: deadline-crossing delayed inbound, supply consumed by higher-priority demand, other late inbound, then undetermined remainder.
- A shipment delay is a triggering change for an order only when the represented change moved the shipment from timely to late for that order's deadline.

The result separates three concepts:

- `supplyContributions`: what currently covers the demand;
- `blockingConditions`: why the remaining demand cannot be covered;
- `triggeringChanges`: what recorded change produced a selected condition.

Blocking-condition quantities must account for the complete projected shortfall without exceeding it, even when several facts overlap.

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

### Use one global blocker-type order

A fixed order such as “late inbound before higher-priority demand” makes results deterministic, but it can select the less useful explanation when evidence overlaps. The same late shipment can be causal for one order and merely circumstantial for another because orders have different deadlines.

The engine instead considers whether a recorded delay crossed the assessed order’s deadline. This preserves the change that caused a represented fulfillment transition before attributing remaining quantities to allocation competition, other late inbound, or an undetermined remainder.

## Implementation approach

The slice follows this flow:

```text
operational events
→ current operational state
→ prioritized demand and matching supply
→ projected allocation
→ evidence attribution
→ order- and line-level assessments
→ human-readable scenario output
```

Events represent facts learned from operational systems. `applyEvent` validates event-to-state consistency and updates the in-memory projection. The fulfillment calculator rebuilds a calculation-local supply pool, sorts active demand deterministically, allocates eligible supply, and constructs structured explanations for each shortfall.

Late inbound evidence is partitioned into two groups for each demand line:

1. supply whose latest represented delay moved it from on time to late for that demand line;
2. other supply that is currently late but did not cross that deadline in the represented change.

The calculator consumes explanatory quantities in four explicit phases: deadline-crossing delayed inbound, higher-priority allocations, other late inbound, and undetermined remainder. This prevents overlapping evidence from explaining more units than the projected shortfall.

The executable scenario recalculates fulfillment after each event and shows status transitions rather than only the final state.

### Comparing immediate event impact

A current assessment and an event impact answer different questions. The current assessment explains the network as represented now; event impact explains what materially changed across one accepted state transition.

The application operation calculates assessments before an event, applies the event, calculates them again, and compares the two result sets. The comparison identifies orders that were added, removed, became blocked, became fulfillable, or retained their status while material details changed. Material details include allocation, shortfall, supply contributions, blocking conditions, triggering changes, and required ship time.

Comparing only order status would miss meaningful deterioration such as a blocked order's shortfall increasing from two units to eight. It would also miss a change in operational evidence when quantities remain constant. Complete before-and-after assessments are retained so a consumer can explain the change without recalculating it.

Event impact is returned by `POST /v1/operational-events`. Duplicate events return no new impact because they do not create another state transition. Failed events do not return a partially constructed impact result.

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
The shipment was delayed from a timely availability to one after this order's deadline.
```

A delay from already late to even later is not a trigger for that order, although the shipment can still appear as late-inbound blocking evidence.

The scenario CLI avoids printing these facts twice when the event being displayed is itself the trigger, while the engine preserves both structures for later queries.

### Attributing overlapping blocking evidence

A projected shortfall can have multiple true explanations. Matching supply may have been consumed by higher-priority demand while another matching inbound shipment is scheduled after the deadline. Returning every overlapping quantity would overstate the shortfall.

For example, an earlier order may already have consumed on-hand supply while a later order remains fulfillable from inbound supply. If that inbound shipment then crosses the later order’s deadline, the delay explains the transition to `BLOCKED`; the unchanged earlier allocation does not. The deadline-crossing delayed supply therefore receives attribution first.

After causal delayed supply is attributed, eligible supply consumed by higher-priority demand explains where otherwise usable supply went. Other late inbound is weaker evidence because it may never have been capable of fulfilling the order. Any quantity the represented evidence cannot explain remains undetermined.

This is an attribution policy, not a claim that only one fact is true. It selects which evidence accounts for each unit of the actual shortfall.

### Preserving supply provenance

Showing only allocation totals hid the scenario’s causal story. The output now shows that the fulfillable order is covered by 70 on-hand units plus 30 inbound units, making it clear why delaying those 30 inbound units creates a 30-unit shortfall.

### Current delay-history limitation

Operational state retains only the latest availability change for each shipment. If a shipment first crosses an order deadline and is later delayed again, the original crossing is no longer represented in current state.

The current attribution is therefore sound for the latest represented change, not for complete shipment history. The accepted-event log now preserves the underlying delay events durably, but the current fulfillment projection does not use that complete history when constructing explanations. Historical attribution remains a separate capability rather than being implied by event persistence alone.

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
- shipment-delay blockers and triggers;
- causal delayed inbound taking precedence over overlapping allocation evidence;
- higher-priority demand taking precedence over inbound that was already late;
- all four attribution phases contributing to one shortfall;
- delays from already late to later remaining non-triggering;
- blocking-condition quantities never exceeding the projected shortfall.

Boundary tests cover:

- inbound supply exactly at and immediately after the deadline;
- warehouse and SKU isolation;
- reserved and unusable inventory;
- prevention of double allocation;
- omission of blockers and triggers for fulfillable lines;
- selection of only relevant, deadline-crossing shipment-delay triggers.

The executable acceptance suite covers four documented business scenarios:

1. `partial-on-hand-shortfall` verifies partial allocation and an undetermined remainder when no more specific evidence exists.
2. `mixed-cause-shortfall` verifies that overlapping evidence partitions one shortfall without double-counting.
3. `shipment-delay-blocks-order` verifies an order moving from blocked to fulfillable and back to blocked when inbound availability crosses its deadline.
4. `two-orders-share-time-phased-supply` verifies deterministic competition between orders for shared on-hand and inbound supply.

Each scenario uses the same event-processing, state-projection, fulfillment-calculation, and explanation code used by the engine. Focused tests remain responsible for isolated allocation boundaries and blocker-attribution edge cases.

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

Explainability cannot be attached afterward as generated prose. The calculation must retain supply provenance, excluded supply, allocation history, relevant state changes, and an explicit attribution policy while producing the result.

A fact can be relevant without being the best explanation. The engine must distinguish evidence that caused a represented status transition from evidence that merely coexists with the current shortage.

Executable business scenarios provide a different guarantee from focused unit tests. Unit tests establish individual calculation rules; scenarios establish that events, state transitions, allocation, explanations, and status changes form a coherent operational story. Converting the documented scenarios into executable specifications also exposed drift between the written rules and the implemented result contract.

A current-state answer and a change answer require different models. Knowing that an order is blocked does not by itself establish what the latest event changed. Immediate impact requires preserving two complete assessments, defining which differences are operationally material, and excluding unaffected orders.

Status alone is too coarse for impact analysis. An order can remain blocked while its shortfall worsens, its projected supply changes, or a previously undetermined shortage gains specific evidence. Added and removed assessments also need distinct classifications because an order that did not previously exist did not "become" fulfillable or blocked.

This work also made idempotency part of the product result rather than only an ingestion optimization. A duplicate event must not report the original impact again because no new state transition occurred.

## Interview story

I started with a business question rather than an API or database schema: which customer orders cannot be fulfilled by their required ship time, and why?

I modeled orders, inventory, inbound supply, and delays as facts from separate operational systems. The first challenge was preventing double allocation across competing demand while producing explanations that did not claim more than the available evidence supported.

I implemented deterministic demand priority, a calculation-local supply pool, structured supply contributions, blocking conditions, and triggering changes. When evidence overlaps, the engine attributes the shortfall according to explanatory strength and reports a shipment delay as a trigger only when it moved supply across the assessed order’s deadline.

I then extended the engine from explaining current state to explaining immediate event impact. Event processing calculates assessments before and after an accepted event, compares the complete results, and returns only materially changed orders through the HTTP boundary.

The next system-design problem was durability. Directly mutating in-memory state before writing to PostgreSQL could leave the running process ahead of durable history if persistence failed. Overlapping requests could also clone the same state and overwrite each other’s changes.

I addressed those boundaries by:

- storing accepted normalized events in PostgreSQL;
- enforcing durable event-ID uniqueness;
- comparing stable content fingerprints for duplicate and conflict handling;
- applying each event to cloned staged state;
- publishing staged state only after durable acceptance;
- serializing the complete state-dependent operation within one process;
- replaying accepted events in database order before opening the HTTP port;
- failing startup when persisted history cannot be reconstructed safely.

The result is a durable single-instance backend with explicit consistency boundaries. It survives process restarts, reconstructs its operational projection deterministically, preserves duplicate recognition, and refuses conflicting event identity reuse.

I deliberately did not claim multi-instance correctness. Each process would maintain its own in-memory projection and serial queue, so multiple active instances require an additional coordination design.

## Follow-up work

### Portfolio checkpoint

The durable single-instance backend is a complete portfolio checkpoint after its documentation and repository audit are finished.

The checkpoint demonstrates:

- business-centered domain modeling;
- deterministic shared-supply allocation;
- structured explainability;
- immediate before-and-after event impact;
- HTTP request validation and error mapping;
- PostgreSQL event persistence;
- durable idempotency and conflict detection;
- staged state publication;
- asynchronous concurrency control;
- deterministic startup replay;
- runtime configuration and graceful shutdown;
- unit, integration, concurrency, HTTP, scenario, and restart verification.

### Candidate next milestones

1. Add historical event and impact queries when a concrete audit question defines the required model.
2. Build a bounded impact explorer for event timelines and before-and-after fulfillment evidence.
3. Add health, readiness, structured logging, metrics, and deployable runtime infrastructure.
4. Design database-backed coordination if multiple active service instances become a real requirement.
5. Introduce snapshots or projection versioning if replay scale or rule evolution requires them.

Kafka, Redis, microservices, Kubernetes, persisted current assessments, and generalized caching remain deferred until a concrete requirement justifies their consistency and operational costs.
