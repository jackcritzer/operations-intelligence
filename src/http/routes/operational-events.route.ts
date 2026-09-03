import type { FastifyInstance } from "fastify";

import {
  processOperationalEvent,
  type AcceptedEventStore,
} from "../../application/process-operational-event.js";
import { createEventFingerprint } from "../../events/create-event-fingerprint.js";
import type { OperationalState } from "../../state/operational-state.js";
import {
  mapOperationalEventRequest,
  type Clock,
} from "../mappers/operational-event.mapper.js";
import {
  OperationalEventRequestSchema,
  type OperationalEventRequest,
} from "../schemas/operational-event.schema.js";
import {
  OperationalEventResponseSchema,
  type OperationalEventResponse,
} from "../schemas/operational-event-response.schema.js";
import type { OperationalEventProcessor } from "../../application/operational-event-processor.js";

export interface OperationalEventRouteDependencies {
  processor: OperationalEventProcessor;
  clock: Clock;
}

export function registerOperationalEventRoutes(
  app: FastifyInstance,
  dependencies: OperationalEventRouteDependencies,
): void {
  app.post<{
    Body: OperationalEventRequest;
    Reply: OperationalEventResponse;
  }>(
    "/v1/operational-events",
    {
      schema: {
        body: OperationalEventRequestSchema,
        response: {
          200: OperationalEventResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const event = mapOperationalEventRequest(
        request.body,
        dependencies.clock,
      );

      const fingerprint = createEventFingerprint(event);
      const result: OperationalEventResponse =
        await dependencies.processor.process(event, fingerprint);

      return reply.code(200).send(result);
    },
  );
}
