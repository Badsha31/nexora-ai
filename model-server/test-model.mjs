import {chat} from './adapter.js';

const content=await chat([
  {role:'system',content:'You are Nexora AI coding engine. Return concise code-focused output.'},
  {role:'user',content:'Write a JavaScript function named add that returns the sum of two numbers. Return only the function.'}
],{maxTokens:300,temperature:0.1,timeoutMs:120000});

if(!content.trim()){
  console.error('Gemini returned empty content');
  process.exit(1);
}
console.log(content);
console.log('\nGemini model inference: PASS');
