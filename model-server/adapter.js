import {err} from '../shared/errors.js';

export function modelConfig(){
  return {
    baseUrl:process.env.NEXORA_MODEL_URL||'https://nexora-api-model.rakibulhasan1301.workers.dev/v1',
    model:process.env.NEXORA_MODEL_NAME||'nexora-coder',
    apiKey:process.env.NEXORA_MODEL_API_KEY||'',
    configured:true,
    keyless:true
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
    let body=null;try{body=await r.json()}catch{}
    return {
      available:r.ok,
      status:r.status,
      model:c.model,
      endpoint:c.baseUrl,
      serverModels:body?.data||[],
      config:{...c,apiKey:c.apiKey?'configured':'not required'}
    };
  }catch(e){
    return {
      available:false,
      error:e.message,
      model:c.model,
      endpoint:c.baseUrl,
      config:{...c,apiKey:c.apiKey?'configured':'not required'}
    };
  }
}

function extractContent(j){
  const message=j?.choices?.[0]?.message;
  const candidates=[
    message?.content,
    j?.choices?.[0]?.text,
    j?.output_text,
    j?.response,
    j?.text
  ];
  for(const value of candidates){
    if(typeof value==='string'&&value.trim())return value;
  }
  const toolCalls=message?.tool_calls||j?.tool_calls;
  if(Array.isArray(toolCalls)&&toolCalls.length)return JSON.stringify({tool_calls:toolCalls});
  return '';
}

async function requestCompletion(c,payload){
  const headers={'Content-Type':'application/json'};
  if(c.apiKey)headers.Authorization=`Bearer ${c.apiKey}`;
  const {__timeoutMs=240000,...requestBody}=payload;
  const r=await fetch(endpoint(c,'/chat/completions'),{
    method:'POST',
    headers,
    body:JSON.stringify(requestBody),
    signal:AbortSignal.timeout(__timeoutMs)
  });
  const raw=await r.text();
  let j=null;try{j=raw?JSON.parse(raw):null}catch{}
  if(!r.ok){
    if(r.status===401)throw err('MODEL_AUTH_REQUIRED','The Nexora model service requires authorization. Deploy the keyless Nexora API mode or configure NEXORA_MODEL_API_KEY on the server.',503);
    throw err('MODEL_ERROR',`Model server returned HTTP ${r.status}`,502,{response:raw.slice(0,4000)});
  }
  return j;
}

export async function chat(messages,options={}){
  const c=modelConfig();
  try{
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

    const requestPayload={...base};
    const timeoutMs=options.timeoutMs??240000;
    let j=await requestCompletion(c,{...requestPayload,__timeoutMs:timeoutMs});
    let content=extractContent(j);
    if(content)return content;

    // A small retry handles transient empty generations from Workers AI.
    j=await requestCompletion(c,{
      ...requestPayload,
      temperature:0,
      max_tokens:Math.min(base.max_tokens,4096),
      messages:[
        ...messages,
        {role:'user',content:'Return the requested response now. Do not return an empty response.'}
      ],
      __timeoutMs:options.timeoutMs??240000
    });
    content=extractContent(j);
    if(!content){
      throw err('MODEL_EMPTY','Model server returned no usable text or tool calls',502,{
        responseShape:j?Object.keys(j).slice(0,30):[]
      });
    }
    return content;
  }catch(e){
    if(e.code)throw e;
    throw err('MODEL_UNAVAILABLE',`Nexora Coding Model unavailable: ${e.message}`,503);
  }
}
