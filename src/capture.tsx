import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import metaData from '../data/meta.json';

export const CAPTURE_STORAGE_KEY = 'symphony.capture.v1';
export const CAPTURE_TESTIDS = new Set([
  'start-bank-tour',
  'start-nabii-tour',
  'tour-next',
  'tour-back',
  'tour-exit',
  'reset-demo',
  'open-event-log',
  'present-record',
  'outcome-select',
  'record-outcome',
  'admit-evidence',
  'query-evidence',
  'reject-evidence',
  'request-more-evidence',
  'lender-raise-dispute',
  'assign-verification',
  'relied-btn',
  'not-relied-btn',
  'export-json-btn',
  'export-csv-btn',
  'export-print-btn',
  'portfolio-exposure',
  'funnel-count-enrolled',
  'funnel-count-ready_programme',
  'funnel-count-ready_lender',
  'funnel-count-presented',
  'funnel-count-lender_response_recorded',
  'funnel-count-financed',
  'directory-programme-filter',
  'directory-sort',
]);

export type CaptureScreen =
  | 'login'
  | 'enrollment'
  | 'sme_dashboard'
  | 'org_state'
  | 'project_state'
  | 'requirements'
  | 'gap_remediation'
  | 'readiness_basis'
  | 'destination_projection'
  | 'present_modal'
  | 'lender_assessment'
  | 'facility_monitoring'
  | 'portfolio'
  | 'claim_view'
  | 'nabii_pipeline'
  | 'nabii_cohort'
  | 'nabii_directory'
  | 'verifier_queue'
  | 'verifier_workbench'
  | 'tour_launcher';

export type CaptureEventType =
  | 'session_start'
  | 'session_end'
  | 'screen_view'
  | 'screen_leave'
  | 'idle_start'
  | 'idle_end'
  | 'visibility'
  | 'tour_start'
  | 'tour_step'
  | 'tour_exit'
  | 'tour_complete'
  | 'off_script'
  | 'ui_click'
  | 'help_open'
  | 'destination_switch'
  | 'role_switch'
  | 'case_select'
  | 'action_result'
  | 'readiness_change'
  | 'traceability_open'
  | 'drilldown'
  | 'outcome_recorded'
  | 'evidence_admission'
  | 'evidence_request'
  | 'dossier_export'
  | 'reset_demo'
  | 'export'
  | 'error';

export interface CaptureEvent {
  v: 1;
  session_id: string;
  seq: number;
  t_ms: number;
  ts: string;
  type: CaptureEventType;
  screen_id: CaptureScreen | null;
  tour_id: 'bank' | 'nabii' | null;
  tour_step: string | null;
  case_id: string | null;
  destination_id: 'A' | 'B' | 'N' | null;
  role: string | null;
  payload: Record<string, unknown>;
}

export interface CaptureSessionRecord {
  session: {
    session_id: string;
    audience: string;
    label: string;
    started_at: string;
    ended_at?: string;
  };
  events: CaptureEvent[];
}

interface CaptureContextState {
  screenId: CaptureScreen | null;
  caseId: string | null;
  destinationId: 'A' | 'B' | 'N' | null;
  role: string | null;
}

interface CaptureContextValue {
  emit: (type: CaptureEventType, payload: Record<string, unknown>, overrides?: Partial<Pick<CaptureEvent, 'screen_id' | 'tour_id' | 'tour_step'>>) => void;
  setContext: (context: CaptureContextState) => void;
  setTourContext: (tourId: 'bank' | 'nabii' | null, stepId?: string | null) => void;
  endSession: (reason: 'chord' | 'idle_timeout' | 'tour_complete' | 'page_hide' | 'reset') => void;
  resetSession: () => void;
  exportCurrentSession: () => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function storageRead(): CaptureSessionRecord[] {
  try {
    const raw = window.localStorage.getItem(CAPTURE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CaptureSessionRecord[]) : [];
  } catch {
    return [];
  }
}

function storageWrite(records: CaptureSessionRecord[]) {
  window.localStorage.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(records));
}

function audienceFromParams(params: URLSearchParams) {
  const value = params.get('audience');
  return value === 'bank' || value === 'nabii' || value === 'other' ? value : 'unlabelled';
}

function deviceClass() {
  const width = window.innerWidth;
  if (width < 700) return 'phone';
  if (width < 1100) return 'tablet';
  return 'desktop';
}

function sessionId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const random = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `S-${stamp}-${random}`;
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function lastEvent(events: CaptureEvent[], type: CaptureEventType) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === type) return events[index];
  }
  return undefined;
}

