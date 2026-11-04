/**
 * @symphony/testkit — builders/an-enroller.ts
 * Phase 0 stub — platform enroller with optional session.
 * [SYNTHETIC FIXTURE]
 */

export interface EnrollerStub {
  readonly id: string;
  readonly email: string;
  readonly scope: 'platform_enroller';
  readonly sessionId: string | null;
}

export interface EnrollerWithSession extends EnrollerStub {
  readonly sessionId: string;
}

interface EnrollerBuilder {
  build(): EnrollerStub;
  withSession(sessionId?: string): EnrollerWithSessionBuilder;
}

interface EnrollerWithSessionBuilder {
  build(): EnrollerWithSession;
}

export function anEnroller(overrides: Partial<EnrollerStub> = {}): EnrollerBuilder {
  const base: EnrollerStub = {
    id: '00000000-0000-0000-0000-000000000020',
    email: 'enroller@test.invalid',
    scope: 'platform_enroller',
    sessionId: null,
    ...overrides,
  };

  return {
    build() {
      return base;
    },
    withSession(sessionId: string = '00000000-0000-0000-0000-000000000099') {
      const withSession: EnrollerWithSession = { ...base, sessionId };
      return {
        build() {
          return withSession;
        },
      };
    },
  };
}

