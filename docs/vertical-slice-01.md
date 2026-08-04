# Vertical Slice 01: Unfulfillable Customer Orders

## Question

Which open customer orders cannot currently be fulfilled by their required
ship date, and why?

## Proposed definition

An order is currently fulfillable when every active order line can be fully 
supplied by its required ship date from its assigned fulfillment warehouse 
using usable, unreserved on-hand inventory and confirmed inbound inventory 
expected to arrive in time.

An order is blocked when one or more lines have a projected shortfall.

## Initial business rules

1. On-hand inventory is tracked by SKU and warehouse.
2. Reserved inventory cannot be allocated to another order.
3. Unusable inventory does not count as available.
4. Confirmed inbound inventory counts when its expected receipt date is on or
   before the order's required ship date.
5. An inbound delay can make a previously fulfillable order blocked.
6. Orders compete for limited supply.
7. Initial allocation priority is:
   - earlier required ship date;
   - then earlier order placement time.
8. Any blocked line makes the order blocked.
9. The result must expose line-level quantities and causes, not only a status.

## Open decisions

- Can inventory from multiple warehouses satisfy one order?
- Does that depend on whether split shipments are permitted?
- Is inventory reserved immediately or only during a scheduled allocation run?
- Do expected inbound receipts merely influence a projection, or are they
  explicitly assigned to orders?
- What happens when an earlier high-priority order arrives after inventory has
  already been reserved?
- Is the first slice evaluating requested or promised ship dates?
- What event source owns inventory reservations?

## First-slice boundaries

- Each order line has one assigned fulfillment warehouse.
- Supply at other warehouses does not count toward fulfillment.
- Split fulfillment and inventory transfers are deferred.
- Confirmed inbound supply may count toward projected availability.
- Inbound supply is evaluated using its expected availability time, not merely
  its carrier arrival date.
- The engine performs a projected allocation to avoid counting the same supply
  for multiple orders.
- Projected allocation does not create or replace an upstream inventory
  reservation.

## Expected answer shape

For each blocked order:

- order identifier
- required ship date
- blocking order lines
- requested quantity
- supply available by the required date
- shortfall quantity
- contributing facts
- events that materially caused the current condition

## Primary user

An operations coordinator responsible for ensuring customer orders ship on time.

## User need

The coordinator needs one place to identify blocked orders without manually
reconciling order, inventory, warehouse, and inbound-shipment information.

## Product behavior

The engine receives normalized business events from simulated upstream systems,
updates its derived operational state, and exposes an explainable query showing
which orders are blocked.

## First demo

A deterministic scenario initially shows an order as fulfillable. An inbound
shipment is then delayed beyond the required ship date. The same query now shows
the order as blocked, including the affected SKU, shortfall quantity, delayed
shipment, and relevant dates.