export function summarizeCapture(events: CaptureEvent[]) {
  const screens = new Map<string, { views: number; first_view_t_ms: number; total_dwell_ms: number; total_active_ms: number; max_single_active_ms: number; entered_via_tour: boolean; entered_via_nav: boolean }>();
  for (const event of events) {
    if (event.type === 'screen_view' && event.screen_id) {
      const current = screens.get(event.screen_id) ?? {
        views: 0,
        first_view_t_ms: event.t_ms,
        total_dwell_ms: 0,
        total_active_ms: 0,
        max_single_active_ms: 0,
        entered_via_tour: false,
        entered_via_nav: false,
      };
      current.views += 1;
      current.first_view_t_ms = Math.min(current.first_view_t_ms, event.t_ms);
      current.entered_via_tour ||= event.payload.via === 'tour';
      current.entered_via_nav ||= event.payload.via === 'nav';
      screens.set(event.screen_id, current);
    }
    if (event.type === 'screen_leave' && event.screen_id) {
      const current = screens.get(event.screen_id);
      if (current) {
        const dwell = Number(event.payload.dwell_ms ?? 0);
        const active = Number(event.payload.active_ms ?? 0);
        current.total_dwell_ms += dwell;
        current.total_active_ms += active;
        current.max_single_active_ms = Math.max(current.max_single_active_ms, active);
      }
    }
  }
  const helpCounts: Record<string, number> = {};
  for (const event of events.filter((item) => item.type === 'help_open')) {
    const id = String(event.payload.help_id);
    helpCounts[id] = (helpCounts[id] ?? 0) + 1;
  }
  return {
    duration_ms: Number(lastEvent(events, 'session_end')?.payload.duration_ms ?? events[events.length - 1]?.t_ms ?? 0),
    active_ms: Number(lastEvent(events, 'session_end')?.payload.active_ms ?? events[events.length - 1]?.t_ms ?? 0),
    idle_gap_count: events.filter((event) => event.type === 'idle_start').length,
    idle_total_ms: events.filter((event) => event.type === 'idle_end').reduce((sum, event) => sum + Number(event.payload.idle_ms ?? 0), 0),
    longest_idle_ms: Math.max(0, ...events.filter((event) => event.type === 'idle_end').map((event) => Number(event.payload.idle_ms ?? 0))),
    tours_started: events.filter((event) => event.type === 'tour_start').length,
    tours_completed: events.filter((event) => event.type === 'tour_complete').length,
    tour_exit_step: lastEvent(events, 'tour_exit')?.payload.step_id ?? null,
    off_script_count: events.filter((event) => event.type === 'off_script').length,
    destination_switches: events.filter((event) => event.type === 'destination_switch').length,
    role_switches: events.filter((event) => event.type === 'role_switch').length,
    blocked_actions: events.filter((event) => event.type === 'action_result' && event.payload.ok === false).length,
    successful_actions: events.filter((event) => event.type === 'action_result' && event.payload.ok === true).length,
    traceability_opens: events.filter((event) => event.type === 'traceability_open').length,
    max_drill_clicks: Math.max(0, ...events.filter((event) => event.type === 'drilldown').map((event) => Number(event.payload.clicks ?? 0))),
    outcomes_recorded: events.filter((event) => event.type === 'outcome_recorded').length,
    resets: events.filter((event) => event.type === 'reset_demo').length,
    time_to_first_traceability_open_ms: events.find((event) => event.type === 'traceability_open')?.t_ms ?? null,
    help_open_by_id: helpCounts,
    top_help_ids: Object.entries(helpCounts).sort((left, right) => right[1] - left[1]).slice(0, 5).map(([id]) => id),
    screens: Object.fromEntries(
      [...screens.entries()].map(([screen, value]) => [
        screen,
        {
          ...value,
          revisits: Math.max(0, value.views - 1),
          mean_active_ms: value.views ? Math.round(value.total_active_ms / value.views) : 0,
        },
      ]),
    ),
  };
}

export function captureEventsCsv(events: CaptureEvent[]) {
  const header = 'session_id,seq,t_ms,ts,type,screen_id,tour_id,tour_step,case_id,destination_id,role,payload_json';
  const rows = events.map((event) =>
    [
      event.session_id,
      event.seq,
      event.t_ms,
      event.ts,
      event.type,
      event.screen_id,
      event.tour_id,
      event.tour_step,
      event.case_id,
      event.destination_id,
      event.role,
      JSON.stringify(event.payload),
    ].map(csvEscape).join(','),
  );
  return [header, ...rows].join('\n');
}

