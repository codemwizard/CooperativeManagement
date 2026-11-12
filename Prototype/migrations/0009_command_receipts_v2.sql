-- WP1.1: replace the historical globally-unique/raw-payload receipt with the
-- immutable, tenant-scoped, versioned receipt contract. This migration is
-- forward-only and refuses to reinterpret any existing receipt data.
DO $$
BEGIN
  IF to_regclass('symphony.command_receipts') IS NULL THEN
    RAISE EXCEPTION 'WP1.1 migration requires symphony.command_receipts from 0001_kernel.sql';
  END IF;

  IF EXISTS (SELECT 1 FROM symphony.command_receipts LIMIT 1) THEN
    RAISE EXCEPTION 'WP1.1 cannot migrate non-empty command_receipts; preserve the data and obtain an approved, tested legacy-receipt migration plan before applying 0009';
  END IF;
END
$$;

DROP INDEX IF EXISTS symphony.command_receipts_tenant_id_occurred_at_idx;
ALTER TABLE symphony.command_receipts
  DROP CONSTRAINT command_receipts_pkey;

ALTER TABLE symphony.command_receipts
  RENAME COLUMN type TO command_type;

ALTER TABLE symphony.command_receipts
  DROP COLUMN payload,
  DROP COLUMN occurred_at,
  DROP COLUMN device_id,
  DROP COLUMN expected_version,
  DROP COLUMN result;

ALTER TABLE symphony.command_receipts
  ALTER COLUMN recorded_at SET DEFAULT now(),
  ALTER COLUMN recorded_at SET NOT NULL,
  ADD COLUMN command_schema_version TEXT NOT NULL,
  ADD COLUMN canonicalization_version TEXT NOT NULL
    CHECK (canonicalization_version = 'jcs-rfc8785-v1'),
  ADD COLUMN digest_key_version TEXT NOT NULL,
  ADD COLUMN semantic_digest BYTEA NOT NULL
    CHECK (octet_length(semantic_digest) = 32),
  ADD COLUMN result_classification TEXT NOT NULL
    CHECK (result_classification IN ('committed_success', 'terminal_rejection')),
  ADD COLUMN result_schema_version TEXT NOT NULL
    CHECK (result_schema_version = 'command-result-v1'),
  ADD COLUMN safe_result JSONB NOT NULL
    CHECK (jsonb_typeof(safe_result) = 'object'),
  ADD CONSTRAINT command_receipts_pkey PRIMARY KEY (tenant_id, command_id);

