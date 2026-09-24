const state={
  projects:[],
  currentProject:null,
  messages:[],
  sending:false,
  intake:null
};

const $=s=>document.querySelector(s);

async function api(url,opt={}){
  const headers={'Content-Type':'application/json',...(opt.headers||{})};
  const retries=Number(opt.retries??8),timeoutMs=Number(opt.timeoutMs??90000);
  const requestOpt={...opt};delete requestOpt.retries;delete requestOpt.timeoutMs;
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const r=await fetch(url,{...requestOpt,headers,cache:'no-store',signal:controller.signal});
      const j=await r.json().catch(()=>({success:false,error:{message:'Invalid server response'}}));
      if(r.ok&&j.success)return j.data;
      const message=j.error?.message||('Request failed (HTTP '+r.status+')');
      if(r.status>=500&&attempt<retries){await new Promise(resolve=>setTimeout(resolve,Math.min(3000*(attempt+1),10000)));continue;}
      throw new Error(message);
    }catch(e){
      lastError=e;
      if(attempt<retries){await new Promise(resolve=>setTimeout(resolve,Math.min(3000*(attempt+1),10000)));continue;}
      if(e.name==='AbortError')throw new Error('Backend request timed out. Render may still be starting; please try again.');
      throw new Error('Backend connection failed after multiple retries. Check the Render service logs and try again.');
    }finally{clearTimeout(timer);}
  }
  throw lastError||new Error('Backend connection failed.');
}
function escapeHtml(s){
  return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

async function render(){
  let projectLoadError='';
  try{
    state.projects=await api('/api/projects');
  }catch(e){
    state.projects=[];
    projectLoadError=e.message;
  }
  if(state.currentProject){
    state.currentProject=state.projects.find(p=>p.id===state.currentProject.id)||state.currentProject;
  }
  document.querySelector('#app').innerHTML=home();
  bindHome();
  if(projectLoadError)addMessage('ai','⚠️ '+projectLoadError+' You can still start a new project; the server error will be shown when you submit the request.');
}

function home(){
  return '<div class="ai-shell">'+
    '<aside class="ai-sidebar">'+
      '<div class="side-head"><div class="brand">NEXORA <span>AI</span></div><button id="closeSide" class="icon-btn">×</button></div>'+
      '<button id="newChat" class="new-chat">＋ <span>New chat</span></button>'+
      '<div class="side-label">RECENT</div>'+
      '<div id="recentChats" class="recent">'+(state.projects.length?state.projects.slice(0,12).map(p=>'<button class="recent-item '+(state.currentProject?.id===p.id?'active':'')+'" data-id="'+escapeHtml(p.id)+'"><span>◈</span><span>'+escapeHtml(p.name)+'</span></button>').join(''):'<div class="empty-recent">No projects yet</div>')+'</div>'+
      '<div class="side-spacer"></div>'+
      '<a class="admin-link" href="/admin.html">⚙ Master Admin</a>'+
      '<div class="side-note">Personal AI Development Factory</div>'+
    '</aside>'+
    '<main class="ai-main">'+
      '<header class="ai-header"><button id="openSide" class="icon-btn mobile-only">☰</button><div class="header-model"><span class="online-dot"></span>Nexora AI</div><div class="header-actions">'+(state.currentProject?'<button id="projectZip">ZIP</button><button id="projectDeploy">Deploy</button>':'')+'</div></header>'+
      '<section id="chat" class="chat-area">'+
        '<div id="messages" class="messages"></div>'+
      '</section>'+
      '<div class="composer-area">'+
        '<form id="composer" class="composer">'+
          '<label class="attach-btn" title="Attach design reference">＋<input id="attachment" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
          '<textarea id="messageInput" rows="1" autocomplete="off" placeholder="Message Nexora AI…"></textarea>'+
          '<button id="sendBtn" class="send-btn" type="submit" aria-label="Send">↑</button>'+
        '</form>'+
        '<div id="attachName" class="attach-name"></div>'+
        '<div class="composer-note">Nexora can create, edit, build, test, secure and deploy projects. Master Admin controls safety and deployment permissions.</div>'+
      '</div>'+
    '</main>'+
  '</div>';
}

function renderMessages(){
  const box=$('#messages');
  if(!box)return;
  if(!state.messages.length){
    box.innerHTML='<div class="welcome-chat">'+
      '<div class="welcome-icon">N</div>'+
      '<h1>How can I help you build?</h1>'+
      '<p>I can build real websites, Android apps and security-focused projects. Tell me what you want to create.</p>'+
      '<div class="prompt-grid">'+
        '<button data-prompt="Build a premium business website">Build a website</button>'+
        '<button data-prompt="Build a complete Android app">Build an Android app</button>'+
        '<button data-prompt="Create a premium ecommerce website">Build an online store</button>'+
        '<button data-prompt="Review and secure my project">Security engineer</button>'+
      '</div>'+
    '</div>';
    return;  }
  box.innerHTML=state.messages.map((m,i)=>{
    if(m.role==='user')return '<div class="msg-row user-row"><div class="user-bubble">'+escapeHtml(m.text)+'</div></div>';
    return '<div class="msg-row ai-row"><div class="ai-avatar">N</div><div class="ai-message">'+formatText(m.text)+'</div></div>';
  }).join('');
  box.lastElementChild?.scrollIntoView({behavior:'smooth',block:'end'});
}

function formatText(t){
  const safe=escapeHtml(t);
  return safe.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
}

function addMessage(role,text){
  state.messages.push({role,text});
  renderMessages();
}

function bindHome(){
  renderMessages();

  $('#composer').addEventListener('submit',e=>{e.preventDefault();sendMessage();});
  $('#messageInput').addEventListener('keydown',e=>{    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
  });
  $('#messageInput').addEventListener('input',e=>{
    e.target.style.height='auto';
    e.target.style.height=Math.min(e.target.scrollHeight,180)+'px';
  });
  $('#attachment').addEventListener('change',e=>{
    const f=e.target.files[0];
    $('#attachName').textContent=f?'📎 '+f.name:'';
  });
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>startFromPrompt(b.dataset.prompt));

  $('#newChat').onclick=()=>{
    state.currentProject=null;
    state.messages=[];
    state.intake=null;
    render();
  };
  $('#openSide')?.addEventListener('click',()=>document.querySelector('.ai-sidebar')?.classList.add('open'));
  $('#closeSide')?.addEventListener('click',()=>document.querySelector('.ai-sidebar')?.classList.remove('open'));

  document.querySelectorAll('.recent-item').forEach(b=>b.onclick=()=>{
    const p=state.projects.find(x=>x.id===b.dataset.id);
    if(p){state.currentProject=p;state.messages=[{role:'ai',text:'Project **'+p.name+'** is selected. Tell me what you want to change, build, test or secure.'}];render();}
  });

  $('#projectZip')?.addEventListener('click',async()=>{
    if(!state.currentProject)return;
    window.location='/api/projects/'+state.currentProject.id+'/export.zip';
  });
  $('#projectDeploy')?.addEventListener('click',()=>deployCurrent());
}

