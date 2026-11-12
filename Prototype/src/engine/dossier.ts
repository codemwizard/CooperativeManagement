import { evaluate } from './evaluate';
import type { CaseState, Destination } from './types';

const boundaryStatement =
  'Symphony establishes and governs readiness evidence; the financing institution establishes creditworthiness and makes the financing decision.';
const note = 'Export of the readiness record. Not mapped to any institution\'s system.';

export function buildDossier(caseState: CaseState, destination: Destination, demoDate: string, source: 'presented_snapshot' | 'live_state' = 'live_state') {
  const snapshot = source === 'presented_snapshot' ? (caseState.presentation as { snapshot?: ReturnType<typeof evaluate> } | null)?.snapshot : null;
  const readiness = snapshot ?? evaluate(caseState, destination, demoDate);
  return {
    export_version: 1,
    illustrative: true,
    boundary_statement: boundaryStatement,
    note,
    destination: { display_name: destination.display_name, product: destination.product },
    generated_from: source,
    case: { id: caseState.id, name: caseState.name, district: caseState.district, programme: caseState.programme },
    project: caseState.project,
    readiness: readiness.summary,
    requirements: readiness.requirements.map((requirement) => {
      const evidence = requirement.evidence_ref ? caseState.evidence[requirement.evidence_ref] : undefined;
      const finding = caseState.verification.findings.find((candidate) =>
        caseState.verification.assignments.some(
          (assignment) => assignment.id === candidate.assignment_id && assignment.target.kind === 'evidence' && assignment.target.ref === requirement.evidence_ref,
        ),
      );
      const disputesForEvidence = caseState.disputes.filter((dispute) => dispute.evidence_type === requirement.evidence_ref);
      const preferredDispute =
        disputesForEvidence.find((dispute) => dispute.status === 'open') ?? [...disputesForEvidence].reverse().find((dispute) => dispute.status);
      return {
        ...requirement,
        supplied_by: evidence?.supplied_by ?? null,
        supplied_on: evidence?.supplied_on ?? null,
        verified_by: evidence?.verified_by ?? null,
        verified_on: evidence?.verified_on ?? null,
        limitation: evidence?.limitation ?? null,
        dispute_status: preferredDispute?.status ?? null,
        finding_result: finding?.result ?? null,
      };
    }),
    disputes: caseState.disputes,
    findings: caseState.verification.findings,
    reliance: caseState.verification.reliance,
    limitations_summary: readiness.requirements
      .map((requirement) => (requirement.evidence_ref ? caseState.evidence[requirement.evidence_ref]?.limitation : null))
      .filter(Boolean),
  };
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function dossierToCsv(dossier: ReturnType<typeof buildDossier>): string {
  const columns = [
    'requirement_id',
    'title',
    'state',
    'applicability_reason',
    'evidence_type',
    'evidence_level',
    'supplied_by',
    'supplied_on',
    'verified_by',
    'verified_on',
    'limitation',
    'dispute_status',
    'finding_result',
  ];
  const rows = dossier.requirements.map((requirement) =>
    [
      requirement.id,
      requirement.title,
      requirement.state,
      requirement.reason,
      requirement.evidence_ref,
      requirement.effective_level,
      requirement.supplied_by,
      requirement.supplied_on,
      requirement.verified_by,
      requirement.verified_on,
      requirement.limitation,
      requirement.dispute_status,
      requirement.finding_result,
    ]
      .map(csvEscape)
      .join(','),
  );
  return [columns.join(','), ...rows].join('\n');
}
