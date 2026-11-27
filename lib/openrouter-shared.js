export const OR_PREFIX='or/';
export const OR_AUTO='or/openrouter/free';
export const OR_LIMITS=Object.freeze({daily:50,minute:20});
export function isRouterId(id){return typeof id==='string'&&/^or\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:free$/.test(id)&&id.length<=200||id===OR_AUTO}
export function routerInfo(id,meta){
 if(!isRouterId(id))return null;
 const slug=id.slice(3),kind=meta?.kind==='vision'?'vision':'chat';
 return {id,name:typeof meta?.name==='string'?meta.name.slice(0,120):id===OR_AUTO?'OpenRouter Free Auto':slug.split('/').pop().replace(/:free$/,'').replace(/-/g,' '),kind,vendor:'OpenRouter',provider:'openrouter',detail:'Free'};
}
