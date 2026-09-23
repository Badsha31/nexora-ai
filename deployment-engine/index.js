import {requirePolicy} from '../admin/policy.js';
import {get} from '../credential-vault/index.js';
import {err} from '../shared/errors.js';
import {push} from '../github-engine/index.js';

async function hook(name){
  const url=get(name);
  if(!url)throw err('DEPLOYMENT_NOT_CONFIGURED',name+' is not configured in Master Admin',412);
  const r=await fetch(url,{method:'POST',signal:AbortSignal.timeout(30000)});
  const body=await r.text();
  if(!r.ok)throw err('DEPLOY_FAILED',name+' returned HTTP '+r.status,502,{response:body.slice(0,4000)});
  return {provider:name.replace('_deploy_hook_url',''),status:r.status,response:body.slice(0,4000)};
}
export async function deploy(project,{provider='local',repo,branch='main',message}={}){
  requirePolicy('deployment');
  const p=String(provider).toLowerCase();
  if(p==='local'||p==='localhost')return {success:true,provider:'local',workspace:project.root};
  if(p==='render')return hook('render_deploy_hook_url');
  if(p==='vercel')return hook('vercel_deploy_hook_url');
  if(p==='cloudflare')return hook('cloudflare_deploy_hook_url');
  if(p==='hostinger')return hook('hostinger_deploy_hook_url');
  if(p==='github')return push(project,{repo,branch,message});
  throw err('DEPLOYMENT_PROVIDER_UNSUPPORTED','Unsupported provider: '+provider,400);
}