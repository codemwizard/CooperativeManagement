import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import type { AuthSessionRow, AuthSubject, LoginAttemptReservation } from '@symphony/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthComposition, type AuthComposition } from '../authentication-composition.js';
import { buildApiServer } from '../server.js';

class MemoryAuthStore {
  readonly sessions = new Map<string, AuthSessionRow>();
  subject: AuthSubject;
  private counter=0;

  constructor(subject:AuthSubject){this.subject=subject;}
  async lookupSubject(userId:string){return userId===USER_ID?this.subject:undefined;}
  async findSession(tokenHash:Buffer){return this.sessions.get(tokenHash.toString('hex'));}
  async createPreAuthSession(tokenHash:Buffer,csrfHash:Buffer){const now=new Date();this.sessions.set(tokenHash.toString('hex'),this.row(tokenHash,csrfHash,null,null,null,null,false,now));}
  async refreshCsrf(tokenHash:Buffer,csrfHash:Buffer){const old=await this.findSession(tokenHash);if(!old||old.revokedAt)return false;this.sessions.set(tokenHash.toString('hex'),{...old,csrfHash,lastActivityAt:new Date().toISOString()});return true;}
  async createAuthenticatedSession(input:{preAuthTokenHash:Buffer;tokenHash:Buffer;csrfHash:Buffer;tenantId:string;userId:string;deviceId:string;temporaryCredentialId:string|null;forcedChangeRequired:boolean}){
    const pre=await this.findSession(input.preAuthTokenHash);if(pre)this.sessions.set(input.preAuthTokenHash.toString('hex'),{...pre,revokedAt:new Date().toISOString()});
    const now=new Date();this.sessions.set(input.tokenHash.toString('hex'),this.row(input.tokenHash,input.csrfHash,input.tenantId,input.userId,input.deviceId,input.temporaryCredentialId,input.forcedChangeRequired,now));
  }
  async touchSession(tokenHash:Buffer){const row=await this.findSession(tokenHash);if(!row||row.revokedAt||Date.now()>=Date.parse(row.absoluteExpiresAt)||Date.now()>=Date.parse(row.lastActivityAt)+30*60_000)return false;this.sessions.set(tokenHash.toString('hex'),{...row,lastActivityAt:new Date().toISOString()});return true;}
  async revokeSession(tokenHash:Buffer){const row=await this.findSession(tokenHash);if(row)this.sessions.set(tokenHash.toString('hex'),{...row,revokedAt:new Date().toISOString()});}
  async updatePermanentPasswordHash(_tenantId:string,_userId:string,passwordHash:string){this.subject={...this.subject,passwordSecretHash:passwordHash};}
  async rotateAuthenticatedSession(input:{previousTokenHash:Buffer;nextTokenHash:Buffer;nextCsrfHash:Buffer;tenantId:string}){const row=await this.findSession(input.previousTokenHash);if(!row||row.revokedAt)return false;this.sessions.set(input.previousTokenHash.toString('hex'),{...row,revokedAt:new Date().toISOString()});this.sessions.set(input.nextTokenHash.toString('hex'),{...row,tokenHash:input.nextTokenHash,csrfHash:input.nextCsrfHash,lastActivityAt:new Date().toISOString(),revokedAt:null});return true;}
  async establishPasswordAndRevokeSessions(input:{tenantId:string;userId:string;temporaryCredentialId:string;passwordHash:string}){
    this.subject={...this.subject,temporaryCredentialId:null,temporarySecretHash:null,temporaryExpiresAt:null,passwordSecretHash:input.passwordHash};
    for(const [key,row] of this.sessions)if(row.tenantId===input.tenantId&&row.userId===input.userId&&!row.revokedAt)this.sessions.set(key,{...row,revokedAt:new Date().toISOString()});
  }
  async reserveAttempt():Promise<LoginAttemptReservation>{return{attemptId:String(++this.counter),delayMs:0};}
  async finishAttempt(){return;}
  async abandonAttempt(){return;}
  async healthCheck(){return true;}
  private row(tokenHash:Buffer,csrfHash:Buffer,tenantId:string|null,userId:string|null,deviceId:string|null,temporaryCredentialId:string|null,forcedChangeRequired:boolean,now:Date):AuthSessionRow{
    return {tokenHash,csrfHash,tenantId,userId,deviceId,temporaryCredentialId,forcedChangeRequired,issuedAt:now.toISOString(),lastActivityAt:now.toISOString(),absoluteExpiresAt:new Date(now.getTime()+12*60*60_000).toISOString(),revokedAt:null};
  }
}

