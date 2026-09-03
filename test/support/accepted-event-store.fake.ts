import type { AcceptedEventStore } from "../../src/application/process-operational-event.js";

export function createInMemoryAcceptedEventStore(): AcceptedEventStore {
  const fingerprintsByEventId = new Map<string, string>();

  return {
    insertOrGet: async (event, fingerprint) => {
      const existingFingerprint = fingerprintsByEventId.get(event.eventId);

      if (existingFingerprint !== undefined) {
        return {
          status: "EXISTING",
          event: {
            eventFingerprint: existingFingerprint,
          },
        };
      }

      fingerprintsByEventId.set(event.eventId, fingerprint);

      return {
        status: "INSERTED",
        event: {
          eventFingerprint: fingerprint,
        },
      };
    },
  };
}
