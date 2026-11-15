/** Normalize only formatting and the owning relation qualification emitted by PostgreSQL. */
export function canonicalPostgresPolicyExpression(
  expression: string,
  relationSchema: string,
  relationTable: string,
): string {
  const rawTokens = expression.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9$]*|\s+|./gs) ?? [];
  const tokens: string[] = [];
  for (const raw of rawTokens) {
    if (/^\s+$/.test(raw)) continue;
    if (raw.startsWith('"')) {
      const identifier = raw.slice(1, -1).replaceAll('""', '"');
      tokens.push(/^[a-z_][a-z0-9_$]*$/.test(identifier) ? identifier : `quoted:${identifier}`);
    } else if (raw.startsWith("'")) {
      tokens.push(raw);
    } else {
      tokens.push(/^[A-Za-z_][A-Za-z_0-9$]*$/.test(raw) ? raw.toLowerCase() : raw);
    }
  }

  const canonical: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (
      tokens[index] === relationSchema.toLowerCase()
      && tokens[index + 1] === '.'
      && tokens[index + 2] === relationTable.toLowerCase()
      && tokens[index + 3] === '.'
    ) {
      canonical.push('$row', '.');
      index += 2;
    } else {
      canonical.push(tokens[index]!);
    }
  }
  return canonical.join('');
}

/** Compare classified and manifested tenant table sets without hiding duplicates. */
export function tenantPolicyTableSetErrors(expectedTables: string[], actualTables: string[]): string[] {
  const errors: string[] = [];
  const expected = new Set(expectedTables);
  const actual = new Set(actualTables);

  for (const table of [...expected].sort()) {
    if (!actual.has(table)) errors.push(`missing tenant policy entry: ${table}`);
  }
  for (const table of [...actual].sort()) {
    if (!expected.has(table)) errors.push(`unexpected tenant policy entry: ${table}`);
  }

  const actualCounts = new Map<string, number>();
  for (const table of actualTables) actualCounts.set(table, (actualCounts.get(table) ?? 0) + 1);
  for (const [table, count] of [...actualCounts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (count > 1) errors.push(`duplicate tenant policy entry: ${table}`);
  }
  return errors;
}
