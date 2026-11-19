# Candidate toolchain limitation

The Phase 1 baseline pins Node 26.7.0 and npm 12.2.0. The global npm 12.2.0 installation is in the roaming npm prefix, outside the standard shell PATH and denied to the sandbox. The toolchain was verified by prepending that prefix in the approved shell; `npm-version.log` records `12.2.0`.

The owner had previously directed upgrading npm to 12.2.0. An elevated `npm.cmd install --global npm@12.2.0` completed with “changed 10 packages.” The standard sandboxed command continues to find the Node-bundled 11.19.0 CLI because it does not search the roaming prefix. The approved elevated shell used `PATH=C:\Users\User\AppData\Roaming\npm;...` and confirmed 12.2.0.

All refreshed checks in this evidence package were rerun under npm 12.2.0. Exact-candidate gate verification remains pending until the implementation is committed and the exact-candidate verifier passes.
