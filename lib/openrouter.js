import {isRouterId,routerInfo,OR_AUTO} from './openrouter-shared.js';
export const OR_BASE='https://openrouter.ai/api/v1';
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const zero=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number(v)===0;
export function filterFreeModels(data){
 if(!Array.isArray(data))return [];
 const models=new Map();
 for(const m of data){
  const id='or/'+m?.id;
  if(!isRouterId(id)||m?.active===false)continue;
  const p=m.pricing,a=m.architecture;
  if(!p||!zero(p.prompt)||!zero(p.completion)||!Object.values(p).every(v=>v===null||zero(v)))continue;
  if(!Array.isArray(a?.input_modalities)||!a.input_modalities.includes('text')||!Array.isArray(a.output_modalities)||!a.output_modalities.includes('text'))continue;
  // VOST only renders text outputs and accepts text/image inputs.
  if(a.output_modalities.some(x=>x!=='text'))continue;
  const kind=id===OR_AUTO?'chat':a.input_modalities.includes('image')?'vision':'chat';
  models.set(id,{...routerInfo(id,{kind,name:typeof m.name==='string'?m.name.replace(/\s*\(free\)\s*$/i,'').slice(0,120):undefined}),active:true});
 }
 return [...models.values()].sort((a,b)=>a.id===OR_AUTO?-1:b.id===OR_AUTO?1:a.name.localeCompare(b.name));
}
export function createRouterCatalog({fetcher=fetch,now=Date.now}={}){
 let cached=null,pending=null;
 return async key=>{
  if(!key)return [];
  if(cached?.key===key&&now()-cached.at<60000)return cached.models;
  if(!pending)pending=(async()=>{try{
   const r=await fetcher(OR_BASE+'/models',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!r.ok)return null;const j=await r.json();if(!Array.isArray(j.data))return null;
   const models=filterFreeModels(j.data);cached={key,at:now(),models};return models;
  }catch{return null}})().finally(()=>{pending=null});
  return await pending; // no stale catalog fallback for free-only billing protection
 };
}
export const routerCatalog=createRouterCatalog();
export async function requireRouterModel(id,key=process.env.OPENROUTER_API_KEY){
 if(!isRouterId(id))fail(400,'OpenRouter: free models only');
 if(!key)fail(503,'OpenRouter: provider unavailable');
 const models=await routerCatalog(key);if(models===null)fail(503,'OpenRouter: model catalog unavailable');
 const m=models.find(x=>x.id===id);if(!m)fail(400,'OpenRouter: free model unavailable');return m;
}
export function routerPayload(payload,model){
 if(!isRouterId(model?.id)||payload.model!==model.id)fail(400,'OpenRouter: free models only');
 return {model:model.id.slice(3),messages:payload.messages,stream:true,max_tokens:payload.max_completion_tokens,...(payload.temperature===undefined?{}:{temperature:payload.temperature}),stream_options:{include_usage:true},provider:{data_collection:'deny',max_price:{prompt:0,completion:0,image:0,request:0}}};
}
export function routerError(status){return status===429?'OpenRouter: rate limit or daily quota reached':status===401?'OpenRouter: credentials rejected':status===402?'OpenRouter: insufficient balance or free access':status===403?'OpenRouter: provider access denied':status===404?'OpenRouter: no compatible free endpoint':status>=500?'OpenRouter: temporarily unavailable':'OpenRouter: request rejected ('+status+')'}
export async function openRouter({model,payload,models,fetchAttempt,reserveAttempt,recordAttempt,signal}){
 let actual=model;
 for(let attempt=1;attempt<=2;attempt++){
  signal?.throwIfAborted();const day=await reserveAttempt(actual.id);
  let response;
  try{response=await fetchAttempt(routerPayload({...payload,model:actual.id},actual),signal)}catch(e){await recordAttempt(actual.id,day,{success:false,prompt:0,completion:0});throw e}
  if(response.ok&&response.body)return {response,model:actual.id,day,attempts:attempt};
  await response.body?.cancel().catch(()=>{});await recordAttempt(actual.id,day,{success:false,prompt:0,completion:0});
  const fallback=models?.find(x=>x.id===OR_AUTO);
  if(attempt===1&&[502,503].includes(response.status)&&actual.kind==='chat'&&actual.id!==OR_AUTO&&fallback){actual=fallback;continue}
  return {response,model:actual.id,attempts:attempt};
 }
}
export function routerStream(){
 let buf='';const dec=new TextDecoder(),enc=new TextEncoder();
 function line(s){if(!s.startsWith('data:'))return '';const d=s.slice(5).trim();if(d==='[DONE]')return 'data: [DONE]\n\n';let p;try{p=JSON.parse(d)}catch{return ''}if(p.error)return 'data: '+JSON.stringify({error:{message:'OpenRouter: stream interrupted'}})+'\n\n';
 const choices=(Array.isArray(p.choices)?p.choices:[]).slice(0,1).map(c=>({delta:{...(typeof c?.delta?.content==='string'?{content:c.delta.content}:{}),...(typeof c?.delta?.reasoning==='string'||typeof c?.delta?.reasoning_content==='string'?{reasoning:'active'}:{})},finish_reason:c?.finish_reason==='error'?'network_error':c?.finish_reason==='stop'?'stop':c?.finish_reason==='length'?'length':null}));
 const n=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000000?x:0;
 const model=typeof p.model==='string'&&/^[\w./:-]{1,200}$/.test(p.model)?p.model:undefined;
 return 'data: '+JSON.stringify({choices,...(model?{model}:{}),...(p.usage?{usage:{prompt_tokens:n(p.usage.prompt_tokens),completion_tokens:n(p.usage.completion_tokens),total_tokens:n(p.usage.total_tokens)}}:{})})+'\n\n';
 }
 return new TransformStream({transform(chunk,c){buf+=dec.decode(chunk,{stream:true});if(buf.length>2000000)throw Error('OpenRouter stream too large');let i;while((i=buf.indexOf('\n'))>=0){const s=line(buf.slice(0,i));buf=buf.slice(i+1);if(s)c.enqueue(enc.encode(s))}},flush(c){buf+=dec.decode();const s=line(buf);if(s)c.enqueue(enc.encode(s))}});
}
