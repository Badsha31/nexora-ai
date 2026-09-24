import {err} from '../shared/errors.js';

export function modelConfig(){
  const provider=String(process.env.NEXORA_MODEL_PROVIDER||'gemini').toLowerCase();
  if(provider==='gemini'){
    return {
      provider:'gemini',
      baseUrl:(process.env.GEMINI_API_BASE_URL||'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/,''),
      model:process.env.GEMINI_MODEL_NAME||'gemini-3.8-flash',
      fallbackModel:process.env.GEMINI_MODEL_FALLBACK||'gemini-3.7-flash',
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
  const candidates=[
    message?.content,
    message?.reasoning_content,
    message?.output_text,
    j?.choices?.[0]?.text,
    j?.output_text,
    j?.response,
    j?.text
  ];
  const read=(value)=>{
    if(typeof value==='string'&&value.trim())return value.trim();
    if(Array.isArray(value)){
      const text=value.map(x=>{
        if(typeof x==='string')return x;
        if(typeof x?.text==='string')return x.text;
        if(typeof x?.content==='string')return x.content;
        if(typeof x?.text?.value==='string')return x.text.value;
        return '';
      }).join('').trim();
      if(text)return text;
    }
    if(value&&typeof value==='object'){
      for(const key of ['text','content','output_text','value']){
        const found=read(value[key]);
        if(found)return found;
      }
    }
    return '';
  };
  for(const value of candidates){
    const text=read(value);
    if(text)return text;
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

  // Gemini can temporarily return 429/500/503 during load or quota bursts.
  // Retry only transient failures, then let chat() fail over to the fallback model.
  const maxAttempts=4;
  let lastFailure=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const r=await fetch(endpoint(c,'/chat/completions'),{
        method:'POST',
        headers,
        body:JSON.stringify(requestBody),
        signal:AbortSignal.timeout(__timeoutMs)
      });
      const raw=await r.text();
      let j=null;try{j=raw?JSON.parse(raw):null}catch{}
      if(r.ok)return j;

      const transient=[408,429,500,502,503,504].includes(r.status);
      if(!transient || attempt===maxAttempts){
        throw err(r.status===401?'MODEL_AUTH_REQUIRED':'MODEL_ERROR',`Gemini API returned HTTP ${r.status}`,r.status===401?503:502,{response:raw.slice(0,4000),status:r.status,model,attempts:attempt});
      }
      lastFailure={status:r.status,body:raw.slice(0,1000)};
    }catch(e){
      if(e.code)throw e;
      if(attempt===maxAttempts)throw err('MODEL_ERROR',e.message||'Gemini request failed',502,{model,attempts:attempt});
      lastFailure={message:e.message};
    }

    const delay=Math.min(8000,1000*2**(attempt-1))+Math.floor(Math.random()*300);
    await new Promise(resolve=>setTimeout(resolve,delay));
  }
  throw err('MODEL_ERROR','Gemini request failed after retries.',502,{model,lastFailure});
}

export async function chat(messages,options={}){
  const c=modelConfig();
  if(!c.configured)throw err('MODEL_AUTH_REQUIRED','GEMINI_API_KEY is not configured on the server.',503);
  const base={
    model:c.model,
    messages,
    max_tokens:Math.min(Number(options.maxTokens??8192),32768),
    stream:false,
    reasoning_effort:options.reasoningEffort||'medium'
  };
  if(options.tools)base.tools=options.tools;
  if(options.toolChoice)base.tool_choice=options.toolChoice;
  if(options.reasoning)base.reasoning=options.reasoning;
  if(options.responseFormat)base.response_format=options.responseFormat;

  const timeoutMs=options.timeoutMs??240000;
  let j;
  let lastError=null;
  const configuredModels=[c.model,c.fallbackModel,'gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash-lite'];
  const models=configuredModels.filter((v,i,a)=>v&&a.indexOf(v)===i);
  const failures=[];
  for(const model of models){
    try{
      j=await requestCompletion(c,{...base,__timeoutMs:timeoutMs},model);
      let content=extractContent(j);
      if(content)return content;

      // Some Gemini OpenAI-compatible responses can be empty when medium thinking
      // consumes the response budget. Retry the same model once with lower thinking.
      if(base.reasoning_effort!=='low'){
        const retryBody={...base,reasoning_effort:'low',max_tokens:Math.min(Number(base.max_tokens||8192),16384),__timeoutMs:timeoutMs};
        j=await requestCompletion(c,retryBody,model);
        content=extractContent(j);
        if(content)return content;
      }
      lastError=err('MODEL_EMPTY',`Gemini returned an empty response for ${model}`,502,{model});
      failures.push({model,code:lastError.code,message:lastError.message,details:lastError.details||{}});
    }catch(e){
      lastError=e;
      if(!['MODEL_ERROR','MODEL_EMPTY'].includes(e.code))throw e;
      failures.push({model,code:e.code,message:e.message,details:e.details||{}});
    }
  }
  if(failures.length){
    const summary=failures.map(x=>`${x.model}: ${x.message}`).join(' | ');
    throw err('MODEL_UNAVAILABLE',`Gemini models unavailable: ${summary}`,503,{failures});
  }
  throw lastError||err('MODEL_UNAVAILABLE','Gemini model is unavailable.',503);
}