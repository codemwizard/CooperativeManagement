export type ChipDescriptor = { cls: string; label: string };

/** Requirement state -> chip. Shapes differ (solid, half, diamond, dashed) so state never relies on colour alone. */
export function requirementChip(state: string): ChipDescriptor {
  if (state === 'satisfied') return { cls: 'ev-v', label: 'Met' };
  if (state === 'unresolved') return { cls: 'ev-u', label: 'Unresolved' };
  if (state === 'exception') return { cls: 'ev-r', label: 'Exception' };
  if (state === 'not_applicable') return { cls: 'ev-m', label: 'Not applicable' };
  return { cls: 'ev-m', label: 'At assessment' };
}

/** Evidence level -> chip. */
export function levelChip(level: string): ChipDescriptor {
  if (level === 'verified') return { cls: 'ev-v', label: 'Verified' };
  if (level === 'supported') return { cls: 'ev-u', label: 'Supported' };
  return { cls: 'ev-m', label: 'Asserted' };
}

/** NABII four-state pipeline classification -> chip. */
export function pipelineChip(state: string): ChipDescriptor {
  if (state === 'assessment_ready') return { cls: 'ev-v', label: 'Assessment ready' };
  if (state === 'evidence_progressing') return { cls: 'ev-u', label: 'Evidence progressing' };
  if (state === 'remediation_required') return { cls: 'ev-r', label: 'Remediation required' };
  return { cls: 'ev-m', label: 'Initial record' };
}
