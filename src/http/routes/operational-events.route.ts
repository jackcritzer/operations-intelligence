import type { FastifyInstance } from "fastify";

import { applyEvent } from "../../state/apply-event.js";
import type { OperationalState } from "../../state/operational-state.js";
import {
  mapOperationalEventRequest,
  type Clock,
} from "../mappers/operational-event.mapper.js";
import {
  OperationalEventRequestSchema,
  type OperationalEventRequest,
} from "../schemas/operational-event.schema.js";

export interface OperationalEventRouteDependencies {
  state: OperationalState;
  clock: Clock;
}

export function registerOperationalEventRoutes(
  app: FastifyInstance,
  dependencies: OperationalEventRouteDependencies,
): void {
  app.post<{
    Body: OperationalEventRequest;
  }>(
    "/v1/operational-events",
    {
      schema: {
        body: OperationalEventRequestSchema,
      },
    },
    async (request, reply) => {
      const event = mapOperationalEventRequest(
        request.body,
        dependencies.clock,
      );

      const result = applyEvent(dependencies.state, event);

      return reply.code(200).send({
        eventId: event.eventId,
        status: result.status,
      });
    },
  );
}
