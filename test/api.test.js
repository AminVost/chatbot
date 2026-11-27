import test from 'node:test';import assert from 'node:assert/strict';import {prepare} from '../api/groq.js';import {modelInfo,allowed} from '../lib/models.js';
test('model discovery',()=>assert.deepEqual(prepare({op:'models'}),{path:'/models',method:'GET'}));
test('chat caps tokens and enables streaming',()=>{const p=prepare({op:'chat',model:'openai/gpt-oss-120b',messages:[{role:'user',content:'Hello'}],maxTokens:100000});assert.equal(p.payload.stream,true);assert.equal(p.payload.max_completion_tokens,8192);});
test('audio and safety cannot be sent as chat',()=>{assert.throws(()=>prepare({op:'chat',model:'whisper-large-v3'}));assert.equal(allowed(modelInfo('openai/gpt-oss-safeguard-20b').kind,'chat'),false);});
test('vision accepts only supported local images',()=>{const message={role:'user',content:[{type:'text',text:'test'},{type:'image_url',image_url:{url:'data:image/png;base64,YQ=='}}]};assert.equal(prepare({op:'chat',model:'qwen/qwen3.8-27b',messages:[message]}).payload.messages.length,1);assert.throws(()=>prepare({op:'chat',model:'openai/gpt-oss-20b',messages:[message]}));message.content[1].image_url.url='https://example.com/a.png';assert.throws(()=>prepare({op:'chat',model:'qwen/qwen3.8-27b',messages:[message]}));});
test('TTS voice validation',()=>{assert.equal(prepare({op:'tts',model:'canopylabs/orpheus-arabic-saudi',voice:'fahad',input:'سلام'}).payload.voice,'fahad');assert.throws(()=>prepare({op:'tts',model:'canopylabs/orpheus-arabic-saudi',voice:'troy',input:'Hi'}));});
test('audio form construction',()=>{const p=prepare({op:'stt',model:'whisper-large-v3',file:'YQ==',filename:'test.wav',language:'fa'});assert.equal(p.form.get('language'),'fa');assert.equal(p.form.get('file').name,'test.wav');});
test('safety runs non-streaming',()=>assert.equal(prepare({op:'safety',model:'meta-llama/llama-prompt-guard-2-22m',messages:[{role:'user',content:'Hello'}]}).payload.stream,false));

test('Orpheus character limit enforced',()=>assert.throws(()=>prepare({op:'tts',model:'canopylabs/orpheus-v1-english',voice:'troy',input:'a'.repeat(201)})));
test('Allam classified as chat',()=>assert.equal(modelInfo('allam-2-7b').kind,'chat'));

test('Orpheus allows all official voice IDs',()=>{for(const [model,ids] of [['canopylabs/orpheus-v1-english',['autumn','diana','hannah','austin','daniel','troy']],['canopylabs/orpheus-arabic-saudi',['abdullah','fahad','sultan','lulwa','noura','aisha']]])for(const voice of ids)assert.equal(prepare({op:'tts',model,input:'Hello',voice}).payload.voice,voice)});

import {isOwner,sameOrigin} from '../lib/account.js';
test('owner must be verified, exact email and bound UUID',()=>{const id='123e4567-e89b-12d3-a456-426614174000';assert.equal(isOwner('aminvost@gmail.com',true,id,id),true);assert.equal(isOwner('aminvost@gmail.com',false,id,id),false);assert.equal(isOwner('other@gmail.com',true,id,id),false);assert.equal(isOwner('aminvost@gmail.com',true,id,'other'),false)});
test('origin restriction',()=>{assert.equal(sameOrigin({headers:{origin:'https://evil.test',host:'nava-groq-chatbot.vercel.app'}}),false);assert.equal(sameOrigin({headers:{origin:'https://nava-groq-chatbot.vercel.app',host:'nava-groq-chatbot.vercel.app'}}),true)});

import {zaiModels,zaiPayload,usageObserver,ZAI_LIMITS} from '../lib/providers.js';
test('only documented free Z.ai models are routed',()=>{assert.equal(zaiModels.length,3);for(const m of zaiModels){assert.equal(modelInfo(m.id).provider,'zai');const p=prepare({op:'chat',model:m.id,messages:[{role:'user',content:'Hi'}],maxTokens:256});const z=zaiPayload(p.payload);assert.equal(z.model,m.id.slice(4));assert.equal(z.max_tokens,256);assert.equal(z.stream,true);assert.equal(z.max_completion_tokens,undefined)}assert.throws(()=>prepare({op:'chat',model:'zai/glm-5.3',messages:[{role:'user',content:'Hi'}]}));assert.throws(()=>prepare({op:'tts',model:'zai/glm-4.7-flash',input:'hi'}));assert.equal(ZAI_LIMITS.daily,150)});
test('Z.ai SSE usage observer handles split packets',()=>{const o=usageObserver(),e=new TextEncoder();o.push(e.encode('data: {"usage":{"prompt_tokens":12,'));o.push(e.encode('"completion_tokens":8}}\n\ndata: [DO'));o.push(e.encode('NE]\n\n'));assert.deepEqual(o.finish(),{success:true,prompt:12,completion:8})});
test('Z.ai interrupted stream is not counted successful',()=>{const o=usageObserver();o.push(new TextEncoder().encode('data: {"choices":[]}\n\n'));assert.equal(o.finish().success,false)});

import {zaiError} from '../lib/providers.js';
test('Z.ai error codes distinguish provider overload, billing and usage',()=>{assert.match(zaiError(429,'1305'),/overloaded/);assert.match(zaiError(429,'1113'),/balance/);assert.match(zaiError(429,'1302'),/rate limit/);assert.match(zaiError(429,'1308'),/usage limit/)});
