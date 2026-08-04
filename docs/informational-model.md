# Information Model

## Purpose

This document defines the minimum business information the Operations Intelligence Engine needs to answer the first operational question:

> Which open customer orders cannot currently be fulfilled by their required ship date, and what operational conditions are preventing fulfillment?

This is a conceptual information model, not a database schema or TypeScript class design.

It distinguishes:

- facts received from upstream operational systems;
- relationships between those facts;
- conclusions derived by the Operations Intelligence Engine.

Only information required by the first vertical slice is included.

---

# Modeling decisions

## Customer demand and inbound supply are separate concepts

An **order line** represents customer demand.

Example:

> Customer order SO-1001 requires 4 units of BRG-440.

A **shipment line** represents inbound supply.

Example:

> Inbound shipment IN-900 is expected to deliver 10 units of BRG-440.

Both may reference the same SKU, but they have different meanings and lifecycles.

| Concept       | Represents                                 | Example                         |
| ------------- | ------------------------------------------ | ------------------------------- |
| Order line    | Demand the distributor must satisfy        | Customer requires 4 bearings    |
| Shipment line | Supply expected from outside the warehouse | Supplier is sending 10 bearings |

An order line contributes to required quantity.

A shipment line contributes to projected available quantity when the shipment is eligible to count.

---

## Fulfillment warehouse is assigned to the order line

Each order line has one assigned fulfillment warehouse.

This allows different lines on the same order to be fulfilled from different warehouses.

Example:

| Order   | Line | SKU      | Assigned warehouse |
| ------- | ---- | -------- | ------------------ |
| SO-1001 | 1    | BRG-440  | Chicago            |
| SO-1001 | 2    | BELT-220 | Dallas             |

For the first vertical slice:

- one order may contain lines assigned to different warehouses;
- one order line cannot be split across warehouses;
- supply from an unassigned warehouse does not count;
- warehouse transfers are not considered;
- the engine does not select or optimize the fulfillment warehouse.

The assigned warehouse is treated as an upstream operational fact.

---

# Source facts

Source facts originate in upstream systems such as the ERP, warehouse management system, supplier system, or transportation system.

The Operations Intelligence Engine consumes these facts but is not their system of record.

---

# Customer Order

A customer order represents accepted customer demand that operations is responsible for fulfilling.

## Required information

| Field              | Meaning                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| Order identifier   | Stable identifier from the order system                                         |
| Placed at          | Time the order became accepted demand                                           |
| Required ship time | Latest time the order must leave the distributor to meet its current commitment |
| Status             | Current upstream order status                                                   |
| Order lines        | Products and quantities requested by the customer                               |

## Relevant statuses

The first vertical slice only needs to distinguish whether the order contributes active demand.

Initial conceptual statuses:

- `OPEN`
- `CANCELLED`
- `SHIPPED`

Only open orders participate in projected allocation.

Additional commercial and fulfillment statuses are deferred.

---

# Order Line

An order line represents demand for a specific SKU on a customer order.

## Required information

| Field                          | Meaning                                          |
| ------------------------------ | ------------------------------------------------ |
| Order line identifier          | Stable identifier within the order               |
| SKU                            | Product being requested                          |
| Required quantity              | Quantity the customer requires                   |
| Assigned fulfillment warehouse | Warehouse responsible for fulfilling the line    |
| Status                         | Whether the line still contributes active demand |

## Notes

The required ship time is initially inherited from the customer order.

A future version may allow individual lines to have different commitments, but that is outside the first slice.

An order line is evaluated independently for supply, but its result contributes to the status of the complete order.

---

# Product

A product identifies the item being demanded, stored, or received.

## Required information

| Field       | Meaning                     |
| ----------- | --------------------------- |
| SKU         | Stable product identifier   |
| Description | Human-readable product name |

Example:

| Field       | Value            |
| ----------- | ---------------- |
| SKU         | BRG-440          |
| Description | Conveyor bearing |

The first vertical slice does not model:

- product substitutions;
- units-of-measure conversion;
- lot tracking;
- serial numbers;
- shelf life;
- product compatibility.

---

# Warehouse

A warehouse is a physical facility where inventory may be stored and inbound shipments may become available.

## Required information

| Field                | Meaning                       |
| -------------------- | ----------------------------- |
| Warehouse identifier | Stable facility identifier    |
| Name                 | Human-readable warehouse name |

The first vertical slice does not model:

- warehouse zones;
- bins;
- receiving docks;
- operating calendars;
- picking capacity;
- warehouse closures.

