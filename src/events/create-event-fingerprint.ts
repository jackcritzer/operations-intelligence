import { createHash } from "node:crypto";

import type { OperationalEventRequest } from "../http/schemas/operational-event.schema.js";

export function createEventFingerprint(event: OperationalEventRequest): string {
  const fingerprintContent = {
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    source: event.source,
    payload: event.payload,
  };

  const canonicalContent = canonicalize(fingerprintContent);
  const serializedContent = JSON.stringify(canonicalContent);

  return createHash("sha256").update(serializedContent).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;

    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, canonicalize(object[key])]),
    );
  }

  return value;
}
