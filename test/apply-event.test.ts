import { describe, expect, it } from "vitest";

import type {
  OrderPlacedEvent,
  InventoryPositionReportedEvent,
  InboundShipmentConfirmedEvent,
  InboundShipmentDelayedEvent,
} from "../src/events/operational-event.js";

import { applyEvent } from "../src/state/apply-event.js";
import {
  createEmptyOperationalState,
  inventoryPositionKey,
} from "../src/state/operational-state.js";
import { EventApplicationError } from "../src/application/errors/event-application-error.js";

type EventOverrides<TEvent extends { payload: object }> = Omit<
  Partial<TEvent>,
  "payload"
> & {
  payload?: Partial<TEvent["payload"]>;
};

type OrderPlacedEventOverrides = EventOverrides<OrderPlacedEvent>;

type InventoryPositionReportedEventOverrides =
  EventOverrides<InventoryPositionReportedEvent>;

type InboundShipmentConfirmedEventOverrides =
  EventOverrides<InboundShipmentConfirmedEvent>;

type InboundShipmentDelayedEventOverrides =
  EventOverrides<InboundShipmentDelayedEvent>;

describe("applyEvent", () => {
  it("creates an open order from OrderPlaced", () => {
    const state = createEmptyOperationalState();
    const event = orderPlacedEvent();

    applyEvent(state, event);

    expect(state.orders.get("SO-1001")).toEqual({
      orderId: "SO-1001",
      placedAt: "2026-08-01T09:00:00-05:00",
      requiredShipAt: "2026-08-08T17:00:00-05:00",
      status: "OPEN",
      lines: [
        {
          orderLineId: "SO-1001-L1",
          sku: "BRG-440",
          quantity: 4,
          fulfillmentWarehouseId: "CHI",
        },
      ],
    });

    expect(state.processedEventIds.has(event.eventId)).toBe(true);
  });

  it("replaces the current inventory position", () => {
    const state = createEmptyOperationalState();

    applyEvent(
      state,
      inventoryPositionReportedEvent({
        eventId: "evt-inventory-1",
        payload: {
          usableQuantity: 2,
        },
      }),
    );

    applyEvent(
      state,
      inventoryPositionReportedEvent({
        eventId: "evt-inventory-2",
        payload: {
          usableQuantity: 5,
        },
      }),
    );

    expect(
      state.inventoryPositions.get(inventoryPositionKey("CHI", "BRG-440")),
    ).toEqual({
      warehouseId: "CHI",
      sku: "BRG-440",
      usableQuantity: 5,
      reservedQuantity: 0,
      unusableQuantity: 0,
      reportedAt: "2026-08-01T10:00:00-05:00",
    });

    expect(state.inventoryPositions.size).toBe(1);
  });

  it("creates a confirmed inbound shipment", () => {
    const state = createEmptyOperationalState();
    const event = inboundShipmentConfirmedEvent();

    applyEvent(state, event);

    expect(state.inboundShipments.get("IN-900")).toEqual({
      shipmentId: "IN-900",
      destinationWarehouseId: "CHI",
      expectedAvailableAt: "2026-08-06T09:00:00-05:00",
      status: "CONFIRMED",
      lines: [
        {
          shipmentLineId: "IN-900-L1",
          sku: "BRG-440",
          quantity: 10,
        },
      ],
    });
  });

  it("updates a shipment and records the change when it is delayed", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, inboundShipmentConfirmedEvent());

    const delayEvent = inboundShipmentDelayedEvent();
    applyEvent(state, delayEvent);

    expect(state.inboundShipments.get("IN-900")?.expectedAvailableAt).toBe(
      "2026-08-11T09:00:00-05:00",
    );

    expect(state.shipmentAvailabilityChanges.get("IN-900")).toEqual({
      shipmentId: "IN-900",
      previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
      newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
      changedAt: "2026-08-04T12:00:00-05:00",
      reason: "Supplier production delay",
    });
  });

  it("ignores an event that has already been processed", () => {
    const state = createEmptyOperationalState();
    const event = orderPlacedEvent();

    applyEvent(state, event);
    applyEvent(state, event);

    expect(state.orders.size).toBe(1);
    expect(state.processedEventIds.size).toBe(1);
  });

  it("rejects a second event that creates the same order", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, orderPlacedEvent());

    expect(() =>
      applyEvent(
        state,
        orderPlacedEvent({
          eventId: "evt-order-2",
        }),
      ),
    ).toThrow(EventApplicationError);

    expect(state.processedEventIds.has("evt-order-2")).toBe(false);
  });

  it("rejects a delay for an unknown shipment", () => {
    const state = createEmptyOperationalState();

    expect(() => applyEvent(state, inboundShipmentDelayedEvent())).toThrow(
      "Inbound shipment IN-900 does not exist",
    );
  });

  it("rejects a delay whose previous date does not match current state", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, inboundShipmentConfirmedEvent());

    expect(() =>
      applyEvent(
        state,
        inboundShipmentDelayedEvent({
          payload: {
            previousExpectedAvailableAt: "2026-08-07T09:00:00-05:00",
          },
        }),
      ),
    ).toThrow(/expected availability does not match/);
  });

  it("rejects a delay that does not move availability later", () => {
    const state = createEmptyOperationalState();

    applyEvent(state, inboundShipmentConfirmedEvent());

    expect(() =>
      applyEvent(
        state,
        inboundShipmentDelayedEvent({
          payload: {
            newExpectedAvailableAt: "2026-08-05T09:00:00-05:00",
          },
        }),
      ),
    ).toThrow(/delay must move availability later/);
  });
});

