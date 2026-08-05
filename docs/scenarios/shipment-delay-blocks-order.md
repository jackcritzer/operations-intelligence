# Scenario: Shipment Delay Blocks an Order

## Business question

Can customer order `SO-1001` be fulfilled in full from its assigned warehouse by its required ship time, and if not, what prevents fulfillment?

## Purpose

Demonstrate that a delay to eligible inbound supply can change a customer order from `FULFILLABLE` to `BLOCKED`, while preserving a structured explanation of the shortfall and the change that caused it.

## Rules exercised

- Supply is eligible only when its warehouse and SKU match the order line.
- Cross-warehouse fulfillment is out of scope.
- Usable inventory is reduced by inventory already reserved outside this calculation.
- Confirmed inbound supply is eligible only when it is expected to be available on or before the order's required ship time.
- Every line must be fully covered for the order to be `FULFILLABLE`.
- A partially covered line is `BLOCKED`, although its projected allocation is still reported.
- Blocking-condition quantities equal the projected shortfall even when explanatory evidence overlaps.
- A shipment delay is a triggering change only when it moves supply from timely to late for the assessed order.
- The calculation projects allocation but does not create reservations or mutate operational state.

## Order event

`OrderPlaced` from the ERP:

- Order ID: `SO-1001`
- Placed at: `2026-08-01T09:00:00-05:00`
- Required ship time: `2026-08-08T17:00:00-05:00`

| Order line   | SKU           | Fulfillment warehouse | Quantity |
| ------------ | ------------- | --------------------- | -------: |
| `SO-1001-L1` | `BEARING-440` | `CHI`                 |      100 |

Customer identity and customer-level priority are not modeled in this slice.

## Inventory events

`InventoryPositionReported` from the WMS:

| Warehouse | SKU           | Usable | Reserved | Unusable | Available to calculation |
| --------- | ------------- | -----: | -------: | -------: | -----------------------: |
| `CHI`     | `BEARING-440` |     70 |        0 |        0 |                       70 |

`available to calculation = usableQuantity - reservedQuantity`.

## Inbound shipment event

`InboundShipmentConfirmed` from the transportation system:

- Shipment ID: `IN-900`
- Destination warehouse: `CHI`
- Initial expected availability: `2026-08-06T09:00:00-05:00`

| Shipment line | SKU           | Quantity |
| ------------- | ------------- | -------: |
| `IN-900-L1`   | `BEARING-440` |       30 |

## Before the delay

For `SO-1001-L1`, 70 units are available on hand and 30 confirmed inbound
units are expected before the required ship time. The engine can project an
allocation of 100 units.

Expected order status: `FULFILLABLE`.

## Delay event

`InboundShipmentDelayed` changes `IN-900`:

- Previous expected availability: `2026-08-06T09:00:00-05:00`
- New expected availability: `2026-08-11T09:00:00-05:00`
- Changed at: `2026-08-03T12:00:00-05:00`
- Reason: carrier delay

The previous availability was before `SO-1001`'s deadline and the new availability is after it, so this is a deadline-crossing delay for the order.

## After the delay

`IN-900` is no longer eligible for `SO-1001` because its expected availability is after the required ship time.

| Order line   | Required | Projected allocation | Shortfall | Status    |
| ------------ | -------: | -------------------: | --------: | --------- |
| `SO-1001-L1` |      100 |                   70 |        30 | `BLOCKED` |

Expected order status: `BLOCKED`, because at least one line is blocked.

The explanation for `SO-1001-L1` must identify:

- an `INBOUND_AVAILABLE_TOO_LATE` blocking condition for 30 units on
  `IN-900`, equal to the projected shortfall; and
- the shipment delay as the triggering change, including its previous and new expected availability times.

All 30 units on `IN-900` are attributed to the blocker because the line's
projected shortfall is also 30 units.

## Explicitly out of scope

- combining inventory across warehouses;
- moving inventory between warehouses;
- customer tiers or customer-specific priority;
- alternate fulfillment warehouses;
- partial shipment policy;
- committing the projected allocation as a reservation;
- optimizing allocation to maximize the number or value of fulfilled orders.
