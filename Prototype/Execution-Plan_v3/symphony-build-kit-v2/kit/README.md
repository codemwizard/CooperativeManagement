# Symphony Prototype Build Kit

Hand this folder to Claude Code. It reads `CLAUDE.md` first.

1. `python3 tools/reference_oracle.py` must print OK before any coding.
2. Build in phase order (CLAUDE.md section 6). Stop at each gate.
3. All data is fictional. No real lender names may appear in the built app.

Contents: `CLAUDE.md` (instructions), `data/` (requirements, cases, roles, extension content),
`tests/TEST_CASES.md` and `tests/expected-results.json` (written tests and expected results),
`tools/reference_oracle.py` (independent cross-check, not the app engine).
