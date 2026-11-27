import {sql,fail} from './account.js';
import {authLimits,clientSubject,rateSubject} from './security.js';
export async function reserveRate(scope,subject,seconds,limit){
 const q=sql();const rows=await q`INSERT INTO nava_security_rate(scope,subject,bucket,hits)
 VALUES(${scope},${rateSubject(subject)},floor(extract(epoch from now())/${seconds})::bigint,1)
 ON CONFLICT(scope,subject) DO UPDATE SET bucket=EXCLUDED.bucket,hits=CASE WHEN nava_security_rate.bucket<>EXCLUDED.bucket THEN 1 ELSE nava_security_rate.hits+1 END
 WHERE nava_security_rate.bucket<>EXCLUDED.bucket OR nava_security_rate.hits<${limit}
 RETURNING hits`;
 if(!rows.length)fail(429,'Too many requests. Please try again later.');
}
export async function limitAuth(req,path,b){for(const r of authLimits(path,b.email))await reserveRate(r.scope,r.email??clientSubject(req),r.seconds,r.limit)}