---

# Inventory Position

An inventory position describes the known inventory state for one SKU at one warehouse.

An inventory position is identified by the combination:

```text
Warehouse + SKU
```

## Required information

| Field             | Meaning                                                    |
| ----------------- | ---------------------------------------------------------- |
| Warehouse         | Facility where the inventory exists                        |
| SKU               | Product being counted                                      |
| Usable quantity   | Physical inventory currently suitable for fulfillment      |
| Reserved quantity | Usable inventory committed through an upstream reservation |
| Unusable quantity | Physical inventory that cannot currently be used           |

## Available on-hand quantity

Available on-hand quantity is derived as:

```text
usable quantity - reserved quantity
```

Reserved inventory remains physically usable, but it is not available to satisfy additional demand.

Unusable inventory does not contribute to available supply.

## Example

| Inventory category | Quantity |
| ------------------ | -------: |
| Usable quantity    |        6 |
| Reserved quantity  |        3 |
| Unusable quantity  |        5 |
| Available on hand  |        3 |

The engine may expose unusable or reserved quantities as contributing context even though they do not count toward projected fulfillment.

---

# Inbound Shipment

An inbound shipment represents supply expected to become available at a warehouse.

## Required information

| Field                   | Meaning                                                      |
| ----------------------- | ------------------------------------------------------------ |
| Shipment identifier     | Stable identifier from the supplier or transportation system |
| Destination warehouse   | Warehouse where the supply will become available             |
| Status                  | Confidence or operational state of the shipment              |
| Expected available time | Time the inventory is expected to be usable for fulfillment  |
| Shipment lines          | SKUs and quantities expected on the shipment                 |

## Relevant statuses

The first vertical slice requires only:

- `PLANNED`
- `CONFIRMED`

Only confirmed shipments contribute to projected available supply.

The model may later include statuses such as:

- in transit;
- partially received;
- received;
- cancelled;
- held;
- lost.

Those states are deferred until a scenario requires them.

---

# Shipment Line

A shipment line represents a quantity of one SKU expected on an inbound shipment.

## Required information

| Field                    | Meaning                               |
| ------------------------ | ------------------------------------- |
| Shipment line identifier | Stable identifier within the shipment |
| SKU                      | Product expected on the shipment      |
| Expected quantity        | Quantity expected to become available |

The destination warehouse and expected available time are initially inherited from the inbound shipment.

A future model may support line-specific availability or partial receipts, but the first slice does not require them.

---

# Relationships

## Customer order and order lines

```text
Customer Order
    has one or more
        Order Lines
```

An order line cannot exist without a customer order.

One order may contain several SKUs.

---

## Order line and product

```text
Order Line
    references one
        Product
```

Several order lines may reference the same product.

---

## Order line and warehouse

```text
Order Line
    is assigned to one
        Warehouse
```

Several lines on the same order may be assigned to different warehouses.

A single line cannot be split across warehouses in the first vertical slice.

---

## Warehouse inventory

```text
Warehouse
    has many
        Inventory Positions

Product
    appears in many
        Inventory Positions
```

There is at most one current inventory position for a given warehouse and SKU combination.

---

## Inbound shipment and warehouse

```text
Inbound Shipment
    is destined for one
        Warehouse
```

All shipment lines initially share the shipment's destination warehouse.

---

## Inbound shipment and shipment lines

```text
Inbound Shipment
    has one or more
        Shipment Lines
```

A shipment line cannot exist without an inbound shipment.

---

## Shipment line and product

```text
Shipment Line
    references one
        Product
```

Several shipment lines across different shipments may reference the same SKU.

---

## Demand and supply matching

An order line may be satisfied by qualifying supply that shares:

- the same SKU;
- the assigned fulfillment warehouse;
- availability no later than the required ship time.

Qualifying supply may include:

- usable, unreserved on-hand inventory;
- confirmed inbound inventory expected to be available in time.

There is no permanent source relationship between an order line and a shipment line in the source facts.

The engine derives which supply is projected to cover which demand.

---

# Derived information

Derived information is computed by the Operations Intelligence Engine. It is not directly reported as authoritative fact by an upstream system.

---

# Available On-Hand Quantity

The amount of current inventory that may satisfy new demand.

```text
available on hand =
    usable quantity
    - reserved quantity
```

Unusable quantity does not contribute.

---

# Qualifying Inbound Supply

Inbound quantity that may contribute to projected fulfillment.

An inbound shipment line qualifies when:

