import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { AcceptedEventRepository } from "./persistence/accepted-event-repository.js";
import { createDatabasePool } from "./persistence/database.js";
import { createRuntime } from "./runtime/create-runtime.js";
import { loadRuntimeConfig } from "./runtime/runtime-config.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const pool = createDatabasePool(config.databaseUrl);

  let app: FastifyInstance | undefined;

  try {
    const repository = new AcceptedEventRepository(pool);
    const runtime = await createRuntime(repository);

    app = runtime.app;

    const address = await app.listen({
      host: config.host,
      port: config.port,
    });

    console.log(`Operations Intelligence listening at ${address}`);
  } catch (error) {
    await closeAfterStartupFailure(app, pool);
    throw error;
  }

  registerShutdownHandlers(app, pool);
}

async function closeAfterStartupFailure(
  app: FastifyInstance | undefined,
  pool: Pool,
): Promise<void> {
  const cleanupOperations: Promise<unknown>[] = [pool.end()];

  if (app !== undefined) {
    cleanupOperations.push(app.close());
  }

  await Promise.allSettled(cleanupOperations);
}

function registerShutdownHandlers(app: FastifyInstance, pool: Pool): void {
  let shutdownStarted = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;

    console.log(`Received ${signal}; shutting down`);

    try {
      await app.close();
    } finally {
      await pool.end();
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT").catch(reportFatalError);
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").catch(reportFatalError);
  });
}

function reportFatalError(error: unknown): void {
  console.error(error);
  process.exitCode = 1;
}

void main().catch(reportFatalError);
