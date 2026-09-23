import fs from 'node:fs';
import path from 'node:path';
import {execCommand} from '../tools/terminal.js';
import {requirePolicy} from '../admin/policy.js';

const SECRET_PATTERNS=[
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{12,}['"]/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/
];
const DANGEROUS_PATTERNS=[
  {name:'eval',re:/\beval\s*\(/},
  {name:'child_process exec',re:/(?:child_process\.(?:exec|execFile|spawn)|execSync)\s*\(/},
  {name:'innerHTML',re:/\.innerHTML\s*=/},
  {name:'document.write',re:/document\.write\s*\(/}
];

function files(root){
  const out=[];
  const walk=(dir)=>{
    if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())return;
    for(const name of fs.readdirSync(dir)){
      if(['node_modules','.git','dist','build','.gradle'].includes(name))continue;
      const full=path.join(dir,name),st=fs.statSync(full);
      if(st.isDirectory())walk(full);
      else if(st.size<=1024*1024&&/\.(js|mjs|cjs|ts|tsx|jsx|json|html|css|py|java|kt|kts|xml|yml|yaml|env)$/i.test(name))out.push(full);
    }
  };
  walk(root);return out;
}

export async function scanSecurity(project){
  requirePolicy('security_scan');
  const scanFiles=files(project.root),findings=[];
  for(const file of scanFiles){
    let text='';try{text=fs.readFileSync(file,'utf8')}catch{continue}
    const rel=path.relative(project.root,file);
    if(/\.env(?:\.|$)/i.test(path.basename(file)))findings.push({severity:'high',type:'secret-file',path:rel,message:'Environment/secret file is present in the project workspace. Keep it out of source control.'});
    for(const p of SECRET_PATTERNS)if(p.test(text))findings.push({severity:'high',type:'possible-secret',path:rel,message:'Possible hard-coded credential/secret detected. Move it to environment or Master Admin credentials.'});
    for(const p of DANGEROUS_PATTERNS)if(p.re.test(text))findings.push({severity:'medium',type:'dangerous-pattern',path:rel,message:'Review '+p.name+' and confirm inputs are trusted or replace with a safer API.'});
  }
  if(fs.existsSync(path.join(project.root,'package.json'))){
    const audit=await execCommand(project,'npm audit --omit=dev --json',180000).catch(e=>({code:1,stdout:'',stderr:String(e?.message||e)}));
    if(audit.stdout){try{const j=JSON.parse(audit.stdout);findings.push({severity:(j.metadata?.vulnerabilities?.high||j.metadata?.vulnerabilities?.critical)?'high':'info',type:'npm-audit',path:'package.json',message:'Dependency audit completed.',details:j.metadata?.vulnerabilities||{}})}catch{}}
  }
  return {success:true,summary:{filesScanned:scanFiles.length,findings:findings.length},findings};
}