1. its shipment is confirmed;
2. its SKU matches the order line;
3. its destination matches the order line's assigned warehouse;
4. its expected available time is on or before the required ship time.

Planned or late inbound supply does not qualify.

---

# Projected Supply Pool

The supply available to satisfy active demand for one warehouse and SKU.

```text
projected supply pool =
    available on-hand quantity
    + qualifying inbound quantity
```

The projected supply pool is calculated separately for each:

```text
Warehouse + SKU
```

Supply in another warehouse does not contribute.

---

# Demand Priority

Open order lines competing for the same projected supply pool are processed in this order:

1. earliest required ship time;
2. earliest order placement time;
3. stable order identifier;
4. stable order line identifier.

The final two rules provide deterministic behavior when business priority fields are equal.

They are technical tie-breakers, not business claims about customer importance.

---

# Projected Allocation

Projected allocation is the portion of the supply pool assigned analytically to an order line.

The engine consumes projected supply in demand-priority order.

Example:

```text
Projected supply: 4

SO-1001 requires 3
SO-1002 requires 3
```

Result:

```text
SO-1001 projected allocation: 3
SO-1002 projected allocation: 1
```

Projected allocation:

- prevents the same supply from being counted for several orders;
- supports fulfillment analysis;
- does not create an upstream inventory reservation;
- does not instruct the warehouse to pick or ship inventory.

---

# Projected Shortfall

The quantity of demand that projected allocation cannot cover.

```text
projected shortfall =
    required quantity
    - projected allocation
```

The shortfall cannot be less than zero.

Example:

```text
Required quantity: 4
Projected allocation: 2
Projected shortfall: 2
```

---

# Order-Line Fulfillment Status

An order line is:

```text
FULFILLABLE
```

when:

```text
projected shortfall = 0
```

An order line is:

```text
BLOCKED
```

when:

```text
projected shortfall > 0
```

---

# Order Fulfillment Status

A customer order is:

```text
FULFILLABLE
```

when every active order line is fulfillable.

A customer order is:

```text
BLOCKED
```

when one or more active order lines are blocked.

A multi-line order may therefore contain both fulfillable and blocked lines.

---

# Blocking Condition

A blocking condition describes the current operational state preventing fulfillment.

Examples include:

- insufficient usable on-hand inventory;
- inventory reserved for other demand;
- physical inventory is unusable;
- inbound supply is unconfirmed;
- inbound supply is expected after the required ship time;
- higher-priority demand consumed the available projected supply.

A blocked line may have more than one contributing condition.

---

# Triggering Change

A triggering change is the event or fact change that materially caused an order to enter its current blocked state.

Example:

```text
Previous expected availability:
2026-08-06 14:00

New expected availability:
2026-08-11 14:00
```

The current blocking condition is insufficient supply by the required ship time.

The triggering change is the delay to the inbound shipment.

These concepts should remain distinct:

| Concept            | Question answered                 |
| ------------------ | --------------------------------- |
| Blocking condition | Why is the order blocked now?     |
| Triggering change  | What changed to cause this state? |

Not every blocked order will have a single identifiable triggering change. Some may already be blocked when first observed.

---

# Explanation

An explanation combines the derived result with the source facts that support it.

For a blocked line, the explanation should include:

- order identifier;
- order line identifier;
- SKU;
- assigned warehouse;
- required ship time;
- required quantity;
- projected allocation;
- projected shortfall;
- current supply contributions;
- excluded supply and why it was excluded;
- contributing blocking conditions;
- triggering change when known.

Example:

```text
Order SO-1001 is blocked.

Line:
BRG-440 from Chicago

Required:
4 units by 2026-08-08

Projected allocation:
2 units

Shortfall:
2 units

Current condition:
Chicago has only 2 usable, unreserved units available by the required ship time.

Triggering change:
Inbound shipment IN-900 was delayed from 2026-08-06 to 2026-08-11.

Excluded supply:
The 10 units on IN-900 are expected after the required ship time.
```

---

# Information intentionally excluded

The first vertical slice does not require the engine to know:

- customer billing information;
- payment status;
- pricing;
- taxes;
- carrier selection;
- delivery routes;
- transit-time calculation;
- warehouse bins;
- pick-pack capacity;
- product substitutions;
- warehouse transfers;
- split fulfillment of one order line;
- supplier purchase-order details beyond relevant inbound supply;
- actual reservation commands;
- actual shipment execution.

These concepts should be introduced only when a scenario requires them.
