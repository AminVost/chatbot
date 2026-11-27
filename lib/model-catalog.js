// Validate model IDs against the live account catalog, without exposing provider metadata.
import {routerCatalog} from './openrouter.js';
import {known} from './models.js';
import {zaiInfo,zaiModels} from './providers.js';
const BASE='https://api.groq.com/openai/v1';
let cached=null,pending=null;
const ID=/^[a-zA-Z0-9_.\/-]{1,150}$/;
export function activeModels(data){return Array.isArray(data)?[...new Set(data.filter(x=>x&&x.active!==false&&typeof x.id==='string'&&ID.test(x.id)&&!x.id.startsWith('zai/')&&!x.id.startsWith('or/')).map(x=>x.id))]:[]}
export async function groqCatalog(key){
 if(!key)return null;
 if(cached&&Date.now()-cached.at<60000)return cached.ids;
 if(!pending)pending=(async()=>{try{const r=await fetch(BASE+'/models',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)return null;const j=await r.json();if(!Array.isArray(j.data))return null;const ids=activeModels(j.data);cached={ids,at:Date.now()};return ids}catch{return null}})().finally(()=>{pending=null});
 return await pending??(cached&&Date.now()-cached.at<600000?cached.ids:null);
}
export async function modelCatalog(){const [ids,router]=await Promise.all([groqCatalog(process.env.GROQ_API_KEY),routerCatalog(process.env.OPENROUTER_API_KEY)]);if(ids===null&&!process.env.ZAI_API_KEY&&!router?.length)throw Object.assign(Error('Model catalog temporarily unavailable'),{status:503});return [...(ids||[]).map(id=>({id,active:true})),...(process.env.ZAI_API_KEY?zaiModels.map(m=>({id:m.id,active:true,owned_by:'Z.ai'})):[]),...(router||[])]}
export function modelPermitted(id,ids){if(zaiInfo(id))return true;if(typeof id!=='string'||(id.startsWith('zai/')||id.startsWith('or/')))return false;return ids===null?known.some(m=>m[0]===id):ids.includes(id)}
export async function requireModel(id){if(zaiInfo(id))return;const ids=await groqCatalog(process.env.GROQ_API_KEY);if(!modelPermitted(id,ids))throw Object.assign(Error('Model unavailable for this account'),{status:400})}
