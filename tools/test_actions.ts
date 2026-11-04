import { baselineCases, meta } from '../src/engine/data';
import { applyAction } from '../src/engine/actions';

const demoActionAt = `${meta.demo_date}T09:00:00Z`;

// Test 1: PFI Credit Officer record_outcome on case-1
const targetCase = JSON.parse(JSON.stringify(baselineCases[0]));
targetCase.presentation = {
  destination: 'A',
  presented_on: demoActionAt.slice(0, 10),
  snapshot: null,
};
const actorPfi = { role: 'pfi_credit', user_id: 'pfi.credit1' };
const resOutcome = applyAction(targetCase, {
  type: 'record_outcome',
  outcome: 'approved',
  destination: 'A',
  note: 'Commercial credit assessment conducted by PFI Credit Officer.'
}, actorPfi, demoActionAt);

console.log('record_outcome result:', resOutcome.ok, (resOutcome as any).code);

// Test 2: VVB record_verification_finding on case-1
const actorVvb = { role: 'verifier', user_id: 'vrf.mulenga' };
const resVvb = applyAction(targetCase, {
  type: 'record_verification_finding',
  assignment_id: 'asg-reg-001',
  result: 'verified',
  scope: 'Full statutory registry query at PACRA.',
  limitation: 'Scope limited to registered cooperative entities.',
}, actorVvb, demoActionAt);

console.log('record_verification_finding result:', resVvb.ok, (resVvb as any).code);

// Test 3: TA assign_verification on case-1
const actorTa = { role: 'ta', user_id: 'ta.officer1' };
const resTa = applyAction(targetCase, {
  type: 'assign_verification',
  target: { kind: 'evidence', ref: 'registration' },
  assigned_to: 'vrf.mulenga',
  scope: 'TA gap remediation: independent verification of registration',
}, actorTa, demoActionAt);

console.log('assign_verification result:', resTa.ok, (resTa as any).code);
