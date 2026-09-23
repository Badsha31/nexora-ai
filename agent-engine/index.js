import {chat} from '../model-server/adapter.js';
import {execCommand} from '../tools/terminal.js';
import {requirePolicy} from '../admin/policy.js';
import {build} from '../build-engine/index.js';
import {test as runTests} from '../test-engine/index.js';
import {indexProject,searchContext} from '../repository-indexer/index.js';
import {getMemory,setMemory} from '../project-memory/index.js';
import fs from 'node:fs';
import path from 'node:path';
import {err} from '../shared/errors.js';

const MAX_STEPS=Number(process.env.NEXORA_AGENT_MAX_STEPS||24);
const MAX_FILE_BYTES=1024*1024;
function safePath(root,rel){if(typeof rel!=='string'||!rel.trim())throw err('VALIDATION','File path is required');const target=path.resolve(root,rel);if(target!==root&&!target.startsWith(root+path.sep))throw err('PATH_DENIED','Path outside project',403);return target;}
function parseAction(text){const cleaned=String(text||'').replace(/^\s*\`\`\`(?:json)?/i,'').replace(/\`\`\`\s*$/,'').trim();try{return JSON.parse(cleaned)}catch{}const match=cleaned.match(/\{[\s\S]*\}/);if(match){try{return JSON.parse(match[0])}catch{}}throw err('MODEL_PROTOCOL','Model did not return valid JSON action protocol',502,{raw:cleaned.slice(0,4000)});}
function context(project,request){return {memory:getMemory(project.id).slice(0,80),files:searchContext(project.id,request).slice(0,12).map(x=>({path:x.path,language:x.language,content:x.content.slice(0,12000)}))};}
const system=`You are Nexora AI, a real software engineering agent. You have tools executed by the platform.
Never claim an action happened unless you requested it and the platform result says it succeeded.
Work incrementally. Inspect context before editing. Prefer small safe changes. After edits, run relevant tests/builds.
Return ONLY JSON in this schema:
{"message":"short progress message","action":{"type":"...","path":"","content":"","command":""}}
Action types:
- write_file: create/replace one project file. Requires path and content.
- run: execute one terminal command. Requires command.
- build: run the project's build.
- test: run the project's tests.
- index: refresh repository index.
- remember: save useful project memory; use path as key and content as value.
- finish: no more actions; requires message.
Do not use shell to bypass policy. Do not request destructive commands. Never expose secrets.
If a build/test fails, analyze the actual output and fix the relevant file before retrying.
For a new app, create real runnable files rather than describing them.`;
async function executeAction(project,a){
if(!a||typeof a.type!=='string')throw err('MODEL_PROTOCOL','Missing action type',502);
switch(a.type){
case 'write_file':{requirePolicy('file_write');const target=safePath(project.root,a.path);const content=String(a.content??'');if(Buffer.byteLength(content,'utf8')>MAX_FILE_BYTES)throw err('FILE_TOO_LARGE','File exceeds 1MB limit',413);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,'utf8');return {type:a.type,path:a.path,success:true,bytes:Buffer.byteLength(content,'utf8')};}
case 'run':{const result=await execCommand(project,String(a.command||''));return {type:a.type,command:a.command,success:result.code===0,code:result.code,stdout:result.stdout.slice(0,12000),stderr:result.stderr.slice(0,12000)};}
case 'build':{const result=await build(project,String(a.command||'npm run build'));return {type:a.type,success:true,result:{code:result.code,stdout:result.stdout?.slice(0,12000),stderr:result.stderr?.slice(0,12000)}};}
case 'test':{const result=await runTests(project,String(a.command||'npm test'));return {type:a.type,success:true,result:{code:result.code,stdout:result.stdout?.slice(0,12000),stderr:result.stderr?.slice(0,12000)}};}
case 'index':return {type:a.type,success:true,result:indexProject(project)};
case 'remember':setMemory(project.id,'agent',String(a.path||'note'),String(a.content||''));return {type:a.type,success:true};
case 'finish':return {type:a.type,success:true,message:String(a.message||'Completed')};
default:throw err('MODEL_PROTOCOL','Unsupported model action: '+a.type,502);}}
export async function execute({project,request,onStep}){
requirePolicy('model_access');const history=[];
for(let step=1;step<=MAX_STEPS;step++){
const c=context(project,request);
const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify({task:request,step,maxSteps:MAX_STEPS,project:{name:project.name,root:project.root},context:c,history:history.slice(-10)})}];
const raw=await chat(messages);const current=parseAction(raw);const result=await executeAction(project,current.action);const record={step,message:current.message,action:current.action,result};history.push(record);onStep?.(record);
if(current.action.type==='finish')return {status:'completed',message:current.action.message||current.message,steps:history};}
throw err('AGENT_MAX_STEPS','Agent reached the maximum execution steps without finishing',422,{steps:history.length});}
