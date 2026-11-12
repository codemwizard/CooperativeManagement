/**
 * apps/workspace/src/App.tsx
 *
 * Root application router.
 * WP-1.9.1
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './shell/AppShell.js';
import { LoginPage } from './routes/LoginPage.js';

export function App(): React.ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/workspace/*" element={<AppShell />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

