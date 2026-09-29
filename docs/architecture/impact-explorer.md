# Impact Explorer

## Purpose

The Impact Explorer is a read-only demonstration surface for the Operations
Intelligence Engine.

Its purpose is to help hiring managers and engineers understand the system's
business value without installing dependencies, starting PostgreSQL, or
interpreting raw API responses.

The explorer does not implement fulfillment logic. It presents results produced
by the existing scenario runner and operational engine.

## Audience

The primary audience is:

- hiring managers evaluating the project;
- engineers reviewing its design;
- people receiving a direct project link during job outreach.

## First scenario

The first vertical slice visualizes the existing
`shipment-delay-blocks-order` scenario.

The primary moment is the shipment delay that changes order SO-1001 from
`FULFILLABLE` to `BLOCKED`.

The explorer should show:

- operational events in replay order;
- the selected event and its triggering change;
- order status before and after the event;
- projected allocation before and after;
- projected shortfall before and after;
- supply contributions;
- blocking conditions;
- optional raw event data.

## Data flow

The explorer consumes generated demonstration data:

1. The existing scenario definition supplies operational events.
2. The existing scenario runner executes the events through the real engine.
3. A small adapter converts the results into an explorer-specific read model.
4. A build-time script writes the read model as static JSON.
5. The frontend renders that JSON without reproducing domain logic.

## Architecture constraints

- The backend engine remains the source of business decisions.
- The frontend must not calculate fulfillment status or allocation.
- Scenario definitions must not be duplicated in the frontend.
- The first slice should not require a running API or PostgreSQL database.
- Generated data must be reproducible from repository code.
- The result must be deployable as a public static site.

## First vertical slice acceptance criteria

A visitor can:

- open the explorer without setup or authentication;
- see the four events in the shipment-delay scenario;
- select an event from the timeline;
- see SO-1001 change from `FULFILLABLE` to `BLOCKED` after the delay;
- see projected allocation change from 100 to 70;
- see projected shortfall change from 0 to 30;
- understand that 30 inbound units arrive after the August 8 ship deadline;
- inspect the selected event's raw data;
- follow links to the repository and architecture documentation.

The explorer must obtain these values from generated engine output rather than
hard-coded frontend calculations.

## Non-goals

This milestone does not include:

- authentication or user accounts;
- order, inventory, or shipment CRUD;
- arbitrary scenario editing;
- customer or tenant management;
- production administration screens;
- new fulfillment business rules;
- live event ingestion;
- database access from the browser;
- multi-instance concurrency work;
- a general-purpose dashboard.

## Backend architecture presentation

The main interface explains the operational result rather than the internal
implementation.

A secondary section may briefly describe:

- durable accepted-event persistence;
- deterministic startup replay;
- duplicate and conflict handling;
- serialized processing within one service instance.

Detailed implementation material remains in the repository documentation.
