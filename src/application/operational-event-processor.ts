import type { OperationalEvent } from "../events/operational-event.js";
import { AsyncSerialQueue } from "./async-serial-queue.js";
import {
  processOperationalEvent,
  type AcceptedEventStore,
  type ProcessOperationalEventResult,
} from "./process-operational-event.js";
import type { OperationalState } from "../state/operational-state.js";

export interface OperationalEventProcessor {
  process(
    event: OperationalEvent,
    fingerprint: string,
  ): Promise<ProcessOperationalEventResult>;
}

export function createOperationalEventProcessor(
  state: OperationalState,
  eventStore: AcceptedEventStore,
): OperationalEventProcessor {
  const queue = new AsyncSerialQueue();

  return {
    process: (event, fingerprint) =>
      queue.run(() =>
        processOperationalEvent(state, event, fingerprint, eventStore),
      ),
  };
}
