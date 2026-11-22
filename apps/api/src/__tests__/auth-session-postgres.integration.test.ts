import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { PostgresCredentialRepository, PostgresVerifiedFindingRepository, PostgresWorkspaceContextRepository } from '@symphony/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthComposition } from '../authentication-composition.js';
import { buildApiServer } from '../server.js';
import { createWorkspaceContextRoutes } from '../routes/workspace-context.js';
import { createPostgresCommandComposition } from '../command-composition.js';
import { createCommandRoutes } from '../routes/commands.js';

// These are test credentials only. The dedicated disposable database is dropped
// after this suite; no local password or database URL is printed or persisted.
const localEnvPath = resolve(process.cwd(), '../../.env.local');
if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/.exec(line);
    if (match && process.env[match[1]!] === undefined) {
      process.env[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const adminUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
const migrationBaseUrl = process.env['MIGRATION_TEST_DATABASE_URL'];
const appBaseUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'];
const enabled = Boolean(adminUrl && migrationBaseUrl && appBaseUrl && process.env['DATA_MODE'] === 'test');

function runMigration(databaseUrl: string): Promise<{status:number|null;stdout:string;stderr:string}> {
  return new Promise((resolvePromise,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','packages/db/src/migrate.ts'],{
      cwd:resolve(process.cwd(),'../..'),
      env:{...process.env,DATABASE_URL:databaseUrl,DATABASE_SCHEMA:'symphony'},
      stdio:['ignore','pipe','pipe'],
    });
    let stdout='';let stderr='';
    child.stdout.setEncoding('utf8').on('data',(chunk:string)=>{stdout+=chunk;});
    child.stderr.setEncoding('utf8').on('data',(chunk:string)=>{stderr+=chunk;});
    child.once('error',reject);child.once('close',(status)=>resolvePromise({status,stdout,stderr}));
  });
}

function cookie(response:{headers:Record<string,unknown>}):string {
  const header=response.headers['set-cookie'];
  const first=typeof header==='string'?header:Array.isArray(header)&&typeof header[0]==='string'?header[0]:undefined;
  if(!first)throw new Error('Expected authentication cookie');
  return first.split(';',1)[0]!;
}

