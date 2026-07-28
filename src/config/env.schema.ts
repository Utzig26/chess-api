import { z } from 'zod';

const durationPattern = /^\d+(ms|s|m|h|d)$/;

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DB_URI: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_USERNAME: z.string().default(''),
  DB_PASSWORD: z.string().default(''),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().regex(durationPattern).default('15m'),

  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
