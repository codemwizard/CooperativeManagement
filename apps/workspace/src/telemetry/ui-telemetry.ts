export const UI_TELEMETRY_EVENT = 'symphony:ui-telemetry';

const screenKeys = new Set([
  'overview', 'identity', 'enrolment', 'bylaws', 'governance', 'people', 'meetings',
  'financial-records', 'committees', 'audit', 'evidence', 'findings', 'verification-queue',
  'pipeline', 'cohort', 'directory', 'legal-catalogue', 'delegations', 'capability-gaps',
  'certificate-details', 'create-officer-accounts', 'hand-over', 'my-activities', 'my-household',
]);

export interface UiTelemetryEvent {
  readonly event: 'workspace.screen_viewed';
  readonly screen: string;
  readonly occurredAt: string;
}

/** Publish only a fixed screen category; never include URL, tenant, person, or user data. */
export function publishUiTelemetry(pathname: string, target: EventTarget = window): UiTelemetryEvent {
  const cleanPath = pathname.split(/[?#]/, 1)[0] ?? '';
  const key = cleanPath.split('/').filter(Boolean).at(-1) ?? 'overview';
  const screen = screenKeys.has(key) ? key : 'overview';
  const event: UiTelemetryEvent = {
    event: 'workspace.screen_viewed',
    screen,
    occurredAt: new Date().toISOString(),
  };
  target.dispatchEvent(new CustomEvent<UiTelemetryEvent>(UI_TELEMETRY_EVENT, { detail: event }));
  return event;
}
