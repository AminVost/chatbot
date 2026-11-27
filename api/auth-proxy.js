import {handleAuthProxyRequest,processAuthMiddleware} from '@neon/auth/server';
import {authPayload,jsonBody} from '../lib/security.js';
import {limitAuth} from '../lib/security-rate.js';
import {requestOrigin} from '../lib/origins.js';
const routes=new Map([['get-session','GET'],['token','GET'],['sign-in/social','POST'],['sign-in/email','POST'],['sign-up/email','POST'],['sign-out','POST'],['email-otp/send-verification-otp','POST'],['email-otp/verify-email','POST'],['email-otp/request-password-reset','POST'],['email-otp/reset-password','POST']]);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const origin=requestOrigin(req);if(!origin)return res.status(403).json({error:'Origin denied'});
 const incoming=new URL(req.url,origin), path=String(req.query?.path??incoming.searchParams.get('path')??'').replace(/^\/+|\/+$/g,'');
 if(path!=='return'&&routes.get(path)!==req.method)return res.status(404).json({error:'Not found'});
 if(path==='return'&&req.method!=='GET')return res.status(405).end();
 if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'))return res.status(403).json({error:'Origin denied'});
 const url=new URL('/api/auth/'+path,origin);for(const [k,v] of incoming.searchParams)if(k!=='path')url.searchParams.append(k,v);
 const headers=new Headers();for(const name of ['cookie','origin','referer','content-type','accept','user-agent','x-neon-client-info'])if(typeof req.headers[name]==='string')headers.set(name,req.headers[name]);
 if(!headers.has('origin'))headers.set('origin',origin);
 try{
 const config={baseUrl:process.env.NEON_AUTH_BASE_URL,cookieSecret:process.env.NEON_AUTH_COOKIE_SECRET,sameSite:'lax'};
 if(!config.baseUrl||!config.cookieSecret)return res.status(503).json({error:'Authentication configuration unavailable'});
 let body;if(req.method==='POST'){const data=authPayload(path,jsonBody(req,16384,{empty:path==='sign-out'}),origin);await limitAuth(req,path,data);body=JSON.stringify(data);headers.set('content-type','application/json')}
 const request=new Request(url,{method:req.method,headers,body});
 if(path==='return'){
 const result=await processAuthMiddleware({...config,request,pathname:url.pathname,skipRoutes:[url.pathname],loginUrl:'/login'});
 if(result.cookies?.length)res.setHeader('Set-Cookie',result.cookies);
 const target=new URL('/',origin);if(result.action!=='redirect_oauth'&&url.searchParams.has('neon_auth_session_verifier'))target.searchParams.set('neon_auth_session_verifier',url.searchParams.get('neon_auth_session_verifier'));
 return res.redirect(303,target.toString());
 }
 const response=await handleAuthProxyRequest({...config,request,path});
 for(const [k,v] of response.headers)if(!['set-cookie','content-length','content-encoding','transfer-encoding','cache-control'].includes(k))res.setHeader(k,v);
 const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
 return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});console.error('NAVA auth proxy failed',e?.name||'Error');return res.status(502).json({error:'Authentication temporarily unavailable'})}
}