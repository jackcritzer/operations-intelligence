import { Ajv } from "ajv";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";

import { InboundShipmentDelayedRequestSchema } from "../../src/http/schemas/operational-event.schema.js";
import type { InboundShipmentDelayedRequest } from "../../src/http/schemas/operational-event.schema.js";

const addFormats = addFormatsModule.default;

const ajv = new Ajv({
  allErrors: true,
  strict: true,
});

addFormats(ajv);

const validateInboundShipmentDelayedRequest = ajv.compile(
  InboundShipmentDelayedRequestSchema,
);

function createValidRequest(): InboundShipmentDelayedRequest {
  return {
    eventId: "delay-1",
    eventType: "InboundShipmentDelayed",
    occurredAt: "2026-08-03T12:00:00-05:00",
    source: "TRANSPORTATION_INTEGRATION",
    payload: {
      shipmentId: "IN-900",
      previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
      newExpectedAvailableAt: "2026-08-11T09:00:00-05:00",
      reason: "Carrier delay",
    },
  };
}

describe("InboundShipmentDelayedRequestSchema", () => {
  it("accepts a structurally valid request", () => {
    const request = createValidRequest();

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(true);
    expect(validateInboundShipmentDelayedRequest.errors).toBeNull();
  });

  it("rejects a caller-supplied receivedAt timestamp", () => {
    const request = {
      ...createValidRequest(),
      receivedAt: "2026-08-03T17:00:01.000Z",
    };

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(false);
    expect(validateInboundShipmentDelayedRequest.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: {
            additionalProperty: "receivedAt",
          },
        }),
      ]),
    );
  });

  it("rejects missing required payload properties", () => {
    const request = {
      ...createValidRequest(),
      payload: {
        shipmentId: "IN-900",
      },
    };

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(false);
    expect(validateInboundShipmentDelayedRequest.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "required",
          params: {
            missingProperty: "previousExpectedAvailableAt",
          },
        }),
        expect.objectContaining({
          keyword: "required",
          params: {
            missingProperty: "newExpectedAvailableAt",
          },
        }),
      ]),
    );
  });

  it("rejects an unsupported event source", () => {
    const request = {
      ...createValidRequest(),
      source: "EMAIL",
    };

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(false);
  });

  it("rejects a timestamp without a timezone", () => {
    const request = {
      ...createValidRequest(),
      occurredAt: "2026-08-03T12:00:00",
    };

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(false);
    expect(validateInboundShipmentDelayedRequest.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: "/occurredAt",
          keyword: "format",
          params: {
            format: "date-time",
          },
        }),
      ]),
    );
  });

  it("rejects blank identifiers", () => {
    const request = {
      ...createValidRequest(),
      eventId: "   ",
    };

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(false);
    expect(validateInboundShipmentDelayedRequest.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: "/eventId",
          keyword: "pattern",
        }),
      ]),
    );
  });

  it("does not reject a structurally valid event based on business meaning", () => {
    const request = {
      ...createValidRequest(),
      payload: {
        shipmentId: "IN-900",
        previousExpectedAvailableAt: "2026-08-06T09:00:00-05:00",
        newExpectedAvailableAt: "2026-08-05T09:00:00-05:00",
      },
    };

    const valid = validateInboundShipmentDelayedRequest(request);

    expect(valid).toBe(true);
  });
});