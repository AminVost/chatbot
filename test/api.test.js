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
test('owner must be verified and exact email',()=>{assert.equal(isOwner('aminvost@gmail.com',true),true);assert.equal(isOwner('aminvost@gmail.com',false),false);assert.equal(isOwner('other@gmail.com',true),false)});
test('origin restriction',()=>{assert.equal(sameOrigin({headers:{origin:'https://evil.test',host:'nava-groq-chatbot.vercel.app'}}),false);assert.equal(sameOrigin({headers:{origin:'https://nava-groq-chatbot.vercel.app',host:'nava-groq-chatbot.vercel.app'}}),true)});
