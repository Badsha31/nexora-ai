const base=process.env.NEXORA_MODEL_URL||'http://127.0.0.1:8000/v1';
const key=process.env.NEXORA_MODEL_API_KEY||'';
const headers=key?{Authorization:`Bearer ${key}`}:{};
const r=await fetch(base.replace(/\/$/,'')+'/models',{headers,signal:AbortSignal.timeout(10000)});
const text=await r.text();
if(!r.ok){
  console.error(`Model server unhealthy: HTTP ${r.status}\n${text.slice(0,2000)}`);
  process.exit(1);
}
let data; try{data=JSON.parse(text)}catch{data={raw:text}};
console.log(JSON.stringify({ok:true,models:data.data||data},null,2));
