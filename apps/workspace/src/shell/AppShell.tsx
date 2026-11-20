/**
 * apps/workspace/src/shell/AppShell.tsx
 *
 * Main workspace layout: left nav, org header, content area, provenance drawer.
 * WP-1.9.2
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LeftNav } from './LeftNav.js';
import { OrgHeader } from './OrgHeader.js';
import { ProvenanceDrawer } from './ProvenanceDrawer.js';
import { CapabilityGapPage } from './CapabilityGapPage.js';
import { EvidenceRegisterPage } from '../routes/EvidenceRegisterPage.js';
import { readWorkspaceContext } from '../api/workspace-client.js';
import { isOrganizationInContext, presentWorkspaceContexts, type PresentedWorkspaceContext } from '../presenters/present-workspace-context.js';
import type { WorkspaceContextFactsContract } from '@symphony/contracts';
import './workspace-shell.css';

export function AppShell(): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workspaceFacts, setWorkspaceFacts] = useState<WorkspaceContextFactsContract | null>(null);
  const [contextLoadFailed, setContextLoadFailed] = useState(false);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const provenanceTriggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { cooperativeId } = useParams<{ cooperativeId?: string }>();
  const contexts = workspaceFacts ? presentWorkspaceContexts(workspaceFacts) : [];
  const routeContext = contexts.find((context) => (!cooperativeId || isOrganizationInContext(context, cooperativeId))
    && context.navigation.some((area) => location.pathname.endsWith(`/${area.path}`)));
  const selectedContext = contexts.find((context) => context.id === selectedContextId) ?? routeContext ?? contexts[0];
  const requestedOrganizationAllowed = cooperativeId && selectedContext
    ? isOrganizationInContext(selectedContext, cooperativeId)
    : true;
  const activeOrganizationId = cooperativeId && requestedOrganizationAllowed
    ? cooperativeId
    : selectedContext?.organizationId;
  const requestedPath = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
  const requestedRouteAllowed = !registeredWorkspacePaths.has(requestedPath)
    || Boolean(selectedContext?.navigation.some((area) => area.path === requestedPath));
  const basePath = activeOrganizationId ? `/coop/${encodeURIComponent(activeOrganizationId)}` : '/workspace';
  const closeProvenance = useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => provenanceTriggerRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    let mounted = true;
    void readWorkspaceContext().then((facts) => {
      if (mounted) {
        setWorkspaceFacts(facts);
      }
    }).catch(() => { if (mounted) setContextLoadFailed(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const area = selectedContext?.navigation.find((candidate) => location.pathname.endsWith(`/${candidate.path}`));
    const isWorkspaceRoot = location.pathname === basePath || location.pathname === `${basePath}/`;
    document.title = `${area?.label ?? (isWorkspaceRoot ? 'Overview' : 'Page not found')} | Symphony Workspace`;
    document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true });
  }, [basePath, location.pathname, selectedContext]);

  const selectContext = (contextId: string): void => {
    const next = contexts.find((context) => context.id === contextId);
    if (!next) return;
    setSelectedContextId(next.id);
    const rootPath = next.organizationId ? `/coop/${encodeURIComponent(next.organizationId)}` : '/workspace';
    navigate(rootPath);
  };

  if (!workspaceFacts && !contextLoadFailed) return <main id="main-content" aria-busy="true"><p role="status">Loading your workspace context…</p></main>;
  if (contextLoadFailed) return <WorkspaceMessage heading="Workspace unavailable" message="Your current workspace context could not be loaded. Refresh the page or sign in again." />;
  if (!selectedContext) return <WorkspaceMessage heading="No active workspace context" message="Your account has no current cooperative membership or assigned work context." />;
  if (!requestedOrganizationAllowed) return <WorkspaceMessage heading="Workspace context unavailable" message="This organization is outside your current workspace authority." />;
  if (!requestedRouteAllowed) return <WorkspaceMessage heading="Workflow unavailable" message="Your current workspace authority does not include this workflow." />;

  return (
    <div className="app-shell" style={styles.shell}>
      <a className="workspace-skip-link" href="#main-content">Skip to main content</a>
      <OrgHeader {...(selectedContext.organizationName ? { orgName: selectedContext.organizationName } : {})}
        provenanceButtonRef={provenanceTriggerRef} onOpenProvenance={() => setDrawerOpen(true)} />
      <div className="app-shell-body" style={styles.body}>
        <aside aria-label="Current workflow and navigation" style={styles.navigationColumn}>
          <label style={styles.contextLabel} htmlFor="workspace-context-select">Current workflow</label>
          <select
            id="workspace-context-select"
            value={selectedContext.id}
            onChange={(event) => selectContext(event.currentTarget.value)}
            style={styles.contextSelect}
          >
            {contexts.map((context) => <option key={context.id} value={context.id}>{context.label}</option>)}
          </select>
          <LeftNav basePath={basePath} items={selectedContext.navigation} />
        </aside>
        <main id="main-content" style={styles.main} tabIndex={-1}>
          <Routes>
            <Route index element={<CapabilityGapPage module="Overview" />} />
            <Route path="overview" element={<CapabilityGapPage module="Overview" />} />
            <Route path="identity" element={<CapabilityGapPage module="Identity" />} />
            <Route path="enrolment" element={<CapabilityGapPage module="Enrolment and authority" />} />
            <Route path="bylaws" element={<CapabilityGapPage module="By-laws and requirements" />} />
            <Route path="governance" element={<CapabilityGapPage module="Governance" />} />
            <Route path="people" element={<CapabilityGapPage module="People and appointments" />} />
            <Route path="meetings" element={<CapabilityGapPage module="Meetings and resolutions" />} />
            <Route path="financial-records" element={<CapabilityGapPage module="Financial records" />} />
            <Route path="committees" element={<CapabilityGapPage module="Committees" />} />
            <Route path="audit" element={<CapabilityGapPage module="Audit and education" />} />
            <Route path="evidence" element={activeOrganizationId
              ? <EvidenceRegisterPage organizationId={activeOrganizationId} />
              : <CapabilityGapPage module="Evidence register" />} />
            <Route path="findings" element={<CapabilityGapPage module="Findings and next actions" />} />
            <Route path="verification-queue" element={<CapabilityGapPage module="Verification queue" />} />
            <Route path="pipeline" element={<CapabilityGapPage module="Pipeline" />} />
            <Route path="cohort" element={<CapabilityGapPage module="Cohort" />} />
            <Route path="directory" element={<CapabilityGapPage module="Directory" />} />
            <Route path="legal-catalogue" element={<CapabilityGapPage module="Legal catalogue review" />} />
            <Route path="delegations" element={<CapabilityGapPage module="Delegations" />} />
            <Route path="capability-gaps" element={<CapabilityGapPage module="Capability gaps" />} />
            <Route path="certificate-details" element={<CapabilityGapPage module="Certificate details" />} />
            <Route path="create-officer-accounts" element={<CapabilityGapPage module="Create officer accounts" />} />
            <Route path="hand-over" element={<CapabilityGapPage module="Hand over" />} />
            <Route path="my-activities" element={<CapabilityGapPage module="My activities" />} />
            <Route path="my-household" element={<CapabilityGapPage module="My household" />} />
            <Route path="*" element={<WorkspaceNotFound />} />
          </Routes>
        </main>
        {drawerOpen && (
          <ProvenanceDrawer onClose={closeProvenance} />
        )}
      </div>
    </div>
  );
}

function WorkspaceMessage({ heading, message }: { heading: string; message: string }): React.ReactElement {
  return <main id="main-content" tabIndex={-1}><h1 tabIndex={-1}>{heading}</h1><p>{message}</p></main>;
}

function WorkspaceNotFound(): React.ReactElement {
  return (
    <section aria-labelledby="workspace-not-found-heading">
      <h1 id="workspace-not-found-heading" tabIndex={-1}>Page not found</h1>
      <p>This workspace route is not available.</p>
      <Link to="/workspace/overview">Return to Overview</Link>
    </section>
  );
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    color: '#212529',
    background: '#f8f9fa',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  navigationColumn: { width: '264px', minWidth: '264px', background: '#ffffff', borderRight: '1px solid #dee2e6' },
  contextLabel: { display: 'block', padding: '0.75rem 1rem 0.25rem', color: '#495057', fontSize: '0.75rem', fontWeight: 600 },
  contextSelect: { boxSizing: 'border-box' as const, width: 'calc(100% - 2rem)', margin: '0 1rem 0.5rem', padding: '0.5rem', border: '1px solid #adb5bd', borderRadius: '0.25rem', background: '#ffffff', color: '#212529' },
  main: {
    flex: 1,
    padding: '2rem',
    overflow: 'auto',
    outline: 'none',
  },
};

const registeredWorkspacePaths = new Set([
  'overview', 'identity', 'enrolment', 'bylaws', 'governance', 'people', 'meetings', 'committees',
  'audit', 'evidence', 'findings', 'verification-queue', 'pipeline', 'cohort', 'directory',
  'legal-catalogue', 'delegations', 'capability-gaps', 'certificate-details',
  'create-officer-accounts', 'hand-over', 'my-activities', 'my-household', 'financial-records',
]);

