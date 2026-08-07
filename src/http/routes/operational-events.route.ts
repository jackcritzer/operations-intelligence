import type { FastifyInstance } from "fastify";

import { applyEvent } from "../../state/apply-event.js";
import type { OperationalState } from "../../state/operational-state.js";
import {
  mapInboundShipmentDelayedRequest,
  type Clock,
} from "../mappers/operational-event.mapper.js";
import {
  InboundShipmentDelayedRequestSchema,
  type InboundShipmentDelayedRequest,
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
    Body: InboundShipmentDelayedRequest;
  }>(
    "/v1/operational-events",
    {
      schema: {
        body: InboundShipmentDelayedRequestSchema,
      },
    },
    async (request, reply) => {
      const event = mapInboundShipmentDelayedRequest(
        request.body,
        dependencies.clock,
      );

      applyEvent(dependencies.state, event);

      return reply.code(200).send({
        eventId: event.eventId,
        status: "APPLIED",
      });
    },
  );
}