const USER_ID='0f08dc5a-4f09-4dae-8bde-7fce32e1c1cf';
const TENANT_ID='f81372f3-19d0-4aca-8dfe-5fd84e322cb2';
const ORIGIN='http://localhost:5174';
const profile={runtimeProfile:'test' as const,appEnv:'test',dataMode:'test',publicOrigin:ORIGIN,host:'127.0.0.1',port:3000};
const lifecycle=new CredentialLifecycleService({now:()=>new Date().toISOString()});

function cookie(response:{headers:Record<string,unknown>}):string{
  const header=response.headers['set-cookie'];const first=typeof header==='string'?header:Array.isArray(header)&&typeof header[0]==='string'?header[0]:undefined;
  if(!first)throw new Error('Expected session cookie');return first.split(';',1)[0]!;
}

describe('persisted authentication API composition',()=>{
  let app!:FastifyInstance;
  let auth!:AuthComposition;
  let store:MemoryAuthStore;
  const temporary='temporary credential canary '+randomUUID();
  const permanent=`permanent password ${randomUUID()}`;

  beforeAll(async()=>{
    const tempHash=await lifecycle.hashPermanentPassword(temporary);
    store=new MemoryAuthStore({tenantId:TENANT_ID,userStatus:'active',temporaryCredentialId:randomUUID(),temporarySecretHash:tempHash,temporaryExpiresAt:new Date(Date.now()+60*60_000).toISOString(),passwordSecretHash:null});
    auth=createAuthComposition({repository:store,config:profile,throttleHmacKey:Buffer.alloc(32,17)});
    app=buildApiServer({config:profile,routes:{authentication:auth.authentication,commands:async(fastify)=>{
      fastify.get('/private',async(request)=>({userId:request.authSession?.userId??null}));
      fastify.post('/rotate',async(request,reply)=>({csrfToken:await fastify.rotateAuthSession(request,reply)}));
    },verifyCsrf:auth.verifyCsrf,authorize:auth.authorize,rotateSession:auth.rotateSession},readinessChecks:[{name:'test-store',check:auth.healthCheck}],});
    await app.ready();
  },30_000);

  afterAll(async()=>{await app?.close();});

  it('enforces CSRF and Origin, forced-change allowlist, session rotation, all-session revocation and fresh login',async()=>{
    const csrfResponse=await app.inject({method:'GET',url:'/auth/csrf'});
    expect(csrfResponse.statusCode).toBe(200);
    const preAuthCookie=cookie(csrfResponse);
    const csrfToken=csrfResponse.json<{csrfToken:string}>().csrfToken;
    expect(csrfResponse.headers['cache-control']).toBe('no-store, private');
    const invalidKnown=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:preAuthCookie,origin:ORIGIN,'x-csrf-token':csrfToken},payload:{userId:USER_ID,credential:`incorrect ${randomUUID()}`,deviceId:'browser-a'}});
    const invalidUnknown=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:preAuthCookie,origin:ORIGIN,'x-csrf-token':csrfToken},payload:{userId:randomUUID(),credential:`incorrect ${randomUUID()}`,deviceId:'browser-a'}});
    expect(invalidKnown.statusCode).toBe(401);
    expect(invalidUnknown.statusCode).toBe(401);
    expect(invalidUnknown.body).toBe(invalidKnown.body);
    const badOrigin=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:preAuthCookie,origin:'https://attacker.invalid','x-csrf-token':csrfToken},payload:{userId:USER_ID,credential:temporary,deviceId:'browser-a'}});
    expect(badOrigin.statusCode).toBe(403);

    const login=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:preAuthCookie,origin:ORIGIN,'x-csrf-token':csrfToken},payload:{userId:USER_ID,credential:temporary,deviceId:'browser-a'}});
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({forcedChangeRequired:true});
    expect(login.body).not.toContain('sessionToken');
    const loginCookie=login.headers['set-cookie'];
    expect(loginCookie).toContain('Path=/; HttpOnly; SameSite=Lax');
    expect(loginCookie).not.toContain('Domain=');
    const sessionCookie=cookie(login);
    const sessionState=await app.inject({method:'GET',url:'/auth/session',headers:{cookie:sessionCookie}});
    expect(sessionState.statusCode).toBe(200);
    expect(sessionState.json()).toMatchObject({authenticated:true,forcedChangeRequired:true});
    const currentCsrf=sessionState.json<{csrfToken:string}>().csrfToken;
    const privateDenied=await app.inject({method:'GET',url:'/private',headers:{cookie:sessionCookie}});
    expect(privateDenied.statusCode).toBe(403);
    expect(privateDenied.json()).toEqual({code:'FORCED_PASSWORD_CHANGE_REQUIRED'});
    const missingCsrf=await app.inject({method:'POST',url:'/auth/change-password',headers:{cookie:sessionCookie,origin:ORIGIN},payload:{currentCredential:temporary,newPassword:permanent}});
    expect(missingCsrf.statusCode).toBe(403);

    const changed=await app.inject({method:'POST',url:'/auth/change-password',headers:{cookie:sessionCookie,origin:ORIGIN,'x-csrf-token':currentCsrf},payload:{currentCredential:temporary,newPassword:permanent}});
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toEqual({ok:true});
    expect((await app.inject({method:'GET',url:'/auth/session',headers:{cookie:sessionCookie}})).statusCode).toBe(401);

    const newPreAuth=await app.inject({method:'GET',url:'/auth/csrf'});
    const freshLogin=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(newPreAuth),origin:ORIGIN,'x-csrf-token':newPreAuth.json<{csrfToken:string}>().csrfToken},payload:{userId:USER_ID,credential:permanent,deviceId:'browser-b'}});
    expect(freshLogin.statusCode).toBe(200);
    expect(freshLogin.json()).toEqual({forcedChangeRequired:false});
    const authenticatedCookie=cookie(freshLogin);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:authenticatedCookie}})).json()).toEqual({userId:USER_ID});
  });

  it('allows concurrent sessions and logout revokes only the current session',async()=>{
    const firstPre=await app.inject({method:'GET',url:'/auth/csrf'});
    const firstLogin=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(firstPre),origin:ORIGIN,'x-csrf-token':firstPre.json<{csrfToken:string}>().csrfToken},payload:{userId:USER_ID,credential:permanent,deviceId:'one'}});
    const firstCookie=cookie(firstLogin);
    const secondPre=await app.inject({method:'GET',url:'/auth/csrf'});
    const secondLogin=await app.inject({method:'POST',url:'/auth/login',headers:{cookie:cookie(secondPre),origin:ORIGIN,'x-csrf-token':secondPre.json<{csrfToken:string}>().csrfToken},payload:{userId:USER_ID,credential:permanent,deviceId:'two'}});
    const secondCookie=cookie(secondLogin);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:firstCookie}})).statusCode).toBe(200);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:secondCookie}})).statusCode).toBe(200);
    const csrf=await app.inject({method:'GET',url:'/auth/session',headers:{cookie:firstCookie}});
    const rotated=await app.inject({method:'POST',url:'/rotate',headers:{cookie:firstCookie,origin:ORIGIN,'x-csrf-token':csrf.json<{csrfToken:string}>().csrfToken}});
    const rotatedCookie=cookie(rotated);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:firstCookie}})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:rotatedCookie}})).statusCode).toBe(200);
    const logout=await app.inject({method:'POST',url:'/auth/logout',headers:{cookie:rotatedCookie,origin:ORIGIN,'x-csrf-token':rotated.json<{csrfToken:string}>().csrfToken}});
    expect(logout.statusCode).toBe(200);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:rotatedCookie}})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/private',headers:{cookie:secondCookie}})).statusCode).toBe(200);
  });
});
