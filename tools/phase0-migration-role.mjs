const REQUIRED_ROLE_ATTRIBUTES = {
  symphony_migrator: { rolcanlogin: true, rolinherit: false },
  symphony_app: { rolcanlogin: true, rolinherit: false },
  symphony_outbox_writer: { rolcanlogin: false, rolinherit: false },
};

export function assertPhase0MigrationAdminIdentity(identity) {
  if (!identity || typeof identity.database_name !== 'string' || !identity.database_name.endsWith('_test')) {
    throw new Error('Migration gate requires an isolated *_test database.');
  }
  if (Math.floor(Number(identity.server_version_num) / 10000) !== 18) {
    throw new Error('Migration gate requires PostgreSQL 18.');
  }
  if (identity.rolsuper !== true) {
    throw new Error('Migration gate requires a PostgreSQL superuser administrator for disposable database and role isolation.');
  }
}

export function migrationRoleNeedsBootstrap({ migrationUrlUsername, migratorCanSetWriter }) {
  return migrationUrlUsername !== 'symphony_migrator' || migratorCanSetWriter !== true;
}

export function migrationRoleUrl(adminUrl, password) {
  const url = new URL(adminUrl);
  url.username = 'symphony_migrator';
  url.password = password;
  return url.toString();
}

export function roleContractErrors(name, role) {
  const expected = REQUIRED_ROLE_ATTRIBUTES[name];
  if (!expected) return [`Unexpected role in migration role contract: ${name}`];
  const errors = [];
  for (const [attribute, value] of Object.entries(expected)) {
    if (role[attribute] !== value) errors.push(`${name} must be ${value ? '' : 'NO'}${attribute === 'rolcanlogin' ? 'LOGIN' : 'INHERIT'}`);
  }
  for (const attribute of ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolbypassrls']) {
    if (role[attribute] !== false) errors.push(`${name} must not have ${attribute}`);
  }
  return errors;
}
