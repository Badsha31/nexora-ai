import fs from 'node:fs';
import path from 'node:path';
import {execCommand} from '../tools/terminal.js';
import {requirePolicy} from '../admin/policy.js';
import {err} from '../shared/errors.js';

function findApks(root){
  const out=[];
  const walk=(dir)=>{
    if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())return;
    for(const name of fs.readdirSync(dir)){
      if(name==='node_modules'||name==='.git')continue;
      const full=path.join(dir,name); const st=fs.statSync(full);
      if(st.isDirectory())walk(full); else if(name.toLowerCase().endsWith('.apk'))out.push(full);
    }
  };
  walk(root); return out;
}

export async function buildAndroid(project,{variant='debug'}={}){
  requirePolicy('android_build');
  if(!project?.root||!fs.existsSync(project.root))throw err('PROJECT_NOT_FOUND','Android project workspace does not exist',404);
  const wrapper=path.join(project.root,'gradlew');
  const task=variant==='release'?'assembleRelease':'assembleDebug';
  const command=fs.existsSync(wrapper)?'chmod +x ./gradlew && ./gradlew '+task:'gradle '+task;
  const result=await execCommand(project,command,600000);
  if(result.code!==0)throw err('ANDROID_BUILD_FAILED',result.stderr||'Android build failed',422,{stdout:result.stdout,command});
  const apks=findApks(project.root).map(file=>({path:path.relative(project.root,file),absolute:file,size:fs.statSync(file).size}));
  return {success:true,variant,command,apks,stdout:result.stdout?.slice(-16000)||'',stderr:result.stderr?.slice(-8000)||''};
}
