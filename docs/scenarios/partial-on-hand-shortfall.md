# Partial on-hand fulfillment with unidentified shortfall

## Business question

When a warehouse has some, but not enough, usable inventory for an
order, how much can be fulfilled and how much has no identified supply?

## Initial facts

- Warehouse CHI reports 7 usable units of BRG-440.
- Order SO-4001 requires 10 units of BRG-440 from CHI.
- No matching inbound supply has been reported.

## Expected result

- 7 units are allocated from on-hand inventory.
- The order has a projected shortfall of 3 units.
- The order and line are BLOCKED.
- The remaining 3 units have no identified supply source.

## Explanation boundary

The engine does not know why additional supply is unavailable. It must
not infer an unplaced purchase order, canceled shipment, inventory
discrepancy, or other operational cause without supporting events.
