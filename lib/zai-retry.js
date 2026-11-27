import {setTimeout as delay} from 'node:timers/promises';
import {zaiInfo} from './providers.js';
export const ZAI_FALLBACK='zai/glm-4.5-flash';
const failed={success:false,prompt:0,completion:0};
export function overload(status,code){return status===429&&String(code)==='1305'}
function retryDelay(response,index){
 const raw=response.headers.get('retry-after');
 const requested=raw===null?0:/^\d+(\.\d+)?$/.test(raw)?Number(raw)*1000:Math.max(0,Date.parse(raw)-Date.now());
 if(Number.isFinite(requested)&&requested>5000)return null;
 return Math.max([800,1600,2400][index]||800,Number.isFinite(requested)?requested:0);
}
// Only retry a documented overload before any successful response headers are sent.
// Each attempt gets its own provider quota reservation; user quota stays per logical turn.
export async function openZai({model,fetchAttempt,reserveAttempt,recordAttempt,signal,sleep=(ms,s)=>delay(ms,undefined,{signal:s})}){
 if(!zaiInfo(model))throw Object.assign(new Error('Z.ai model not enabled'),{status:400});
 const plan=[model,model,model,...(model==='zai/glm-4.7-flash'?[ZAI_FALLBACK]:[])];
 for(let i=0;i<plan.length;i++){
  signal?.throwIfAborted();
  const actual=plan[i],day=await reserveAttempt(actual);
  let response;
  try{signal?.throwIfAborted();response=await fetchAttempt(actual,signal)}
  catch(e){await recordAttempt(actual,day,failed);throw e}
  if(response.ok&&response.body)return {response,model:actual,day,attempts:i+1};
  let code;
  try{const e=await response.json();code=e.error?.code??e.code}catch{}
  await recordAttempt(actual,day,failed);
  const ms=retryDelay(response,i);
  if(!overload(response.status,code)||i===plan.length-1||ms===null)return {response,model:actual,code,attempts:i+1};
  await sleep(ms,signal);
 }
}
