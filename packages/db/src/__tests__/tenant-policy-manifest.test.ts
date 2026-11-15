import { describe, expect, it } from 'vitest';
import { canonicalPostgresPolicyExpression, tenantPolicyTableSetErrors } from '../testing/tenant-policy-manifest.js';

describe('WP1.5 tenant policy manifest oracle helpers', () => {
  it('canonicalizes only PostgreSQL deparser whitespace and the target relation name', () => {
    const actual = "((symphony.person_identifiers.person_id = p.id) AND ((p.tenant_id)::text = NULLIF(current_setting('app.tenant_id'::text, true), ''::text)))";
    const expected = "( (_wp15_oracle.person_identifiers.person_id=p.id) AND ((p.tenant_id)::text= NULLIF(current_setting('app.tenant_id'::text,true),''::text)) )";

    expect(canonicalPostgresPolicyExpression(actual, 'symphony', 'person_identifiers'))
      .toBe(canonicalPostgresPolicyExpression(expected, '_wp15_oracle', 'person_identifiers'));
  });

  it('does not normalize a changed tenant setting, operator, or parent relationship', () => {
    const expected = "((symphony.person_identifiers.person_id = p.id) AND ((p.tenant_id)::text = NULLIF(current_setting('app.tenant_id'::text, true), ''::text)))";

    expect(canonicalPostgresPolicyExpression(expected.replace('app.tenant_id', 'app.other_tenant'), 'symphony', 'person_identifiers'))
      .not.toBe(canonicalPostgresPolicyExpression(expected, 'symphony', 'person_identifiers'));
    expect(canonicalPostgresPolicyExpression(expected.replace(' = p.id', ' <> p.id'), 'symphony', 'person_identifiers'))
      .not.toBe(canonicalPostgresPolicyExpression(expected, 'symphony', 'person_identifiers'));
    expect(canonicalPostgresPolicyExpression(expected.replace('p.id', 'p.person_id'), 'symphony', 'person_identifiers'))
      .not.toBe(canonicalPostgresPolicyExpression(expected, 'symphony', 'person_identifiers'));
  });

  it('requires exact table-set equality and identifies missing, unexpected, and duplicate tables', () => {
    expect(tenantPolicyTableSetErrors(['a', 'b'], ['b', 'a'])).toEqual([]);
    expect(tenantPolicyTableSetErrors(['a', 'b'], ['a', 'c', 'c'])).toEqual([
      'missing tenant policy entry: b',
      'unexpected tenant policy entry: c',
      'duplicate tenant policy entry: c',
    ]);
  });
});
