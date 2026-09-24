import {err} from '../shared/errors.js';

export function modelConfig(){
  const provider=String(process.env.NEXORA_MODEL_PROVIDER||'gemini').toLowerCase();
  if(provider==='gemini'){
    return {
      provider:'gemini',
      baseUrl:(process.env.GEMINI_API_BASE_URL||'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/,''),
      model:process.env.GEMINI_MODEL_NAME||'gemini-3.8-flash',
      fallbackModel:process.env.GEMINI_MODEL_FALLBACK||'gemini-3.5-flash-lite',
      apiKey:process.env.GEMINI_API_KEY||'',
      configured:!!process.env.GEMINI_API_KEY,
      keyless:false
    };
  }
  if(provider==='nexora'){
    return {
      provider:'nexora',
      baseUrl:(process.env.NEXORA_MODEL_URL||'https://nexora-api-model.rakibulhasan1301.workers.dev/v1').replace(/\/$/,''),
      model:process.env.NEXORA_MODEL_NAME||'nexora-coder',
      fallbackModel:'',
      apiKey:process.env.NEXORA_MODEL_API_KEY||'',
      configured:true,
      keyless:true
    };
  }
  throw err('MODEL_PROVIDER_INVALID','Unsupported model provider. Use gemini.',500);
}

function endpoint(c,path){return c.baseUrl+path;}

export async function health(){
  const c=modelConfig();
  if(!c.configured){
    return {available:false,status:401,model:c.model,provider:c.provider,endpoint:c.baseUrl,error:'GEMINI_API_KEY is not configured'};
  }
  try{
    const headers=c.apiKey?{Authorization:`Bearer ${c.apiKey}`}:{};
    const r=await fetch(endpoint(c,'/models'),{signal:AbortSignal.timeout(10000),headers});
    const raw=await r.text();
    let body=null;try{body=raw?JSON.parse(raw):null}catch{}
    return {
      available:r.ok,
      status:r.status,
      model:c.model,
      provider:c.provider,
      endpoint:c.baseUrl,
      serverModels:body?.data||[],
      error:r.ok?undefined:(body?.error?.message||raw.slice(0,1000))
    };
  }catch(e){
    return {available:false,error:e.message,model:c.model,provider:c.provider,endpoint:c.baseUrl};
  }
}

function extractContent(j){
  const message=j?.choices?.[0]?.message;
  const candidates=[message?.content,j?.choices?.[0]?.text,j?.output_text,j?.response,j?.text];
  for(const value of candidates){
    if(typeof value==='string'&&value.trim())return value;
    if(Array.isArray(value)){
      const text=value.map(x=>typeof x==='string'?x:x?.text||'').join('').trim();
      if(text)return text;
    }
  }
  const toolCalls=message?.tool_calls||j?.tool_calls;
  if(Array.isArray(toolCalls)&&toolCalls.length)return JSON.stringify({tool_calls:toolCalls});
  return '';
}

async function requestCompletion(c,payload,model=c.model){
  if(!c.apiKey)throw err('MODEL_AUTH_REQUIRED','GEMINI_API_KEY is not configured on the server.',503);
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${c.apiKey}`};
  const {__timeoutMs=240000,...requestBody}=payload;
  requestBody.model=model;
  const r=await fetch(endpoint(c,'/chat/completions'),{
    method:'POST',
    headers,
    body:JSON.stringify(requestBody),
    signal:AbortSignal.timeout(__timeoutMs)
  });
  const raw=await r.text();
  let j=null;try{j=raw?JSON.parse(raw):null}catch{}
  if(!r.ok){
    throw err(r.status===401?'MODEL_AUTH_REQUIRED':'MODEL_ERROR',`Gemini API returned HTTP ${r.status}`,r.status===401?503:502,{response:raw.slice(0,4000),status:r.status,model});
  }
  return j;
}

export async function chat(messages,options={}){
  const c=modelConfig();
  if(!c.configured)throw err('MODEL_AUTH_REQUIRED','GEMINI_API_KEY is not configured on the server.',503);
  const base={
    model:c.model,
    messages,
    temperature:options.temperature??0.15,
    max_tokens:Math.min(Number(options.maxTokens??8192),32768),
    stream:false
  };
  if(options.tools)base.tools=options.tools;
  if(options.toolChoice)base.tool_choice=options.toolChoice;
  if(options.reasoning)base.reasoning=options.reasoning;
  if(options.responseFormat)base.response_format=options.responseFormat;

  const timeoutMs=options.timeoutMs??240000;
  let j;
  let lastError=null;
  for(const model of [c.model,c.fallbackModel].filter((v,i,a)=>v&&a.indexOf(v)===i)){
    try{
      j=await requestCompletion(c,{...base,__timeoutMs:timeoutMs},model);
      const content=extractContent(j);
      if(content)return content;
      lastError=err('MODEL_EMPTY',`Gemini returned an empty response for ${model}`,502,{model});
    }catch(e){
      lastError=e;
      // Only fail over for transient/availability/model-selection failures.
      if(!['MODEL_ERROR','MODEL_EMPTY'].includes(e.code))throw e;
    }
  }
  throw lastError||err('MODEL_UNAVAILABLE','Gemini model is unavailable.',503);
}
