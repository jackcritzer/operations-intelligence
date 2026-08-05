# Fulfillment Rules

This document defines the business rules currently implemented by the
fulfillment calculator. It describes the engine's present behavior, not every
policy a production fulfillment system may eventually support.

## Demand priority

Demand is processed in this order:

1. `requiredShipAt`, ascending;
2. `placedAt`, ascending;
3. `orderId`, ascending;
4. `orderLineId`, ascending.

The earliest required ship time receives available supply first. An order
placed earlier does not retain priority over a later-placed order with an
earlier required ship time.

When required ship times match, the earlier placement time receives priority.
Order ID and order-line ID are deterministic tie-breakers; they do not
represent business priority.

Customer identity, customer tier, order value, and manual expedites are not
priority inputs in this vertical slice.

## Supply matching and eligibility

Supply can cover an order line only when both its SKU and warehouse match the
line's assigned SKU and fulfillment warehouse.

Eligible supply consists of:

- currently usable, unreserved on-hand inventory; and
- confirmed inbound inventory expected to be available on or before the
  line's `requiredShipAt`.

Reserved and unusable inventory are not allocated. Cross-warehouse sourcing,
transfers, substitutions, procurement, and production supply are out of scope.

## Projected allocation

The calculator processes demand in priority order and consumes each eligible
supply quantity at most once. It reports a projection only: it does not create
a reservation or mutate operational state.

For every line:

```text
projectedAllocation + projectedShortfall = requiredQuantity
```

A line is `FULFILLABLE` only when its projected shortfall is zero. An order is
`FULFILLABLE` only when every line is fulfillable; otherwise the order is
`BLOCKED`.

## Blocking explanations

For a blocked line, blocking-condition quantities partition the projected
shortfall. The calculator currently uses these explanations:

- `SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND`: matching supply was projected
  to an order line processed earlier under the demand-priority rules.
- `INBOUND_AVAILABLE_TOO_LATE`: matching inbound supply exists, but its
  expected availability is after the line's required ship time.
- `SHORTFALL_CAUSE_UNDETERMINED`: no represented supply or more specific
  evidence explains the remaining quantity.

`SHORTFALL_CAUSE_UNDETERMINED` does not assert that inventory is missing or
that a purchase order, shipment, or replenishment action failed. The engine
lacks evidence for those conclusions in this vertical slice.

When more than one condition could explain a shortfall, the intended
precedence is:

1. previously timely inbound supply that a recorded delay moved past the
   assessed line's deadline;
2. eligible supply consumed by higher-priority demand;
3. other inbound supply available after the deadline;
4. undetermined remainder.

Triggering changes are reported only when state contains a recorded change
that produced a selected blocking condition. A shipment delay is a triggering
change only when the recorded change moved that shipment from timely to late
for the assessed line.

Supply contributions identify the supply provisionally allocated to an order line by the fulfillment calculation. They may be present on a blocked line when available supply covers only part of its required quantity. A projected allocation does not itself authorize a partial shipment or represent a persisted reservation.
