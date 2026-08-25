import type { OperationalEvent } from "../events/operational-event.js";
import { applyEvent } from "../state/apply-event.js";
import {
  createEmptyOperationalState,
  type OperationalState,
} from "../state/operational-state.js";

export interface ReplayEventSource {
  listForReplay(): Promise<
    Array<{
      eventData: OperationalEvent;
    }>
  >;
}

export async function rebuildOperationalState(
  eventSource: ReplayEventSource,
): Promise<OperationalState> {
  const acceptedEvents = await eventSource.listForReplay();
  const state = createEmptyOperationalState();

  for (const acceptedEvent of acceptedEvents) {
    applyEvent(state, acceptedEvent.eventData);
  }

  return state;
}
