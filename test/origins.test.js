import test from 'node:test';
import assert from 'node:assert/strict';
import {requestOrigin,sameOrigin} from '../lib/origins.js';
test('both production domains accepted',()=>{for(const host of ['ai.aminvost.ir','nava-groq-chatbot.vercel.app']){const req={headers:{host,origin:'https://'+host}};assert.equal(requestOrigin(req),'https://'+host);assert.equal(sameOrigin(req),true)}});
test('host and origin injection rejected',()=>{for(const headers of [{host:'evil.test',origin:'https://evil.test'},{host:'ai.aminvost.ir',origin:'https://evil.test'},{host:'ai.aminvost.ir',origin:'http://ai.aminvost.ir'},{host:'ai.aminvost.ir.evil.test'},{host:'ai.aminvost.ir',origin:'https://nava-groq-chatbot.vercel.app'}])assert.equal(sameOrigin({headers}),false)});
