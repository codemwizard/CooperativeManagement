# WP1.5 CI follow-up review

## Inputs reviewed

This review is based on the CI output pasted by the project owner. No GitHub Actions status or artifact query was made.

The pasted run reports:

1. `verify:toolchain` failed because the hosted Node 26.7.0 runner's installed npm was `11.19.0`, while the repository contract requires `12.2.0`.
2. The reviewer identified that GitHub's unspecified Linux run shell is not equivalent to explicit `shell: bash` for pipeline status: the `tee` pipelines in DB and legacy jobs could return tee's success while masking the command's failure.

## Corrections made in the worktree

### CI-6: deterministic npm version without a global install

- Added `tools/prepare_ci_npm.sh`.
- It reads the required Node/npm versions from `toolchain.json`, rejects a Node mismatch, installs npm `12.2.0` only under `$RUNNER_TEMP/symphony-npm`, invokes that exact CLI to verify its version, then adds its local `.bin` directory to `$GITHUB_PATH` for subsequent steps.
- Added the preparation step to all three workflow jobs before npm version verification and `npm ci`.
- Extended `tools/verify_toolchain.mjs` and `tools/toolchain-contract.mjs` to validate the helper's local-prefix install, direct version check, workflow invocation, and the absence of global npm installation.

### CI-7: preserve failures across `tee`

- Added workflow-wide `defaults.run.shell: bash`; every workflow `run` step now uses GitHub's explicit Bash shell with `-e -o pipefail`.
- Added contracts that require the Bash default and all seven evidence-capturing `tee` pipelines.
- Added a functional failure-propagation test that runs `node` exit 23 through `bash --noprofile --norc -e -o pipefail` and `tee`. The test runs on Linux CI; it is skipped on Windows because the available `bash.exe` is a WSL shim and is denied by the local host.

## Local checks

- `npm run test:toolchain`: passed, 4/4, including rejection of global npm installation.
- `npm run test:phase0-contract`: passed, 10 passed and 1 Linux-only pipeline test skipped on Windows.
- `npm run verify:toolchain`: passed with Node `26.7.0`, npm `12.2.0`, and PostgreSQL `18.0` package build `18.0-2`.
- `git diff --check`: passed.

The functional Bash pipeline regression was not executed on this Windows host. It is deliberately enabled on Linux CI, which is the environment whose shell semantics were implicated in the report. No CI pass is claimed for these follow-up changes. The previous pushed candidate does not include this follow-up worktree state.

## Required follow-up

Commit these fixes and run CI on that exact candidate. Confirm the npm preparation reports `12.2.0`, and that a failing logged command makes the owning job fail while preserving its raw log. Only then reconcile the WP1.5 task record; do not infer CI success from the earlier candidate's local tests.
