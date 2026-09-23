import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {requirePolicy} from '../admin/policy.js';
import {get} from '../credential-vault/index.js';
import {err} from '../shared/errors.js';

function runGit(project,args,env={}){
  return new Promise((resolve,reject)=>{
    const child=spawn('git',args,{cwd:project.root,env:{...process.env,...env,GIT_TERMINAL_PROMPT:'0'},stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d); child.stderr.on('data',d=>stderr+=d);
    child.on('error',reject); child.on('close',code=>resolve({code,stdout,stderr}));
  });
}
function repoUrl(input){
  const raw=String(input||'').trim();
  if(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(raw)) return raw.replace(/\.git$/,'')+'.git';
  if(/^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(raw)) return raw;
  throw err('GITHUB_URL_INVALID','Only a GitHub repository URL is accepted');
}
export async function push(project,{repo,branch='main',message='Nexora AI: generated project'}={}){
  requirePolicy('github_push');
  const token=get('github_token');
  if(!token) throw err('GITHUB_NOT_CONFIGURED','GitHub token is not configured in Master Admin',412);
  const remote=repoUrl(repo);
  const askpass=path.join(project.root,'.nexora-askpass.cjs');
  fs.writeFileSync(askpass,'process.stdout.write(process.env.NEXORA_GITHUB_TOKEN);\n',{mode:0o700});
  try{
    let r=await runGit(project,['rev-parse','--is-inside-work-tree']);
    if(r.code!==0){r=await runGit(project,['init']);if(r.code!==0)throw err('GIT_INIT_FAILED',r.stderr,502);}
    r=await runGit(project,['remote','get-url','origin']);
    if(r.code===0) await runGit(project,['remote','set-url','origin',remote]);
    else {r=await runGit(project,['remote','add','origin',remote]);if(r.code!==0)throw err('GIT_REMOTE_FAILED',r.stderr,502);}
    for(const a of [['config','user.name','Nexora AI'],['config','user.email','nexora-ai@localhost'],['checkout','-B',branch],['add','-A']]){r=await runGit(project,a);if(r.code!==0)throw err('GIT_COMMAND_FAILED',r.stderr,502);}
    r=await runGit(project,['commit','-m',message]);
    if(r.code!==0 && !/nothing to commit/i.test(r.stdout+r.stderr))throw err('GIT_COMMIT_FAILED',r.stderr||r.stdout,502);
    r=await runGit(project,['push','-u','origin',branch],{GIT_ASKPASS:askpass,NEXORA_GITHUB_TOKEN:token});
    if(r.code!==0)throw err('GIT_PUSH_FAILED',r.stderr||r.stdout,502);
    return {success:true,repo:remote.replace(/\.git$/,''),branch,output:(r.stdout||r.stderr).slice(-4000)};
  }finally{try{fs.rmSync(askpass,{force:true})}catch{}}
}