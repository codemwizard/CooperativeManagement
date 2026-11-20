/**
 * apps/workspace/src/App.tsx
 *
 * Root application router.
 * WP-1.9.1
 */

import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './shell/AppShell.js';
import { ComponentsPage } from './routes/ComponentsPage.js';
import { LoginPage } from './routes/LoginPage.js';
import { readSession } from './api/auth-client.js';

function AuthenticatedWorkspace(): React.ReactElement {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void readSession().then((session) => {
      if (active) setAuthenticated(!session.forcedChangeRequired);
    }).catch(() => { if (active) setAuthenticated(false); });
    return () => { active = false; };
  }, []);
  if (authenticated === null) return <main id="main-content" aria-busy="true"><p role="status">Checking your session…</p></main>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App(): React.ReactElement {
  return (
    <Routes>
      <Route path="/components" element={<ComponentsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/workspace/*" element={<AuthenticatedWorkspace />} />
      <Route path="/coop/:cooperativeId/*" element={<AuthenticatedWorkspace />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

