let state={projects:[],currentProject:null};
const $=s=>document.querySelector(s);

async function api(url,opt={}){
  opt.headers={'Content-Type':'application/json',...(opt.headers||{})};
  const r=await fetch(url,opt);
  const j=await r.json().catch(()=>({success:false,error:{message:'Invalid server response'}}));
  if(!j.success)throw new Error(j.error?.message||'Request failed');
  return j.data;
}

async function render(){
  try{
    const projects=await api('/api/projects');
    state.projects=projects;
    if(!projects.length){
      const p=await api('/api/projects',{method:'POST',body:JSON.stringify({name:'My Project',root:'./workspace/my-project'})});
      state.projects=[p];
    }
    state.currentProject=state.projects.find(p=>p.id===state.currentProject?.id)||state.projects[0];
    document.querySelector('#app').innerHTML=layout();
    bind();
  }catch(e){
    document.querySelector('#app').innerHTML='<main class="center"><div><h2>Nexora AI</h2><p>'+escapeHtml(e.message)+'</p><button onclick="location.reload()">Retry</button></div></main>';
  }
}

function layout(){
  return '<div class="shell"><aside class="left"><div class="brand">NEXORA <span>AI</span></div><button class="newchat" id="newchat">＋ New project</button><div class="section-title">PROJECTS</div><div id="projects">'+state.projects.map(p=>'<button class="project '+(state.currentProject?.id===p.id?'active':'')+'" data-id="'+p.id+'"><span>◈</span>'+escapeHtml(p.name)+'</button>').join('')+'</div><div class="left-bottom"><a href="/admin.html">Master Admin ↗</a></div></aside><main class="chat-main"><header class="topbar"><div class="mobile-brand">NEXORA AI</div><div class="model-badge">● Nexora Coding AI</div><div class="actions"><button id="zipBtn" title="Download project ZIP">ZIP</button><button id="deployBtn" title="Deploy project">Deploy</button></div><select id="projectSelect">'+state.projects.map(p=>'<option value="'+p.id+'" '+(state.currentProject?.id===p.id?'selected':'')+'>'+escapeHtml(p.name)+'</option>').join('')+'</select></header><section class="conversation"><div class="welcome"><div class="mark">N</div><h1>What are we building?</h1><p>Describe what you want to build. Nexora can create, inspect, debug, test and improve the project.</p><div class="cards"><button data-prompt="Build a production-ready responsive website with authentication, database, admin panel and deployment configuration.">Build a website</button><button data-prompt="Build a production-ready Android app with a real project structure, build configuration and tests.">Build Android app</button><button data-prompt="Inspect this project for bugs, security issues and build failures, then fix them.">Debug & repair</button></div></div><div id="messages"></div></section><div class="composer-wrap"><div class="composer"><textarea id="req" rows="1" placeholder="Message Nexora AI…"></textarea><button id="send" aria-label="Send">↑</button></div><div class="hint">Nexora can edit files, run permitted commands, build, test and export projects. Safety controls remain outside the AI under Master Admin.</div></div></main></div>';
}

function add(role,text){
  const m=$('#messages');
  m.insertAdjacentHTML('beforeend','<div class="bubble '+role+'"><div class="bubble-label">'+(role==='user'?'You':'Nexora AI')+'</div><pre>'+escapeHtml(text)+'</pre></div>');
  m.lastElementChild.scrollIntoView({behavior:'smooth',block:'end'});
}

let sending=false;
async function send(){
  const req=$('#req').value.trim();
  if(!req||!state.currentProject||sending)return;
  sending=true;$('#send').disabled=true;$('#req').value='';
  add('user',req);add('ai','Working through the project…');
  const pending=$('#messages').lastElementChild.querySelector('pre');
  try{
    const x=await api('/api/projects/'+state.currentProject.id+'/execute',{method:'POST',body:JSON.stringify({request:req})});
    pending.textContent=x.message||JSON.stringify(x,null,2);
    if(x.steps)pending.textContent=(x.message||'Completed')+'\n\n'+x.steps.map(a=>'#'+a.step+' '+(a.message||a.action?.type||'')).join('\n');
  }catch(e){
    pending.textContent='ERROR: '+e.message;
  }finally{
    sending=false;$('#send').disabled=false;
  }
}

function bind(){
  $('#send').onclick=send;
  $('#zipBtn').onclick=downloadZip;
  $('#deployBtn').onclick=deployProject;
  $('#req').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('#req').value=b.dataset.prompt;send()});
  document.querySelectorAll('.project').forEach(b=>b.onclick=()=>{state.currentProject=state.projects.find(p=>p.id===b.dataset.id);render()});
  $('#projectSelect').onchange=()=>{state.currentProject=state.projects.find(p=>p.id===$('#projectSelect').value);render()};
  $('#newchat').onclick=async()=>{
    const name=prompt('Project name');
    if(!name)return;
    const root='./workspace/'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    await api('/api/projects',{method:'POST',body:JSON.stringify({name,root})});
    render();
  };
}

async function downloadZip(){
  try{
    const r=await fetch('/api/projects/'+state.currentProject.id+'/export.zip');
    if(!r.ok){const j=await r.json().catch(()=>null);throw new Error(j?.error?.message||'ZIP export failed')}
    const blob=await r.blob(),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=(state.currentProject.name||'nexora-project')+'.zip';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }catch(e){add('ai','ZIP export error: '+e.message)}
}

async function deployProject(){
  const provider=prompt('Deploy provider: local / render / vercel / cloudflare / hostinger','local');
  if(!provider)return;
  try{
    const x=await api('/api/projects/'+state.currentProject.id+'/deploy',{method:'POST',body:JSON.stringify({provider})});
    add('ai','Deployment result:\n'+JSON.stringify(x,null,2));
  }catch(e){add('ai','Deployment error: '+e.message)}
}

function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
render();
