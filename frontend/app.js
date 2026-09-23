let state={projects:[],currentProject:null,sending:false};
const $=s=>document.querySelector(s);
async function api(url,opt={}){
  opt.headers={'Content-Type':'application/json',...(opt.headers||{})};
  const r=await fetch(url,opt);const j=await r.json().catch(()=>({success:false,error:{message:'Invalid server response'}}));
  if(!j.success)throw new Error(j.error?.message||'Request failed');return j.data;
}
async function render(){
  try{
    state.projects=await api('/api/projects');
    state.currentProject=state.projects.find(p=>p.id===state.currentProject?.id)||state.projects[0]||null;
    document.querySelector('#app').innerHTML=state.currentProject?layout():wizard();
    bind();
  }catch(e){document.querySelector('#app').innerHTML='<main class="center"><div><h2>Nexora AI</h2><p>'+escapeHtml(e.message)+'</p><button id="retry">Retry</button></div></main>';$('#retry').onclick=render;}
}
function wizard(){
 return '<main class="factory"><div class="factory-card"><div class="brand">NEXORA <span>AI</span></div><div class="eyebrow">PERSONAL AI DEVELOPMENT FACTORY</div><h1>What are we building?</h1><p class="lead">Give Nexora the project name, a design reference and the stack choices. It will create the real project, test it and keep working until the implementation is complete.</p><form id="factoryForm"><div class="two"><label>Project name<input id="name" required placeholder="e.g. Maheer Store"></label><label>Project type<select id="type"><option value="website">Website / Full-stack Web App</option><option value="android">Android App / APK</option><option value="cyber">Cyber Security Project</option></select></label></div><label>Design reference <span class="muted">(PNG/JPG/WebP)</span><input id="reference" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="three"><label>Frontend<select id="frontend"><option>auto</option><option>HTML/CSS/JS</option><option>React</option><option>Next.js</option><option>Vue</option></select></label><label>Backend<select id="backend"><option>auto</option><option>none</option><option>Node.js/Express</option><option>Node.js/Fastify</option><option>Python/FastAPI</option></select></label><label>Database<select id="database"><option>auto</option><option>none</option><option>SQLite</option><option>PostgreSQL</option><option>Turso</option></select></label></div><label>Extra requirements <span class="muted">(optional)</span><textarea id="requirements" rows="3" placeholder="Only if you need something specific..."></textarea></label><button class="start" type="submit">Start Building <span>→</span></button><div id="factoryStatus" class="status"></div></form><div class="factory-note">Master Admin controls safety, credentials and deployment permissions. The AI cannot change those controls.</div></div></main>';
}
function layout(){
 const p=state.currentProject;
 return '<div class="shell"><aside class="left"><div class="brand">NEXORA <span>AI</span></div><button class="newchat" id="newchat">＋ New project</button><div class="section-title">PROJECTS</div><div id="projects">'+state.projects.map(x=>'<button class="project '+(p?.id===x.id?'active':'')+'" data-id="'+x.id+'"><span>◈</span>'+escapeHtml(x.name)+'</button>').join('')+'</div><div class="left-bottom"><a href="/admin.html">Master Admin ↗</a></div></aside><main class="chat-main"><header class="topbar"><div class="mobile-brand">NEXORA AI</div><div class="model-badge">● Nexora Engineering AI</div><div class="actions"><button id="buildBtn">Build</button><button id="securityBtn">Security</button><button id="zipBtn">ZIP</button><button id="deployBtn">Deploy</button></div><select id="projectSelect">'+state.projects.map(x=>'<option value="'+x.id+'" '+(p?.id===x.id?'selected':'')+'>'+escapeHtml(x.name)+'</option>').join('')+'</select></header><section class="conversation"><div class="project-head"><div><div class="eyebrow">'+escapeHtml(p.type||'website')+' ENGINEER</div><h1>'+escapeHtml(p.name)+'</h1><p>'+escapeHtml((p.frontend||'auto')+' · '+(p.backend||'auto')+' · '+(p.database_kind||'auto'))+'</p></div><div class="stack-pill">'+escapeHtml(p.frontend||'auto')+'</div></div><div id="messages"></div></section><div class="composer-wrap"><div class="composer"><textarea id="req" rows="1" placeholder="Tell Nexora what to build, change, debug or secure…"></textarea><button id="send" aria-label="Send">↑</button></div><div class="hint">Nexora can edit files, run permitted commands, build, test, security-scan, export and deploy. Safety controls stay outside the AI.</div></div></main></div>';
}
function add(role,text){const m=$('#messages');m.insertAdjacentHTML('beforeend','<div class="bubble '+role+'"><div class="bubble-label">'+(role==='user'?'You':'Nexora AI')+'</div><pre>'+escapeHtml(text)+'</pre></div>');m.lastElementChild.scrollIntoView({behavior:'smooth',block:'end'});}
async function send(textOverride){
 const req=(textOverride||$('#req').value).trim();if(!req||!state.currentProject||state.sending)return;
 state.sending=true;$('#send').disabled=true;if(!textOverride)$('#req').value='';add('user',req);add('ai','Nexora is engineering the project…');const pending=$('#messages').lastElementChild.querySelector('pre');
 try{const x=await api('/api/projects/'+state.currentProject.id+'/execute',{method:'POST',body:JSON.stringify({request:req})});pending.textContent=x.message||'Completed';if(x.steps)pending.textContent=(x.message||'Completed')+'\n\n'+x.steps.map(a=>'#'+a.step+' '+(a.message||a.action?.type||'')).join('\n');}
 catch(e){pending.textContent='ERROR: '+e.message}finally{state.sending=false;$('#send').disabled=false;}
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{if(!file)return resolve('');const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});}
async function createFromWizard(e){
 e.preventDefault();const status=$('#factoryStatus'),btn=$('.start');btn.disabled=true;status.textContent='Creating project workspace…';
 try{
  const name=$('#name').value.trim(),type=$('#type').value,frontend=$('#frontend').value,backend=$('#backend').value,database=$('#database').value,requirements=$('#requirements').value.trim(),file=$('#reference').files[0];
  const p=await api('/api/projects',{method:'POST',body:JSON.stringify({name,type,frontend,backend,database,requirements})});
  if(file){status.textContent='Uploading design reference…';const dataUrl=await fileToDataUrl(file);await api('/api/projects/'+p.id+'/reference',{method:'POST',body:JSON.stringify({dataUrl,name:file.name})});}
  state.projects=[p,...state.projects];state.currentProject=p;status.textContent='Starting website/Android/security engineer…';await render();await send('Build this project completely now. Project name: '+name+'. Type: '+type+'. Frontend: '+frontend+'. Backend: '+backend+'. Database: '+database+'. Requirements: '+(requirements||'none')+'. Use the uploaded design reference as the visual source of truth. Implement real production-ready functionality, then run appropriate build/tests.'); 
 }catch(e){status.textContent='Build start failed: '+e.message;btn.disabled=false;}
}
function bind(){
 const form=$('#factoryForm');if(form){form.onsubmit=createFromWizard;return;}
 $('#send').onclick=()=>send();$('#req').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
 $('#zipBtn').onclick=downloadZip;$('#deployBtn').onclick=deployProject;$('#buildBtn').onclick=buildProject;$('#securityBtn').onclick=securityScan;
 $('#newchat').onclick=()=>{state.currentProject=null;render()};
 document.querySelectorAll('.project').forEach(b=>b.onclick=()=>{state.currentProject=state.projects.find(p=>p.id===b.dataset.id);render()});
 $('#projectSelect').onchange=()=>{state.currentProject=state.projects.find(p=>p.id===$('#projectSelect').value);render()};
}
async function buildProject(){try{const p=state.currentProject;if(p.type==='android'){const x=await api('/api/projects/'+p.id+'/android-build',{method:'POST',body:JSON.stringify({variant:'debug'})});add('ai','Android build result:\n'+JSON.stringify(x,null,2));}else{const x=await api('/api/projects/'+p.id+'/build',{method:'POST',body:JSON.stringify({})});add('ai','Build result:\n'+JSON.stringify(x,null,2));}}catch(e){add('ai','Build error: '+e.message)}}
async function securityScan(){try{const x=await api('/api/projects/'+state.currentProject.id+'/security-scan',{method:'POST',body:'{}'});add('ai','Security scan:\n'+JSON.stringify(x,null,2));}catch(e){add('ai','Security scan error: '+e.message)}}
async function downloadZip(){try{const r=await fetch('/api/projects/'+state.currentProject.id+'/export.zip');if(!r.ok){const j=await r.json().catch(()=>null);throw new Error(j?.error?.message||'ZIP export failed')}const blob=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(state.currentProject.name||'nexora-project')+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){add('ai','ZIP export error: '+e.message)}}
async function deployProject(){const provider=prompt('Deploy provider: local / render / vercel / cloudflare / hostinger','local');if(!provider)return;try{const x=await api('/api/projects/'+state.currentProject.id+'/deploy',{method:'POST',body:JSON.stringify({provider})});add('ai','Deployment result:\n'+JSON.stringify(x,null,2));}catch(e){add('ai','Deployment error: '+e.message)}}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
render();
