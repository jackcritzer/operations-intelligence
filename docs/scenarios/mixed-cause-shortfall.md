# Mixed-cause fulfillment shortfall

## Business question

When several known conditions contribute to one order-line shortfall, can the
engine explain each portion without double-counting or overstating what it
knows?

## Initial facts

- Warehouse CHI reports 5 usable units of BRG-440.
- Higher-priority order SO-7001 requires 3 units.
- Lower-priority order SO-7002 requires 10 units.
- Inbound shipment SHIP-7001 contains 2 units but becomes available after
  SO-7002's required ship time.
- No identified supply covers the remaining 3 units.

## Expected result

- SO-7001 receives 3 units.
- SO-7002 receives the remaining 2 on-hand units.
- SO-7002 has a projected shortfall of 8 units.
- The engine explains 3 units as consumed by higher-priority demand.
- The engine explains 2 units as inbound supply available too late.
- The remaining 3 units have no identified supply source.
- The blocking-condition quantities total the projected shortfall exactly.

## Explanation precedence

Shortfall explanations are assigned in this order:

1. Supply consumed by higher-priority demand.
2. Matching inbound supply available after the required ship time.
3. Any remaining quantity is marked as an undetermined shortfall cause.

Higher-priority consumption comes first because it records an allocation
decision the engine actually made. Late inbound is an alternative supply source
that was excluded by timing. The fallback must cover only the remainder.

## Explanation boundary

The engine does not infer why the final 3 units lack an identified supply
source. Procurement, production, transfer, cancellation, or inventory
discrepancy causes require additional operational evidence.
