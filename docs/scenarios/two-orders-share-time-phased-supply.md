# Scenario: Two Orders Share Time-Phased Supply

## Business question

When two orders require the same warehouse and SKU, which supply is projected
to each order when the orders have different required ship times?

## Purpose

Provide a small, manually traceable case that proves:

- the same supply cannot be allocated twice;
- demand is processed by order priority;
- inbound supply is eligible for one deadline only if it is available by that
  deadline; and
- a shipment delay can block the later order without changing the earlier
  order's result.

## Allocation priority

Demand is ordered by:

1. `requiredShipAt`, ascending;
2. `placedAt`, ascending;
3. `orderId`, ascending;
4. `orderLineId`, ascending.

The final two rules make results deterministic. They are not business
priorities.

## Orders

### SO-2001

- Placed at: `2026-08-01T09:00:00-05:00`
- Required ship time: `2026-08-08T17:00:00-05:00`

| Order line   | SKU       | Fulfillment warehouse | Quantity |
| ------------ | --------- | --------------------- | -------: |
| `SO-2001-L1` | `BRG-440` | `CHI`                 |        4 |

### SO-2002

- Placed at: `2026-08-02T09:00:00-05:00`
- Required ship time: `2026-08-10T17:00:00-05:00`

| Order line   | SKU       | Fulfillment warehouse | Quantity |
| ------------ | --------- | --------------------- | -------: |
| `SO-2002-L1` | `BRG-440` | `CHI`                 |        4 |

`SO-2001` has higher priority because it has the earlier required ship time.
Its earlier placement time is not needed to decide this case.

## Current inventory

`InventoryPositionReported` reports:

| Warehouse | SKU       | Usable | Reserved | Unusable | Available to calculation |
| --------- | --------- | -----: | -------: | -------: | -----------------------: |
| `CHI`     | `BRG-440` |      4 |        0 |        0 |                        4 |

## Confirmed inbound supply

`InboundShipmentConfirmed` reports:

- Shipment ID: `IN-901`
- Destination warehouse: `CHI`
- Expected availability: `2026-08-09T09:00:00-05:00`

| Shipment line | SKU       | Quantity |
| ------------- | --------- | -------: |
| `IN-901-L1`   | `BRG-440` |        4 |

The inbound supply is too late for `SO-2001` but timely for `SO-2002`.

## Before the delay

The calculator should process `SO-2001-L1` first. Its only eligible supply is
the four on-hand units. `SO-2002-L1` is then covered by the four inbound units
available on August 9.

Expected status:

| Order     | Expected status | Projected source |
| --------- | --------------- | ---------------- |
| `SO-2001` | `FULFILLABLE`   | 4 on hand        |
| `SO-2002` | `FULFILLABLE`   | 4 from `IN-901`  |

## Delay event

`InboundShipmentDelayed` changes `IN-901`:

- Previous expected availability: `2026-08-09T09:00:00-05:00`
- New expected availability: `2026-08-11T09:00:00-05:00`
- Changed at: `2026-08-07T12:00:00-05:00`
- Reason: carrier delay

## After the delay

The four on-hand units remain projected to the higher-priority `SO-2001`.
`IN-901` is now too late for `SO-2002`.

Expected status:

| Order     | Expected status | Projected allocation | Shortfall |
| --------- | --------------- | -------------------: | --------: |
| `SO-2001` | `FULFILLABLE`   |                    4 |         0 |
| `SO-2002` | `BLOCKED`       |                    0 |         4 |

The `SO-2002-L1` explanation must identify both insufficient projected supply
and `IN-901` as inbound supply available too late. The shipment delay is the
triggering change.

It should not claim that higher-priority demand caused the shortfall in this
specific before/after case: even before the delay, `SO-2002` depended on its
own timely inbound supply. A separate focused test should establish the
`SUPPLY_CONSUMED_BY_HIGHER_PRIORITY_DEMAND` condition using scarce supply that
is eligible for both orders.
