export const zaiModels=Object.freeze([
 Object.freeze({id:'zai/glm-4.7-flash',name:'GLM 4.7 Flash',kind:'chat',vendor:'Z.ai',provider:'zai',detail:'Free'}),
 Object.freeze({id:'zai/glm-4.5-flash',name:'GLM 4.5 Flash',kind:'chat',vendor:'Z.ai',provider:'zai',detail:'Free'}),
 Object.freeze({id:'zai/glm-4.6v-flash',name:'GLM 4.6V Flash',kind:'vision',vendor:'Z.ai',provider:'zai',detail:'Free · availability varies'})
]);
export const ZAI_LIMITS=Object.freeze({daily:150,minute:5});
export const zaiInfo=id=>zaiModels.find(m=>m.id===id);
export function zaiPayload(payload){
 const info=zaiInfo(payload.model);if(!info)throw Object.assign(new Error('Z.ai model not enabled (free models only)'),{status:400});
 const {model,messages,stream,max_completion_tokens,temperature}=payload;
 return {model:model.slice(4),messages,stream,max_tokens:max_completion_tokens,temperature:Math.max(.01,Math.min(1,temperature??.7)),thinking:{type:'disabled'}};
}
export function usageObserver(){
 let buf='',done=false,usage=null,failed=false;const decoder=new TextDecoder();
 function line(s){if(!s.startsWith('data:'))return;const value=s.slice(5).trim();if(value==='[DONE]'){done=true;return}try{const p=JSON.parse(value);if(p.error||p.choices?.some(c=>['sensitive','model_context_window_exceeded','network_error'].includes(c.finish_reason)))failed=true;if(p.usage)usage=p.usage;}catch{}}
 return {push(bytes){buf+=decoder.decode(bytes,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){line(buf.slice(0,i));buf=buf.slice(i+1)}if(buf.length>2000000)buf='';},finish(){buf+=decoder.decode();if(buf.trim())line(buf);const safe=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000?n:0;return {success:done&&!failed,prompt:safe(usage?.prompt_tokens),completion:safe(usage?.completion_tokens)}}};
}

export function zaiError(status,code){switch(String(code??'')){case '1113':return 'Z.ai: insufficient balance or model access';case '1302':return 'Z.ai: request rate limit reached';case '1305':return 'Z.ai: temporarily overloaded';case '1308':case '1310':return 'Z.ai: provider usage limit reached';case '1311':case '1315':return 'Z.ai: API key or subscription does not permit this model';case '1313':return 'Z.ai: provider fair usage restriction';}return status===429?'Z.ai: rate limited or temporarily unavailable':status===401?'Z.ai: credentials rejected':status===402?'Z.ai: insufficient balance or model access':'Z.ai request failed ('+status+')';}
