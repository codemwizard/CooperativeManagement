const SCHEMA_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/** Migrations currently target the architecture's canonical `symphony` schema. */
export function assertMigrationSchema(schema: string): 'symphony' {
  if (!SCHEMA_IDENTIFIER.test(schema) || schema !== 'symphony') {
    throw new Error('DATABASE_SCHEMA must be exactly "symphony" for this migration set.');
  }
  return 'symphony';
}

/** Quote an already validated PostgreSQL identifier. */
export function quoteMigrationSchema(schema: string): '"symphony"' {
  assertMigrationSchema(schema);
  return '"symphony"';
}

export function isMigrationFilename(name: string): boolean {
  return /^\d{4}[a-z]?_[a-z0-9_]+\.sql$/.test(name);
}
