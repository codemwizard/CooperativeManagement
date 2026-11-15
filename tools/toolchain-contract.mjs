export function validateToolchain({
  expected,
  packageJson,
  lockfile,
  nvmrc,
  readme,
  workflow,
  compose,
  ciNpmSetup,
  actualNode,
  actualNpm,
}) {
  const failures = [];
  const rootLock = lockfile.packages?.[''];
  if (nvmrc.trim() !== expected.node) failures.push('.nvmrc');
  if (packageJson.packageManager !== `npm@${expected.npm}`) failures.push('package.json packageManager');
  if (packageJson.engines?.node !== `>=${expected.node} <27`) failures.push('package.json Node engine');
  if (packageJson.engines?.npm !== expected.npm) failures.push('package.json npm engine');
  if (rootLock?.engines?.node !== packageJson.engines.node) failures.push('package-lock.json Node engine');
  if (rootLock?.engines?.npm !== packageJson.engines.npm) failures.push('package-lock.json npm engine');
  if (!readme.includes(`Node.js ${expected.node}`)) failures.push('README Node version');
  if (!readme.includes(`npm ${expected.npm}`)) failures.push('README npm version');
  if (!readme.includes(`PostgreSQL ${expected.postgresqlVersion}`)) failures.push('README PostgreSQL version');
  if (expected.postgresqlPackageVersion && !readme.includes(`package build ${expected.postgresqlPackageVersion}`)) {
    failures.push('README PostgreSQL package build');
  }

  const ciNodeVersions = [...workflow.matchAll(/node-version:\s*['"]?([^\s'"#]+)/g)].map((match) => match[1]);
  if (ciNodeVersions.length === 0 || ciNodeVersions.some((version) => version !== expected.node)) {
    failures.push('CI Node versions');
  }
  if (!workflow.includes('bash tools/prepare_ci_npm.sh')) failures.push('CI must prepare the pinned local npm CLI');
  const ciNpmSetupCount = [...workflow.matchAll(/run:\s*bash tools\/prepare_ci_npm\.sh/g)].length;
  if (ciNpmSetupCount !== ciNodeVersions.length) failures.push('Every CI Node job must prepare its pinned local npm CLI');
  if (!workflow.includes('npm --version')) failures.push('CI must verify the installed npm runtime');
  if (/npm\s+install\s+(?:--global|-g)\s+npm@/i.test(workflow)) failures.push('CI must use the installed npm runtime, not install npm globally');
  if (!ciNpmSetup?.includes('npm install --prefix "$npm_root" --no-save --no-package-lock "npm@$expected_npm"')) {
    failures.push('CI npm must be installed under RUNNER_TEMP, not globally');
  }
  if (!ciNpmSetup?.includes('node "$npm_cli" --version') || !ciNpmSetup?.includes('>> "$GITHUB_PATH"')
      || !ciNpmSetup?.includes('NPM_BIN=%s/npm')
      || !ciNpmSetup?.includes('exec node "%s" "$@"')
      || !ciNpmSetup?.includes('npm_bin="$RUNNER_TEMP/symphony-npm/bin"')) {
    failures.push('CI npm setup must verify, wrap, and expose the exact local npm CLI');
  }
  if (!workflow.includes('test "$(command -v npm)" = "$NPM_BIN"')) {
    failures.push('CI must assert the npm executable path before running npm commands');
  }
  if (/npm\s+install\s+(?:--global|-g)\s+npm@/i.test(ciNpmSetup ?? '')) {
    failures.push('CI npm setup must never install npm globally');
  }
  if (!/^defaults:\s*\r?\n\s+run:\s*\r?\n\s+shell:\s*bash\s*$/m.test(workflow)) {
    failures.push('CI run steps must default to Bash with pipefail');
  }
  const ciPostgresVersions = [...workflow.matchAll(/image:\s*postgres:(\d+\.\d+(?:\.\d+)?)(?:-[^\s]+)?/g)].map((match) => match[1]);
  if (ciPostgresVersions.length === 0 || ciPostgresVersions.some((version) => version !== expected.postgresqlVersion)) {
    failures.push('CI PostgreSQL versions');
  }
  const postgresVersions = [...compose.matchAll(/image:\s*postgres:(\d+\.\d+(?:\.\d+)?)(?:-[^\s]+)?/g)].map((match) => match[1]);
  if (postgresVersions.length === 0 || postgresVersions.some((version) => version !== expected.postgresqlVersion)) {
    failures.push('Docker Compose PostgreSQL versions');
  }
  if (actualNode !== expected.node) failures.push(`running Node (${actualNode})`);
  if (actualNpm !== expected.npm) failures.push(`running npm (${actualNpm})`);
  return failures;
}
