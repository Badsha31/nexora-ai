import {chat} from '../model-server/adapter.js';
import {execCommand} from '../tools/terminal.js';
import {requirePolicy} from '../admin/policy.js';
import {build} from '../build-engine/index.js';
import {test as runTests} from '../test-engine/index.js';
import {buildAndroid} from '../android-engine/index.js';
import {scanSecurity} from '../security-engine/index.js';
import {indexProject,searchContext} from '../repository-indexer/index.js';
import {getMemory,setMemory} from '../project-memory/index.js';
import fs from 'node:fs';
import path from 'node:path';
import {err} from '../shared/errors.js';

const MAX_STEPS=Number(process.env.NEXORA_AGENT_MAX_STEPS||60);
const MAX_FILE_BYTES=2*1024*1024;
function safePath(root,rel){if(typeof rel!=='string'||!rel.trim())throw err('VALIDATION','File path is required');const target=path.resolve(root,rel);if(target!==root&&!target.startsWith(root+path.sep))throw err('PATH_DENIED','Path outside project',403);return target;}
function extractJsonObject(text){
 const s=String(text||'').trim();
 let start=-1,depth=0,inString=false,escape=false;
 for(let i=0;i<s.length;i++){
  const ch=s[i];
  if(start<0){if(ch==='{'){start=i;depth=1;}continue;}
  if(inString){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')inString=false;continue;}
  if(ch==='"'){inString=true;continue;}
  if(ch==='{')depth++;
  else if(ch==='}') {depth--;if(depth===0)return s.slice(start,i+1);}
 }
 return null;
}
function parseAction(text){
 const raw=String(text||'').trim();
 const candidates=[raw,raw.replace(/^\s*\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`\s*$/,'').trim(),extractJsonObject(raw)].filter(Boolean);
 for(const candidate of candidates){try{const parsed=JSON.parse(candidate);if(parsed&&typeof parsed==='object')return parsed;}catch{}}
 throw err('MODEL_PROTOCOL','Model did not return valid JSON action protocol',502,{raw:raw.slice(0,4000)});
}
function context(project,request,spec){const memory=getMemory(project.id).slice(0,100);return {brief:{name:project.name,type:project.type,frontend:project.frontend,backend:project.backend,database:project.database_kind,...spec},memory,files:searchContext(project.id,request).slice(0,18).map(x=>({path:x.path,language:x.language,content:x.content.slice(0,14000)}))};}
const system=[
'You are Nexora AI, a production software factory with three specialist roles:',
'1) WEBSITE ENGINEER: builds complete responsive websites and full-stack web apps from a name plus a visual reference and requested stack.',
'2) ANDROID BUILD ENGINEER: builds real Android Studio/Gradle projects, configures manifests/resources/networking/storage/authentication and produces APK/AAB when build tools exist.',
'3) CYBER SECURITY ENGINEER: performs defensive security reviews, hardening, dependency audits and fixes. Do not perform unauthorized intrusion, credential theft, malware, persistence or destructive actions.',
'You are an execution agent, not a chat-only advisor. Inspect the project, create/edit real files, run commands, build, test and fix failures.',
'For a supplied design reference, preserve the visual intent closely: composition, spacing, hierarchy, typography, responsive behavior, component placement and branding. Do not merely describe the screenshot.',
'For new projects, establish production structure first, then implement the required frontend/backend/database/auth/admin/API flows appropriate to the request. Never use fake buttons, fake success messages, placeholder business logic or invented deployment results.',
'If stack fields are auto, choose a stable appropriate stack and record that decision in memory.',
'Never expose secrets or commit .env/private keys. Never claim an operation succeeded unless its tool result says it succeeded.',
'Return ONLY one compact JSON object: {"message":"short progress message","action":{"type":"...","path":"","content":"","command":"","files":[],"variant":""}}. Do not include markdown, prose, or explanations.',
'Action types: write_file, write_files, run, build, test, android_build, security_scan, index, remember, finish.',
'write_files may contain up to 8 files. Use small verifiable increments. After major implementation, build/test. If a command fails, inspect the actual error and fix it before retrying.'
].join('\\n');
async function executeAction(project,a){
 if(!a||typeof a.type!=='string')throw err('MODEL_PROTOCOL','Missing action type',502);
 switch(a.type){
 case 'write_file':{requirePolicy('file_write');const target=safePath(project.root,a.path);const content=String(a.content??'');if(Buffer.byteLength(content,'utf8')>MAX_FILE_BYTES)throw err('FILE_TOO_LARGE','File exceeds 2MB limit',413);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,'utf8');return {type:a.type,path:a.path,success:true,bytes:Buffer.byteLength(content,'utf8')};}
 case 'write_files':{requirePolicy('file_write');const files=Array.isArray(a.files)?a.files.slice(0,8):[];if(!files.length)throw err('VALIDATION','files array is required');const written=[];for(const f of files){const target=safePath(project.root,f.path);const content=String(f.content??'');if(Buffer.byteLength(content,'utf8')>MAX_FILE_BYTES)throw err('FILE_TOO_LARGE','A file exceeds 2MB limit',413);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,'utf8');written.push({path:f.path,bytes:Buffer.byteLength(content,'utf8')});}return {type:a.type,success:true,files:written};}
 case 'run':{const result=await execCommand(project,String(a.command||''));return {type:a.type,command:a.command,success:result.code===0,code:result.code,stdout:result.stdout.slice(0,16000),stderr:result.stderr.slice(0,16000)};}
 case 'build':{const result=await build(project,String(a.command||'npm run build'));return {type:a.type,success:result.code===0,result:{code:result.code,stdout:result.stdout?.slice(0,16000),stderr:result.stderr?.slice(0,16000)}};}
 case 'test':{const result=await runTests(project,String(a.command||'npm test'));return {type:a.type,success:result.code===0,result:{code:result.code,stdout:result.stdout?.slice(0,16000),stderr:result.stderr?.slice(0,16000)}};}
 case 'android_build':return {type:a.type,...await buildAndroid(project,{variant:a.variant==='release'?'release':'debug'})};
 case 'security_scan':return {type:a.type,...await scanSecurity(project)};
 case 'index':return {type:a.type,success:true,result:indexProject(project)};
 case 'remember':setMemory(project.id,'agent',String(a.path||'note'),String(a.content||''));return {type:a.type,success:true};
 case 'finish':return {type:a.type,success:true,message:String(a.message||'Completed')};
 default:throw err('MODEL_PROTOCOL','Unsupported model action: '+a.type,502);
 }
}
async function referenceBrief(project){
 if(!project.reference_path)return '';
 const file=safePath(project.root,project.reference_path);if(!fs.existsSync(file))return '';
 const ext=path.extname(file).toLowerCase();const mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';
 const data='data:'+mime+';base64,'+fs.readFileSync(file).toString('base64');
 return await chat([{role:'system',content:'You are a senior UI/UX design analyst. Analyze the supplied website/app screenshot for a software engineer. Return a concise but detailed design specification: page structure, layout grid, spacing, typography, colors, visual hierarchy, components, responsive behavior, navigation, forms, cards, buttons, imagery and notable interactions. Do not write code.'},{role:'user',content:[{type:'image_url',image_url:{url:data}},{type:'text',text:'Analyze this visual reference so another agent can reproduce its design closely.'}]}],{maxTokens:6000,timeoutMs:120000});
}
export async function execute({project,request,spec={},onStep}){
 requirePolicy('model_access');const history=[];const brief=await referenceBrief(project).catch(e=>{console.warn('[REFERENCE ANALYSIS]',e.message);return '';});if(brief)setMemory(project.id,'design','reference_analysis',brief);
 for(let step=1;step<=MAX_STEPS;step++){
  const c=context(project,request,spec);
  const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify({task:request,step,maxSteps:MAX_STEPS,project:{name:project.name,root:project.root,type:project.type,frontend:project.frontend,backend:project.backend,database:project.database_kind},brief:c.brief,referenceAnalysis:brief||getMemory(project.id).find(x=>x.key==='reference_analysis')?.value||'',context:c,history:history.slice(-12)})}];
  let current=null;
  let raw='';
  for(let attempt=1;attempt<=3;attempt++){
   raw=await chat(messages,{maxTokens:8192,timeoutMs:240000,responseFormat:{type:'json_object'}});
   try{current=parseAction(raw);break;}
   catch(protocolError){
    if(attempt===3)throw protocolError;
    history.push({step,message:'Model returned invalid action JSON; requesting a corrected action.',action:{type:'protocol_retry',attempt},result:{success:false,error:protocolError.message,raw:raw.slice(0,2000)}});
    messages.push({role:'assistant',content:raw});
    messages.push({role:'user',content:'PROTOCOL REPAIR: Return ONLY one valid JSON object. No markdown fences and no prose. Required shape: {"message":"short progress message","action":{"type":"write_file|write_files|run|build|test|android_build|security_scan|index|remember|finish", ...}}.'});
   }
  }
  const result=await executeAction(project,current.action);const record={step,message:current.message,action:current.action,result};history.push(record);onStep?.(record);
  if(current.action.type==='finish')return {status:'completed',message:current.action.message||current.message,steps:history};
 }
 throw err('AGENT_MAX_STEPS','Agent reached the maximum execution steps without finishing',422,{steps:history.length});
}