describe.skipIf(!enabled)('WP5.3 Fastify and PostgreSQL integration',()=>{
  let admin:pg.Pool;
  let isolatedAdmin:pg.Pool;
  let appPoolA:pg.Pool;
  let appPoolB:pg.Pool;
  let appA:import('fastify').FastifyInstance;
  let appB:import('fastify').FastifyInstance;
  let commandComposition:ReturnType<typeof createPostgresCommandComposition>|undefined;
  let isolatedDatabase:string|undefined;
  let isolatedUrl:string|undefined;
  let adminSecurityAttemptPolicyInstalled=false;
  let adminActorScopePolicyInstalled=false;
  let adminOutboxPolicyInstalled=false;
  let tenantId:string|undefined;
  let tenantB:string|undefined;
  let userId:string|undefined;
  let organizationId:string|undefined;
  let organizationB:string|undefined;
  let personId:string|undefined;
  let taScopeId:string;
  let hmacKey:Buffer;
  let temporaryCredential:string;
  const profile={runtimeProfile:'test' as const,appEnv:'test',dataMode:'test',publicOrigin:'http://localhost:5174',host:'127.0.0.1',port:3000};

  beforeAll(async()=>{
    if(!adminUrl||!migrationBaseUrl||!appBaseUrl)throw new Error('PostgreSQL integration URLs are required.');
    const adminIdentity=new URL(adminUrl);
    const sourceDatabase=decodeURIComponent(adminIdentity.pathname.replace(/^\//,''));
    if(!sourceDatabase.endsWith('_test'))throw new Error('Refusing WP5.3 integration setup outside a *_test database.');
    admin=new pg.Pool({connectionString:adminUrl,max:3});
    const randomSuffix=randomUUID().replaceAll('-','').slice(0,18);
    isolatedDatabase=`symphony_wp53_${randomSuffix}_test`;
    const quote=`"${isolatedDatabase.replaceAll('"','""')}"`;
    await admin.query(`CREATE DATABASE ${quote}`);
    const migrationRole=decodeURIComponent(new URL(migrationBaseUrl).username);
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(migrationRole))throw new Error('Migration URL role name is not a valid PostgreSQL identifier.');
    await admin.query(`GRANT CONNECT, CREATE ON DATABASE ${quote} TO "${migrationRole}"`);
    await admin.query(`GRANT CONNECT ON DATABASE ${quote} TO symphony_app`);
    const migrationUrl=new URL(migrationBaseUrl);migrationUrl.pathname=`/${isolatedDatabase}`;isolatedUrl=migrationUrl.toString();
    const migrated=await runMigration(isolatedUrl);
    if(migrated.status!==0)throw new Error(`WP5.3 isolated migration failed (${migrated.status}): ${migrated.stderr}\n${migrated.stdout}`);
    isolatedAdmin=new pg.Pool({connectionString:isolatedUrl,max:3});
    await isolatedAdmin.query(`DO $policy$
      BEGIN
        EXECUTE format('CREATE POLICY wp16_test_admin_actor_scope_bootstrap ON symphony.authority_scope_versions FOR INSERT TO %I WITH CHECK (scope_type=''actor'' AND tenant_id IS NULL)',current_user);
      END
      $policy$`);
    adminActorScopePolicyInstalled=true;
    await isolatedAdmin.query(`DO $policy$
      BEGIN
        EXECUTE format('CREATE POLICY wp16_test_admin_outbox_inspection ON symphony.event_outbox FOR SELECT TO %I USING (true)',current_user);
      END
      $policy$`);
    adminOutboxPolicyInstalled=true;
    await isolatedAdmin.query(`DO $policy$
      BEGIN
        EXECUTE format('CREATE POLICY wp16_test_admin_security_attempt_inspection ON symphony.security_attempts FOR SELECT TO %I USING (true)',current_user);
      END
      $policy$`);
    adminSecurityAttemptPolicyInstalled=true;
    const appUrl=new URL(appBaseUrl);appUrl.pathname=`/${isolatedDatabase}`;
    appPoolA=new pg.Pool({connectionString:appUrl.toString(),max:4});
    appPoolB=new pg.Pool({connectionString:appUrl.toString(),max:4});
    tenantId=randomUUID();userId=randomUUID();organizationId=randomUUID();personId=randomUUID();hmacKey=Buffer.alloc(32,0x53);
    await isolatedAdmin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)',[tenantId,'wp5.3-api-integration']);
    const fixture=await isolatedAdmin.connect();
    try {
      await fixture.query('BEGIN');
      await fixture.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      await fixture.query(
        `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
         VALUES($1,$2,$3,$3,'active')`,[userId,tenantId,`wp53-${userId}@example.invalid`],
      );
      await fixture.query("INSERT INTO symphony.authority_scope_versions(scope_type,tenant_id,scope_id) VALUES('actor',NULL,$1) ON CONFLICT DO NOTHING",[userId]);
      await fixture.query('COMMIT');
    } catch(error) { await fixture.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { fixture.release(); }
    tenantB=randomUUID();organizationB=randomUUID();
    await isolatedAdmin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)',[tenantB,'wp5.3-cross-tenant']);
    const crossTenantFixture=await isolatedAdmin.connect();
    try {
      await crossTenantFixture.query('BEGIN');
      await crossTenantFixture.query("SELECT set_config('app.tenant_id',$1,true)",[tenantB]);
      await crossTenantFixture.query("INSERT INTO symphony.organizations(id,tenant_id,name,status,organization_kind) VALUES($1,$2,'cross-tenant cooperative','active','cooperative')",[organizationB,tenantB]);
      await crossTenantFixture.query('COMMIT');
    } catch(error) { await crossTenantFixture.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { crossTenantFixture.release(); }
    const unionId=randomUUID();
    const membershipId=randomUUID();
    const roleId=randomUUID();
    const managerScopeId=randomUUID();
    taScopeId=randomUUID();
    const identityAdmin=await isolatedAdmin.connect();
    try {
      await identityAdmin.query('BEGIN');
      await identityAdmin.query('SELECT set_config(\'app.tenant_id\',$1,true)',[tenantId]);
      await identityAdmin.query('INSERT INTO symphony.persons(id,tenant_id,pseudonym_id) VALUES($1,$2,$3)',[personId,tenantId,`person-${personId}`]);
      await identityAdmin.query('INSERT INTO symphony.organizations(id,tenant_id,name,status,organization_kind) VALUES($1,$2,$3,\'active\',\'cooperative\'),($4,$2,$5,\'active\',\'union\')',[organizationId,tenantId,'WP2.2 cooperative',unionId,'WP2.2 union']);
      await identityAdmin.query(`INSERT INTO symphony.user_person_links(tenant_id,user_id,person_id,source_ref,linked_by_user_id)
        VALUES($1,$2,$3,'integration-fixture',$2)`,[tenantId,userId,personId]);
      await identityAdmin.query(`INSERT INTO symphony.organization_memberships(id,tenant_id,organization_id,person_id,status,joined_at,source_ref)
        VALUES($1,$2,$3,$4,'active',clock_timestamp()-interval '1 day','integration-fixture')`,[membershipId,tenantId,organizationId,personId]);
      await identityAdmin.query(`INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,source_ref)
        VALUES($1,$2,'00000000-0000-4000-8000-000000000003',clock_timestamp()-interval '1 hour','integration-fixture')`,[organizationId,personId]);
      await identityAdmin.query(`INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,source_ref)
        VALUES($1,$2,'00000000-0000-4000-8000-000000000001',clock_timestamp()-interval '1 hour','integration-fixture')`,[organizationId,personId]);
      await identityAdmin.query(`INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,ended_at,source_ref)
        VALUES($1,$2,'00000000-0000-4000-8000-000000000002',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour','expired-fixture')`,[organizationId,personId]);
      await identityAdmin.query(`INSERT INTO symphony.capacity_grants(user_id,organization_id,capacity_type,granted_by_user_id,granted_at,active_from)
        VALUES($1,$2,'internal_verifier',$1,clock_timestamp()-interval '1 hour',clock_timestamp()-interval '1 hour')`,[userId,organizationId]);
      await identityAdmin.query(`INSERT INTO symphony.capacity_grants(user_id,organization_id,capacity_type,granted_by_user_id,granted_at,active_from,revoked_at)
        VALUES($1,$2,'field_agent',$1,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')`,[userId,organizationId]);
      await identityAdmin.query('INSERT INTO symphony.platform_roles(id,code,name) VALUES($1,\'programme_manager\',\'Programme manager\')',[roleId]);
      await identityAdmin.query(`INSERT INTO symphony.user_role_assignments(user_id,platform_role_id,tenant_id,granted_at)
        VALUES($1,$2,$3,clock_timestamp()-interval '1 day')`,[userId,roleId,tenantId]);
      await identityAdmin.query(`INSERT INTO symphony.programme_manager_scopes(id,tenant_id,programme_manager_user_id,target_organization_id,scope_kind,granted_at,source_ref)
        VALUES($1,$2,$3,$4,'ta_delegation',clock_timestamp()-interval '1 day','integration-fixture')`,[managerScopeId,tenantId,userId,organizationId]);
      await identityAdmin.query(`INSERT INTO symphony.institutional_role_assignments(tenant_id,user_id,institution_organization_id,role_code,granted_at,source_ref)
        VALUES($1,$2,$3,'union_ta',clock_timestamp()-interval '1 day','integration-fixture')`,[tenantId,userId,unionId]);
      await identityAdmin.query(`INSERT INTO symphony.ta_scope_delegations(id,tenant_id,programme_manager_user_id,union_organization_id,delegatee_user_id,target_organization_id,granted_at,active_from,agreement_ref)
        VALUES($1,$2,$3,$4,$3,$5,clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 day','agreement-fixture')`,[taScopeId,tenantId,userId,unionId,organizationId]);
      await identityAdmin.query(`INSERT INTO symphony.enrolment_sessions(tenant_id,enroller_user_id,organization_id,started_at)
        VALUES($1,$2,$3,clock_timestamp()-interval '1 hour')`,[tenantId,userId,organizationId]);
      await identityAdmin.query('COMMIT');
    } catch(error) { await identityAdmin.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { identityAdmin.release(); }
    const credentialService=new CredentialLifecycleService({now:()=>new Date().toISOString()});
    const material=await credentialService.issueTemporaryCredential();temporaryCredential=material.plaintext;
    await new PostgresCredentialRepository(appPoolA).issueTemporaryCredential({
      credentialId:material.credentialId,tenantId,userId,secretHash:material.hash,
    });
    const authA=createAuthComposition({pool:appPoolA,config:profile,throttleHmacKey:hmacKey});
    const authB=createAuthComposition({pool:appPoolB,config:profile,throttleHmacKey:hmacKey});
    const contextA=createWorkspaceContextRoutes(new PostgresWorkspaceContextRepository(appPoolA),new PostgresVerifiedFindingRepository(appPoolA));
    const contextB=createWorkspaceContextRoutes(new PostgresWorkspaceContextRepository(appPoolB),new PostgresVerifiedFindingRepository(appPoolB));
    const isolatedAppUrl=new URL(appBaseUrl);isolatedAppUrl.pathname=`/${isolatedDatabase}`;
    commandComposition=createPostgresCommandComposition({
      ...process.env, DATABASE_URL:isolatedAppUrl.toString(), COMMAND_DIGEST_HMAC_KEY:Buffer.alloc(32,0x44).toString('base64'),
      NODE_ENV:'test', DATA_MODE:'test', SYNTHETIC_ONLY:'true',
    });
    appA=buildApiServer({config:profile,routes:{authentication:authA.authentication,verifyCsrf:authA.verifyCsrf,authorize:authA.authorize,rotateSession:authA.rotateSession,workspace:contextA,commands:createCommandRoutes(commandComposition)}});
    appB=buildApiServer({config:profile,routes:{authentication:authB.authentication,verifyCsrf:authB.verifyCsrf,authorize:authB.authorize,rotateSession:authB.rotateSession,workspace:contextB}});
    await Promise.all([appA.ready(),appB.ready()]);
  },60_000);

  afterAll(async()=>{
    await appA?.close().catch(()=>undefined);await appB?.close().catch(()=>undefined);
    await commandComposition?.close().catch(()=>undefined);
    await appPoolA?.end().catch(()=>undefined);await appPoolB?.end().catch(()=>undefined);
    await isolatedAdmin?.end().catch(()=>undefined);
    if(admin&&isolatedDatabase){
      if(adminSecurityAttemptPolicyInstalled)await isolatedAdmin?.query('DROP POLICY IF EXISTS wp16_test_admin_security_attempt_inspection ON symphony.security_attempts').catch(()=>undefined);
      if(adminActorScopePolicyInstalled)await isolatedAdmin?.query('DROP POLICY IF EXISTS wp16_test_admin_actor_scope_bootstrap ON symphony.authority_scope_versions').catch(()=>undefined);
      if(adminOutboxPolicyInstalled)await isolatedAdmin?.query('DROP POLICY IF EXISTS wp16_test_admin_outbox_inspection ON symphony.event_outbox').catch(()=>undefined);
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[isolatedDatabase]).catch(()=>undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${isolatedDatabase.replaceAll('"','""')}"`).catch(()=>undefined);
    }
    await admin?.end().catch(()=>undefined);
  },30_000);

  it('runs temp login, forced-change denial, all-session revocation and fresh login through the actual app-role database path',async()=>{
    const csrf=await appA.inject({method:'GET',url:'/auth/csrf'});
    const login=await appA.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(csrf),origin:profile.publicOrigin,'x-csrf-token':csrf.json<{csrfToken:string}>().csrfToken},payload:{userId,credential:temporaryCredential,deviceId:'postgres-browser'}});
    expect(login.statusCode).toBe(200);expect(login.json()).toEqual({forcedChangeRequired:true});
    expect((await appA.inject({method:'GET',url:'/workspace/context',headers:{cookie:cookie(login)}})).statusCode).toBe(403);
    const eventClient=await isolatedAdmin.connect();
    try {
      await eventClient.query('BEGIN');
      await eventClient.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      const event=await eventClient.query<{method:string;result:string;device_id:string}>(
        'SELECT method,result,device_id FROM symphony.authentication_events WHERE user_id=$1 AND method=$2 ORDER BY occurred_at DESC LIMIT 1',
        [userId,'first_login'],
      );
      expect(event.rows[0]).toMatchObject({method:'first_login',result:'success',device_id:'postgres-browser'});
      await eventClient.query('COMMIT');
    } catch(error) { await eventClient.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { eventClient.release(); }
    const sessionCookie=cookie(login);
    const session=await appA.inject({method:'GET',url:'/auth/session',headers:{cookie:sessionCookie}});
    expect(session.statusCode).toBe(200);expect(session.json()).toMatchObject({authenticated:true,forcedChangeRequired:true});
    const forbidden=await appA.inject({method:'GET',url:'/not-allowlisted',headers:{cookie:sessionCookie}});
    expect(forbidden.statusCode).toBe(403);expect(forbidden.json()).toEqual({code:'FORCED_PASSWORD_CHANGE_REQUIRED'});
    const newPassword=`New database passphrase ${randomUUID()}`;
    const changed=await appA.inject({method:'POST',url:'/auth/change-password',headers:{cookie:sessionCookie,origin:profile.publicOrigin,'x-csrf-token':session.json<{csrfToken:string}>().csrfToken},payload:{currentCredential:temporaryCredential,newPassword}});
    expect(changed.statusCode).toBe(200);expect(changed.json()).toEqual({ok:true});
    expect((await appA.inject({method:'GET',url:'/auth/session',headers:{cookie:sessionCookie}})).statusCode).toBe(401);
    const isolatedClient=await isolatedAdmin.connect();
    let persisted:pg.QueryResult<{secret_hash:string}>;
    try {
      await isolatedClient.query('BEGIN');
      await isolatedClient.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      persisted=await isolatedClient.query<{secret_hash:string}>('SELECT secret_hash FROM symphony.password_credentials WHERE tenant_id=$1 AND user_id=$2',[tenantId,userId]);
      await isolatedClient.query('COMMIT');
    } catch(error) { await isolatedClient.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { isolatedClient.release(); }
    expect(persisted.rows).toHaveLength(1);expect(persisted.rows[0]!.secret_hash).not.toContain(newPassword);
    const freshCsrf=await appA.inject({method:'GET',url:'/auth/csrf'});
    const freshLogin=await appA.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(freshCsrf),origin:profile.publicOrigin,'x-csrf-token':freshCsrf.json<{csrfToken:string}>().csrfToken},payload:{userId,credential:newPassword,deviceId:'postgres-browser-2'}});
    expect(freshLogin.statusCode).toBe(200);expect(freshLogin.json()).toEqual({forcedChangeRequired:false});
    const context=await appA.inject({method:'GET',url:'/workspace/context?userId='+randomUUID(),headers:{cookie:cookie(freshLogin)}});
    expect(context.statusCode).toBe(200);
    expect(context.headers['cache-control']).toBe('no-store, private');
    const facts=context.json<{data:{tenantId:string;userId:string;personId:string;facts:{kind:string;authority:string;organizationId:string|null;scopeOrganizationIds:string[]}[]}}>().data;
    expect(facts).toMatchObject({tenantId,userId,personId});
    expect(facts.facts.map((fact)=>`${fact.kind}:${fact.authority}`)).toEqual([
      'appointment:chairperson','appointment:secretary','capacity:internal_verifier','enrolment:self_enroller','institutional_role:union_ta',
      'membership:member','platform_role:programme_manager','platform_role:programme_manager_ta_delegation_scope',
    ]);
    expect(facts.facts.find((fact)=>fact.kind==='institutional_role')?.scopeOrganizationIds).toEqual([organizationId]);
    expect(facts.facts.some((fact)=>fact.authority==='vice_chairperson' || fact.authority==='field_agent')).toBe(false);
    expect(context.body).not.toContain('@example.invalid');
    await isolatedAdmin.query('BEGIN');
    try {
      await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      await isolatedAdmin.query(`UPDATE symphony.ta_scope_delegations
        SET active_from=clock_timestamp()+interval '1 hour' WHERE id=$1`,[taScopeId]);
      await isolatedAdmin.query('COMMIT');
    } catch(error) { await isolatedAdmin.query('ROLLBACK').catch(()=>undefined);throw error; }
    const scheduledTaContext=await appA.inject({method:'GET',url:'/workspace/context',headers:{cookie:cookie(freshLogin)}});
    expect(scheduledTaContext.statusCode).toBe(200);
    expect(scheduledTaContext.json<{data:typeof facts}>().data.facts.some((fact)=>fact.kind==='institutional_role')).toBe(false);
    await isolatedAdmin.query('BEGIN');
    try {
      await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      await isolatedAdmin.query(`UPDATE symphony.ta_scope_delegations
        SET active_from=clock_timestamp()-interval '1 hour' WHERE id=$1`,[taScopeId]);
      await isolatedAdmin.query('COMMIT');
    } catch(error) { await isolatedAdmin.query('ROLLBACK').catch(()=>undefined);throw error; }
    const effectiveTaContext=await appA.inject({method:'GET',url:'/workspace/context',headers:{cookie:cookie(freshLogin)}});
    expect(effectiveTaContext.statusCode).toBe(200);
    expect(effectiveTaContext.json<{data:typeof facts}>().data.facts.find((fact)=>fact.kind==='institutional_role')?.scopeOrganizationIds).toEqual([organizationId]);
    const unauthenticatedFindings=await appA.inject({method:'GET',url:`/workspace/verified-findings?organizationId=${organizationId}`});
    expect(unauthenticatedFindings.statusCode).toBe(401);
    const findings=await appA.inject({method:'GET',url:`/workspace/verified-findings?organizationId=${organizationId}`,headers:{cookie:cookie(freshLogin)}});
    expect(findings.statusCode).toBe(200);
    expect(findings.headers['cache-control']).toBe('no-store, private');
    expect(findings.json()).toEqual({data:[]});
    expect((await appA.inject({method:'GET',url:'/workspace/verified-findings?organizationId=invalid',headers:{cookie:cookie(freshLogin)}})).statusCode).toBe(400);

    const targetUserId=randomUUID();
    const targetFixture=await isolatedAdmin.connect();
    try {
      await targetFixture.query('BEGIN');
      await targetFixture.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      await targetFixture.query('INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status) VALUES($1,$2,$3,$3,\'active\')',
        [targetUserId,tenantId,`wp16-target-${targetUserId}@example.invalid`]);
      await targetFixture.query('COMMIT');
    } catch(error) { await targetFixture.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { targetFixture.release(); }
    const findingItemId=randomUUID();
    const findingVersionId=randomUUID();
    const findingAssignmentId=randomUUID();
    const findingId=randomUUID();
    await isolatedAdmin.query('BEGIN');
    try {
      await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      await isolatedAdmin.query('INSERT INTO symphony.evidence_items(id,organization_id,track,evidence_type) VALUES($1,$2,\'R\',\'authority-window-fixture\')',[findingItemId,organizationId]);
      await isolatedAdmin.query(`INSERT INTO symphony.evidence_versions(id,evidence_item_id,version_number,supplier_user_id,origin,stage,payload)
        VALUES($1,$2,1,$3,'cooperative_supplied','supplied','{}'::jsonb)`,[findingVersionId,findingItemId,targetUserId]);
      await isolatedAdmin.query(`INSERT INTO symphony.verification_assignments(id,evidence_item_id,assigned_to_user_id,evidence_version_id,completed_at)
        VALUES($1,$2,$3,$4,clock_timestamp())`,[findingAssignmentId,findingItemId,userId,findingVersionId]);
      await isolatedAdmin.query(`INSERT INTO symphony.verification_findings(id,assignment_id,evidence_version_id,assurance_class,result,scope,outcome)
        VALUES($1,$2,$3,'cooperative_internal','inconclusive','scheduled authority regression','inconclusive')`,[findingId,findingAssignmentId,findingVersionId]);
      await isolatedAdmin.query('COMMIT');
    } catch(error) { await isolatedAdmin.query('ROLLBACK').catch(()=>undefined);throw error; }
    const freshSession=await appA.inject({method:'GET',url:'/auth/session',headers:{cookie:cookie(freshLogin)}});
    expect(freshSession.statusCode).toBe(200);
    const command={
      commandId:randomUUID(), organizationId, occurredAt:new Date().toISOString(), expectedVersion:null,
      schemaVersion:1, type:'GrantCapacity',
      payload:{capacityGrantId:randomUUID(),targetUserId,capacityType:'field_agent',
        activeFrom:new Date(Date.now()-60_000).toISOString(),activeTo:new Date(Date.now()+60*60_000).toISOString(),sourceRef:'wp1.6-http-fixture'},
    };
    const commandHeaders={cookie:cookie(freshLogin),origin:profile.publicOrigin,'x-csrf-token':freshSession.json<{csrfToken:string}>().csrfToken,'x-role':'platform_admin'};
    const activeFindings=await appA.inject({method:'GET',url:`/workspace/verified-findings?organizationId=${organizationId}`,headers:{cookie:cookie(freshLogin)}});
    expect(activeFindings.statusCode).toBe(200);
    expect(activeFindings.json<{data:{findingId:string}[]}>().data.map((finding)=>finding.findingId)).toContain(findingId);
    await isolatedAdmin.query('BEGIN');
    await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
    await isolatedAdmin.query(`UPDATE symphony.capacity_grants SET active_from=clock_timestamp()+interval '1 hour'
      WHERE user_id=$1 AND organization_id=$2 AND capacity_type='internal_verifier'`,[userId,organizationId]);
    await isolatedAdmin.query('COMMIT');
    const beforeAuthority=await appA.inject({method:'GET',url:`/workspace/verified-findings?organizationId=${organizationId}`,headers:{cookie:cookie(freshLogin)}});
    expect(beforeAuthority.statusCode).toBe(200);
    expect(beforeAuthority.json()).toEqual({data:[]});
    await isolatedAdmin.query('BEGIN');
    await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
    await isolatedAdmin.query(`UPDATE symphony.capacity_grants SET active_from=clock_timestamp()-interval '1 hour',
      expires_at=clock_timestamp()-interval '1 second'
      WHERE user_id=$1 AND organization_id=$2 AND capacity_type='internal_verifier'`,[userId,organizationId]);
    await isolatedAdmin.query('COMMIT');
    const afterAuthority=await appA.inject({method:'GET',url:`/workspace/verified-findings?organizationId=${organizationId}`,headers:{cookie:cookie(freshLogin)}});
    expect(afterAuthority.statusCode).toBe(200);
    expect(afterAuthority.json()).toEqual({data:[]});
    await isolatedAdmin.query('BEGIN');
    await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
    await isolatedAdmin.query(`UPDATE symphony.capacity_grants SET active_from=clock_timestamp()-interval '1 hour',expires_at=NULL
      WHERE user_id=$1 AND organization_id=$2 AND capacity_type='internal_verifier'`,[userId,organizationId]);
    await isolatedAdmin.query('COMMIT');
    const firstCommand=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:command});
    expect(firstCommand.statusCode).toBe(200);
    expect(firstCommand.json()).toMatchObject({ok:true,replayed:false,data:{operation:'granted'}});
    const repeatedCommand=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:command});
    expect(repeatedCommand.statusCode).toBe(200);
    expect(repeatedCommand.json()).toMatchObject({ok:true,replayed:true,data:{operation:'granted'}});
    const staleRevoke={
      commandId:randomUUID(), organizationId, occurredAt:new Date().toISOString(), expectedVersion:0,
      schemaVersion:1, type:'RevokeCapacity', payload:{capacityGrantId:command.payload.capacityGrantId},
    };
    const staleFirst=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:staleRevoke});
    expect(staleFirst.statusCode).toBe(409);
    const staleFirstBody=staleFirst.json<{ok:boolean;code:string;replayed:boolean;reconciliationId:string}>();
    expect(staleFirstBody).toMatchObject({ok:false,code:'VERSION_CONFLICT',replayed:false});
    expect(staleFirstBody.reconciliationId).toMatch(/^[0-9a-f-]{36}$/i);
    const staleReplay=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:staleRevoke});
    expect(staleReplay.statusCode).toBe(409);
    expect(staleReplay.json()).toEqual({...staleFirstBody,replayed:true});
    await isolatedAdmin.query('BEGIN');
    await isolatedAdmin.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
    const stalePersistence=await isolatedAdmin.query<{receipts:number;inbox:number}>(
      `SELECT (SELECT count(*)::int FROM symphony.command_receipts WHERE tenant_id=$1 AND command_id=$2) AS receipts,
              (SELECT count(*)::int FROM symphony.reconciliation_inbox WHERE tenant_id=$1 AND reconciliation_id=$3) AS inbox`,
      [tenantId,staleRevoke.commandId,staleFirstBody.reconciliationId],
    );
    await isolatedAdmin.query('COMMIT');
    expect(stalePersistence.rows[0]).toEqual({receipts:1,inbox:1});
    const changedCommand=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:{...command,payload:{...command.payload,activeTo:new Date(Date.now()+2*60*60_000).toISOString()}}});
    expect(changedCommand.statusCode).toBe(409);
    expect(changedCommand.json()).toEqual({ok:false,code:'IDEMPOTENCY_KEY_REUSED',replayed:false});
    const forgedClaims=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:{...command,tenantId:randomUUID(),actorUserId:randomUUID(),role:'platform_admin'}});
    expect(forgedClaims.statusCode).toBe(400);
    expect(forgedClaims.json()).toEqual({code:'INVALID_COMMAND'});
    const duplicateKey=await appA.inject({method:'POST',url:'/commands',headers:{...commandHeaders,'content-type':'application/json'},
      payload:`{"commandId":"${randomUUID()}","\\u0063ommandId":"${randomUUID()}"}`});
    expect(duplicateKey.statusCode).toBe(400);
    expect(duplicateKey.json()).toEqual({code:'INVALID_JSON'});
    const appIdentity=await appPoolA.query<{current_user:string}>("SELECT current_user");
    expect(appIdentity.rows[0]?.current_user).toBe('symphony_app');
    const commandInspector=await isolatedAdmin.connect();
    try {
      await commandInspector.query('BEGIN');
      await commandInspector.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      const commandRows=await commandInspector.query<{receipts:number;events:number;outbox:number;grants:number}>(
        `SELECT (SELECT count(*)::int FROM symphony.command_receipts WHERE tenant_id=$1 AND command_id=$2) AS receipts,
                (SELECT count(*)::int FROM symphony.domain_events WHERE tenant_id=$1 AND aggregate_id=$3) AS events,
                (SELECT count(*)::int FROM symphony.event_outbox o JOIN symphony.domain_events e ON e.id=o.event_id WHERE e.tenant_id=$1 AND e.aggregate_id=$3) AS outbox,
                (SELECT count(*)::int FROM symphony.capacity_grants WHERE user_id=$4 AND organization_id=$5) AS grants`,
        [tenantId,command.commandId,command.payload.capacityGrantId,targetUserId,organizationId],
      );
      expect(commandRows.rows[0]).toEqual({receipts:1,events:1,outbox:1,grants:1});
      await commandInspector.query('COMMIT');
    } catch(error) { await commandInspector.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { commandInspector.release(); }

    const deniedEnvelope=(targetOrganizationId:string)=>({
      ...command,commandId:randomUUID(),organizationId:targetOrganizationId,
      payload:{...command.payload,capacityGrantId:randomUUID()},
    });
    const crossTenantCommand=deniedEnvelope(organizationB!);
    const missingOrganizationCommand=deniedEnvelope(randomUUID());
    const crossTenantDenial=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:crossTenantCommand});
    const missingOrganizationDenial=await appA.inject({method:'POST',url:'/commands',headers:commandHeaders,payload:missingOrganizationCommand});
    expect(crossTenantDenial.statusCode).toBe(403);
    expect(crossTenantDenial.body).toBe(missingOrganizationDenial.body);
    expect(crossTenantDenial.json()).toEqual({ok:false,code:'NOT_AUTHORIZED',replayed:false});
    const denialInspector=await isolatedAdmin.connect();
    try {
      await denialInspector.query('BEGIN');
      await denialInspector.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      const audits=await denialInspector.query<{observed_command_id:string;observed_command_type:string;denial_code:string}>(
        `SELECT observed_command_id,observed_command_type,denial_code FROM symphony.security_attempts
          WHERE tenant_id=$1 AND actor_user_id=$2 AND observed_command_id=ANY($3::uuid[]) ORDER BY observed_command_id`,
        [tenantId,userId,[crossTenantCommand.commandId,missingOrganizationCommand.commandId]],
      );
      expect(audits.rows).toHaveLength(2);
      expect(audits.rows.map((row)=>row.observed_command_type)).toEqual(['GrantCapacity','GrantCapacity']);
      expect(audits.rows.map((row)=>row.denial_code)).toEqual(['NOT_AUTHORISED_FOR_ORGANISATION','NOT_AUTHORISED_FOR_ORGANISATION']);
      const deniedReceipts=await denialInspector.query<{count:number}>(
        'SELECT count(*)::int AS count FROM symphony.command_receipts WHERE tenant_id=$1 AND command_id=ANY($2::uuid[])',
        [tenantId,[crossTenantCommand.commandId,missingOrganizationCommand.commandId]],
      );
      expect(deniedReceipts.rows[0]?.count).toBe(0);
      await denialInspector.query('COMMIT');
    } catch(error) { await denialInspector.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { denialInspector.release(); }
  },60_000);

  it('records generic failed attempts from two independent Fastify instances in one shared PostgreSQL throttle store',async()=>{
    const preOne=await appA.inject({method:'GET',url:'/auth/csrf'});
    const preTwo=await appB.inject({method:'GET',url:'/auth/csrf'});
    const unknownOne=randomUUID();const unknownTwo=randomUUID();
    let arrived=0;let release!:()=>void;const start=new Promise<void>((resolveStart)=>{release=resolveStart;});
    const request=(app:typeof appA,pre:typeof preOne,accountId:string)=>{
      arrived+=1;if(arrived===2)release();
      return start.then(()=>app.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(pre),origin:profile.publicOrigin,'x-csrf-token':pre.json<{csrfToken:string}>().csrfToken},payload:{userId:accountId,credential:`unknown_${randomUUID()}`,deviceId:'parallel-test'}}));
    };
    const [failedOne,failedTwo]=await Promise.all([request(appA,preOne,unknownOne),request(appB,preTwo,unknownTwo)]);
    expect(failedOne.statusCode).toBe(401);expect(failedTwo.statusCode).toBe(401);
    expect(failedOne.body).toBe(failedTwo.body);
    const accountKeys=[unknownOne,unknownTwo].map((id)=>createHmac('sha256',hmacKey).update(`account:${id.toLowerCase()}`).digest());
    const sourceKey=createHmac('sha256',hmacKey).update('trusted_source:127.0.0.1').digest();
    const rows=await isolatedAdmin.query<{dimension:string;count:number}>(
      `SELECT dimension,count(*)::int AS count FROM symphony.auth_attempt_events
        WHERE identity_hmac=$1 OR identity_hmac=$2 OR identity_hmac=$3 GROUP BY dimension`,[accountKeys[0],accountKeys[1],sourceKey],
    );
    expect(rows.rows).toEqual(expect.arrayContaining([{dimension:'account',count:2},{dimension:'trusted_source',count:2}]));
  },30_000);
});
