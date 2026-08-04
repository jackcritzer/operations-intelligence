# Event Model

## Purpose

This document defines the minimum business events required for the first vertical slice of the Operations Intelligence Engine.

The engine consumes these events to maintain current operational facts and derive customer-order fulfillment status.

The event model is intentionally limited to the shipment-delay scenario. Additional events should be introduced only when a concrete scenario requires them.

---

# Event envelope

Every event includes common metadata.

| Field             | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| `eventId`         | Globally unique identifier for the event                      |
| `eventType`       | Name of the business event                                    |
| `occurredAt`      | Time the business fact became true                            |
| `receivedAt`      | Time the engine received the event                            |
| `source`          | Upstream system that reported the fact                        |
| `sourceReference` | Identifier that supports tracing the event back to its source |

Example:

```json
{
  "eventId": "evt-1001",
  "eventType": "OrderPlaced",
  "occurredAt": "2026-08-01T09:00:00-05:00",
  "receivedAt": "2026-08-01T09:00:02-05:00",
  "source": "ERP",
  "sourceReference": "SO-1001"
}
```

`occurredAt` and `receivedAt` are separate because events may arrive late or out of order.

The first implementation does not need to solve out-of-order processing completely, but the distinction should exist in the event contract.

---

# OrderPlaced

## Meaning

The order-management system has accepted customer demand that operations is responsible for fulfilling.

This event does not represent a quote, shopping cart, or rejected order.

## Source

ERP or order-management system.

## Required payload

| Field            | Meaning                               |
| ---------------- | ------------------------------------- |
| `orderId`        | Stable customer-order identifier      |
| `placedAt`       | Time the order became accepted demand |
| `requiredShipAt` | Current committed ship deadline       |
| `lines`          | Active customer-order lines           |

Each order line contains:

| Field                    | Meaning                                |
| ------------------------ | -------------------------------------- |
| `orderLineId`            | Stable line identifier                 |
| `sku`                    | Product requested                      |
| `quantity`               | Required quantity                      |
| `fulfillmentWarehouseId` | Warehouse assigned to fulfill the line |

## Example

```json
{
  "eventId": "evt-1001",
  "eventType": "OrderPlaced",
  "occurredAt": "2026-08-01T09:00:00-05:00",
  "receivedAt": "2026-08-01T09:00:02-05:00",
  "source": "ERP",
  "sourceReference": "SO-1001",
  "payload": {
    "orderId": "SO-1001",
    "placedAt": "2026-08-01T09:00:00-05:00",
    "requiredShipAt": "2026-08-08T17:00:00-05:00",
    "lines": [
      {
        "orderLineId": "SO-1001-1",
        "sku": "BRG-440",
        "quantity": 4,
        "fulfillmentWarehouseId": "CHI"
      }
    ]
  }
}
```

## Facts changed

- creates an open customer order;
- creates its active order lines;
- adds demand to the projected allocation calculation.

---

# InventoryPositionReported

## Meaning

The warehouse system reports the current inventory position for one SKU at one warehouse.

This is a snapshot of the current position, not a quantity adjustment.

Using a position report avoids requiring the first slice to reconstruct inventory from every receipt, pick, damage, and reservation event.

## Source

Warehouse management system.

## Required payload

| Field              | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| `warehouseId`      | Warehouse where the inventory exists                 |
| `sku`              | Product being counted                                |
| `usableQuantity`   | Physical quantity currently suitable for fulfillment |
| `reservedQuantity` | Usable quantity already committed upstream           |
| `unusableQuantity` | Physical quantity that cannot currently be used      |

## Example

```json
{
  "eventId": "evt-1002",
  "eventType": "InventoryPositionReported",
  "occurredAt": "2026-08-01T09:05:00-05:00",
  "receivedAt": "2026-08-01T09:05:03-05:00",
  "source": "WMS",
  "sourceReference": "CHI:BRG-440",
  "payload": {
    "warehouseId": "CHI",
    "sku": "BRG-440",
    "usableQuantity": 2,
    "reservedQuantity": 0,
    "unusableQuantity": 0
  }
}
```

## Facts changed

- replaces the current inventory position for the warehouse and SKU;
- changes available on-hand supply;
- may change projected allocation and fulfillment status.

Available on-hand quantity is derived as:

```text
usableQuantity - reservedQuantity
```

---

# InboundShipmentConfirmed

## Meaning

An inbound shipment has reached the level of confidence required to contribute to projected fulfillment.

The expected availability time represents when the inventory is expected to be usable for fulfillment, not merely when transportation arrives at the warehouse.

## Source

