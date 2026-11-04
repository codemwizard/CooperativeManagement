/**
 * apps/workspace/src/components-page.ts
 *
 * Stub /components route — Component Library Phase 0 scaffold.
 * Renders a minimal HTML page (served by the workspace dev server)
 * listing design token categories and builder names.
 *
 * This is the entry point for:
 *  1. The design system component library (Phase 1+)
 *  2. The a11y regression suite (WP-0.9)
 *
 * Phase 0: Static HTML only — no interactive components yet.
 */

export function renderComponentsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Symphony Component Library — Phase 0 Scaffold</title>
  <link rel="stylesheet" href="design-tokens/tokens.css" />
  <style>
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: #f8f9fa;
      color: #212529;
    }
    h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 0.5rem; }
    p  { color: #495057; line-height: 1.6; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-phase0 { background: #e8ecf5; color: #2c3e6b; }
    .badge-wip { background: #fff8e1; color: #7a4f00; }
    ul { padding-left: 1.5rem; }
    li { margin-bottom: 0.25rem; color: #495057; }
    .token-swatch { display: inline-block; width: 1rem; height: 1rem; border-radius: 0.25rem; border: 1px solid #dee2e6; vertical-align: middle; margin-right: 0.5rem; }
  </style>
</head>
<body>
  <main id="main-content">
    <h1>Symphony Component Library</h1>
    <p>
      <span class="badge badge-phase0">Phase 0 Scaffold</span>
      &nbsp;
      <span class="badge badge-wip">Components: Pending Phase 1</span>
    </p>
    <p>
      This page is the entry point for the Symphony V4 design system and accessibility test suite.
      No interactive components are implemented in Phase 0.
    </p>

    <h2>Design Tokens</h2>
    <p>Tokens defined in <code>design-tokens/tokens.css</code>:</p>
    <ul>
      <li><span class="token-swatch" style="background:#009b87;"></span>Brand (teal): <code>--color-brand-500</code></li>
      <li><span class="token-swatch" style="background:#0a6640;"></span>Status verified: <code>--color-status-verified</code></li>
      <li><span class="token-swatch" style="background:#7a4f00;"></span>Status pending: <code>--color-status-pending</code></li>
      <li><span class="token-swatch" style="background:#8b0000;"></span>Status rejected: <code>--color-status-rejected</code></li>
      <li>Spacing scale: <code>--space-1</code> through <code>--space-24</code></li>
      <li>Typography: <code>--text-xs</code> through <code>--text-4xl</code></li>
      <li>Radius: <code>--radius-sm</code> through <code>--radius-full</code></li>
    </ul>

    <h2>Planned Components (Phase 1+)</h2>
    <ul>
      <li>Button (primary, secondary, destructive)</li>
      <li>Badge (status variants)</li>
      <li>Card</li>
      <li>Form inputs (text, select, file upload)</li>
      <li>Evidence standing indicator</li>
      <li>Timeline / audit trail</li>
      <li>Officer appointment card</li>
      <li>By-law status banner</li>
    </ul>

    <h2>Builders (Phase 0 Stubs)</h2>
    <ul>
      <li><code>aCooperative()</code></li>
      <li><code>aSelfEnroller()</code></li>
      <li><code>anEnroller().withSession()</code></li>
      <li><code>aChairperson()</code>, <code>aSecretary()</code>, <code>aTreasurer()</code></li>
      <li><code>anInternalVerifier()</code></li>
      <li><code>aFieldAgent()</code></li>
      <li><code>aMember(n)</code></li>
      <li><code>anEvidenceVersion()</code></li>
      <li><code>aMeeting()</code></li>
      <li><code>aByLawWithClauses()</code></li>
    </ul>
  </main>
</body>
</html>`;
}

