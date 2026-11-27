export const known = [
['openai/gpt-oss-120b','GPT OSS 120B','chat','OpenAI','500 t/s'],
['openai/gpt-oss-20b','GPT OSS 20B','chat','OpenAI','1,000 t/s'],
['qwen/qwen3.8-27b','Qwen 3.8 27B','vision','Qwen','450 t/s'],
['qwen/qwen3.6-27b','Qwen 3.6 27B','vision','Qwen',''],
['llama-3.1-8b-instant','Llama 3.1 8B','chat','Meta','Enterprise'],
['llama-3.3-70b-versatile','Llama 3.3 70B','chat','Meta','Enterprise'],
['minimaxai/minimax-m2.7','MiniMax M2.7','chat','MiniMax','Enterprise'],
['allam-2-7b','Allam 2 7B','chat','SDAIA',''],
['whisper-large-v3','Whisper Large V3','stt','OpenAI',''],
['whisper-large-v3-turbo','Whisper V3 Turbo','stt','OpenAI',''],
['canopylabs/orpheus-v1-english','Orpheus English','tts','Canopy Labs','Preview'],
['canopylabs/orpheus-arabic-saudi','Orpheus Arabic','tts','Canopy Labs','Preview'],
['meta-llama/llama-prompt-guard-2-22m','Prompt Guard 22M','safety','Meta','Preview'],
['meta-llama/llama-prompt-guard-2-86m','Prompt Guard 86M','safety','Meta','Preview'],
['openai/gpt-oss-safeguard-20b','GPT OSS Safeguard','safety','OpenAI','Preview']
];
export const voices={en:['autumn','diana','hannah','austin','daniel','troy'],ar:['abdullah','fahad','sultan','lulwa','noura','aisha']};
export function modelInfo(id){
 const hit=known.find(x=>x[0]===id);
 if(hit)return {id,name:hit[1],kind:hit[2],vendor:hit[3],detail:hit[4]};
 const s=id.toLowerCase(); const kind=/whisper|transcri|speech-to-text/.test(s)?'stt':/orpheus|tts|text-to-speech/.test(s)?'tts':/guard|safety|moderation/.test(s)?'safety':/vision|scout|maverick|qwen3\.[68]|-vl/.test(s)?'vision':'chat';
 return {id,name:id.split('/').pop(),kind,vendor:id.split('/')[0],detail:''};
}
export function allowed(kind,mode){return mode==='chat'?['chat','vision'].includes(kind):kind===mode;}
