import React, { useEffect, useState } from 'react';
import { verifiedFindingListSchema, type VerifiedFindingProjection } from '@symphony/contracts';

export function EvidenceRegisterPage({ organizationId }: { readonly organizationId: string }): React.ReactElement {
  const [findings, setFindings] = useState<readonly VerifiedFindingProjection[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const query = new URLSearchParams({ organizationId });
    void fetch(`/workspace/verified-findings?${query.toString()}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('VERIFIED_FINDINGS_UNAVAILABLE');
      const envelope = await response.json() as { data?: unknown };
      return verifiedFindingListSchema.parse(envelope.data);
    }).then((rows) => {
      if (mounted) setFindings(rows);
    }).catch(() => {
      if (mounted) setFailed(true);
    });
    return () => { mounted = false; };
  }, [organizationId]);

  if (failed) return <section><h1 tabIndex={-1}>Evidence register</h1><p role="alert">Evidence findings are unavailable for this workflow.</p></section>;
  if (findings === null) return <section><h1 tabIndex={-1}>Evidence register</h1><p role="status">Loading assigned findings…</p></section>;
  if (findings.length === 0) return (
    <section>
      <h1 tabIndex={-1}>Evidence register</h1>
      <p>No findings assigned to the current internal verifier are available in this cooperative.</p>
      <p>Only current, assigned work is shown here.</p>
    </section>
  );

  return (
    <section aria-labelledby="evidence-register-heading">
      <h1 id="evidence-register-heading" tabIndex={-1}>Evidence register</h1>
      <p>Findings are shown from the current verifier’s assigned work. A positive verification requires a completed finding and complete provenance.</p>
      <ul aria-label="Assigned verification findings">
        {findings.map((finding) => (
          <li key={finding.findingId}>
            <details>
              <summary>
                Evidence item, version {finding.versionNumber}{' '}
                <span className={finding.verified ? 'finding-status finding-status-positive' : 'finding-status'}>
                  {finding.verified ? 'Cooperative-verified (internal)' : nonPositiveLabel(finding.outcome)}
                </span>
              </summary>
              {finding.verified ? (
                <dl>
                  <div><dt>Verified by</dt><dd>{finding.verifierName} — {finding.verifierOffice}</dd></div>
                  <div><dt>Scope</dt><dd>{finding.scope}</dd></div>
                  <div><dt>Evidence version</dt><dd>{finding.versionNumber}</dd></div>
                  <div><dt>Assurance class</dt><dd>{finding.assuranceLabel}</dd></div>
                  <div><dt>Finding recorded</dt><dd><time dateTime={finding.findingAt}>{new Date(finding.findingAt).toLocaleString()}</time></dd></div>
                  <div><dt>Office effective from</dt><dd><time dateTime={finding.officeEffectiveAt!}>{new Date(finding.officeEffectiveAt!).toLocaleDateString()}</time></dd></div>
                </dl>
              ) : (
                <p role="status">This finding does not qualify for a positive verified result.</p>
              )}
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function nonPositiveLabel(outcome: VerifiedFindingProjection['outcome']): string {
  if (outcome === 'does_not_support_claim') return 'Claim not supported';
  if (outcome === 'inconclusive') return 'Inconclusive';
  if (outcome === 'supports_claim') return 'Provenance incomplete';
  return 'No qualified result';
}
