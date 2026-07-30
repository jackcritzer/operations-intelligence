
# Fulfillment Rules

## Purpose

This document defines the business rules used by the Operations Intelligence Engine to determine whether a customer order is projected to be fulfillable.

Each rule is intended to become an automated acceptance test.

---

# Common scenario

Unless otherwise noted, all examples assume the following:

**Order**

| Field                          | Value      |
| ------------------------------ | ---------- |
| Order                          | SO-1001    |
| SKU                            | BRG-440    |
| Quantity required              | 4          |
| Assigned fulfillment warehouse | Chicago    |
| Required ship date             | 2026-08-08 |

---

# Rule 1: Usable on-hand inventory counts immediately

## Scenario

**Chicago inventory**

| Type                  | Quantity |
| --------------------- | -------: |
| Usable and unreserved |        4 |

## Expected result

| Result                          | Value                 |
| ------------------------------- | --------------------- |
| Status                          | **Fulfillable** |
| Available by required ship date | 4                     |
| Shortfall                       | 0                     |

Supply used:

* 4 usable on-hand units

---

# Rule 2: Reserved inventory does not count

## Scenario

**Chicago inventory**

| Type                      | Quantity |
| ------------------------- | -------: |
| Physical quantity         |        6 |
| Reserved for other orders |        3 |
| Usable and unreserved     |        3 |

## Expected result

| Result                          | Value             |
| ------------------------------- | ----------------- |
| Status                          | **Blocked** |
| Available by required ship date | 3                 |
| Shortfall                       | 1                 |

Cause:

> Insufficient usable, unreserved inventory.

---

# Rule 3: Unusable inventory does not count

## Scenario

**Chicago inventory**

| Type                   | Quantity |
| ---------------------- | -------: |
| Usable and unreserved  |        2 |
| Damaged or quarantined |        5 |

## Expected result

| Result                          | Value             |
| ------------------------------- | ----------------- |
| Status                          | **Blocked** |
| Available by required ship date | 2                 |
| Shortfall                       | 2                 |

Contributing condition:

> Five units exist physically but are unavailable for fulfillment.

---

# Rule 4: Confirmed inbound inventory contributes to projected supply

## Scenario

**Chicago inventory**

| Type                  | Quantity |
| --------------------- | -------: |
| Usable and unreserved |        2 |

**Inbound shipment**

| Field                 | Value            |
| --------------------- | ---------------- |
| Shipment              | IN-900           |
| Quantity              | 10               |
| Destination           | Chicago          |
| Status                | Confirmed        |
| Expected available at | 2026-08-06 14:00 |

## Expected result

| Result                          | Value                 |
| ------------------------------- | --------------------- |
| Status                          | **Fulfillable** |
| Available by required ship date | 12                    |
| Shortfall                       | 0                     |

Projected supply consists of:

* 2 usable on-hand units
* 10 confirmed inbound units

Only two inbound units are required to satisfy this order. The remaining projected supply may satisfy other customer demand.

---

# Rule 5: Delayed inbound inventory no longer contributes

## Scenario

The shipment from Rule 4 changes:

| Field                 | Previous         | New              |
| --------------------- | ---------------- | ---------------- |
| Expected available at | 2026-08-06 14:00 | 2026-08-11 14:00 |

## Expected result

| Result                          | Value             |
| ------------------------------- | ----------------- |
| Status                          | **Blocked** |
| Available by required ship date | 2                 |
| Shortfall                       | 2                 |

Triggering change:

> Shipment IN-900 is no longer expected to become available before the required ship date.

Contributing condition:

> Current usable inventory alone is insufficient.

---

# Rule 6: Planned inbound inventory does not contribute

## Scenario

The shipment from Rule 4 changes:

| Field  | Value   |
| ------ | ------- |
| Status | Planned |

## Expected result

| Result                          | Value             |
| ------------------------------- | ----------------- |
| Status                          | **Blocked** |
| Available by required ship date | 2                 |
| Shortfall                       | 2                 |

Cause:

> Planned inbound supply is not considered available for projected fulfillment.

For the first vertical slice, only **confirmed** inbound supply contributes to projected availability.

---

# Rule 7: Earlier demand consumes projected supply first

## Scenario

**Chicago inventory**

| Type                  | Quantity |
| --------------------- | -------: |
| Usable and unreserved |        4 |

**SO-1001**

| Field              | Value            |
| ------------------ | ---------------- |
| Quantity           | 3                |
| Required ship date | 2026-08-08       |
| Placed at          | 2026-08-01 09:00 |

**SO-1002**

| Field              | Value            |
| ------------------ | ---------------- |
| Quantity           | 3                |
| Required ship date | 2026-08-09       |
| Placed at          | 2026-08-01 08:00 |

## Expected result

### SO-1001

| Result               | Value                 |
| -------------------- | --------------------- |
| Status               | **Fulfillable** |
| Projected allocation | 3                     |

### SO-1002

| Result               | Value             |
| -------------------- | ----------------- |
| Status               | **Blocked** |
| Projected allocation | 1                 |
| Shortfall            | 2                 |

Cause:

> Earlier customer demand consumed the remaining projected supply.

Although SO-1002 was placed first, SO-1001 has the earlier required ship date and therefore receives priority.

---

# Rule 8: Order placement time breaks ties

## Scenario

Inventory remains:

| Type                  | Quantity |
| --------------------- | -------: |
| Usable and unreserved |        4 |

Both orders now have the same required ship date.

**SO-1001**

* Quantity: 3
* Required ship date: 2026-08-08
* Placed: 09:00

**SO-1002**

* Quantity: 3
* Required ship date: 2026-08-08
* Placed: 08:00

## Expected result

SO-1002 receives projected supply first because it was placed earlier.

SO-1001 becomes partially or fully blocked depending on the remaining projected supply.

---

# Summary of business rules

The first vertical slice assumes the following:

1. Only usable, unreserved inventory is immediately available.
2. Reserved inventory cannot satisfy additional customer demand.
3. Unusable inventory does not contribute to fulfillment.
4. Confirmed inbound supply contributes to projected availability.
5. Planned inbound supply does not contribute.
6. Orders compete for limited projected supply.
7. Earlier required ship dates receive fulfillment priority.
8. Order placement time breaks ties between otherwise equal orders.
9. The engine reports both the current blocking condition and the operational change that produced it whenever possible.
