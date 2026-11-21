-- REM-WP2.6: frozen global and actor scopes must be row-lockable as part of a
-- complete authority mutation lock set, but never writable by symphony_app.
-- PostgreSQL evaluates UPDATE-policy visibility for SELECT row-lock clauses.
CREATE POLICY authority_scope_versions_frozen_lock
  ON symphony.authority_scope_versions
  FOR UPDATE TO symphony_app
  USING (scope_type IN ('global_policy', 'actor'))
  WITH CHECK (false);
