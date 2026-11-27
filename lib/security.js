import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
export function reject(status,message){throw Object.assign(new Error(message),{status})}
export function jsonBody(req,max=16384,{empty=false}={}){
 const raw=req.body;
 if(empty&&(raw===undefined||raw===null||raw===''))return {};
 if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||'')))reject(415,'JSON required');
 const declared=Number(req.headers['content-length']);if(Number.isFinite(declared)&&declared>max)reject(413,'Request too large');
 let b;try{b=typeof raw==='string'?JSON.parse(raw):raw}catch{reject(400,'Invalid JSON')}
 if(!b||typeof b!=='object'||Array.isArray(b))reject(400,'Invalid JSON object');
 if(Buffer.byteLength(JSON.stringify(b),'utf8')>max)reject(413,'Request too large');
 return b;
}
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function clientSubject(req){const raw=String(req.headers['x-forwarded-for']||'').trim();return isIP(raw)?raw.toLowerCase():'unknown'}
export function rateSubject(value,secret=process.env.NEON_AUTH_COOKIE_SECRET){if(!secret)reject(503,'Security configuration unavailable');return createHmac('sha256',secret).update(String(value)).digest('hex')}
const fields={
 'sign-in/social':['provider','callbackURL','errorCallbackURL','newUserCallbackURL','disableRedirect'],
 'sign-in/email':['email','password','rememberMe','callbackURL'],
 'sign-up/email':['email','password','name','callbackURL','rememberMe'],
 'sign-out':[],
 'email-otp/send-verification-otp':['email','type'],
 'email-otp/verify-email':['email','otp'],
 'email-otp/request-password-reset':['email'],
 'email-otp/reset-password':['email','otp','password']
};
export function authPayload(path,b,origin){
 if(!Object.hasOwn(fields,path))reject(400,'Unsupported authentication request');
 const out={};for(const key of fields[path])if(Object.hasOwn(b,key))out[key]=b[key];
 for(const key of ['callbackURL','errorCallbackURL','newUserCallbackURL'])if(key in out){
  let u;try{if(typeof out[key]!=='string'||out[key].length>2048)throw Error();u=new URL(out[key],origin)}catch{reject(400,'Invalid callback')}
  if(u.origin!==origin||u.username||u.password||!['/','/api/auth/return'].includes(u.pathname)||u.search||u.hash)reject(400,'Invalid callback');
  out[key]=u.href;
 }
 if(path==='sign-in/social'&&out.provider!=='google')reject(400,'Unsupported provider');
 if(fields[path].includes('email')){if(typeof out.email!=='string'||out.email.length>254||!/^[^\s@]+@[^\s@]+$/.test(out.email))reject(400,'Invalid email');out.email=out.email.trim().toLowerCase()}
 if(fields[path].includes('password')&&(typeof out.password!=='string'||!out.password.length||out.password.length>128))reject(400,'Invalid password');
 if(path==='sign-up/email'&&(typeof out.name!=='string'||!out.name.trim()||out.name.length>80||out.password.length<8))reject(400,'Invalid registration');
 if(fields[path].includes('otp')&&(typeof out.otp!=='string'||!/^\d{4,10}$/.test(out.otp)))reject(400,'Invalid verification code');
 if(path==='email-otp/reset-password'&&out.password.length<8)reject(400,'Invalid password');
 if(path==='email-otp/send-verification-otp'&&out.type!=='email-verification')reject(400,'Invalid verification request');
 for(const k of ['rememberMe','disableRedirect'])if(k in out&&typeof out[k]!=='boolean')reject(400,'Invalid authentication option');
 return out;
}
export function authLimits(path,email){
 if(path==='sign-out')return [];
 if(path==='sign-in/social')return [{scope:'oauth',seconds:60,limit:30}];
 if(path==='sign-in/email')return [{scope:'login',seconds:60,limit:30}];
 if(path==='sign-up/email')return [{scope:'signup',seconds:600,limit:15}];
 if(path==='email-otp/send-verification-otp'||path==='email-otp/request-password-reset')return [{scope:'otp-send',seconds:600,limit:20},{scope:'otp-recipient',seconds:600,limit:6,email}];
 return [{scope:'otp-verify',seconds:600,limit:30}];
}
export function safeProviderMessage(message,keys=[]){let s=String(message||'Provider request failed');for(const k of keys)if(k)s=s.split(k).join('[redacted]');return s.replace(/gsk_[\w-]+/g,'[redacted]').replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi,'Bearer [redacted]').slice(0,500)}
