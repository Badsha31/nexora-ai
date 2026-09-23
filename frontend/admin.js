let token=localStorage.getItem('nexora_admin_token');
const $=s=>document.querySelector(s);

async function api(u,o={}){
  o.headers={'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(o.headers||{})};
  const r=await fetch(u,o);
  const j=await r.json().catch(()=>({success:false,error:{message:'Invalid server response'}}));
  if(!j.success)throw new Error(j.error?.message||'Request failed');
  return j.data;
}

function login(){
  document.querySelector('#admin').innerHTML='<main class="admin-auth"><section class="auth-card"><div class="brand">NEXORA <span>MASTER</span></div><div class="label">PROTECTED CONTROL PLANE</div><h1>Master Admin</h1><p>Safety policies, credentials and deployment controls are administrator-only.</p><input id="u" value="admin" placeholder="Username" autocomplete="username"><input id="p" type="password" placeholder="Password" autocomplete="current-password"><button id="go">Sign in</button><small id="e"></small></section></main>';
  $('#go').onclick=async()=>{
    try{
      const x=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:$('#u').value,password:$('#p').value})});
      token=x.token;localStorage.setItem('nexora_admin_token',token);boot();
    }catch(e){$('#e').textContent=e.message}
  };
}

async function boot(){
  try{
    const me=await api('/api/me');
    if(me.role!=='admin')throw new Error('Admin access required');
    const [policies,health,ops,integrations]=await Promise.all([api('/api/policies'),api('/api/health'),api('/api/operations'),api('/api/integrations')]);
    document.querySelector('#admin').innerHTML='<div class="admin-shell"><aside><div class="brand">NEXORA <span>MASTER</span></div><div class="label">CONTROL PLANE</div><a href="/">← AI Workspace</a><a class="active">Security & Policies</a><a>Runtime</a><a>Operations</a><a>Projects</a><div class="bottom">Admin: '+escapeHtml(me.username)+'<button id="logout">Log out</button></div></aside><main><header><div><div class="label">OUTSIDE AI CONTROL</div><h1>Master Admin</h1><p>Only the administrator can change these controls. The coding agent cannot modify this panel.</p></div></header><section class="grid"><div class="card"><h2>Policy controls</h2>'+policies.map(p=>'<label class="row"><span><b>'+escapeHtml(p.key)+'</b><small>Backend-enforced permission</small></span><input type="checkbox" data-key="'+escapeHtml(p.key)+'" '+(p.enabled?'checked':'')+'></label>').join('')+'</div><div class="card"><h2>Deployment & GitHub</h2><p class="note">Credentials are encrypted in the server vault. Deploy hooks can trigger providers after you connect them.</p><div class="integrations">'+integrations.map(i=>'<div class="integration"><span><b>'+escapeHtml(i.name)+'</b><small>'+(i.configured?'Configured':'Not configured')+'</small></span><button data-integration="'+escapeHtml(i.name)+'">'+(i.configured?'Replace':'Configure')+'</button></div>').join('')+'</div></div><div class="card"><h2>Runtime</h2><div class="stat"><span>API</span><b>ONLINE</b></div><div class="stat"><span>Model endpoint</span><b>'+escapeHtml(health.model?.endpoint||'Not configured')+'</b></div><div class="stat"><span>Model</span><b>'+escapeHtml(health.model?.model||'nexora-coder')+'</b></div><div class="stat"><span>Operations</span><b>'+ops.length+'</b></div></div></section></main></div>';
    document.querySelectorAll('[data-integration]').forEach(x=>x.onclick=async()=>{const value=prompt('Enter the secret/value for '+x.dataset.integration);if(!value)return;try{await api('/api/integrations/'+x.dataset.integration,{method:'PUT',body:JSON.stringify({value})});x.textContent='Configured'}catch(e){alert(e.message)}});
    document.querySelectorAll('[data-key]').forEach(x=>x.onchange=async()=>{try{await api('/api/policies/'+x.dataset.key,{method:'PATCH',body:JSON.stringify({enabled:x.checked})})}catch(e){x.checked=!x.checked;alert(e.message)}});
    $('#logout').onclick=()=>{localStorage.removeItem('nexora_admin_token');token=null;login()};
  }catch(e){
    if(/Authentication|Session|Admin access/.test(e.message)){localStorage.removeItem('nexora_admin_token');token=null;login()}
    else document.querySelector('#admin').innerHTML='<main class="center">'+escapeHtml(e.message)+'</main>';
  }
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
if(token)boot();else login();
