import {neon} from '@neondatabase/serverless';
import {handleAuthRequest} from '@neon/auth/server';
import {requestOrigin,sameOrigin} from './origins.js';
import {UUID} from './security.js';
export {sameOrigin};
let db;
export function sql(){return db??=neon(process.env.DATABASE_URL)}
export function fail(status,message){throw Object.assign(new Error(message),{status})}
export function isOwner(email,verified,id,ownerId){return verified===true&&typeof id==='string'&&UUID.test(id)&&id===ownerId&&String(email).toLowerCase()==='aminvost@gmail.com'}
export async function identity(req){
 const cookie=String(req.headers.cookie||'');if(!cookie.includes('__Secure-neon-auth.session_token='))fail(401,'Sign in required');
 let sub;try{const origin=requestOrigin(req);if(!origin)fail(403,'Origin denied');const r=await handleAuthRequest(process.env.NEON_AUTH_BASE_URL,new Request(origin+'/api/auth/get-session',{headers:{cookie,origin,referer:origin+'/'}}),'get-session');if(!r.ok){if(r.status>=500)fail(503,'Authentication temporarily unavailable');fail(401,'Session expired')}const session=await r.json();sub=session?.user?.id;if(!session?.session||!sub||!UUID.test(sub))fail(401,'Session expired. Sign in again.')}catch(e){if(e.status)throw e;fail(503,'Authentication temporarily unavailable')}
 const q=sql();const [u]=await q`SELECT u.id,u.name,u.email,u."emailVerified" AS verified,u.banned,(SELECT user_id::text FROM nava_security_owner WHERE singleton=true) AS owner_id FROM neon_auth."user" u WHERE u.id=${sub}::uuid`;
 if(!u||!u.verified)fail(403,'Verify your email first');
 const admin=isOwner(u.email,u.verified,u.id,u.owner_id);
 await q`INSERT INTO nava_users(id) VALUES(${u.id}) ON CONFLICT DO NOTHING`;
 const [p]=await q`SELECT daily_limit,blocked FROM nava_users WHERE id=${u.id}`;
 if(!admin&&(u.banned||p.blocked))fail(403,'Account suspended');
 return {id:u.id,name:u.name,email:u.email,admin,dailyLimit:p.daily_limit};
}
export async function usage(user){const q=sql();const [r]=await q`SELECT requests FROM nava_usage WHERE user_id=${user.id} AND day=(now() AT TIME ZONE 'UTC')::date`;return {used:r?.requests||0,limit:user.admin?null:user.dailyLimit}}
export async function reserve(user,op,model){
 if(op==='models')return;
 const q=sql();
 if(!user.admin){
 const rows=await q`INSERT INTO nava_usage(user_id,day,requests) SELECT ${user.id},(now() AT TIME ZONE 'UTC')::date,1 WHERE ${user.dailyLimit}>0 ON CONFLICT(user_id,day) DO UPDATE SET requests=nava_usage.requests+1 WHERE nava_usage.requests<${user.dailyLimit} RETURNING requests`;
 if(!rows.length)fail(429,'Daily account quota reached');
 }else await q`INSERT INTO nava_usage(user_id,day,requests) VALUES(${user.id},(now() AT TIME ZONE 'UTC')::date,1) ON CONFLICT(user_id,day) DO UPDATE SET requests=nava_usage.requests+1`;
 await q`INSERT INTO nava_events(user_id,model,op) VALUES(${user.id},${model},${op})`;
}
export async function adminList(user){if(!user.admin)fail(403,'Administrator only');const q=sql();return await q`SELECT u.id,u.name,u.email,u."emailVerified" AS verified,u."createdAt" AS created_at,COALESCE(p.daily_limit,20) AS daily_limit,COALESCE(p.blocked,false) AS blocked,COALESCE(d.requests,0) AS today,COALESCE(a.total,0)::int AS total FROM neon_auth."user" u LEFT JOIN nava_users p ON p.id=u.id LEFT JOIN nava_usage d ON d.user_id=u.id AND d.day=(now() AT TIME ZONE 'UTC')::date LEFT JOIN (SELECT user_id,sum(requests) total FROM nava_usage GROUP BY user_id) a ON a.user_id=u.id ORDER BY u."createdAt" DESC LIMIT 500`}
export async function adminUpdate(user,body){if(!user.admin)fail(403,'Administrator only');if(typeof body.id!=='string'||!UUID.test(body.id)||!Number.isInteger(body.limit)||body.limit<0||body.limit>1000||typeof body.blocked!=='boolean')fail(400,'Invalid settings');const q=sql();const [target]=await q`SELECT id,email FROM neon_auth."user" WHERE id=${body.id}::uuid`;if(!target||target.email.toLowerCase()==='aminvost@gmail.com')fail(400,'Cannot modify owner or missing user');await q.transaction([q`INSERT INTO nava_users(id,daily_limit,blocked) VALUES(${target.id},${body.limit},${body.blocked}) ON CONFLICT(id) DO UPDATE SET daily_limit=EXCLUDED.daily_limit,blocked=EXCLUDED.blocked`,q`INSERT INTO nava_admin_audit(actor,target,action) VALUES(${user.id},${target.id},${JSON.stringify({limit:body.limit,blocked:body.blocked})}::jsonb)`]);}