function startFromPrompt(prompt){
  addMessage('user',prompt);
  startIntake(prompt);
}

function startIntake(initialRequest){
  state.intake={step:0,request:initialRequest,name:'',reference:null,frontend:'',backend:'',database:''};
  askNextIntake();
}

function askNextIntake(){
  const q=[
    'Project name ta ki hobe?',
    'Design/reference image thakle ekhon attach koro. Na thakle **skip** likho.',
    'Frontend konta use korte chao? **HTML/CSS/JS, React, Next.js, Vue** — ba **auto**.',
    'Backend konta? **Node.js/Express, Node.js/Fastify, Python/FastAPI, none** — ba **auto**.',
    'Database konta? **Turso, PostgreSQL, SQLite, none** — ba **auto**.'
  ][state.intake.step];
  addMessage('ai',q);
}

async function sendMessage(){
  if(state.sending)return;
  const input=$('#messageInput');
  const text=input.value.trim();
  const file=$('#attachment').files[0];
  if(!text&&!file)return;
  input.value='';input.style.height='auto';$('#sendBtn').disabled=true;state.sending=true;
  try{
    if(state.intake){
      await handleIntake(text,file);
    }else if(state.currentProject){
      addMessage('user',text||'Attached a file.');
      if(file)await uploadReference(state.currentProject,file);
      await executeCurrent(text||'Analyze the attached design reference and update the project.');
    }else{
      addMessage('user',text||'Attached a design reference.');
      startIntake(text||'Build a project from this design reference.');
      if(file)state.intake.reference=file;
    }
  }catch(e){
    addMessage('ai','ERROR: '+e.message);
  }finally{
    state.sending=false;$('#sendBtn').disabled=false;$('#attachment').value='';$('#attachName').textContent='';  }
}

