import React, { useEffect } from 'react';
import '../design-tokens/tokens.css';
import '../styles/workspace-accessibility.css';

const tokens = [
  ['Brand', '--color-brand-500', '#009b87'],
  ['Cooperative verification status', '--color-status-verified', '#0a6640'],
  ['Pending status', '--color-status-pending', '#7a4f00'],
  ['Rejected status', '--color-status-rejected', '#8b0000'],
] as const;

const plannedComponents = [
  'Buttons', 'Badges', 'Cards', 'Form inputs', 'Evidence standing indicator',
  'Timeline and audit trail', 'Officer appointment card', 'By-law status banner',
];

export function ComponentsPage(): React.ReactElement {
  useEffect(() => {
    document.title = 'Symphony Component Library — Phase 0 Scaffold';
    document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true });
  }, []);

  return (
    <main id="main-content" className="components-page" tabIndex={-1}>
      <a className="workspace-skip-link" href="#main-content">Skip to main content</a>
      <header>
        <h1 tabIndex={-1}>Symphony Component Library</h1>
        <p>
          <span className="components-badge components-phase">Phase 0 scaffold</span>{' '}
          <span className="components-badge components-pending">Components pending Phase 1</span>
        </p>
      </header>
      <p>This route documents the shared design system. Interactive library components are not implemented yet.</p>

      <section aria-labelledby="design-tokens-heading">
        <h2 id="design-tokens-heading">Design tokens</h2>
        <ul className="components-list">
          {tokens.map(([label, token, color]) => (
            <li key={token}>
              <span className="components-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
              {label}: <code>{token}</code>
            </li>
          ))}
          <li>Spacing: <code>--space-1</code> through <code>--space-24</code></li>
          <li>Typography: <code>--text-xs</code> through <code>--text-4xl</code></li>
          <li>Radius: <code>--radius-sm</code> through <code>--radius-full</code></li>
        </ul>
      </section>

      <section aria-labelledby="planned-components-heading">
        <h2 id="planned-components-heading">Planned components</h2>
        <ul className="components-list">
          {plannedComponents.map((component) => <li key={component}>{component}</li>)}
        </ul>
      </section>

      <p><a href="/login">Go to sign in</a></p>
    </main>
  );
}
