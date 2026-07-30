# Domain Overview

## Business

The company is a midsize industrial distributor.

It purchases industrial products from suppliers, stores inventory across
multiple warehouses, and fulfills customer orders containing one or more
product lines.

## Operational users

The initial user is an operations or customer-service employee who needs to
identify orders that are at risk and understand what is preventing fulfillment.

## Core operational question

Which open customer orders cannot currently be fulfilled by their required
ship date, and why?

## Important distinctions

### Requested date versus promised date

A requested ship date comes from the customer.

A promised ship date is a commitment made by the distributor after evaluating
available and expected supply.

The first slice may begin with one required ship date, but the distinction
must remain visible because the two concepts may diverge later.

### Inventory versus available inventory

Physical inventory is not automatically available to an order.

Inventory may already be reserved, damaged, unavailable, located at an
ineligible warehouse, or otherwise restricted.

### Current stock versus projected supply

An order may be impossible to fulfill from current stock but still fulfillable
by its required date if confirmed inbound inventory will arrive in time.

## Initial scope

Included:

- customer orders and order lines
- products and SKUs
- warehouses
- usable on-hand inventory
- inventory reservations
- inbound shipments
- expected receipt dates
- shipment delays
- order-level fulfillment assessment
- line-level explanations

Deferred:

- product substitutions
- credit holds
- carrier capacity
- hazardous-material restrictions
- lot and serial tracking
- warehouse transfer optimization
- manufacturing
- probabilistic inbound reliability