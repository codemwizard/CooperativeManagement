import { canonicalSha256 } from './crypto';

export interface RegisteredArtefact {
  id: string;
  claim_types: string[]; // compatible evidence/claim types
  content: string;
  expected_digest: string;
  title?: string;
}

const DEFAULT_ARTEFACTS: RegisteredArtefact[] = [
  {
    id: 'doc-ear-tags-2026',
    claim_types: ['livestock_claim', 'livestock_count'],
    content: 'Chisamba Livestock Ear Tag Register 2026 - Tagged 500 Head',
    expected_digest: canonicalSha256('Chisamba Livestock Ear Tag Register 2026 - Tagged 500 Head'),
    title: 'Ear Tag Registry 2026',
  },
  {
    id: 'doc-vet-inspection-2026',
    claim_types: ['livestock_claim', 'livestock_count'],
    content: 'Veterinary Department Herd Health Inspection Certificate 2026',
    expected_digest: canonicalSha256('Veterinary Department Herd Health Inspection Certificate 2026'),
    title: 'Veterinary Inspection Certificate 2026',
  },
  {
    id: 'doc-land-tenure-2026',
    claim_types: ['land_right', 'land_tenure', 'land'],
    content: 'Chief Customary Land Allocation Boundary Document 2026',
    expected_digest: canonicalSha256('Chief Customary Land Allocation Boundary Document 2026'),
    title: 'Customary Land Right Certificate 2026',
  },
  {
    id: 'doc-pacra-filing-2026',
    claim_types: ['regulatory_filing', 'registration'],
    content: 'PACRA Annual Return Receipt & Statutory Status 2026',
    expected_digest: canonicalSha256('PACRA Annual Return Receipt & Statutory Status 2026'),
    title: 'PACRA Filing 2026',
  },
  {
    id: 'doc-agm-minutes-2026',
    claim_types: ['governance', 'resolution', 'minutes'],
    content: 'Annual General Meeting Signed Minutes & Resolutions 2026',
    expected_digest: canonicalSha256('Annual General Meeting Signed Minutes & Resolutions 2026'),
    title: 'AGM Resolution Minutes 2026',
  },
];

let registry = new Map<string, RegisteredArtefact>();

export function resetArtefactRegistry(): void {
  registry = new Map<string, RegisteredArtefact>();
  for (const art of DEFAULT_ARTEFACTS) {
    registry.set(art.id, { ...art });
  }
}

// Initialize on load
resetArtefactRegistry();

export function registerArtefact(artefact: RegisteredArtefact): void {
  registry.set(artefact.id, { ...artefact });
}

export function getRegisteredArtefact(id: string): RegisteredArtefact | undefined {
  return registry.get(id);
}

export type ArtefactValidationResult =
  | { ok: true; artefact: RegisteredArtefact }
  | { ok: false; code: 'ARTEFACT_NOT_FOUND' | 'INTEGRITY_MISMATCH' | 'ARTEFACT_NOT_ADMISSIBLE'; message: string };

export function validateSupportingArtefact(
  artefactId: string,
  evidenceType: string,
  providedHash?: string
): ArtefactValidationResult {
  const artefact = registry.get(artefactId);
  if (!artefact) {
    return {
      ok: false,
      code: 'ARTEFACT_NOT_FOUND',
      message: `Artefact ${artefactId} not found in registered repository.`,
    };
  }

  // Verify digest against computed content digest
  const computed = canonicalSha256(artefact.content);
  if (computed !== artefact.expected_digest) {
    return {
      ok: false,
      code: 'INTEGRITY_MISMATCH',
      message: `Artefact ${artefactId} content digest mismatch (stored digest does not match content).`,
    };
  }

  if (providedHash && providedHash !== artefact.expected_digest) {
    return {
      ok: false,
      code: 'INTEGRITY_MISMATCH',
      message: `Artefact ${artefactId} caller digest mismatch: expected ${artefact.expected_digest}, got ${providedHash}.`,
    };
  }

  // Verify claim linkage
  if (!artefact.claim_types.includes(evidenceType) && !artefact.claim_types.includes('*')) {
    return {
      ok: false,
      code: 'ARTEFACT_NOT_ADMISSIBLE',
      message: `Artefact ${artefactId} is admissible for [${artefact.claim_types.join(', ')}], not [${evidenceType}].`,
    };
  }

  return { ok: true, artefact };
}
