import {neon} from '@neondatabase/serverless';
import {createRemoteJWKSet,jwtVerify} from 'jose';
let db,jwks;
export function sql(){return db??=neon(process.env.DATABASE_URL)}
export function fail(status,message){throw Object.assign(new Error(message),{status})}
export function isOwner(email,verified){return verified===true&&String(email).toLowerCase()==='aminvost@gmail.com'}
export function sameOrigin(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}}
export async function identity(req){
 const token=String(req.headers.authorization||'');if(!token.startsWith('Bearer '))fail(401,'Sign in required');
 let sub;try{jwks??=createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));const {payload}=await jwtVerify(token.slice(7),jwks,{issuer:new URL(process.env.NEON_AUTH_BASE_URL).origin,algorithms:['EdDSA']});sub=payload.sub;if(!/^[0-9a-f-]{36}$/i.test(sub))throw Error('Invalid sub')}catch{fail(401,'Session expired. Sign in again.')}
 const q=sql();const [u]=await q`SELECT id,name,email,"emailVerified" AS verified,banned FROM neon_auth."user" WHERE id=${sub}::uuid`;
 if(!u||!u.verified)fail(403,'Verify your email first');
 const admin=isOwner(u.email,u.verified);
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
export async function adminUpdate(user,body){if(!user.admin)fail(403,'Administrator only');if(!/^[0-9a-f-]{36}$/i.test(body.id||'')||!Number.isInteger(body.limit)||body.limit<0||body.limit>1000||typeof body.blocked!=='boolean')fail(400,'Invalid settings');const q=sql();const [target]=await q`SELECT id,email FROM neon_auth."user" WHERE id=${body.id}::uuid`;if(!target||target.email.toLowerCase()==='aminvost@gmail.com')fail(400,'Cannot modify owner or missing user');await q.transaction([q`INSERT INTO nava_users(id,daily_limit,blocked) VALUES(${target.id},${body.limit},${body.blocked}) ON CONFLICT(id) DO UPDATE SET daily_limit=EXCLUDED.daily_limit,blocked=EXCLUDED.blocked`,q`INSERT INTO nava_admin_audit(actor,target,action) VALUES(${user.id},${target.id},${JSON.stringify({limit:body.limit,blocked:body.blocked})}::jsonb)`]);}
