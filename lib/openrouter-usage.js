import {sql,fail} from './account.js';
import {OR_LIMITS} from './openrouter-shared.js';
export async function reserveRouter(model){
 const q=sql();const rows=await q`WITH gate AS (
 INSERT INTO nava_or_quota(day,requests,minute_bucket,minute_requests) VALUES((now() AT TIME ZONE 'UTC')::date,1,date_trunc('minute',now()),1)
 ON CONFLICT(day) DO UPDATE SET requests=nava_or_quota.requests+1,minute_requests=CASE WHEN nava_or_quota.minute_bucket=date_trunc('minute',now()) THEN nava_or_quota.minute_requests+1 ELSE 1 END,minute_bucket=date_trunc('minute',now())
 WHERE nava_or_quota.requests<${OR_LIMITS.daily} AND (nava_or_quota.minute_bucket<>date_trunc('minute',now()) OR nava_or_quota.minute_requests<${OR_LIMITS.minute}) RETURNING day)
 INSERT INTO nava_or_usage(model,day,requests) SELECT ${model},day,1 FROM gate ON CONFLICT(model,day) DO UPDATE SET requests=nava_or_usage.requests+1 RETURNING day::text`;
 if(!rows.length)fail(429,'OpenRouter: shared app quota reached');return rows[0].day;
}
export async function recordRouter(model,day,stats){await sql()`UPDATE nava_or_usage SET prompt_tokens=prompt_tokens+${stats.prompt||0},completion_tokens=completion_tokens+${stats.completion||0},successes=successes+${stats.success?1:0},failures=failures+${stats.success?0:1} WHERE model=${model} AND day=${day}::date`}
export async function routerStats(user){if(!user.admin)fail(403,'Administrator only');if(!process.env.OPENROUTER_API_KEY)return null;const q=sql();const [r]=await q`SELECT requests FROM nava_or_quota WHERE day=(now() AT TIME ZONE 'UTC')::date`;const models=await q`SELECT model,requests,prompt_tokens,completion_tokens,successes,failures FROM nava_or_usage WHERE day=(now() AT TIME ZONE 'UTC')::date ORDER BY requests DESC`;return {limits:OR_LIMITS,requests:r?.requests||0,models}}