Supplier, purchasing, transportation, or integration system.

For the first slice, the simulated integration presents one normalized event regardless of the original upstream source.

## Required payload

| Field                    | Meaning                                          |
| ------------------------ | ------------------------------------------------ |
| `shipmentId`             | Stable inbound-shipment identifier               |
| `destinationWarehouseId` | Warehouse receiving the supply                   |
| `expectedAvailableAt`    | Time the inventory is expected to become usable  |
| `lines`                  | Products and quantities expected on the shipment |

Each shipment line contains:

| Field            | Meaning                |
| ---------------- | ---------------------- |
| `shipmentLineId` | Stable line identifier |
| `sku`            | Product expected       |
| `quantity`       | Expected quantity      |

## Example

```json
{
  "eventId": "evt-1003",
  "eventType": "InboundShipmentConfirmed",
  "occurredAt": "2026-08-01T10:00:00-05:00",
  "receivedAt": "2026-08-01T10:00:04-05:00",
  "source": "SUPPLIER_INTEGRATION",
  "sourceReference": "IN-900",
  "payload": {
    "shipmentId": "IN-900",
    "destinationWarehouseId": "CHI",
    "expectedAvailableAt": "2026-08-06T14:00:00-05:00",
    "lines": [
      {
        "shipmentLineId": "IN-900-1",
        "sku": "BRG-440",
        "quantity": 10
      }
    ]
  }
}
```

## Facts changed

- creates or replaces a confirmed inbound shipment;
- adds qualifying projected supply for its warehouse and SKUs;
- may make previously blocked demand fulfillable.

---

# InboundShipmentDelayed

## Meaning

The expected availability time of a previously known inbound shipment has moved later.

This event records the operational change that drives the first vertical slice.

## Source

Supplier, transportation, or normalized integration system.

## Required payload

| Field                         | Meaning                               |
| ----------------------------- | ------------------------------------- |
| `shipmentId`                  | Shipment whose availability changed   |
| `previousExpectedAvailableAt` | Previously reported availability time |
| `newExpectedAvailableAt`      | Newly reported availability time      |
| `reason`                      | Optional human-readable delay reason  |

## Example

```json
{
  "eventId": "evt-1004",
  "eventType": "InboundShipmentDelayed",
  "occurredAt": "2026-08-05T11:30:00-05:00",
  "receivedAt": "2026-08-05T11:30:02-05:00",
  "source": "TRANSPORTATION_INTEGRATION",
  "sourceReference": "IN-900",
  "payload": {
    "shipmentId": "IN-900",
    "previousExpectedAvailableAt": "2026-08-06T14:00:00-05:00",
    "newExpectedAvailableAt": "2026-08-11T14:00:00-05:00",
    "reason": "Carrier delay"
  }
}
```

## Facts changed

- updates the shipment's expected availability time;
- may remove its supply from an order's qualifying supply window;
- may change an order from fulfillable to blocked;
- provides the triggering change used in the explanation.

The engine should validate that the shipment already exists.

It should also preserve enough information to explain that the expected availability changed from the previous value to the new value.

---

# Event-to-state summary

| Event                       | Source                               | State affected                            |
| --------------------------- | ------------------------------------ | ----------------------------------------- |
| `OrderPlaced`               | ERP                                  | Customer orders and demand                |
| `InventoryPositionReported` | WMS                                  | Current warehouse inventory               |
| `InboundShipmentConfirmed`  | Supplier or integration system       | Confirmed projected supply                |
| `InboundShipmentDelayed`    | Transportation or integration system | Expected availability of projected supply |

---

# Derived results

None of the events directly state that an order is fulfillable or blocked.

After relevant events are applied, the engine derives:

- available on-hand quantity;
- qualifying inbound supply;
- projected supply pool;
- projected allocation;
- projected shortfall;
- order-line fulfillment status;
- order fulfillment status;
- blocking conditions;
- triggering changes;
- explanations.

For example, `InboundShipmentDelayed` does not contain:

```text
SO-1001 is blocked
```

The engine reaches that conclusion by combining the delay with the current order, inventory, and inbound-supply facts.

---

# First-slice boundaries

The first event model does not include:

- order updates or cancellations;
- order shipment or completion;
- individual warehouse inventory adjustments;
- reservation-created or reservation-released events;
- inbound shipment cancellation;
- partial receipts;
- damaged inbound quantities;
- warehouse transfers;
- outbound shipment events;
- product substitutions.

`InventoryPositionReported` includes reserved and unusable quantities, so separate reservation and damage events are not required for the first implementation.

These events should be introduced only when a scenario requires their behavior.
