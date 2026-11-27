// Only known production hosts may be used for OAuth redirects and session checks.
const hosts=new Set(['nava-groq-chatbot.vercel.app','ai.aminvost.ir']);
export function requestOrigin(req){
 const host=String(req.headers?.host||'').toLowerCase();
 return hosts.has(host)?'https://'+host:null;
}
export function sameOrigin(req){const origin=requestOrigin(req);return Boolean(origin&&req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||req.headers.origin===origin))}
