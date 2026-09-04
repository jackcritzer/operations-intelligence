import type { FastifyInstance } from "fastify";

import type { AcceptedEventStore } from "../application/process-operational-event.js";
import {
  rebuildOperationalState,
  type ReplayEventSource,
} from "../application/rebuild-operational-state.js";
import { buildApp } from "../http/build-app.js";
import type { OperationalState } from "../state/operational-state.js";

export interface OperationalEventRepository
  extends AcceptedEventStore, ReplayEventSource {}

export interface Runtime {
  app: FastifyInstance;
  state: OperationalState;
}

export async function createRuntime(
  repository: OperationalEventRepository,
): Promise<Runtime> {
  const state = await rebuildOperationalState(repository);

  const app = buildApp({
    state,
    eventStore: repository,
  });

  return {
    app,
    state,
  };
}
