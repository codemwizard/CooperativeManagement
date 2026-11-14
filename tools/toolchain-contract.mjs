export function validateToolchain({
  expected,
  packageJson,
  lockfile,
  nvmrc,
  readme,
  workflow,
  compose,
  actualNode,
  actualNpm,
}) {
  const failures = [];
  const rootLock = lockfile.packages?.[''];
  if (nvmrc.trim() !== expected.node) failures.push('.nvmrc');
  if (packageJson.packageManager !== `npm@${expected.npm}`) failures.push('package.json packageManager');
  if (packageJson.engines?.node !== `>=${expected.node} <27`) failures.push('package.json Node engine');
  const npmNextMajor = Number(expected.npm.split('.')[0]) + 1;
  if (packageJson.engines?.npm !== `>=${expected.npm} <${npmNextMajor}`) failures.push('package.json npm engine');
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
  if (!workflow.includes(`npm@${expected.npm}`)) failures.push('CI npm version pin');
  if (!workflow.includes('npm --version')) failures.push('CI must verify the installed npm runtime');
  if (/npm\s+install\s+--global\s+npm@/i.test(workflow)) failures.push('CI must use the installed npm runtime, not install npm globally');
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
