/**
 * apps/workspace/src/shell/AppShell.tsx
 *
 * Main workspace layout: left nav, org header, content area, provenance drawer.
 * WP-1.9.2
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { LeftNav, NAV_AREAS } from './LeftNav.js';
import { OrgHeader } from './OrgHeader.js';
import { ProvenanceDrawer } from './ProvenanceDrawer.js';
import { CapabilityGapPage } from './CapabilityGapPage.js';
import './workspace-shell.css';

/** Seed org used in test mode */
const SEED_ORG = {
  name: 'Sunrise Primary Cooperative',
  enrolmentStatus: 'In progress',
  pipelineStage: 'Phase 1 — Evidence gathering',
};

export function AppShell(): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { cooperativeId } = useParams<{ cooperativeId?: string }>();
  const basePath = cooperativeId ? `/coop/${encodeURIComponent(cooperativeId)}` : '/workspace';
  const closeProvenance = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const area = NAV_AREAS.find((candidate) => location.pathname.endsWith(`/${candidate.path.split('/').at(-1)}`));
    const isWorkspaceRoot = location.pathname === basePath || location.pathname === `${basePath}/`;
    document.title = `${area?.label ?? (isWorkspaceRoot ? 'Overview' : 'Page not found')} | Symphony Workspace`;
    document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true });
  }, [basePath, location.pathname]);

  return (
    <div className="app-shell" style={styles.shell}>
      <a className="workspace-skip-link" href="#main-content">Skip to main content</a>
      <OrgHeader
        orgName={SEED_ORG.name}
        enrolmentStatus={SEED_ORG.enrolmentStatus}
        pipelineStage={SEED_ORG.pipelineStage}
        onOpenProvenance={() => setDrawerOpen(true)}
      />
      <div className="app-shell-body" style={styles.body}>
        <LeftNav basePath={basePath} />
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
            <Route path="committees" element={<CapabilityGapPage module="Committees" />} />
            <Route path="audit" element={<CapabilityGapPage module="Audit and education" />} />
            <Route path="evidence" element={<CapabilityGapPage module="Evidence register" />} />
            <Route path="findings" element={<CapabilityGapPage module="Findings and next actions" />} />
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
  main: {
    flex: 1,
    padding: '2rem',
    overflow: 'auto',
    outline: 'none',
  },
};

