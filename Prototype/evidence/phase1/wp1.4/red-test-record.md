# WP1.4 red test record

Before the production changes, the new domain stale-command assertion failed as intended: the persisted receipt was classified as `committed_success`, while the expected classification was `terminal_rejection`.

The raw terminal output was not saved at that point. This record preserves the observed assertion and limitation; it is not a substitute for the missing raw red-run log. The final green domain and PostgreSQL logs are retained alongside this record.

The WP3.6 provider-preparation assertions were also run red before adding the versioned envelope and metadata: the ciphertext did not begin with the expected `SFE1` marker, and `LocalDevKeyProvider.metadata` was absent. The exact red command output was not retained; the passing rerun is in `domain-tests.log`.
