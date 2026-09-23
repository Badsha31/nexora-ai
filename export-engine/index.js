import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import {requirePolicy} from '../admin/policy.js';
import {err} from '../shared/errors.js';

export async function createZip(project){
  requirePolicy('export_zip');
  if(!project?.root || !fs.existsSync(project.root)) throw err('PROJECT_NOT_FOUND','Project workspace does not exist',404);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexora-export-'));
  const safe=(project.name||'nexora-project').replace(/[^a-z0-9._-]+/gi,'-')||'nexora-project';
  const out=path.join(dir,safe+'.zip');
  await new Promise((resolve,reject)=>{
    const output=fs.createWriteStream(out);
    const archive=archiver('zip',{zlib:{level:9}});
    output.on('close',resolve); output.on('error',reject); archive.on('error',reject);
    archive.pipe(output);
    archive.glob('**/*',{cwd:project.root,dot:true,ignore:['**/node_modules/**','**/.git/**','**/.env','**/.env.*','**/*.pem','**/*.key']});
    archive.finalize();
  });
  return {file:out,filename:path.basename(out),bytes:fs.statSync(out).size};
}