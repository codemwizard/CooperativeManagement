/**
 * apps/workspace/src/shell/AppShell.tsx
 *
 * Main workspace layout: left nav, org header, content area, provenance drawer.
 * WP-1.9.2
 */

import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LeftNav } from './LeftNav.js';
import { OrgHeader } from './OrgHeader.js';
import { ProvenanceDrawer } from './ProvenanceDrawer.js';
import { CapabilityGapPage } from './CapabilityGapPage.js';

/** Seed org used in test mode */
const SEED_ORG = {
  name: 'Sunrise Primary Cooperative',
  enrolmentStatus: 'In progress',
  pipelineStage: 'Phase 1 — Evidence gathering',
};

export function AppShell(): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell" style={styles.shell}>
      <OrgHeader
        orgName={SEED_ORG.name}
        enrolmentStatus={SEED_ORG.enrolmentStatus}
        pipelineStage={SEED_ORG.pipelineStage}
        onOpenProvenance={() => setDrawerOpen(true)}
      />
      <div style={styles.body}>
        <LeftNav />
        <main id="main-content" style={styles.main} tabIndex={-1}>
          <Routes>
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
            <Route path="*" element={<CapabilityGapPage module="Overview" />} />
          </Routes>
        </main>
        {drawerOpen && (
          <ProvenanceDrawer onClose={() => setDrawerOpen(false)} />
        )}
      </div>
    </div>
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

