# WP1.5 + WP2.2 integration and verification record

Integration branch: codex/wp1.5-reestablished

WP2.2 merge commit: 62443bf2811e8acfcd16e214514c6f95b7d024c6
- First parent (WP1.5 spine): f2ccf236a3150767c1549914ad39b29a5e9850f5
- Second parent (WP2.2 exact branch): b8622228ab4018ed65cfa49100da54205772eeaa

WP2.2 exact integrated source candidate: 5c5c730843ba3b5627a5389383496b9653caae04. WP1.5 gate SHA 6f145875761a2c356bab790324c8a5615ec03652 and WP2.1 implementation SHA 15d0ec2d67ae0274a3df522e56be48fb05aa06f5 are ancestors. The WP2.1 task record now names its immutable implementation SHA; its policy source and matrix-verifier files are unchanged through the integration candidate. Focused matrix/mutation and policy/capacity tests were rerun and retained.

Exact integrated-source checks passed: Fastify/PostgreSQL API 25/25; migration gate 17/17; app-role RLS 5/5 across all 44 manifested PostgreSQL tenant policy expressions; V4 typecheck; architecture (160 modules, 347 dependencies, no violations). RLS ran against isolated PostgreSQL 18 test database symphony_wp22_d5a7a4827b18_test with the intended restricted application role and test-admin setup. npm was v12.2.0. Raw logs are referenced in task-evidence.json.

The gate status stays pending until the authoritative exact-candidate preflight passes. Implementation completion, integration-test results and gate verification are recorded separately. No session, CSRF, forced-change, or rate-limit work was performed as part of WP2.2.

The merge is local to codex/wp1.5-reestablished; it has not been pushed or merged into main. The separate dirty WP6.1 worktree was not used.
