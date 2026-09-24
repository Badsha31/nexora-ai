import fs from 'node:fs';import path from 'node:path';import {execCommand} from '../tools/terminal.js';import {err} from '../shared/errors.js';
export async function test(project,command=null){
 let cmd=command;
 try{const p=path.join(project.root,'package.json');if(!cmd||cmd==='npm test'){const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.scripts?.test)cmd='npm test';else return {code:0,stdout:'No test script configured; test stage completed without a test suite.',stderr:'',command:'no-test-suite'};}}catch{if(!cmd||cmd==='npm test')return {code:0,stdout:'No package.json/test suite configured; test stage completed without a test suite.',stderr:'',command:'no-test-suite'};}
 const r=await execCommand(project,cmd,180000);if(r.code!==0)throw err('TESTS_FAILED',r.stderr||'Tests failed',422,{output:r.stdout,command:cmd});return {...r,command:cmd};
}