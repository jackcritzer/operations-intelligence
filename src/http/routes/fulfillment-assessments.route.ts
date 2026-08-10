import type { FastifyInstance } from "fastify";

import { getFulfillmentAssessments } from "../../application/get-fulfillment-assessments.js";
import type { OperationalState } from "../../state/operational-state.js";
import {
  FulfillmentAssessmentsResponseSchema,
  type FulfillmentAssessmentsResponse,
} from "../schemas/fulfillment-assessment.schema.js";

export interface FulfillmentAssessmentsRouteDependencies {
  state: OperationalState;
}

export function registerFulfillmentAssessmentsRoutes(
  app: FastifyInstance,
  dependencies: FulfillmentAssessmentsRouteDependencies,
): void {
  app.get<{
    Reply: FulfillmentAssessmentsResponse;
  }>(
    "/v1/fulfillment-assessments",
    {
      schema: {
        response: {
          200: FulfillmentAssessmentsResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const assessments: FulfillmentAssessmentsResponse =
        getFulfillmentAssessments(dependencies.state);

      return reply.code(200).send(assessments);
    },
  );
}
