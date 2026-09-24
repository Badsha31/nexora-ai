import fs from 'node:fs';import path from 'node:path';import {execCommand} from '../tools/terminal.js';import {err} from '../shared/errors.js';
function packageScripts(project){try{const p=path.join(project.root,'package.json');if(!fs.existsSync(p))return null;const j=JSON.parse(fs.readFileSync(p,'utf8'));return j.scripts||{};}catch{return null;}}
export async function build(project,command=null){
 const scripts=packageScripts(project);
 let cmd=command;
 if(!cmd||cmd==='npm run build'){
  if(scripts?.build)cmd='npm run build';
  else if(fs.existsSync(path.join(project.root,'index.html')))return {code:0,stdout:'Static project validation passed: index.html exists and no build script is required.',stderr:'',command:'static-validation'};
  else if(scripts?.test)cmd='npm test';
  else throw err('BUILD_CONFIGURATION','No build script or buildable entrypoint was found in the generated project.',422);
 }
 const r=await execCommand(project,cmd,180000);if(r.code!==0)throw err('BUILD_FAILED',r.stderr||'Build command failed',422,{output:r.stdout,command:cmd});return {...r,command:cmd};
}