async function handleIntake(text,file){
  const i=state.intake;
  if(i.step===0){
    if(!text){addMessage('ai','Please give me the project name first.');return;}
    i.name=text;i.step++;askNextIntake();return;
  }
  if(i.step===1){
    if(file){i.reference=file;addMessage('user','📎 '+file.name);}
    else if(text&&text.toLowerCase()!=='skip'&&text.toLowerCase()!=='no'){addMessage('ai','Attach the image using the ＋ button, or type **skip** if you do not have one.');return;}
    i.step++;askNextIntake();return;
  }
  if(i.step===2){i.frontend=text||'auto';i.step++;askNextIntake();return;}
  if(i.step===3){i.backend=text||'auto';i.step++;askNextIntake();return;}
  if(i.step===4){
    i.database=text||'auto';
    addMessage('user',i.database);
    await createProjectFromIntake();
  }
}

async function createProjectFromIntake(){
  const i=state.intake;
  addMessage('ai','Perfect. I have the project details. Creating the workspace and starting the engineering process…');
  const type=/android|apk|aab|mobile/i.test(i.request)?'android':/security|cyber|secure/i.test(i.request)?'cyber':'website';
  const p=await api('/api/projects',{method:'POST',body:JSON.stringify({
    name:i.name,type,frontend:i.frontend||'auto',backend:i.backend||'auto',database:i.database||'auto',requirements:i.request
  })});
  state.currentProject=p;
  state.projects=[p,...state.projects.filter(x=>x.id!==p.id)];
  if(i.reference)await uploadReference(p,i.reference);
  state.intake=null;
  await render();
  addMessage('ai','Project **'+p.name+'** is ready. I will now build it from the requirements and reference. You can keep chatting while I work.');
  await executeCurrent('Build this project completely now. Implement real production-ready functionality, use the uploaded design reference as the visual source of truth when available, then build and test. Do not report success unless the work actually succeeds.');
}

async function uploadReference(project,file){
  const dataUrl=await fileToDataUrl(file);
  await api('/api/projects/'+project.id+'/reference',{method:'POST',body:JSON.stringify({dataUrl,name:file.name})});
}
function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);
  });
}

async function executeCurrent(request){
  const thinking={role:'ai',text:'Nexora is working…\n\nThe engineering job is running in the background, so the chat will not time out while Render is waking up or the code is being built.'};
  state.messages.push(thinking);renderMessages();
  try{
    const started=await api('/api/projects/'+state.currentProject.id+'/execute',{method:'POST',body:JSON.stringify({request}),timeoutMs:30000,retries:3});
    const operationId=started?.operationId;
    if(!operationId)throw new Error('The backend did not return an engineering operation ID.');
    for(let i=0;i<360;i++){
      await new Promise(resolve=>setTimeout(resolve,i<10?2000:5000));
      const op=await api('/api/operations?id='+encodeURIComponent(operationId),{timeoutMs:30000,retries:2});
      if(op.status==='completed'){
        let result={};try{result=op.output?JSON.parse(op.output):{};}catch{}
        thinking.text=(result.message||'Engineering task completed successfully.')+'\n\nVerified background operation completed.';
        break;
      }
      if(op.status==='failed'){
        let failure={};try{failure=op.error?JSON.parse(op.error):{};}catch{}
        throw new Error(failure.message||'Engineering operation failed.');
      }
      thinking.text='Nexora is working…\n\nStatus: '+op.status+' — building, testing and fixing the project.\nYou can keep chatting.';renderMessages();
    }
    if(thinking.text.startsWith('Nexora is working…'))throw new Error('Engineering operation is still running. Open the project again shortly to see the final result.');
  }catch(e){thinking.text='ERROR: '+e.message;}
  renderMessages();
}

async function deployCurrent(){
  if(!state.currentProject)return;
  const provider=prompt('Deploy provider: local, render, vercel, cloudflare or hostinger','cloudflare');
  if(!provider)return;
  addMessage('user','Deploy to '+provider);
  try{
    const x=await api('/api/projects/'+state.currentProject.id+'/deploy',{method:'POST',body:JSON.stringify({provider})});
    addMessage('ai',JSON.stringify(x,null,2));
  }catch(e){addMessage('ai','ERROR: '+e.message);}
}

render();