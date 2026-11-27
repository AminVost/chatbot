import {sql,fail} from './account.js';
import {ZAI_LIMITS,zaiModels} from './providers.js';
export async function reserveZai(model){
 const q=sql(),day=new Date().toISOString().slice(0,10);
 const rows=await q`INSERT INTO nava_zai_usage(model,day,requests,minute_bucket,minute_requests)
 VALUES(${model},${day}::date,1,date_trunc('minute',now()),1)
 ON CONFLICT(model,day) DO UPDATE SET requests=nava_zai_usage.requests+1,
 minute_requests=CASE WHEN nava_zai_usage.minute_bucket=date_trunc('minute',now()) THEN nava_zai_usage.minute_requests+1 ELSE 1 END,
 minute_bucket=date_trunc('minute',now())
 WHERE nava_zai_usage.requests<${ZAI_LIMITS.daily} AND (nava_zai_usage.minute_bucket<>date_trunc('minute',now()) OR nava_zai_usage.minute_requests<${ZAI_LIMITS.minute})
 RETURNING model`;
 if(!rows.length)fail(429,'Z.ai app model quota reached');
 return day;
}
export async function recordZai(model,day,stats){
 const q=sql();await q`UPDATE nava_zai_usage SET prompt_tokens=prompt_tokens+${stats.prompt||0},completion_tokens=completion_tokens+${stats.completion||0},successes=successes+${stats.success?1:0},failures=failures+${stats.success?0:1} WHERE model=${model} AND day=${day}::date`;
}
export async function zaiStats(user){
 if(!user.admin)fail(403,'Administrator only');
 const q=sql();const rows=await q`SELECT model,requests,prompt_tokens,completion_tokens,successes,failures FROM nava_zai_usage WHERE day=(now() AT TIME ZONE 'UTC')::date`;
 return {limits:ZAI_LIMITS,models:zaiModels.map(m=>({id:m.id,name:m.name,...(rows.find(r=>r.model===m.id)||{requests:0,prompt_tokens:0,completion_tokens:0,successes:0,failures:0})}))};
}