function orderPlacedEvent(
  overrides: OrderPlacedEventOverrides = {},
): OrderPlacedEvent {
  const defaultEvent: OrderPlacedEvent = {
    eventId: "evt-order-1",
    eventType: "OrderPlaced",
    occurredAt: "2026-08-01T09:00:00-05:00",
    receivedAt: "2026-08-01T09:00:01-05:00",
    source: "ERP",
    payload: {
      orderId: "SO-1001",
      placedAt: "2026-08-01T09:00:00-05:00",
      requiredShipAt: "2026-08-08T17:00:00-05:00",
      lines: [
        {
          orderLineId: "SO-1001-L1",
          sku: "BRG-440",
          quantity: 4,
          fulfillmentWarehouseId: "CHI",
        },
      ],
    },
  };

  return {
    ...defaultEvent,
    ...overrides,
    eventType: "OrderPlaced",
    payload: {
      ...defaultEvent.payload,
      ...overrides.payload,
    },
  };
}

function inventoryPositionReportedEvent(
  overrides: InventoryPositionReportedEventOverrides = {},
): InventoryPositionReportedEvent {
  const defaultEvent: InventoryPositionReportedEvent = {
    eventId: "evt-inventory-1",
    eventType: "InventoryPositionReported",
    occurredAt: "2026-08-01T10:00:00-05:00",
    receivedAt: "2026-08-01T10:00:01-05:00",
    source: "WMS",
    payload: {
      warehouseId: "CHI",
      sku: "BRG-440",
      usableQuantity: 2,
      reservedQuantity: 0,
      unusableQuantity: 0,
    },
  };

  return {
    ...defaultEvent,
    ...overrides,
    payload: {
      ...defaultEvent.payload,
      ...overrides.payload,
    },
  };
}

function inboundShipmentConfirmedEvent(
  overrides: InboundShipmentConfirmedEventOverrides = {},
): InboundShipmentConfirmedEvent {
  const defaultEvent: InboundShipmentConfirmedEvent = {
    eventId: "evt-shipment-confirmed-1",
    eventType: "InboundShipmentConfirmed",
    occurredAt: "2026-08-01T11:00:00-05:00",
    receivedAt: "2026-08-01T11:00:01-05:00",
    source: "SUPPLIER_INTEGRATION",
    payload: {
      shipmentId: "IN-900",
      destinationWarehouseId: "CHI",
      expectedAvailableAt: "2026-08-06T09:00:00-05:00",
      lines: [
        {
          shipmentLineId: "IN-900-L1",
          sku: "BRG-440",
          quantity: 10,
        },
      ],
    },
  };

  return {
    ...defaultEvent,
    ...overrides,
    payload: {
      ...defaultEvent.payload,
      ...overrides.payload,
    },
  };
}

function inboundShipmentDelayedEvent(
  overrides: InboundShipmentDelayedEventOverrides = {},
): InboundShipmentDelayedEvent {
  const defaultEvent: InboundShipmentDelayedEvent = {
    eventId: "evt-shipment-delay-1",
    eventType: "InboundShipmentDelayed",
    occurredAt: "2026-08-04T12:00:00-05:00",
    receivedAt: "2026-08-04T12:00:01-05:00",
    source: "TRANSPORTATION_INTEGRATION",
    payload: {
      shipmentId: "IN-900",
      previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
      newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
      reason: "Supplier production delay",
    },
  };

  return {
    ...defaultEvent,
    ...overrides,
    payload: {
      ...defaultEvent.payload,
      ...overrides.payload,
    },
  };
}
