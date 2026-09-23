const base=process.env.NEXORA_MODEL_URL||'http://127.0.0.1:8000/v1';
const model=process.env.NEXORA_MODEL_NAME||'nexora-coder';
const key=process.env.NEXORA_MODEL_API_KEY||'';
const headers={'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})};
const payload={
  model,
  messages:[
    {role:'system',content:'You are Nexora Coding Model. Return concise, correct code-focused answers.'},
    {role:'user',content:'Write a JavaScript function named add that returns the sum of two numbers. Return only the function.'}
  ],
  temperature:0.1,
  max_tokens:300,
  stream:false
};
const r=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(120000)});
const raw=await r.text();
if(!r.ok){console.error(`Inference failed: HTTP ${r.status}\n${raw.slice(0,4000)}`);process.exit(1);}
const j=JSON.parse(raw);
const content=j.choices?.[0]?.message?.content||'';
if(!content){console.error('Inference returned no message content');process.exit(1);}
console.log(content);
console.log('\nNexora Coding Model inference: PASS');
