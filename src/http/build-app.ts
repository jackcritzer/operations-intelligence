import Fastify, 
	{ 
		type FastifyInstance, 
  	type FastifyError, 
	} from "fastify";
import { type TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { systemClock, type Clock } from "./mappers/operational-event.mapper.js";
import { OperationalState } from "../state/operational-state.js";
import { createEmptyOperationalState } from "../state/operational-state.js";
import { registerOperationalEventRoutes } from "./routes/operational-events.route.js";
import { EventApplicationError, statusForEventApplicationError } from "./errors/error-handler.js";
export interface BuildAppOptions {
  state?: OperationalState;
  clock?: Clock;
}

interface FastifyValidationError extends Error {
  code: string;
  validation: unknown;
}

function isFastifyValidationError(
  error: unknown,
): error is FastifyValidationError {
  return (
    error instanceof Error &&
    "validation" in error &&
    "code" in error &&
    typeof error.code === "string"
  );
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
  }).withTypeProvider<TypeBoxTypeProvider>();

	app.setErrorHandler((error, request, reply) => {
		if (error instanceof EventApplicationError) {
			return reply
				.code(statusForEventApplicationError(error))
				.send({
					code: error.code,
					message: error.message,
					...(error.details === undefined
						? {}
						: { details: error.details }),
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