export function captureSessionsCsv(records: CaptureSessionRecord[]) {
  const header = 'session_id,audience,label,started_at,duration_ms,active_ms,tours_started,tours_completed,tour_exit_step,off_script_count,destination_switches,role_switches,blocked_actions,successful_actions,traceability_opens,max_drill_clicks,outcomes_recorded,resets,idle_gap_count,longest_idle_ms,time_to_first_traceability_open_ms';
  const rows = records.map((record) => {
    const summary = summarizeCapture(record.events);
    return [
      record.session.session_id,
      record.session.audience,
      record.session.label,
      record.session.started_at,
      summary.duration_ms,
      summary.active_ms,
      summary.tours_started,
      summary.tours_completed,
      summary.tour_exit_step,
      summary.off_script_count,
      summary.destination_switches,
      summary.role_switches,
      summary.blocked_actions,
      summary.successful_actions,
      summary.traceability_opens,
      summary.max_drill_clicks,
      summary.outcomes_recorded,
      summary.resets,
      summary.idle_gap_count,
      summary.longest_idle_ms,
      summary.time_to_first_traceability_open_ms,
    ].map(csvEscape).join(',');
  });
  return [header, ...rows].join('\n');
}

export function captureScreensCsv(records: CaptureSessionRecord[]) {
  const header = 'session_id,screen_id,views,first_view_t_ms,total_dwell_ms,total_active_ms,max_single_active_ms,revisits,mean_active_ms,entered_via_tour,entered_via_nav';
  const rows = records.flatMap((record) => {
    const summary = summarizeCapture(record.events);
    return Object.entries(summary.screens).map(([screenId, metrics]) =>
      [
        record.session.session_id,
        screenId,
        metrics.views,
        metrics.first_view_t_ms,
        metrics.total_dwell_ms,
        metrics.total_active_ms,
        metrics.max_single_active_ms,
        metrics.revisits,
        metrics.mean_active_ms,
        metrics.entered_via_tour,
        metrics.entered_via_nav,
      ].map(csvEscape).join(','),
    );
  });
  return [header, ...rows].join('\n');
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CaptureProvider({ children }: { children: ReactNode }) {
  const params = new URLSearchParams(window.location.search);
  const audience = audienceFromParams(params);
  const label = params.get('label') ?? '';
  const indicator = params.get('indicator') === 'on';
  const start = useRef(performance.now());
  const seq = useRef(0);
  const session = useRef<CaptureSessionRecord>({
    session: { session_id: sessionId(), audience, label, started_at: nowIso() },
    events: [],
  });
  const context = useRef<CaptureContextState>({ screenId: null, caseId: null, destinationId: null, role: null });
  const tour = useRef<{ tourId: 'bank' | 'nabii' | null; stepId: string | null }>({ tourId: null, stepId: null });
  const storageBroken = useRef(false);
  const ended = useRef(false);
  const [recordsVersion, setRecordsVersion] = useState(0);

  const persist = useCallback(() => {
    try {
      const records = storageRead().filter((record) => record.session.session_id !== session.current.session.session_id);
      storageWrite([...records, session.current]);
      setRecordsVersion((value) => value + 1);
    } catch {
      if (!storageBroken.current) {
        storageBroken.current = true;
        const event = makeEvent('error', { message: 'localStorage unavailable', source: 'storage' });
        session.current.events.push(event);
      }
    }
  }, []);

  function makeEvent(
    type: CaptureEventType,
    payload: Record<string, unknown>,
    overrides: Partial<Pick<CaptureEvent, 'screen_id' | 'tour_id' | 'tour_step'>> = {},
  ): CaptureEvent {
    return {
      v: 1,
      session_id: session.current.session.session_id,
      seq: ++seq.current,
      t_ms: Math.max(0, Math.round(performance.now() - start.current)),
      ts: nowIso(),
      type,
      screen_id: overrides.screen_id ?? context.current.screenId,
      tour_id: overrides.tour_id ?? tour.current.tourId,
      tour_step: overrides.tour_step ?? tour.current.stepId,
      case_id: context.current.caseId,
      destination_id: context.current.destinationId,
      role: context.current.role,
      payload,
    };
  }

  const emit = useCallback<CaptureContextValue['emit']>((type, payload, overrides = {}) => {
    if (ended.current && type !== 'session_start') return;
    if (session.current.events.length >= 20000) return;
    session.current.events.push(makeEvent(type, payload, overrides));
    persist();
  }, [persist]);

  const endSession = useCallback<CaptureContextValue['endSession']>((reason) => {
    if (ended.current) return;
    session.current.events.push(makeEvent('session_end', { reason, duration_ms: Math.round(performance.now() - start.current), active_ms: Math.round(performance.now() - start.current) }));
    session.current.session.ended_at = nowIso();
    ended.current = true;
    persist();
  }, [persist]);

  const resetSession = useCallback(() => {
    session.current.events.push(makeEvent('reset_demo', {}));
    endSession('reset');
    start.current = performance.now();
    seq.current = 0;
    ended.current = false;
    session.current = { session: { session_id: sessionId(), audience, label, started_at: nowIso() }, events: [] };
    session.current.events.push(makeEvent('session_start', {
      audience,
      label,
      app_version: '1.0.0',
      viewport: { w: window.innerWidth, h: window.innerHeight },
      device_class: deviceClass(),
      demo_date: metaData.demo_date,
    }));
    persist();
  }, [audience, endSession, label, persist]);

  const exportCurrentSession = useCallback(() => {
    emit('export', { format: 'session_json' });
    endSession('chord');
    const payload = { ...session.current, summary: summarizeCapture(session.current.events) };
    download(`${session.current.session.session_id}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [emit, endSession]);

  useEffect(() => {
    session.current.events.push(makeEvent('session_start', {
      audience,
      label,
      app_version: '1.0.0',
      viewport: { w: window.innerWidth, h: window.innerHeight },
      device_class: deviceClass(),
      demo_date: metaData.demo_date,
    }));
    persist();

    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest('[data-testid]') as HTMLElement | null;
      const testid = target?.dataset.testid;
      if (testid && CAPTURE_TESTIDS.has(testid)) emit('ui_click', { testid });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        exportCurrentSession();
      }
    };
    const onVisibility = () => emit('visibility', { state: document.visibilityState === 'hidden' ? 'hidden' : 'visible' });
    const onPageHide = () => endSession('page_hide');
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [audience, emit, endSession, exportCurrentSession, label, persist]);

  const value = useMemo<CaptureContextValue>(() => ({
    emit,
    setContext(next) {
      const previous = context.current.screenId;
      if (previous && previous !== next.screenId) {
        session.current.events.push(makeEvent('screen_leave', { dwell_ms: 0, active_ms: 0 }, { screen_id: previous }));
      }
      context.current = next;
      if (next.screenId && previous !== next.screenId) {
        session.current.events.push(makeEvent('screen_view', { previous_screen: previous, via: previous ? 'nav' : 'initial' }, { screen_id: next.screenId }));
        persist();
      }
    },
    setTourContext(tourId, stepId = null) {
      tour.current = { tourId, stepId };
    },
    endSession,
    resetSession,
    exportCurrentSession,
  }), [emit, endSession, exportCurrentSession, persist, resetSession]);

  return (
    <CaptureContext.Provider value={value}>
      {indicator ? <span className="capture-indicator" data-testid="capture-indicator" aria-label="Capture active" /> : null}
      {children}
      <span hidden data-testid="capture-version">{recordsVersion}</span>
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  return useContext(CaptureContext);
}

export function CaptureAdmin() {
  const records = storageRead();
  const capture = useCapture();
  const [, setRefresh] = useState(0);
  function exportAllJson() {
    capture?.emit('export', { format: 'all_sessions_json' });
    download('capture-sessions.json', JSON.stringify(records.map((record) => ({ ...record, summary: summarizeCapture(record.events) })), null, 2), 'application/json');
  }
  function exportEventsCsv() {
    capture?.emit('export', { format: 'events_csv' });
    download('events.csv', captureEventsCsv(records.flatMap((record) => record.events)), 'text/csv');
  }
  function exportScreensCsv() {
    capture?.emit('export', { format: 'screens_csv' });
    download('screens.csv', captureScreensCsv(records), 'text/csv');
  }
  function exportSessionsCsv() {
    capture?.emit('export', { format: 'sessions_csv' });
    download('sessions.csv', captureSessionsCsv(records), 'text/csv');
  }
  function clear() {
    if (window.confirm('Clear capture data?')) {
      window.localStorage.removeItem(CAPTURE_STORAGE_KEY);
      setRefresh((value) => value + 1);
    }
  }
  return (
    <main className="page-shell" data-testid="capture-admin">
      <header className="app-header">
        <h1>Capture</h1>
      </header>
      <section className="component-grid">
        <article className="requirement-card">
          <h2>Sessions</h2>
          {records.map((record) => <p key={record.session.session_id}>{record.session.session_id}: {record.events.length} events</p>)}
        </article>
        <article className="requirement-card">
          <h2>Exports</h2>
          <button type="button" data-testid="capture-export-json" onClick={exportAllJson}>All sessions JSON</button>
          <button type="button" data-testid="capture-export-events" onClick={exportEventsCsv}>events.csv</button>
          <button type="button" data-testid="capture-export-screens" onClick={exportScreensCsv}>screens.csv</button>
          <button type="button" data-testid="capture-export-sessions" onClick={exportSessionsCsv}>sessions.csv</button>
          <button type="button" data-testid="capture-clear" onClick={clear}>Clear capture data</button>
        </article>
      </section>
    </main>
  );
}
