import Fastify, { type FastifyInstance } from "fastify";
import { type TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { type Clock } from "./mappers/operational-event.mapper.js";
import { OperationalState } from "../state/operational-state.js";
import { createEmptyOperationalState } from "../state/operational-state.js";
import { registerOperationalEventRoutes } from "./routes/operational-events.route.js";
import { isHttpError } from "./errors/error-handler.js";
import { EventApplicationError } from "../application/errors/event-application-error.js";
import {
  isFastifyValidationError,
  statusForEventApplicationError,
} from "./errors/error-handler.js";

export const systemClock: Clock = {
  now: () => new Date(),
};
export interface BuildAppOptions {
  state?: OperationalState;
  clock?: Clock;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof EventApplicationError) {
      return reply.code(statusForEventApplicationError(error)).send({
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      });
    }

    if (isFastifyValidationError(error)) {
      return reply.code(400).send({
        statusCode: 400,
        code: error.code,
        error: "Bad Request",
        message: error.message,
      });
    }

    if (
      isHttpError(error) &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        ...(error.code === undefined ? {} : { code: error.code }),
        error: error.name,
        message: error.message,
      });
    }

    request.log.error(error);

    return reply.code(500).send({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  });

  const state = options.state ?? createEmptyOperationalState();

  const clock = options.clock ?? systemClock;

  registerOperationalEventRoutes(app, {
    state,
    clock,
  });

  return app;
}
