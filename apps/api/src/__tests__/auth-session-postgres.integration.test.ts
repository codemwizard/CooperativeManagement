import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { PostgresCredentialRepository } from '@symphony/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthComposition } from '../authentication-composition.js';
import { buildApiServer } from '../server.js';

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
  let isolatedDatabase:string|undefined;
  let isolatedUrl:string|undefined;
  let tenantId:string|undefined;
  let userId:string|undefined;
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
    const appUrl=new URL(appBaseUrl);appUrl.pathname=`/${isolatedDatabase}`;
    appPoolA=new pg.Pool({connectionString:appUrl.toString(),max:4});
    appPoolB=new pg.Pool({connectionString:appUrl.toString(),max:4});
    tenantId=randomUUID();userId=randomUUID();hmacKey=Buffer.alloc(32,0x53);
    await isolatedAdmin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)',[tenantId,'wp5.3-api-integration']);
    const fixture=await appPoolA.connect();
    try {
      await fixture.query('BEGIN');
      await fixture.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
      await fixture.query(
        `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
         VALUES($1,$2,$3,$3,'active')`,[userId,tenantId,`wp53-${userId}@example.invalid`],
      );
      await fixture.query('COMMIT');
    } catch(error) { await fixture.query('ROLLBACK').catch(()=>undefined);throw error; }
    finally { fixture.release(); }
    const credentialService=new CredentialLifecycleService({now:()=>new Date().toISOString()});
    const material=await credentialService.issueTemporaryCredential();temporaryCredential=material.plaintext;
    await new PostgresCredentialRepository(appPoolA).issueTemporaryCredential({
      credentialId:material.credentialId,tenantId,userId,secretHash:material.hash,
    });
    const authA=createAuthComposition({pool:appPoolA,config:profile,throttleHmacKey:hmacKey});
    const authB=createAuthComposition({pool:appPoolB,config:profile,throttleHmacKey:hmacKey});
    appA=buildApiServer({config:profile,routes:{authentication:authA.authentication,verifyCsrf:authA.verifyCsrf,authorize:authA.authorize,rotateSession:authA.rotateSession}});
    appB=buildApiServer({config:profile,routes:{authentication:authB.authentication,verifyCsrf:authB.verifyCsrf,authorize:authB.authorize,rotateSession:authB.rotateSession}});
    await Promise.all([appA.ready(),appB.ready()]);
  },60_000);

  afterAll(async()=>{
    await appA?.close().catch(()=>undefined);await appB?.close().catch(()=>undefined);
    await appPoolA?.end().catch(()=>undefined);await appPoolB?.end().catch(()=>undefined);
    await isolatedAdmin?.end().catch(()=>undefined);
    if(admin&&isolatedDatabase){
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[isolatedDatabase]).catch(()=>undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${isolatedDatabase.replaceAll('"','""')}"`).catch(()=>undefined);
    }
    await admin?.end().catch(()=>undefined);
  },30_000);

  it('runs temp login, forced-change denial, all-session revocation and fresh login through the actual app-role database path',async()=>{
    const csrf=await appA.inject({method:'GET',url:'/auth/csrf'});
    const login=await appA.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(csrf),origin:profile.publicOrigin,'x-csrf-token':csrf.json<{csrfToken:string}>().csrfToken},payload:{userId,credential:temporaryCredential,deviceId:'postgres-browser'}});
    expect(login.statusCode).toBe(200);expect(login.json()).toEqual({forcedChangeRequired:true});
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
