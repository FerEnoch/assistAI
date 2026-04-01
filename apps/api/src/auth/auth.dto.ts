import { z } from 'zod';

/**
 * Request body for POST /auth/magic-link
 */
export const magicLinkRequestSchema = z.object({
  email: z
    .string()
    .email('A valid email address is required')
    .max(320, 'Email must be at most 320 characters')
    .transform((e) => e.toLowerCase().trim()),
});

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

/**
 * Query params for GET /auth/verify
 */
export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type VerifyTokenQuery = z.infer<typeof verifyTokenSchema>;

/**
 * JWT payload for magic-link tokens.
 */
export interface MagicLinkPayload {
  /** Subject: user email */
  sub: string;
  /** Purpose: differentiates token types */
  purpose: 'magic-link';
}
