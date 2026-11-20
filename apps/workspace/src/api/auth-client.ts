import {
  authSessionResponseSchema,
  authenticationErrorSchema,
  changePasswordRequestSchema,
  changePasswordSuccessSchema,
  csrfResponseSchema,
  loginRequestSchema,
  loginSuccessSchema,
} from '@symphony/contracts';

export class AuthenticationApiError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'AuthenticationApiError';
  }
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch('/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new AuthenticationApiError('AUTHENTICATION_UNAVAILABLE', response.status);
  return csrfResponseSchema.parse(await response.json()).csrfToken;
}

async function postAuth<T>(path: string, body: unknown, parseSuccess: (value: unknown) => T): Promise<T> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = authenticationErrorSchema.safeParse(payload);
    throw new AuthenticationApiError(error.success ? error.data.code : 'AUTHENTICATION_FAILED', response.status);
  }
  return parseSuccess(payload);
}

export async function login(input: { userId: string; credential: string; deviceId: string }) {
  const request = loginRequestSchema.parse(input);
  return postAuth('/auth/login', request, (value) => loginSuccessSchema.parse(value));
}

export async function changePassword(input: { currentCredential: string; newPassword: string }) {
  const request = changePasswordRequestSchema.parse(input);
  return postAuth('/auth/change-password', request, (value) => changePasswordSuccessSchema.parse(value));
}

export async function readSession() {
  const response = await fetch('/auth/session', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    const error = authenticationErrorSchema.safeParse(payload);
    throw new AuthenticationApiError(error.success ? error.data.code : 'UNAUTHENTICATED', response.status);
  }
  return authSessionResponseSchema.parse(await response.json());
}
