interface FastifyValidationError extends Error {
  code: string;
  validation: unknown;
}

export function isFastifyValidationError(
  error: unknown,
): error is FastifyValidationError {
  return (
    error instanceof Error &&
    "validation" in error &&
    "code" in error &&
    typeof error.code === "string"
  );
}

export interface HttpError extends Error {
  code?: string;
  statusCode: number;
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}
