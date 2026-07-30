# Scenario: Shipment Delay Blocks an Order

## Purpose

Demonstrate that a change to expected inbound supply can make a previously
fulfillable customer order unfulfillable.

## Order

- Order: SO-1001
- Customer: Midwest Pump & Valve
- Required ship date: August 8
- Partial shipments: not yet decided

OrderPlaced
Source: ERP / Order Management

### Lines

| SKU         | Quantity |
| ----------- | -------: |
| BEARING-440 |      100 |
| SEAL-KIT-12 |       20 |

## Current inventory

### Chicago

| SKU         | On hand | Reserved | Available |
| ----------- | ------: | -------: | --------: |
| BEARING-440 |      80 |       30 |        50 |
| SEAL-KIT-12 |      20 |        0 |        20 |

### Dallas

| SKU         | On hand | Reserved | Available |
| ----------- | ------: | -------: | --------: |
| BEARING-440 |      40 |        0 |        40 |

InventoryBalanceReported
Source: WMS

## Inbound supply

- Shipment: IN-900
- Destination: Chicago
- SKU: BEARING-440
- Quantity: 30
- Initial expected receipt date: August 6

InboundShipmentScheduled
Source: Supplier or Transportation System

## Initial assessment

Assuming inventory may be combined across warehouses:

- 90 BEARING-440 units are currently available.
- 30 additional units are expected before August 8.
- 120 units are projected to be available.
- The order is expected to be fulfillable.

## Event

IN-900 is delayed from August 6 to August 11.

InboundShipmentDelayed
Source: Supplier or Transportation System

## Revised assessment

- 90 BEARING-440 units are available by August 8.
- The line requires 100 units.
- The projected shortfall is 10 units.
- SO-1001 is blocked.

## Explanation

SO-1001 cannot currently be fulfilled by August 8 because BEARING-440 is
short by 10 units. Thirty inbound units were previously expected before the
required ship date, but shipment IN-900 is now expected on August 11.

## Unresolved assumptions

- Whether Chicago and Dallas inventory may be combined
- Whether doing so implies multiple outbound shipments
- Whether split fulfillment is allowed for this order
- Whether inbound supply is reserved for specific orders
