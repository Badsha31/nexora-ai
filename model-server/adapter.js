import {err} from '../shared/errors.js';

export function modelConfig(){
  return {
    baseUrl:process.env.NEXORA_MODEL_URL||'https://nexora-api-model.rakibulhasan1301.workers.dev/v1',
    model:process.env.NEXORA_MODEL_NAME||'nexora-coder',
    apiKey:process.env.NEXORA_MODEL_API_KEY||'',
    configured:true
  };
}

function endpoint(c,path){return c.baseUrl.replace(/\/$/,'')+path;}

export async function health(){
  const c=modelConfig();
  try{
    const r=await fetch(endpoint(c,'/models'),{
      signal:AbortSignal.timeout(10000),
      headers:c.apiKey?{Authorization:`Bearer ${c.apiKey}`}:{}
    });
    let body=null;
    try{body=await r.json();}catch{}
    return {
      available:r.ok,
      status:r.status,
      model:c.model,
      endpoint:c.baseUrl,
      serverModels:body?.data||[],
      config:{...c,apiKey:c.apiKey?'configured':'not configured'}
    };
  }catch(e){
    return {
      available:false,
      error:e.message,
      model:c.model,
      endpoint:c.baseUrl,
      config:{...c,apiKey:c.apiKey?'configured':'not configured'}
    };
  }
}

export async function chat(messages,options={}){
  const c=modelConfig();
  try{
    const payload={
      model:c.model,
      messages,
      temperature:options.temperature??0.15,
      max_tokens:options.maxTokens??32768,
      stream:false
    };
    if(options.tools)payload.tools=options.tools;
    if(options.toolChoice)payload.tool_choice=options.toolChoice;
    const r=await fetch(endpoint(c,'/chat/completions'),{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        ...(c.apiKey?{Authorization:`Bearer ${c.apiKey}`}: {})
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(options.timeoutMs??180000)
    });
    if(!r.ok){
      const detail=await r.text().catch(()=> '');
      if(r.status===401)throw err('MODEL_AUTH_REQUIRED','Nexora API rejected the model request. Set NEXORA_MODEL_API_KEY in the Nexora AI server environment.',503);
      throw err('MODEL_ERROR',`Model server returned HTTP ${r.status}`,502,{response:detail.slice(0,4000)});
    }
    const j=await r.json();
    const message=j.choices?.[0]?.message;
    if(!message?.content && !message?.tool_calls)throw err('MODEL_EMPTY','Model server returned an empty response',502);
    return message.content||JSON.stringify({tool_calls:message.tool_calls});
  }catch(e){
    if(e.code)throw e;
    throw err('MODEL_UNAVAILABLE',`Nexora Coding Model unavailable: ${e.message}`,503);
  }
}
