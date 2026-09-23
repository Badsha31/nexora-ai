let state={projects:[],currentProject:null,sending:false,forceWizard:false};
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
    document.querySelector('#app').innerHTML=state.forceWizard||!state.currentProject?wizard():layout();
    bind();
  }catch(e){document.querySelector('#app').innerHTML='<main class="center"><div><h2>Nexora AI</h2><p>'+escapeHtml(e.message)+'</p><button id="retry">Retry</button></div></main>';$('#retry').onclick=render;}
}
function wizard(){
 return '<main class="chat-home"><aside class="home-side"><div class="brand">NEXORA <span>AI</span></div><div class="side-caption">Personal AI Development Factory</div><div class="home-tip">Website Engineer<br>Android Build Engineer<br>Cyber Security Engineer</div><a href="/admin.html">Master Admin ↗</a></aside><section class="home-chat"><header class="home-top"><div class="mobile-brand">NEXORA AI</div><div class="home-model"><span>●</span> Nexora Engineering AI <small>⌄</small></div></header><div class="welcome"><div class="welcome-mark">N</div><h1>How can I help you build?</h1><p>Describe what you want to create. Nexora will ask only for the project details it needs, then engineer the real project.</p><div class="suggestions"><button data-prompt="Build a premium business website">Build a website</button><button data-prompt="Build an Android app and APK">Build an Android app</button><button data-prompt="Scan and secure my project">Security engineer</button></div></div><form id="factoryForm" class="home-composer"><label class="attach">＋<input id="reference" type="file" accept="image/png,image/jpeg,image/webp"></label><textarea id="requirements" rows="1" placeholder="Message Nexora AI…"></textarea><button class="send-home" type="submit">↑</button><input id="name" type="hidden" value=""><input id="type" type="hidden" value="website"><select id="frontend" hidden><option>auto</option></select><select id="backend" hidden><option>auto</option></select><select id="database" hidden><option>auto</option></select></form><div id="factoryStatus" class="status"></div><div class="home-disclaimer">Nexora can create, edit, build, test and secure projects. Deployment and safety permissions remain controlled by Master Admin.</div></section></main>';
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
 e.preventDefault();const status=$('#factoryStatus'),btn=$('.send-home');btn.disabled=true;
 try{
  const textReq=$('#requirements').value.trim();const file=$('#reference').files[0];
  if(!textReq&&!file){status.textContent='Tell me what you want to build or attach a design reference.';btn.disabled=false;return}
  status.textContent='Nexora is preparing your project…';
  let name='Nexora Project';let type='website';let frontend='auto';let backend='auto';let database='auto';
  const lower=textReq.toLowerCase();if(/android|apk|aab|mobile app/.test(lower))type='android';else if(/security|cyber|secure|pentest|vulnerability/.test(lower))type='cyber';
  const nameMatch=textReq.match(/(?:name|called|named)[:\s]+["']?([A-Za-z0-9][A-Za-z0-9 ._-]{1,70})["']?/i);if(nameMatch)name=nameMatch[1].trim();
  if(/react/.test(lower))frontend='React';else if(/next\.js|nextjs/.test(lower))frontend='Next.js';else if(/vue/.test(lower))frontend='Vue';else if(/html|css|javascript/.test(lower))frontend='HTML/CSS/JS';
  if(/node/.test(lower))backend='Node.js/Express';else if(/fastify/.test(lower))backend='Node.js/Fastify';else if(/fastapi|python/.test(lower))backend='Python/FastAPI';else if(/no backend|frontend only/.test(lower))backend='none';
  if(/turso/.test(lower))database='Turso';else if(/postgres/.test(lower))database='PostgreSQL';else if(/sqlite/.test(lower))database='SQLite';else if(/no database/.test(lower))database='none';
  const p=await api('/api/projects',{method:'POST',body:JSON.stringify({name,type,frontend,backend,database,requirements:textReq})});
  if(file){status.textContent='Reading your design reference…';const dataUrl=await fileToDataUrl(file);await api('/api/projects/'+p.id+'/reference',{method:'POST',body:JSON.stringify({dataUrl,name:file.name})});}
  state.projects=[p,...state.projects];state.currentProject=p;state.forceWizard=false;await render();
  await send('Build this project completely now. User request: '+textReq+'. Project name: '+name+'. Type: '+type+'. Frontend: '+frontend+'. Backend: '+backend+'. Database: '+database+'. Use the uploaded design reference as the visual source of truth if provided. If any required project choice is still unspecified, infer a stable production choice instead of stopping. Implement real production-ready functionality, then build and test.');
 }catch(e){status.textContent='Nexora error: '+e.message;btn.disabled=false;}
}
