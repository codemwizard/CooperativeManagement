/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ADR-006: domain must be pure — no DB, no API framework, no React
    {
      name: "domain-no-db",
      severity: "error",
      comment: "packages/domain must not import pg, kysely, or any DB library (ADR-006)",
      from: { path: "^packages/domain" },
      to: { path: ["node_modules/pg", "node_modules/kysely", "node_modules/postgres"] },
    },
    {
      name: "domain-no-react",
      severity: "error",
      comment: "packages/domain must not import React (ADR-006)",
      from: { path: "^packages/domain" },
      to: { path: ["node_modules/react", "node_modules/react-dom"] },
    },
    {
      name: "domain-no-fastify",
      severity: "error",
      comment: "packages/domain must not import Fastify (ADR-006)",
      from: { path: "^packages/domain" },
      to: { path: ["node_modules/fastify"] },
    },
    // workspace must not import DB libraries
    {
      name: "workspace-no-db",
      severity: "error",
      comment: "apps/workspace must not import pg, kysely, or DB libraries",
      from: { path: "^apps/workspace" },
      to: { path: ["node_modules/pg", "node_modules/kysely"] },
    },
    // Legacy src/ must not import new packages (ADR-007)
    {
      name: "legacy-no-new-packages",
      severity: "error",
      comment: "Legacy src/ must not import from packages/ or apps/ (ADR-007)",
      from: { path: "^src/" },
      to: { path: "^packages/" },
    },
    {
      name: "legacy-no-new-apps",
      severity: "error",
      comment: "Legacy src/ must not import from apps/ (ADR-007)",
      from: { path: "^src/" },
      to: { path: "^apps/" },
    },
    // New packages must not import legacy engine (ADR-007)
    {
      name: "new-packages-no-legacy-engine",
      severity: "error",
      comment: "New packages must not import from legacy src/engine/ (ADR-007)",
      from: { path: "^packages/" },
      to: { path: "^src/engine/" },
    },
    {
      name: "new-apps-no-legacy-engine",
      severity: "error",
      comment: "New apps must not import from legacy src/engine/ (ADR-007)",
      from: { path: "^apps/" },
      to: { path: "^src/engine/" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};

