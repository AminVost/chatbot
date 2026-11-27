import { identity, reserve } from '../lib/account.js';
import { modelInfo, allowed, voices } from '../lib/models.js';
const BASE='https://api.groq.com/openai/v1';
function invalid(message){throw Object.assign(new Error(message),{status:400});}
export function prepare(body){
 const {op,model}=body;
 if(op==='models')return {path:'/models',method:'GET'};
 if(typeof model!=='string'||!/^[a-zA-Z0-9_.\/-]{1,150}$/.test(model))invalid('Invalid model');
 const info=modelInfo(model);
 if(!allowed(info.kind,op))invalid('Model and operation are incompatible');
 if(op==='chat'||op==='safety'){
  if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>60)invalid('Invalid messages');
  const messages=body.messages.map(m=>{
   if(!['user','assistant','system'].includes(m.role))invalid('Invalid role');
   if(typeof m.content==='string'&&m.content.length<=60000)return {role:m.role,content:m.content};
   if(op==='chat'&&info.kind==='vision'&&m.role==='user'&&Array.isArray(m.content)&&m.content.length<=4){
    return {role:m.role,content:m.content.map(p=>{
     if(p.type==='text'&&typeof p.text==='string'&&p.text.length<=60000)return {type:'text',text:p.text};
     if(p.type==='image_url'&&typeof p.image_url?.url==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image_url.url)&&p.image_url.url.length<2800000)return {type:'image_url',image_url:{url:p.image_url.url}};
     invalid('Invalid image');
    })};
   }
   invalid('Invalid message content');
  });
  const payload={model,messages,stream:op==='chat'};
  if(op==='chat'){payload.max_completion_tokens=Math.min(8192,Math.max(64,Number(body.maxTokens)||2048));if(!model.includes('gpt-oss')&&!model.includes('compound'))payload.temperature=Math.min(1,Math.max(0,Number(body.temperature??0.7)||0));}
  return {path:'/chat/completions',payload};
 }
 if(op==='tts'){
  const list=model.includes('arabic')?voices.ar:voices.en;
  if(typeof body.input!=='string'||!body.input.trim()||body.input.length>200||!list.includes(body.voice))invalid('Invalid text or voice');
  return {path:'/audio/speech',payload:{model,input:body.input,voice:body.voice,response_format:'wav'}};
 }
 if(op==='stt'){
  if(typeof body.file!=='string'||body.file.length>3800000||!/^[A-Za-z0-9+/=]+$/.test(body.file))invalid('Audio exceeds limit or invalid data');
  const filename=String(body.filename||'audio.webm').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
  if(!/\.(wav|mp3|mp4|m4a|webm|ogg|flac|mpeg|mpga)$/i.test(filename))invalid('Unsupported audio format');
  const f=new FormData();f.append('file',new Blob([Buffer.from(body.file,'base64')]),filename);f.append('model',model);f.append('response_format','json');
  if(body.language&&/^[a-z]{2}$/.test(body.language))f.append('language',body.language);
  return {path:'/audio/transcriptions',form:f};
 }
 invalid('Unknown operation');
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Origin denied'});}catch{return res.status(403).json({error:'Origin denied'});}}
 const key=process.env.GROQ_API_KEY;if(!key)return res.status(503).json({error:'Service unavailable'});
 try{
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid JSON'});}
  if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>4100000)return res.status(413).json({error:'Request too large'});
  const user=await identity(req);if(!user.admin&&b.op==='chat')b.maxTokens=Math.min(Number(b.maxTokens)||1024,1024);const p=prepare(b);await reserve(user,b.op,b.model||'');const headers={Authorization:'Bearer '+key};
  const options={method:p.method||'POST',headers,signal:AbortSignal.timeout(55000)};
  if(p.form)options.body=p.form;else if(p.payload){headers['Content-Type']='application/json';options.body=JSON.stringify(p.payload);}
  const upstream=await fetch(BASE+p.path,options);
  for(const h of ['x-ratelimit-limit-requests','x-ratelimit-remaining-requests','x-ratelimit-limit-tokens','x-ratelimit-remaining-tokens','retry-after']){const v=upstream.headers.get(h);if(v)res.setHeader(h,v);}
  if(!upstream.ok){let msg='Groq request failed';try{msg=(await upstream.json()).error?.message||msg;}catch{}return res.status(upstream.status).json({error:String(msg).replace(/gsk_[\w-]+/g,'[redacted]').slice(0,500)});}
  if(b.op==='chat'){
   res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
   const reader=upstream.body.getReader();res.on('close',()=>reader.cancel().catch(()=>{}));
   try{while(true){const {done,value}=await reader.read();if(done)break;if(!res.write(Buffer.from(value)))await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve()};res.once('drain',done);res.once('close',done);});}}catch{if(!res.destroyed)res.write('data: '+JSON.stringify({error:{message:'Stream interrupted'}})+'\n\n');}return res.end();
  }
  if(b.op==='tts'){const audio=Buffer.from(await upstream.arrayBuffer());if(audio.length<44||audio.subarray(0,4).toString()!=='RIFF'||audio.subarray(8,12).toString()!=='WAVE')return res.status(502).json({error:'Invalid WAV received from Groq'});res.setHeader('Content-Type','audio/wav');res.setHeader('Content-Length',audio.length);return res.end(audio);}
  return res.status(200).json(await upstream.json());
 }catch(e){if(!res.headersSent)return res.status(e.status||502).json({error:e.status?e.message:'Unable to connect to Groq. Please retry.'});res.end();}
}
