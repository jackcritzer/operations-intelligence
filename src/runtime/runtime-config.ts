export interface RuntimeConfig {
  databaseUrl: string;
  host: string;
  port: number;
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv,
): RuntimeConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  const host = environment.HOST?.trim() || "0.0.0.0";
  const portText = environment.PORT?.trim() || "3000";
  const port = Number(portText);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `PORT must be an integer between 1 and 65535; received ${portText}`,
    );
  }

  return {
    databaseUrl,
    host,
    port,
  };
}
