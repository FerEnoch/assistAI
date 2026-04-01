import { z } from 'zod';

export interface ValidateEnvOptions {
  /** Name of the service (for error messages) */
  serviceName: string;
  /** Whether to exit on failure (default: true in production, false in test) */
  exitOnFailure?: boolean;
}

/**
 * Validates environment variables against a zod schema.
 * Fails fast at startup if configuration is invalid.
 *
 * @param schema - Zod schema to validate against
 * @param env - Environment variables (defaults to process.env)
 * @param options - Validation options
 * @returns Parsed and validated environment
 */
export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  options: ValidateEnvOptions = { serviceName: 'service' },
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    const message = `\n❌ [${options.serviceName}] Invalid environment configuration:\n${errors}\n`;

    console.error(message);

    const shouldExit = options.exitOnFailure ?? (env.NODE_ENV === 'test' ? false : true);
    if (shouldExit) {
      process.exit(1);
    }

    throw new Error(`Invalid environment configuration for ${options.serviceName}`);
  }

  return result.data;
}
