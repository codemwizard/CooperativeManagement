/** Shared, strict authentication payload contracts for the workspace and API. */

import { z } from 'zod';
import { apiErrorCodeSchema } from './api-error.js';

export const loginRequestSchema = z.object({
  userId: z.string().min(1),
  credential: z.string().min(1),
  deviceId: z.string().min(1),
}).strict();

function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

export const changePasswordRequestSchema = z.object({
  currentCredential: z.string().min(1),
  newPassword: z.string()
    .refine((value) => unicodeCodePointLength(value) >= 12, 'Password must contain at least 12 characters')
    .refine((value) => unicodeCodePointLength(value) <= 1024, 'Password must contain no more than 1024 characters'),
}).strict();

export const loginSuccessSchema = z.object({
  forcedChangeRequired: z.boolean(),
}).strict();

export const csrfResponseSchema = z.object({
  csrfToken: z.string().min(32),
}).strict();

export const authSessionResponseSchema = z.object({
  authenticated: z.literal(true),
  forcedChangeRequired: z.boolean(),
  csrfToken: z.string().min(32),
}).strict();

export const changePasswordSuccessSchema = z.object({
  ok: z.literal(true),
}).strict();

export const authenticationErrorSchema = z.object({
  code: apiErrorCodeSchema,
}).strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type LoginSuccess = z.infer<typeof loginSuccessSchema>;
export type CsrfResponse = z.infer<typeof csrfResponseSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type ChangePasswordSuccess = z.infer<typeof changePasswordSuccessSchema>;
export type AuthenticationError = z.infer<typeof authenticationErrorSchema>;
