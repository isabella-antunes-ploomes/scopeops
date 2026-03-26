import React, { useState, useRef, useEffect, createContext } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Clock, History, Settings, X, Send, AlertCircle, CheckCircle, Info, Lock } from "lucide-react";
import api from "./api.js";

const T = {
  p50:"#EEF3FF",p100:"#D4E0FF",p200:"#AABFFF",p400:"#5578FF",p500:"#2E54E8",p600:"#1E3ECC",
  n0:"#FFFFFF",n50:"#F7F8FA",n100:"#EDEEF2",n200:"#D8DAE3",n300:"#B5B9CA",
  n400:"#8D91A8",n500:"#6B6F87",n600:"#4E5268",n700:"#373B52",n800:"#22253A",n900:"#0E1022",
  okBg:"#E8F8F0",okT:"#0F7B45",okB:"#8ADCB2",
  wBg:"#FFF8E6",wT:"#946200",wB:"#FFCE6B",
  eBg:"#FDEEF0",eT:"#C4132A",eB:"#F5A0AA",
  iBg:"#EEF3FF",iT:"#1E3ECC",iB:"#AABFFF",
  sidebarBg:"#1C1040",
  font:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  r4:4,r6:6,r8:8,r12:12,rFull:9999,
  shadowSm:"0 1px 2px rgba(14,16,34,0.06)",
  shadowMd:"0 2px 8px rgba(14,16,34,0.08)",
  shadowLg:"0 4px 16px rgba(14,16,34,0.10)",
  shadowXl:"0 8px 32px rgba(14,16,34,0.14)",
};

const AGENT_KEYS = ["pm","rag","n1","modules","dev","final"];
const KB_MAX_CHARS = 40000;
const ADMIN_PASSWORD = "ploomes2025";

const AGENT_META = {
  pm:      { icon:"🔍", color:T.p500,    light:T.p50     },
  rag:     { icon:"🗂️", color:"#7C3AED", light:"#F5F3FF" },
  n1:      { icon:"🎧", color:"#0891B2", light:"#ECFEFF" },
  modules: { icon:"🔐", color:"#BE185D", light:"#FDF2F8" },
  dev:     { icon:"⚙️", color:"#EA580C", light:"#FFF7ED" },
  final:   { icon:"✅", color:T.okT,     light:T.okBg    },
};

const DEFAULT_AGENTS = {
  pm:      { name:"Agente Broz",                   description:"Pontos de regra de negócio em aberto",     instructions:"Você é um Product Manager sênior especialista em regras de negócio. Identifique pontos NÃO definidos no escopo.\nFoque EXCLUSIVAMENTE em regras de negócio. NÃO aborde compatibilidade. NÃO gere resumos.\nPara cada ponto: descreva a lacuna e formule UMA pergunta direta.\n## Limites e Escopo\n## Fluxos e Comportamentos\n## Condições, Exceções e Casos de Borda\n## Permissões e Perfis de Acesso\n## Migração e Dados Existentes\n## Empty States e Feedbacks\n## Outras Regras Não Definidas\nResponda em português." },
  rag:     { name:"Agente RAG",                    description:"Interferências com features existentes",    instructions:"Você é especialista em análise de impacto. Analise features existentes e identifique interferências.\n## Interferências Críticas\n## Interferências Médias\n## Pontos de Atenção Baixos\n## Observações Gerais\nCite nome e módulo de cada feature. Responda em português." },
  n1:      { name:"Agente N1",                     description:"Análise de suporte e atendimento",          instructions:"Você é especialista em suporte N1. Identifique pontos de atenção de atendimento.\n## Possíveis Dúvidas de Usuários\n## Impactos no Atendimento N1\n## Sugestões de FAQ\n## Pontos de Atenção para Comunicação\nResponda em português." },
  modules: { name:"Check em Módulos e Permissões", description:"Verificação de módulos e níveis de acesso", instructions:"Você é especialista em controle de acesso. Verifique módulos e permissões.\n## Módulos Impactados\n## Permissões Necessárias\n## Perfis de Acesso Envolvidos\n## Inconsistências ou Lacunas\n## Recomendações\nResponda em português." },
  dev:     { name:"Agente Dev Sênior",              description:"Análise técnica e perguntas para o time",   instructions:"Você é dev sênior full-stack. Identifique falhas técnicas.\n## Falhas Técnicas\n## Decisões de Arquitetura\n## Integrações e Dependências\n## Performance\n## Segurança\n## Perguntas para o Time (mínimo 10, numeradas)\nResponda em português." },
  final:   { name:"Escopo Final",                   description:"Consolidação e entregáveis",                instructions:"Você é PM sênior fazendo revisão final. Gere:\n---\n## ESCOPO FINAL DA FEATURE\n[conteúdo]\n---\n## PONTOS DE ATENÇÃO DE IMPACTO\n[conteúdo]\n---\n## LISTA DE PERGUNTAS PARA O TIME DE DEV\n[conteúdo]\n---\n## CHECKLIST DE DEFINIÇÕES\n[itens]\n---\n## PENDÊNCIAS CRÍTICAS\n[conteúdo]\nResponda em português." },
};
const PIPELINE = ["pm","rag","n1","modules","dev","final"];

const UserCtx = createContext("");

// ── helpers ──────────────────────────────────────────────────────────────────
function truncKB(c){
  if(c&&c.type==="text"&&c.content.length>KB_MAX_CHARS)
    return {...c,content:c.content.slice(0,KB_MAX_CHARS)+"\n[truncado]"};
  return c;
}

function chunkMd(md){
  const mx=50000;const ls=md.split("\n");const cs=[];let c="";
  for(const l of ls){
    if(/^#{1,3} /.test(l)&&c.length>mx*0.3){cs.push(c);c=l+"\n";}
    else{c+=l+"\n";if(c.length>=mx){cs.push(c);c="";}}
  }
  if(c.trim()) cs.push(c);
  return cs.filter(x=>x.trim());
}

async function extractFeatures(chunk,i,t){
  const r=await api.callClaude({
    system:"Extraia features de Markdown. Retorne SOMENTE JSON array: [{\"name\":\"\",\"ondeOcorre\":\"\",\"content\":\"ate 80 palavras\"}]. Se não houver, retorne [].",
    userText:"Trecho "+(i+1)+"/"+t+":\n\n"+chunk
  });
  const m=r.match(/\[[\s\S]*\]/);
  if(!m) return [];
  try{return JSON.parse(m[0]);}catch{return [];}
}

async function processMdFile(file,onP){
  const text=await file.text();const cs=chunkMd(text);onP("0/"+cs.length+"…");
  const all=[];
  for(let i=0;i<cs.length;i++){all.push(...await extractFeatures(cs[i],i,cs.length));onP((i+1)+"/"+cs.length+" ("+all.length+" features)");}
  if(!all.length) throw new Error("Nenhuma feature encontrada.");
  return all;
}

async function extractKBText(file){
  const n=file.name.toLowerCase();
  if(n.endsWith(".txt")||n.endsWith(".md")) return {type:"text",content:await file.text()};
  if(n.endsWith(".pdf")) return new Promise((rs,rj)=>{const r=new FileReader();r.onload=()=>rs({type:"pdf",data:r.result.split(",")[1]});r.onerror=rj;r.readAsDataURL(file);});
  return {type:"text",content:"["+file.name+"]"};
}

async function extractTextFromFile(file){
  const n=file.name.toLowerCase();
  if(n.endsWith(".txt")||n.endsWith(".md")) return await file.text();
  if(n.endsWith(".pdf")) return new Promise((rs,rj)=>{const r=new FileReader();r.onload=()=>rs({type:"pdf",data:r.result.split(",")[1]});r.onerror=rj;r.readAsDataURL(file);});
  return "["+file.name+"]";
}

async function processFiles(files){
  const p=[];
  for(const f of files){const r=await extractTextFromFile(f);if(r&&r.type==="pdf") p.push({pdf:r});else p.push({text:"--- "+f.name+" ---\n"+r});}
  return p;
}

function parseSection(text,marker){
  for(const p of text.split(/\n---\n/)) if(p.includes(marker)) return p.replace(/^##[^\n]+\n/,"").trim();
  return "";
}
function cp(t){if(navigator.clipboard) navigator.clipboard.writeText(t).catch(()=>fb(t));else fb(t);}
function fb(t){const e=document.createElement("textarea");e.value=t;e.style.cssText="position:fixed;top:-9999px";document.body.appendChild(e);e.select();document.execCommand("copy");document.body.removeChild(e);}

// ── agent config helpers ─────────────────────────────────────────────────────
let _agentConfigCache = null;

async function getAgentInstructions(k){
  if(_agentConfigCache&&_agentConfigCache[k]&&_agentConfigCache[k].instructions) return _agentConfigCache[k].instructions;
  // Fallback: fetch from server if cache is empty
  try{
    const serverCfg = await api.getAgents();
    _agentConfigCache = serverCfg;
    if(serverCfg[k]&&serverCfg[k].instructions) return serverCfg[k].instructions;
  }catch{}
  return "";
}

async function getAgents(){
  try{
    const serverCfg = await api.getAgents();
    _agentConfigCache = serverCfg;
    const o={};
    for(const k of AGENT_KEYS){
      const srv = serverCfg[k] || {};
      o[k]={
        ...AGENT_META[k],
        name: srv.name || DEFAULT_AGENTS[k].name,
        description: srv.description || DEFAULT_AGENTS[k].description,
        instructions: srv.instructions || "",
      };
    }
    return o;
  }catch{
    const o={};
    for(const k of AGENT_KEYS) o[k]={name:DEFAULT_AGENTS[k].name,description:DEFAULT_AGENTS[k].description,instructions:"",...AGENT_META[k]};
    return o;
  }
}

async function getKbItems(k){
  try{
    const list = await api.getKB(k);
    if(!list.length) return [];
    const items=[];
    for(const entry of list){
      const full = await api.getKBContent(k, entry.id);
      items.push(truncKB({type:full.content_type, content:full.content}));
    }
    return items;
  }catch{return [];}
}

// ── logo ──────────────────────────────────────────────────────────────────────
function PloomesLogo(){
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2}}>
      <svg width="148" height="20" viewBox="0 0 370 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M207.26 41.5601C199.774 41.5601 194.368 35.9684 194.368 28.0981C194.368 20.2279 199.774 14.6361 207.26 14.6361C214.747 14.6361 220.153 20.2279 220.153 28.0981C220.153 35.9684 214.747 41.5601 207.26 41.5601ZM207.26 49.256C218.676 49.256 227.918 39.7814 227.918 28.0981C227.918 16.4148 218.665 6.94025 207.26 6.94025C195.856 6.94025 186.602 16.4148 186.602 28.0981C186.602 39.7814 195.856 49.256 207.26 49.256ZM332.661 40.7231C329.174 45.9428 323.466 49.256 316.584 49.256C305.098 49.256 296.844 40.0023 296.844 28.0981C296.844 16.1939 305.098 6.94025 316.584 6.94025C327.442 6.94025 336.323 16.1939 335.289 31.5508H327.116C328.476 20.007 323.361 14.3455 316.246 14.3455C309.132 14.3455 304.017 20.007 304.017 28.0981C304.017 36.1893 309.132 41.8507 316.246 41.8507C320.676 41.8507 324.326 39.6652 326.453 36.0614L332.685 40.7231H332.661ZM301.541 25.3429H332.452V31.5624H301.541V25.3429ZM162.922 41.5601C155.435 41.5601 150.029 35.9684 150.029 28.0981C150.029 20.2279 155.435 14.6361 162.922 14.6361C170.408 14.6361 175.814 20.2279 175.814 28.0981C175.814 35.9684 170.408 41.5601 162.922 41.5601ZM162.922 49.256C174.338 49.256 183.58 39.7814 183.58 28.0981C183.58 16.4148 174.326 6.94025 162.922 6.94025C151.517 6.94025 142.264 16.4148 142.264 28.0981C142.264 39.7814 151.517 49.256 162.922 49.256ZM336.695 40.1069L342.043 36.2706C343.833 39.9907 347.844 41.9786 353.284 41.9786C359.329 41.9786 362.003 39.8396 362.003 36.1544C362.003 28.505 337.079 36.1776 337.079 18.4143C337.079 11.4625 343.775 6.77749 352.75 6.77749C359.818 6.77749 366.956 10.4627 368.153 17.2751L361.352 19.1932C360.829 15.0081 357.028 13.3109 352.877 13.3109C347.437 13.3109 344.17 15.229 344.17 18.5655C344.17 28.5166 369.688 20.7742 369.688 35.9451C369.688 43.7573 363.689 48.8026 353.284 48.8026C345.588 48.8026 339.148 45.6289 336.695 40.1186V40.1069ZM231.708 48.0818V7.47501H239.66V15.2871C241.02 9.89305 245.693 6.76587 252.006 6.76587C258.818 6.76587 264.352 9.89305 266.049 15.7289C267.92 9.9628 273.303 6.69612 279.267 6.69612C289.485 6.69612 293.74 12.7993 293.74 25.0174V48.0818H285.788V25.6568C285.788 17.6936 283.091 13.5782 276.349 13.5782C269.606 13.5782 266.479 17.8331 266.479 25.5173V48.0818H258.527V25.7266C258.527 17.4843 256.121 13.648 249.518 13.648C242.915 13.648 239.648 18.2632 239.648 26.2962V48.0818H231.696H231.708ZM89.09 48.0818V0H101.413C118.234 0 125.547 7.103 125.547 18.1004C125.547 30.5394 118.234 37.3053 101.482 37.3053H96.9486V48.0702H89.09V48.0818ZM96.9486 29.7838H102.622C112.352 29.7838 117.63 26.3892 117.63 18.1004C117.63 10.3813 112.352 7.31225 102.622 7.31225H96.9486V29.7838Z" fill="#ffffff"/>
        <path d="M135.289 39.5373V0H127.825V40.6185C127.825 44.7338 131.162 48.0818 135.289 48.0818H141.369V40.6185H136.381C135.777 40.6185 135.3 40.1302 135.3 39.5373H135.289Z" fill="#ffffff"/>
        <path d="M62.7229 24.3256H32.228C26.4105 24.3256 20.8393 22.0033 16.7459 17.8747L0.208285 1.20807C-0.23741 0.762374 0.0792682 0 0.712625 0H33.5651C42.9833 0 51.8269 4.52733 57.3277 12.1745L64.1069 21.5928C64.928 22.7305 64.1069 24.3256 62.7112 24.3256H62.7229Z" fill="#7E33E6"/>
        <path d="M46.4317 30.2956H31.0786C25.4957 30.2956 20.1356 32.524 16.1948 36.4884L3.98504 48.7919C3.53935 49.2376 3.85602 50 4.48938 50H23.3963C29.4131 50 35.1368 47.4197 39.1129 42.9041L47.7218 33.1457C48.7071 32.0314 47.9095 30.2838 46.4317 30.2838V30.2956Z" fill="#7E33E6"/>
      </svg>
      <span style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.55)",letterSpacing:"0.8px",textTransform:"uppercase",paddingLeft:22}}>Pipeline ScopeOps</span>
    </div>
  );
}

// ── ui atoms ──────────────────────────────────────────────────────────────────
function Tooltip({text,children}){
  const [vis,setVis]=useState(false);
  return (
    <div style={{position:"relative",display:"inline-flex"}} onMouseEnter={()=>setVis(true)} onMouseLeave={()=>setVis(false)}>
      {children}
      {vis&&(
        <div style={{position:"absolute",bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:T.n800,color:"#fff",fontSize:11,fontWeight:500,padding:"5px 10px",borderRadius:T.r6,whiteSpace:"nowrap",boxShadow:T.shadowLg,zIndex:9999,pointerEvents:"none"}}>
          {text}
          <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid "+T.n800}}/>
        </div>
      )}
    </div>
  );
}

function Toaster({type,msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,type==="error"?4000:2500);return ()=>clearTimeout(t);},[]);
  const maps={error:{bg:T.eBg,border:T.eB,text:T.eT,Icon:AlertCircle},success:{bg:T.okBg,border:T.okB,text:T.okT,Icon:CheckCircle},info:{bg:T.iBg,border:T.iB,text:T.iT,Icon:Info}};
  const cfg=maps[type]||maps.error;
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:99999,background:cfg.bg,border:"1px solid "+cfg.border,borderRadius:T.r8,padding:"10px 18px",display:"flex",alignItems:"center",gap:8,color:cfg.text,fontSize:13,fontWeight:600,boxShadow:T.shadowXl,whiteSpace:"nowrap",pointerEvents:"none"}}>
      <cfg.Icon size={14}/>{msg}
    </div>
  );
}

function Btn({onClick,children,variant,size,disabled}){
  variant=variant||"primary";size=size||"md";disabled=!!disabled;
  const [hov,setHov]=useState(false);
  const Vs={primary:{bg:T.p500,hov:T.p600,c:"#fff",border:T.p500},secondary:{bg:"#fff",hov:T.p50,c:T.p500,border:T.p500},ghost:{bg:"transparent",hov:T.n100,c:T.n600,border:"transparent"},danger:{bg:"#fff",hov:T.eBg,c:T.eT,border:T.eT}};
  const Ss={sm:{p:"5px 10px",fs:11,h:28},md:{p:"7px 14px",fs:13,h:34},lg:{p:"10px 20px",fs:13,h:40}};
  const V=Vs[variant]||Vs.primary;const S=Ss[size]||Ss.md;
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"inline-flex",alignItems:"center",gap:6,background:disabled?T.n100:hov?V.hov:V.bg,color:disabled?T.n400:V.c,border:"1px solid "+(disabled?T.n200:V.border),borderRadius:T.r6,padding:S.p,fontSize:S.fs,fontWeight:600,height:S.h,cursor:disabled?"not-allowed":"pointer",fontFamily:T.font,transition:"all .15s",lineHeight:1,whiteSpace:"nowrap"}}>
      {children}
    </button>
  );
}

function CopyBtn({text}){
  const [c,setC]=useState(false);
  return (
    <button onClick={()=>{cp(text);setC(true);setTimeout(()=>setC(false),2000);}}
      style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:T.r4,background:c?T.okBg:"transparent",border:"1px solid "+(c?T.okB:T.n200),color:c?T.okT:T.n400,fontSize:11,fontWeight:500,cursor:"pointer",transition:"all .15s"}}>
      {c?<Check size={11}/>:<Copy size={11}/>}{c?"Copiado":"Copiar"}
    </button>
  );
}

function Field({label,value,onChange,placeholder,required,rows,type}){
  type=type||"text";
  const [foc,setFoc]=useState(false);
  const base={width:"100%",border:"1px solid "+(foc?T.p500:T.n200),borderRadius:T.r6,padding:"7px 10px",fontSize:13,fontFamily:T.font,color:T.n800,background:T.n0,outline:"none",boxSizing:"border-box",transition:"border-color .15s",lineHeight:1.5,boxShadow:foc?"0 0 0 3px "+T.p100:T.shadowSm};
  return (
    <div>
      {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:T.n600,marginBottom:5}}>{label}{required&&<span style={{color:T.eT,marginLeft:3}}>*</span>}</label>}
      {rows>1
        ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={{...base,resize:"vertical"}}/>
        :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={{...base,height:34}}/>
      }
    </div>
  );
}

function Spinner({label,color}){
  color=color||T.p500;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"36px 0",gap:12}}>
      <div style={{width:30,height:30,border:"2px solid "+T.n200,borderTopColor:color,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <span style={{fontSize:12,color:T.n400,fontWeight:500}}>{label}</span>
    </div>
  );
}

function EyeIcon({open}){
  if(open) return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
  return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>);
}

function PasswordField({label,value,onChange,show,onToggle,hasError}){
  hasError=!!hasError;const [foc,setFoc]=useState(false);
  const bc=hasError?T.eT:foc?"#6B21A8":T.n200;
  return (
    <div>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:hasError?T.eT:T.n600,marginBottom:5}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={show?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} placeholder="Mínimo 6 caracteres"
          onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
          style={{width:"100%",border:"1px solid "+bc,borderRadius:T.r6,padding:"7px 36px 7px 10px",fontSize:13,fontFamily:T.font,color:T.n800,background:T.n0,outline:"none",boxSizing:"border-box",height:34}}/>
        <button type="button" onClick={onToggle} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.n400,display:"flex",alignItems:"center",padding:2}}>
          <EyeIcon open={show}/>
        </button>
      </div>
    </div>
  );
}

// ── step bar ──────────────────────────────────────────────────────────────────
function StepBar({phase,agentCfg}){
  const steps=[
    {id:"input",label:"Escopo",icon:"📝"},
    ...PIPELINE.filter(k=>k!=="final").map(k=>({id:k,label:(agentCfg&&agentCfg[k]&&agentCfg[k].name)||DEFAULT_AGENTS[k].name,icon:AGENT_META[k].icon})),
    {id:"final",label:"Resultado",icon:"✅"}
  ];
  const ai=steps.findIndex(p=>p.id===phase);
  return (
    <div style={{display:"flex",alignItems:"center",overflowX:"auto",paddingBottom:2}}>
      {steps.map((p,i)=>{
        const done=i<ai,cur=i===ai;
        return (
          <div key={p.id} style={{display:"flex",alignItems:"center",flex:1,minWidth:0}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
              <div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,border:"2px solid "+(cur?T.p500:done?T.okT:T.n200),background:cur?T.p500:done?T.okT:T.n0,color:cur||done?"#fff":T.n400,flexShrink:0,boxShadow:cur?"0 0 0 3px "+T.p100:"none",transition:"all .2s"}}>
                {done?"✓":p.icon}
              </div>
              <Tooltip text={p.label}>
                <span style={{fontSize:9,marginTop:4,fontWeight:600,color:cur?T.p500:done?T.okT:T.n300,textAlign:"center",maxWidth:56,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",display:"block",cursor:"default"}}>{p.label}</span>
              </Tooltip>
            </div>
            {i<steps.length-1&&<div style={{height:2,flex:1,background:done?T.okT:T.n200,margin:"0 2px",marginBottom:18,minWidth:8,transition:"background .3s"}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ── file drop zone ────────────────────────────────────────────────────────────
function FileDropZone({files,onFiles}){
  const ref=useRef();const [drag,setDrag]=useState(false);
  const add=fs=>onFiles([...files,...Array.from(fs)]);
  const rem=i=>onFiles(files.filter((_,x)=>x!==i));
  const fmt=f=>{const k=f.size/1024;return k>1024?(k/1024).toFixed(1)+" MB":k.toFixed(0)+" KB";};
  const EXT={pdf:"📄",txt:"📃",md:"📃",doc:"📝",docx:"📝",xlsx:"📊",xls:"📊",csv:"📊"};
  const ic=f=>EXT[f.name.split(".").pop().toLowerCase()]||"📎";
  return (
    <div>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:T.n600,marginBottom:5}}>📎 Documentos de Apoio</label>
      <div onClick={()=>ref.current&&ref.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);add(e.dataTransfer.files);}}
        style={{border:"2px dashed "+(drag?T.p500:T.n200),borderRadius:T.r8,padding:14,background:drag?T.p50:T.n50,cursor:"pointer",transition:"all .15s"}}>
        <input ref={ref} type="file" multiple accept=".pdf,.txt,.md,.doc,.docx,.xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>add(e.target.files)}/>
        <div style={{textAlign:"center",padding:"6px 0"}}>
          <div style={{fontSize:20,marginBottom:4}}>📎</div>
          <div style={{fontSize:12,color:T.n400,fontWeight:500}}>Arraste ou clique para selecionar</div>
          <div style={{fontSize:11,color:T.n300,marginTop:3}}>PDF, TXT, MD, DOCX, XLSX, CSV</div>
        </div>
      </div>
      {files.length>0&&(
        <div style={{marginTop:8,maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
          {files.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:T.n0,borderRadius:T.r6,padding:"6px 10px",border:"1px solid "+T.n100,flexShrink:0}}>
              <span>{ic(f)}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:500,color:T.n700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                <div style={{fontSize:11,color:T.n400}}>{fmt(f)}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();rem(i);}} style={{background:"none",border:"none",cursor:"pointer",color:T.n300,fontSize:16,padding:0,flexShrink:0}}>×</button>
            </div>
          ))}
          <div style={{fontSize:11,color:T.p500,textAlign:"center",paddingTop:2}}>+ Adicionar mais arquivos</div>
        </div>
      )}
    </div>
  );
}

function Panel({icon,title,subtitle,color,children}){
  return (
    <div style={{background:T.n0,border:"1px solid "+T.n100,borderRadius:T.r12,boxShadow:T.shadowMd,overflow:"visible"}}>
      <div style={{background:T.n50,borderBottom:"1px solid "+T.n100,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,borderRadius:T.r12+"px "+T.r12+"px 0 0"}}>
        <div style={{width:32,height:32,borderRadius:T.r8,background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{icon}</div>
        <div>
          <div style={{fontWeight:700,fontSize:13,color:T.n800}}>{title}</div>
          {subtitle&&<div style={{fontSize:11,color:T.n400,marginTop:1}}>{subtitle}</div>}
        </div>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  );
}

// ── agent chat ────────────────────────────────────────────────────────────────
function AgentChatPhase({agentKey,cfg,scopeText,fileParts,prevContext,savedMessages,onAdvance,onBack}){
  const meta=AGENT_META[agentKey];
  const [messages,setMessages]=useState(savedMessages||[]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [initializing,setInitializing]=useState(!savedMessages||savedMessages.length===0);
  const bottomRef=useRef();

  useEffect(()=>{if(bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"});},[messages,loading]);

  useEffect(()=>{
    if(savedMessages&&savedMessages.length>0) return;
    (async()=>{
      setInitializing(true);
      try{
        const instr=await getAgentInstructions(agentKey);
        const kb=await getKbItems(agentKey);
        const ut=prevContext?"Escopo:\n"+scopeText+"\n\n--- Contexto anterior ---\n"+prevContext:"Escopo:\n"+scopeText;
        const r=await api.callClaude({system:instr,userText:ut,kbItems:kb,fileParts});
        setMessages([{role:"agent",text:r}]);
      }catch(e){setMessages([{role:"agent",text:"Erro: "+e.message}]);}
      setInitializing(false);
    })();
  },[]);

  async function send(){
    const text=input.trim();if(!text||loading) return;
    setInput("");
    const nm=[...messages,{role:"user",text}];
    setMessages(nm);setLoading(true);
    try{
      const instr=await getAgentInstructions(agentKey);
      const kb=await getKbItems(agentKey);
      const hist=nm.map(m=>m.role==="user"?"Usuário: "+m.text:"Agente: "+m.text).join("\n\n");
      const r=await api.callClaude({system:instr,userText:"Escopo:\n"+scopeText+"\n\n--- Contexto anterior ---\n"+prevContext+"\n\n--- Histórico ---\n"+hist+"\n\nContinue respondendo.",kbItems:kb,fileParts});
      setMessages(p=>[...p,{role:"agent",text:r}]);
    }catch(e){setMessages(p=>[...p,{role:"agent",text:"Erro: "+e.message}]);}
    setLoading(false);
  }

  function advance(){
    const s=messages.map(m=>m.role==="user"?"Usuário: "+m.text:cfg.name+": "+m.text).join("\n\n");
    onAdvance(s,messages);
  }

  return (
    <div style={{background:T.n0,border:"1px solid "+T.n100,borderRadius:T.r12,boxShadow:T.shadowMd,overflow:"hidden"}}>
      <div style={{background:T.n50,borderBottom:"1px solid "+T.n100,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:T.r8,background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{meta.icon}</div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:T.n800}}>{cfg.name}</div>
            <div style={{fontSize:11,color:T.n400,marginTop:1}}>{cfg.description}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="ghost" size="sm" onClick={onBack}>← Voltar</Btn>
          <Btn variant="primary" size="sm" onClick={advance} disabled={initializing||loading||messages.length===0}>Avançar →</Btn>
        </div>
      </div>
      <div style={{height:400,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12,background:T.n50}}>
        {initializing&&<Spinner label={cfg.name+" analisando…"} color={meta.color}/>}
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{fontSize:10,color:T.n400,marginBottom:3,fontWeight:600}}>{msg.role==="user"?"Você":cfg.name}</div>
            <div style={{maxWidth:"88%"}}>
              <div style={{background:msg.role==="user"?meta.color:T.n0,color:msg.role==="user"?"#fff":T.n800,borderRadius:msg.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",padding:"10px 14px",fontSize:13,lineHeight:1.6,boxShadow:T.shadowSm,border:msg.role==="agent"?"1px solid "+T.n100:"none",whiteSpace:"pre-wrap",fontFamily:T.font}}>
                {msg.text}
              </div>
              {msg.role==="agent"&&<div style={{marginTop:4,display:"flex",justifyContent:"flex-end"}}><CopyBtn text={msg.text}/></div>}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
            <div style={{fontSize:10,color:T.n400,marginBottom:3,fontWeight:600}}>{cfg.name}</div>
            <div style={{background:T.n0,border:"1px solid "+T.n100,borderRadius:"12px 12px 12px 4px",padding:"10px 14px",display:"flex",gap:5,alignItems:"center"}}>
              {[0,1,2].map(x=><div key={x} style={{width:6,height:6,borderRadius:"50%",background:meta.color,opacity:.7,animation:"bounce 1.2s ease-in-out "+(x*.2)+"s infinite"}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 14px",borderTop:"1px solid "+T.n100,background:T.n0,display:"flex",gap:8,alignItems:"flex-end"}}>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="Responda ou forneça mais contexto… (Enter para enviar)" rows={2} disabled={initializing||loading}
          style={{flex:1,border:"1px solid "+T.n200,borderRadius:T.r6,padding:"8px 10px",fontSize:13,resize:"none",outline:"none",fontFamily:T.font,lineHeight:1.5,boxSizing:"border-box",color:T.n800}}
          onFocus={e=>{e.target.style.borderColor=meta.color;e.target.style.boxShadow="0 0 0 3px "+meta.color+"22";}}
          onBlur={e=>{e.target.style.borderColor=T.n200;e.target.style.boxShadow="none";}}/>
        <button onClick={send} disabled={!input.trim()||loading||initializing}
          style={{width:34,height:34,borderRadius:T.r6,background:!input.trim()||loading||initializing?T.n200:meta.color,border:"none",cursor:!input.trim()||loading||initializing?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Send size={14} color={!input.trim()||loading||initializing?T.n400:"#fff"}/>
        </button>
      </div>
      <div style={{padding:"10px 16px",borderTop:"1px solid "+T.n100,background:T.n50,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Btn variant="ghost" size="sm" onClick={onBack}>← Voltar</Btn>
        <Btn variant="primary" size="sm" onClick={advance} disabled={initializing||loading||messages.length===0}>Avançar para próxima etapa →</Btn>
      </div>
      <style>{"@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}"}</style>
    </div>
  );
}

// ── final phase ───────────────────────────────────────────────────────────────
function FinalPhase({cfg,scopeText,fileParts,prevContext,onReset}){
  const [output,setOutput]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const meta=AGENT_META.final;

  useEffect(()=>{
    (async()=>{
      try{
        const instr=await getAgentInstructions("final");
        const kb=await getKbItems("final");
        const r=await api.callClaude({system:instr,userText:"Escopo:\n"+scopeText+"\n\n--- Análises ---\n"+prevContext,kbItems:kb,fileParts});
        setOutput(r);
      }catch(e){setError(e.message);}
      setLoading(false);
    })();
  },[]);

  function ExCard({icon,title,content,borderColor,bg}){
    if(!content) return null;
    return (
      <div style={{borderRadius:T.r8,border:"1px solid "+borderColor,background:bg,padding:16,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:600,fontSize:13,color:T.n800}}><span style={{fontSize:16}}>{icon}</span>{title}</div>
          <CopyBtn text={content}/>
        </div>
        <pre style={{whiteSpace:"pre-wrap",fontSize:12,color:T.n700,fontFamily:T.font,lineHeight:1.6,background:"rgba(255,255,255,.6)",borderRadius:T.r6,padding:12,maxHeight:220,overflowY:"auto",margin:0}}>{content}</pre>
      </div>
    );
  }

  const sF=parseSection(output,"ESCOPO FINAL"),sI=parseSection(output,"PONTOS DE ATENÇÃO"),sD=parseSection(output,"PERGUNTAS PARA"),sCk=parseSection(output,"CHECKLIST");
  return (
    <Panel icon="✅" title={(cfg&&cfg.final&&cfg.final.name)||"Escopo Final"} subtitle={(cfg&&cfg.final&&cfg.final.description)||""} color={meta.color}>
      {loading?<Spinner label="Consolidando escopo final…" color={meta.color}/>
      :error?<div style={{background:T.eBg,border:"1px solid "+T.eB,borderRadius:T.r6,padding:12,color:T.eT,fontSize:13}}>{error}</div>
      :(
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.okBg,color:T.okT,fontWeight:600,padding:"4px 10px",borderRadius:T.rFull,fontSize:11,marginBottom:16,border:"1px solid "+T.okB}}>
            <CheckCircle size={12}/> Pipeline concluído
          </div>
          <ExCard icon="📄" title="Escopo Final da Feature"  content={sF||output} borderColor={T.okB}  bg={T.okBg}/>
          <ExCard icon="🚨" title="Pontos de Atenção"        content={sI}         borderColor="#D8B4FE" bg="#FAF5FF"/>
          <ExCard icon="❓" title="Perguntas para o Time Dev" content={sD}         borderColor={T.wB}   bg={T.wBg}/>
          <ExCard icon="☑️" title="Checklist de Definições"  content={sCk}        borderColor={T.iB}   bg={T.iBg}/>
          <div style={{marginTop:16,display:"flex",justifyContent:"center"}}><Btn variant="secondary" onClick={onReset}>🔄 Analisar Novo Escopo</Btn></div>
        </div>
      )}
    </Panel>
  );
}

// ── history panel ─────────────────────────────────────────────────────────────
function HistoryPanel({sessions,onResume,onDelete,onClose}){
  const [exp,setExp]=useState(null);
  const LBL={pm:{l:"Agente Broz",i:"🔍"},rag:{l:"Agente RAG",i:"🗂️"},n1:{l:"Agente N1",i:"🎧"},modules:{l:"Módulos",i:"🔐"},dev:{l:"Agente Dev",i:"⚙️"},final:{l:"Resultado",i:"✅"}};
  return (
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:340,background:T.n0,boxShadow:"-2px 0 16px rgba(14,16,34,.1)",zIndex:1000,display:"flex",flexDirection:"column",fontFamily:T.font}}>
      <div style={{padding:"13px 16px",borderBottom:"1px solid "+T.n100,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.n50}}>
        <div style={{fontWeight:700,fontSize:13,color:T.n800}}>Histórico de Interações</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.n400,display:"flex"}}><X size={16}/></button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:12}}>
        {sessions.length===0&&<div style={{textAlign:"center",color:T.n400,fontSize:13,marginTop:40}}><div style={{fontSize:32,marginBottom:8}}>🗂️</div>Nenhuma interação salva.</div>}
        {[...sessions].reverse().map(sess=>{
          const isOpen=exp===sess.id;
          return (
            <div key={sess.id} style={{background:T.n0,border:"1px solid "+T.n100,borderRadius:T.r8,marginBottom:8,overflow:"hidden",boxShadow:T.shadowSm}}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",background:isOpen?T.n50:T.n0}} onClick={()=>setExp(isOpen?null:sess.id)}>
                <div style={{width:32,height:32,borderRadius:T.r8,background:T.p50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>📋</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:12,color:T.p500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sess.featureName||"Feature sem nome"}</div>
                  <div style={{fontSize:10,color:T.n400,marginTop:2,display:"flex",alignItems:"center",gap:3}}><Clock size={9}/>{typeof sess.startedAt==="string"?sess.startedAt:new Date(sess.startedAt).toLocaleString("pt-BR")}</div>
                  <div style={{fontSize:10,color:T.n300,marginTop:1}}>{(sess.steps&&sess.steps.length)||0} etapa(s)</div>
                </div>
                {isOpen?<ChevronUp size={12} color={T.n400}/>:<ChevronDown size={12} color={T.n400}/>}
              </div>
              {isOpen&&(
                <div style={{borderTop:"1px solid "+T.n100,background:T.n50,padding:"10px 12px"}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.n500,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Retomar a partir de:</div>
                  {(sess.steps||[]).map((step,si)=>{
                    const lbl=LBL[step.agentKey]||{l:step.agentKey,i:"🤖"};
                    return (
                      <div key={si} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:T.r6,background:T.n0,border:"1px solid "+T.n100,marginBottom:5}}>
                        <span style={{fontSize:13}}>{lbl.i}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,color:T.n700}}>{lbl.l}</div>
                          <div style={{fontSize:10,color:T.n400}}>{step.startedAt}</div>
                        </div>
                        <Btn variant="secondary" size="sm" onClick={()=>{onResume(sess,step.agentKey);onClose();}}>↩️</Btn>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}><Btn variant="danger" size="sm" onClick={()=>onDelete(sess.id)}>Excluir</Btn></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── users modal ───────────────────────────────────────────────────────────────
function UsersModal({onClose,currentUser}){
  const [users,setUsers]=useState([]);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(null);
  useEffect(()=>{api.getUsers().then(u=>{setUsers(u);setLoading(false);}).catch(()=>setLoading(false));},[]);
  async function toggleRole(email,currentRole){
    const newRole=currentRole==="admin"?"common":"admin";
    setSaving(email);await api.setUserRole(email,newRole);
    setUsers(prev=>prev.map(u=>u.email===email?{...u,role:newRole}:u));setSaving(null);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(14,16,34,.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:T.font}}>
      <div style={{background:T.n0,borderRadius:T.r12,width:"100%",maxWidth:520,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:T.shadowXl,overflow:"hidden"}}>
        <div style={{background:T.n800,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:T.n0}}>Gerenciar Usuários</div>
            <div style={{fontSize:11,color:T.n400,marginTop:3}}>Visualize e altere o perfil de acesso</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.n400,cursor:"pointer",display:"flex",padding:4}}><X size={16}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {loading?<div style={{padding:32,display:"flex",justifyContent:"center"}}><Spinner label="Carregando usuários…"/></div>
          :users.length===0?<div style={{padding:32,textAlign:"center",color:T.n400,fontSize:13}}>Nenhum usuário cadastrado.</div>
          :(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:T.n50,borderBottom:"1px solid "+T.n100}}>
                <th style={{padding:"10px 20px",textAlign:"left",fontSize:11,fontWeight:700,color:T.n500,textTransform:"uppercase",letterSpacing:".5px"}}>E-mail</th>
                <th style={{padding:"10px 20px",textAlign:"left",fontSize:11,fontWeight:700,color:T.n500,textTransform:"uppercase",letterSpacing:".5px"}}>Perfil</th>
                <th style={{padding:"10px 20px",textAlign:"center",fontSize:11,fontWeight:700,color:T.n500,textTransform:"uppercase",letterSpacing:".5px"}}>Ação</th>
              </tr></thead>
              <tbody>{users.map((u,i)=>(
                <tr key={u.email} style={{borderBottom:"1px solid "+T.n50,background:i%2===0?T.n0:T.n50}}>
                  <td style={{padding:"12px 20px",fontSize:13,color:T.n700}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:u.role==="admin"?T.sidebarBg:T.p50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:u.role==="admin"?"#fff":T.p500,flexShrink:0}}>{u.role==="admin"?"👑":u.email[0].toUpperCase()}</div>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220}}>{u.email}</span>
                      {u.email===currentUser&&<span style={{fontSize:10,color:T.n400,flexShrink:0}}>(você)</span>}
                    </div>
                  </td>
                  <td style={{padding:"12px 20px"}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:T.rFull,fontSize:11,fontWeight:600,background:u.role==="admin"?"#EDE9FE":T.okBg,color:u.role==="admin"?"#6B21A8":T.okT,border:"1px solid "+(u.role==="admin"?"#DDD6FE":T.okB)}}>
                      {u.role==="admin"?"Administrador":"Comum"}
                    </span>
                  </td>
                  <td style={{padding:"12px 20px",textAlign:"center"}}>
                    {u.email===currentUser?<span style={{fontSize:11,color:T.n300}}>—</span>
                    :<button onClick={()=>toggleRole(u.email,u.role)} disabled={saving===u.email}
                        style={{fontSize:11,fontWeight:600,padding:"5px 12px",borderRadius:T.r6,border:"1px solid "+(u.role==="admin"?T.eB:T.p200),background:u.role==="admin"?T.eBg:T.p50,color:u.role==="admin"?T.eT:T.p500,cursor:saving===u.email?"not-allowed":"pointer",opacity:saving===u.email?.6:1}}>
                        {saving===u.email?"…":u.role==="admin"?"Tornar Comum":"Tornar Admin"}
                      </button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid "+T.n100,background:T.n50,display:"flex",justifyContent:"flex-end",flexShrink:0}}><Btn variant="secondary" onClick={onClose}>Fechar</Btn></div>
      </div>
    </div>
  );
}

// ── kb upload widget ──────────────────────────────────────────────────────────
function KBUpload({agentKey,agentColor,onToast,onToastOk}){
  const ref=useRef();const [drag,setDrag]=useState(false);const [list,setList]=useState([]);const [uploading,setUploading]=useState(false);const [progress,setProgress]=useState("");
  useEffect(()=>{
    api.getKB(agentKey).then(setList).catch(()=>{});
  },[agentKey]);

  async function hf(files){
    const allowed=[".pdf",".txt",".md",".doc",".docx",".csv"];
    for(const file of Array.from(files)){
      const ext="."+file.name.split(".").pop().toLowerCase();
      if(!allowed.includes(ext)){onToast("Formato não suportado: "+ext);continue;}
      setUploading(true);setProgress("Processando "+file.name+"…");
      try{
        if(agentKey==="rag"&&ext===".md"){
          const feats=await processMdFile(file,p=>{setProgress(p);});
          const content="BASE DE FEATURES ("+feats.length+"):\n"+feats.map((x,i)=>"["+(i+1)+"] "+x.name+"\nMódulo: "+x.ondeOcorre+"\n"+x.content).join("\n---");
          const blob=new Blob([content],{type:"text/plain"});
          const synthFile=new File([blob],file.name,{type:"text/plain"});
          const entry=await api.uploadKB(agentKey,synthFile,content,"text");
          setList(p=>[...p,entry]);
        }else{
          const entry=await api.uploadKB(agentKey,file);
          setList(p=>[...p,entry]);
        }
        onToastOk("Base carregada: "+file.name);
      }catch(e){onToast("Erro: "+e.message);}
      setUploading(false);setProgress("");
    }
  }

  async function rem(id){
    await api.deleteKB(agentKey,id);
    setList(p=>p.filter(x=>x.id!==id));
  }

  return (
    <div style={{marginTop:16,borderTop:"1px solid "+T.n100,paddingTop:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:T.n600,marginBottom:6}}>📚 Base de Conhecimento <span style={{fontSize:11,fontWeight:400,color:T.n400}}>· opcional</span></label>
      {list.length>0&&(
        <div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:5}}>
          {list.map(kb=>(
            <div key={kb.id} style={{background:T.okBg,border:"1px solid "+T.okB,borderRadius:T.r6,padding:"7px 10px",display:"flex",alignItems:"center",gap:8}}>
              <span>📄</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:T.okT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{kb.file_name}</div>
                <div style={{fontSize:10,color:T.n400}}>{new Date(kb.uploaded_at).toLocaleString("pt-BR")}</div>
              </div>
              <Btn variant="danger" size="sm" onClick={()=>rem(kb.id)}>✕</Btn>
            </div>
          ))}
        </div>
      )}
      <div onClick={()=>!uploading&&ref.current&&ref.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);hf(e.dataTransfer.files);}}
        style={{border:"2px dashed "+(drag?agentColor:T.n200),borderRadius:T.r6,padding:12,textAlign:"center",background:drag?T.n50:T.n0,cursor:uploading?"not-allowed":"pointer"}}>
        <input ref={ref} type="file" multiple accept=".pdf,.txt,.md,.doc,.docx,.csv" style={{display:"none"}} onChange={e=>e.target.files.length&&hf(e.target.files)}/>
        <div style={{fontSize:16,marginBottom:3}}>📂</div>
        <div style={{fontSize:11,color:T.n400,fontWeight:500}}>{list.length>0?"Adicionar mais":"Arraste ou clique para anexar"}</div>
      </div>
      {uploading&&progress&&(
        <div style={{marginTop:8,background:T.iBg,border:"1px solid "+T.iB,borderRadius:T.r6,padding:"7px 10px",fontSize:11,color:T.iT,display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:10,height:10,border:"1.5px solid "+T.iB,borderTopColor:T.iT,borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>{progress}
        </div>
      )}
    </div>
  );
}

// ── prompt settings ───────────────────────────────────────────────────────────
function PromptSettings({onClose,onToast,onToastOk}){
  const [active,setActive]=useState("pm");const [saved,setSaved]=useState(false);const [loaded,setLoaded]=useState(false);
  const nR=useRef(Object.fromEntries(AGENT_KEYS.map(k=>[k,null])));
  const dR=useRef(Object.fromEntries(AGENT_KEYS.map(k=>[k,null])));
  const iR=useRef(Object.fromEntries(AGENT_KEYS.map(k=>[k,null])));
  const [iv,setIv]=useState({
    n:Object.fromEntries(AGENT_KEYS.map(k=>[k,""])),
    d:Object.fromEntries(AGENT_KEYS.map(k=>[k,""])),
    i:Object.fromEntries(AGENT_KEYS.map(k=>[k,""]))
  });
  const [rk,setRk]=useState(0);
  const [il,setIl]=useState(Object.fromEntries(AGENT_KEYS.map(k=>[k,0])));

  useEffect(()=>{
    (async()=>{
      try{
        const p=await api.getAgents();
        if(p&&Object.keys(p).length){
          setIv({
            n:Object.fromEntries(AGENT_KEYS.map(k=>[k,(p[k]&&p[k].name)||""])),
            d:Object.fromEntries(AGENT_KEYS.map(k=>[k,(p[k]&&p[k].description)||""])),
            i:Object.fromEntries(AGENT_KEYS.map(k=>[k,(p[k]&&p[k].instructions)||""]))
          });
          setIl(Object.fromEntries(AGENT_KEYS.map(k=>[k,((p[k]&&p[k].instructions)||"").length])));
        }
      }catch{}
      setLoaded(true);
    })();
  },[]);

  async function save(){
    const t={};
    AGENT_KEYS.forEach(k=>{
      t[k]={
        name:(nR.current[k]&&nR.current[k].value)||iv.n[k],
        description:(dR.current[k]&&dR.current[k].value)||iv.d[k],
        instructions:(iR.current[k]&&iR.current[k].value)||iv.i[k]
      };
    });
    try{
      await api.saveAgents(t);
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch(e){onToast("Erro ao salvar: "+e.message);}
  }

  async function resetForm(){
    try{
      const p=await api.getAgents();
      setIv({
        n:Object.fromEntries(AGENT_KEYS.map(k=>[k,(p[k]&&p[k].name)||""])),
        d:Object.fromEntries(AGENT_KEYS.map(k=>[k,(p[k]&&p[k].description)||""])),
        i:Object.fromEntries(AGENT_KEYS.map(k=>[k,(p[k]&&p[k].instructions)||""]))
      });
      setIl(Object.fromEntries(AGENT_KEYS.map(k=>[k,((p[k]&&p[k].instructions)||"").length])));
    }catch{}
    setRk(x=>x+1);
  }

  if(!loaded) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(14,16,34,.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:T.font}}>
      <div style={{background:T.n0,borderRadius:T.r12,width:"100%",maxWidth:700,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:T.shadowXl,overflow:"hidden"}}>
        <div style={{background:T.n800,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:T.n0}}>Configuração dos Agentes</div>
            <div style={{fontSize:11,color:T.n400,marginTop:3}}>Nome, descrição, instruções e base de conhecimento</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.n400,cursor:"pointer",display:"flex",padding:4}}><X size={16}/></button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid "+T.n100,flexShrink:0,overflowX:"auto",background:T.n50}}>
          {AGENT_KEYS.map(k=>{
            const c=AGENT_META[k].color;const a=active===k;
            return (
              <button key={k} onClick={()=>setActive(k)}
                style={{padding:"10px 14px",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,whiteSpace:"nowrap",background:a?T.n0:T.n50,color:a?c:T.n400,borderBottom:a?"2px solid "+c:"2px solid transparent",display:"flex",alignItems:"center",gap:4,fontFamily:T.font}}>
                <span>{AGENT_META[k].icon}</span><span>{iv.n[k]}</span>
              </button>
            );
          })}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {AGENT_KEYS.map(k=>(
            <div key={k+"-"+rk} style={{display:active===k?"flex":"none",flexDirection:"column",gap:14,padding:20}}>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:T.n600,marginBottom:5}}>Nome</label>
                <input ref={el=>nR.current[k]=el} defaultValue={iv.n[k]} maxLength={60}
                  style={{width:"100%",border:"1px solid "+T.n200,borderRadius:T.r6,padding:"7px 10px",fontSize:13,fontWeight:600,outline:"none",fontFamily:T.font,boxSizing:"border-box",color:T.n800,height:34}}
                  onFocus={e=>{e.target.style.borderColor=AGENT_META[k].color;e.target.style.boxShadow="0 0 0 3px "+AGENT_META[k].color+"22";}}
                  onBlur={e=>{e.target.style.borderColor=T.n200;e.target.style.boxShadow="none";}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:T.n600,marginBottom:5}}>Descrição</label>
                <input ref={el=>dR.current[k]=el} defaultValue={iv.d[k]} maxLength={120}
                  style={{width:"100%",border:"1px solid "+T.n200,borderRadius:T.r6,padding:"7px 10px",fontSize:12,outline:"none",fontFamily:T.font,boxSizing:"border-box",color:T.n800,height:34}}
                  onFocus={e=>{e.target.style.borderColor=AGENT_META[k].color;e.target.style.boxShadow="0 0 0 3px "+AGENT_META[k].color+"22";}}
                  onBlur={e=>{e.target.style.borderColor=T.n200;e.target.style.boxShadow="none";}}/>
              </div>
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                  <label style={{fontSize:12,fontWeight:600,color:T.n600}}>Instruções</label>
                  <span style={{fontSize:10,color:(il[k]||0)>14000?T.eT:T.n400}}>{il[k]||0}/15.000</span>
                </div>
                <textarea ref={el=>iR.current[k]=el} defaultValue={iv.i[k]} rows={9}
                  onChange={e=>{if(e.target.value.length>15000) e.target.value=e.target.value.slice(0,15000);setIl(p=>({...p,[k]:e.target.value.length}));}}
                  style={{width:"100%",border:"1px solid "+T.n200,borderRadius:T.r6,padding:"8px 10px",fontSize:12,fontFamily:"'Fira Code','Consolas',monospace",resize:"vertical",outline:"none",lineHeight:1.6,boxSizing:"border-box",color:T.n700}}
                  onFocus={e=>{e.target.style.borderColor=AGENT_META[k].color;e.target.style.boxShadow="0 0 0 3px "+AGENT_META[k].color+"22";}}
                  onBlur={e=>{e.target.style.borderColor=T.n200;e.target.style.boxShadow="none";}}/>
              </div>
              <KBUpload agentKey={k} agentColor={AGENT_META[k].color} onToast={onToast} onToastOk={onToastOk}/>
            </div>
          ))}
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid "+T.n100,background:T.n50,display:"flex",gap:8,justifyContent:"space-between",flexShrink:0}}>
          <Btn variant="ghost" onClick={resetForm}>↩️ Resetar formulário</Btn>
          <Btn variant={saved?"secondary":"primary"} onClick={save}>{saved?"✓ Salvo!":"💾 Salvar"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── admin password modal ──────────────────────────────────────────────────────
function AdminPasswordModal({onSuccess,onClose}){
  const [pw,setPw]=useState("");const [err,setErr]=useState("");const [show,setShow]=useState(false);
  function check(){
    if(pw===ADMIN_PASSWORD){onSuccess();}
    else{setErr("Senha incorreta.");setPw("");}
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(14,16,34,.5)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:T.font}}>
      <div style={{background:T.n0,borderRadius:T.r12,width:"100%",maxWidth:360,boxShadow:T.shadowXl,overflow:"hidden"}}>
        <div style={{background:T.n800,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Lock size={14} color="rgba(255,255,255,.7)"/>
            <div style={{fontWeight:700,fontSize:13,color:T.n0}}>Acesso Restrito</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.n400,cursor:"pointer",display:"flex"}}><X size={16}/></button>
        </div>
        <div style={{padding:24,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:13,color:T.n500}}>Digite a senha de administrador para acessar as configurações dos agentes.</div>
          <PasswordField label="Senha" value={pw} onChange={setPw} show={show} onToggle={()=>setShow(v=>!v)} hasError={!!err}/>
          {err&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.eT}}><AlertCircle size={12}/>{err}</div>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" onClick={check} disabled={!pw.trim()}>Entrar</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── auth screen ───────────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const [mode,setMode]=useState("login");const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [conf,setConf]=useState("");
  const [load,setLoad]=useState(false);const [err,setErr]=useState("");const [showPw,setShowPw]=useState(false);const [showConf,setShowConf]=useState(false);
  const pwTooShort=mode==="register"&&pw.length>0&&pw.length<6;
  const pwMismatch=mode==="register"&&conf.length>0&&pw!==conf;
  const regDisabled=mode==="register"&&(pw.length<6||pw!==conf||!email.trim()||!conf.trim());
  async function submit(){
    setErr("");
    if(!email.trim()||!pw.trim()){setErr("Preencha todos os campos.");return;}
    if(mode==="register"&&pw!==conf){setErr("As senhas não coincidem.");return;}
    if(pw.length<6){setErr("Senha com mínimo 6 caracteres.");return;}
    setLoad(true);
    try{
      const data=mode==="register"?await api.register(email,pw):await api.login(email,pw);
      onAuth(data.email,data.role);
    }catch(e){setErr(e.message);}
    setLoad(false);
  }
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg, "+T.sidebarBg+" 0%, #2D1B69 100%)",fontFamily:T.font,padding:32}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <svg width="160" height="22" viewBox="0 0 370 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M207.26 41.5601C199.774 41.5601 194.368 35.9684 194.368 28.0981C194.368 20.2279 199.774 14.6361 207.26 14.6361C214.747 14.6361 220.153 20.2279 220.153 28.0981C220.153 35.9684 214.747 41.5601 207.26 41.5601ZM207.26 49.256C218.676 49.256 227.918 39.7814 227.918 28.0981C227.918 16.4148 218.665 6.94025 207.26 6.94025C195.856 6.94025 186.602 16.4148 186.602 28.0981C186.602 39.7814 195.856 49.256 207.26 49.256ZM332.661 40.7231C329.174 45.9428 323.466 49.256 316.584 49.256C305.098 49.256 296.844 40.0023 296.844 28.0981C296.844 16.1939 305.098 6.94025 316.584 6.94025C327.442 6.94025 336.323 16.1939 335.289 31.5508H327.116C328.476 20.007 323.361 14.3455 316.246 14.3455C309.132 14.3455 304.017 20.007 304.017 28.0981C304.017 36.1893 309.132 41.8507 316.246 41.8507C320.676 41.8507 324.326 39.6652 326.453 36.0614L332.685 40.7231H332.661ZM301.541 25.3429H332.452V31.5624H301.541V25.3429ZM162.922 41.5601C155.435 41.5601 150.029 35.9684 150.029 28.0981C150.029 20.2279 155.435 14.6361 162.922 14.6361C170.408 14.6361 175.814 20.2279 175.814 28.0981C175.814 35.9684 170.408 41.5601 162.922 41.5601ZM162.922 49.256C174.338 49.256 183.58 39.7814 183.58 28.0981C183.58 16.4148 174.326 6.94025 162.922 6.94025C151.517 6.94025 142.264 16.4148 142.264 28.0981C142.264 39.7814 151.517 49.256 162.922 49.256ZM336.695 40.1069L342.043 36.2706C343.833 39.9907 347.844 41.9786 353.284 41.9786C359.329 41.9786 362.003 39.8396 362.003 36.1544C362.003 28.505 337.079 36.1776 337.079 18.4143C337.079 11.4625 343.775 6.77749 352.75 6.77749C359.818 6.77749 366.956 10.4627 368.153 17.2751L361.352 19.1932C360.829 15.0081 357.028 13.3109 352.877 13.3109C347.437 13.3109 344.17 15.229 344.17 18.5655C344.17 28.5166 369.688 20.7742 369.688 35.9451C369.688 43.7573 363.689 48.8026 353.284 48.8026C345.588 48.8026 339.148 45.6289 336.695 40.1186V40.1069ZM231.708 48.0818V7.47501H239.66V15.2871C241.02 9.89305 245.693 6.76587 252.006 6.76587C258.818 6.76587 264.352 9.89305 266.049 15.7289C267.92 9.9628 273.303 6.69612 279.267 6.69612C289.485 6.69612 293.74 12.7993 293.74 25.0174V48.0818H285.788V25.6568C285.788 17.6936 283.091 13.5782 276.349 13.5782C269.606 13.5782 266.479 17.8331 266.479 25.5173V48.0818H258.527V25.7266C258.527 17.4843 256.121 13.648 249.518 13.648C242.915 13.648 239.648 18.2632 239.648 26.2962V48.0818H231.696H231.708ZM89.09 48.0818V0H101.413C118.234 0 125.547 7.103 125.547 18.1004C125.547 30.5394 118.234 37.3053 101.482 37.3053H96.9486V48.0702H89.09V48.0818ZM96.9486 29.7838H102.622C112.352 29.7838 117.63 26.3892 117.63 18.1004C117.63 10.3813 112.352 7.31225 102.622 7.31225H96.9486V29.7838Z" fill="white"/>
              <path d="M135.289 39.5373V0H127.825V40.6185C127.825 44.7338 131.162 48.0818 135.289 48.0818H141.369V40.6185H136.381C135.777 40.6185 135.3 40.1302 135.3 39.5373H135.289Z" fill="white"/>
              <path d="M62.7229 24.3256H32.228C26.4105 24.3256 20.8393 22.0033 16.7459 17.8747L0.208285 1.20807C-0.23741 0.762374 0.0792682 0 0.712625 0H33.5651C42.9833 0 51.8269 4.52733 57.3277 12.1745L64.1069 21.5928C64.928 22.7305 64.1069 24.3256 62.7112 24.3256H62.7229Z" fill="#7E33E6"/>
              <path d="M46.4317 30.2956H31.0786C25.4957 30.2956 20.1356 32.524 16.1948 36.4884L3.98504 48.7919C3.53935 49.2376 3.85602 50 4.48938 50H23.3963C29.4131 50 35.1368 47.4197 39.1129 42.9041L47.7218 33.1457C48.7071 32.0314 47.9095 30.2838 46.4317 30.2838V30.2956Z" fill="#7E33E6"/>
            </svg>
            <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.5)",letterSpacing:"1px",textTransform:"uppercase"}}>Pipeline ScopeOps</span>
          </div>
        </div>
        <div style={{background:T.n0,borderRadius:T.r12,border:"1px solid "+T.n100,padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:T.n800,marginBottom:4}}>{mode==="login"?"Bem-vindo de volta":"Criar conta"}</div>
            <div style={{fontSize:13,color:T.n400}}>Pipeline de elaboração de escopo de produto</div>
          </div>
          <div style={{display:"flex",background:T.n100,borderRadius:T.r6,padding:3,marginBottom:20}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setErr("");setPw("");setConf("");}}
                style={{flex:1,padding:"7px 0",borderRadius:T.r4,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:mode===m?T.n0:T.n100,color:mode===m?T.n800:T.n400,boxShadow:mode===m?T.shadowSm:"none",transition:"all .15s",fontFamily:T.font}}>
                {m==="login"?"Entrar":"Criar conta"}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Field label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" type="email"/>
            <div>
              <PasswordField label="Senha" value={pw} onChange={setPw} show={showPw} onToggle={()=>setShowPw(v=>!v)} hasError={pwTooShort}/>
              {pwTooShort&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:5,fontSize:11,color:T.eT}}><AlertCircle size={11}/> A senha deve ter pelo menos 6 caracteres</div>}
            </div>
            {mode==="register"&&(
              <div>
                <PasswordField label="Confirmar senha" value={conf} onChange={setConf} show={showConf} onToggle={()=>setShowConf(v=>!v)} hasError={pwMismatch}/>
                {pwMismatch&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:5,fontSize:11,color:T.eT}}><AlertCircle size={11}/> As senhas não coincidem</div>}
              </div>
            )}
          </div>
          {err&&<div style={{background:T.eBg,border:"1px solid "+T.eB,borderRadius:T.r6,padding:"8px 10px",color:T.eT,fontSize:12,marginTop:12,display:"flex",alignItems:"center",gap:6}}><AlertCircle size={12}/>{err}</div>}
          <button onClick={submit} disabled={load||(mode==="register"&&regDisabled)}
            style={{width:"100%",marginTop:16,background:load||(mode==="register"&&regDisabled)?"#C4B5E8":"#6B21A8",color:"#fff",fontWeight:600,padding:"10px 0",borderRadius:T.r6,fontSize:13,border:"none",cursor:load||(mode==="register"&&regDisabled)?"not-allowed":"pointer",fontFamily:T.font,transition:"background .15s"}}>
            {load?"Aguarde...":mode==="login"?"Entrar →":"Criar conta →"}
          </button>
          <div style={{marginTop:14,textAlign:"center",fontSize:11,color:T.n400}}>
            Sua conta é gerenciada pelo servidor. O histórico de sessões fica vinculado à sua conta.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function App(){
  const storedUser = api.getStoredUser();
  const [user,setUser]=useState(storedUser ? storedUser.email : null);
  const [userRole,setUserRole_]=useState(storedUser ? storedUser.role : "common");
  const [ready,setReady]=useState(!!storedUser);
  const [phase,setPhase]=useState("input");
  const [toast,setToast]=useState(null);const [toastType,setToastType]=useState("error");
  const [showHist,setShowHist]=useState(false);
  const [showPrompts,setShowPrompts]=useState(false);
  const [showAdminPw,setShowAdminPw]=useState(false);
  const [showMenu,setShowMenu]=useState(false);const [showUsers,setShowUsers]=useState(false);
  const [sessions,setSessions]=useState([]);
  const isAdmin=userRole==="admin";
  const [agentCfg,setAgentCfg]=useState(()=>{const o={};for(const k of AGENT_KEYS) o[k]={...DEFAULT_AGENTS[k],...AGENT_META[k]};return o;});
  const menuRef=useRef();
  const [featureName,setFeatureName]=useState("");const [statement,setStatement]=useState("");const [notes,setNotes]=useState("");const [prereqs,setPrereqs]=useState("");
  const [docFiles,setDocFiles]=useState([]);const [fileParts,setFileParts]=useState([]);
  const [currentSessionId,setCurrentSessionId]=useState(null);const [agentMessages,setAgentMessages]=useState({});const [contextChain,setContextChain]=useState([]);
  const scopeText=()=>"## Nome da Feature\n"+featureName+"\n\n## Problem Statement\n"+statement+"\n\n## Pré-requisitos\n"+(prereqs||"Nenhum")+"\n\n## Escopo Preliminar\n"+notes;
  const prevContext=contextChain.join("\n\n");
  function showT(msg,type){setToast(msg);setToastType(type||"error");}

  useEffect(()=>{
    (async()=>{
      if(user){
        try{
          const cfg=await getAgents();
          setAgentCfg(cfg);
          const s=await api.getSessions();
          setSessions(s);
        }catch{}
      }
      setReady(true);
    })();
    const close=e=>{if(menuRef.current&&!menuRef.current.contains(e.target)) setShowMenu(false);};
    document.addEventListener("mousedown",close);
    return ()=>document.removeEventListener("mousedown",close);
  },[]);

  function handleAuth(email,role){
    setUser(email);setUserRole_(role);
    api.getSessions().then(setSessions).catch(()=>{});
    getAgents().then(setAgentCfg).catch(()=>{});
    setReady(true);
  }
  function handleLogout(){api.logout();setUser(null);setSessions([]);reset();setUserRole_("common");}
  async function handlePromptsClose(){setShowPrompts(false);setAgentCfg(await getAgents());}

  async function saveStep(agentKey,msgs){
    const now=new Date().toLocaleString("pt-BR");
    setSessions(prev=>{
      const u=prev.map(s=>{
        if(s.id!==currentSessionId) return s;
        const steps=(s.steps||[]).filter(st=>st.agentKey!==agentKey);
        return {...s,steps:[...steps,{agentKey,startedAt:now,messages:msgs}]};
      });
      const sess=u.find(s=>s.id===currentSessionId);
      if(sess) api.updateSession(sess.id,sess.steps).catch(()=>{});
      return u;
    });
  }

  async function startPipeline(){
    if(!featureName.trim()){showT("O Nome da Feature é obrigatório.");return;}
    if(!statement.trim()){showT("O Problem Statement é obrigatório.");return;}
    if(!prereqs.trim()){showT("Os Pré-requisitos são obrigatórios.");return;}
    const fp=docFiles.length>0?await processFiles(docFiles):[];setFileParts(fp);
    try{
      const sess=await api.createSession(featureName,[]);
      setCurrentSessionId(sess.id);
      setSessions(prev=>[...prev,sess]);
    }catch(e){showT("Erro ao criar sessão: "+e.message);return;}
    setAgentMessages({});setContextChain([]);setPhase("pm");
  }

  function handleAgentAdvance(k,summary,msgs){
    setAgentMessages(p=>({...p,[k]:msgs}));
    saveStep(k,msgs);
    setContextChain(p=>[...p,"=== "+((agentCfg[k]&&agentCfg[k].name)||k)+" ===\n"+summary]);
    const idx=PIPELINE.indexOf(k);const next=PIPELINE[idx+1];if(next) setPhase(next);
  }

  function handleResume(session,agentKey){
    setCurrentSessionId(session.id);
    const msgs={};const chain=[];
    for(const step of (session.steps||[])){
      msgs[step.agentKey]=step.messages;
      const sum=step.messages.map(m=>m.role==="user"?"Usuário: "+m.text:"Agente: "+m.text).join("\n\n");
      chain.push("=== "+((agentCfg[step.agentKey]&&agentCfg[step.agentKey].name)||step.agentKey)+" ===\n"+sum);
      if(step.agentKey===agentKey) break;
    }
    setAgentMessages(msgs);setContextChain(chain.slice(0,PIPELINE.indexOf(agentKey)));setPhase(agentKey);
  }

  async function handleDeleteSession(id){
    try{await api.deleteSession(id);}catch{}
    setSessions(prev=>prev.filter(s=>s.id!==id));
  }

  function reset(){setPhase("input");setFeatureName("");setStatement("");setNotes("");setPrereqs("");setDocFiles([]);setFileParts([]);setAgentMessages({});setContextChain([]);setCurrentSessionId(null);}

  if(!ready) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.n50,fontFamily:T.font}}>
      <Spinner label="Carregando…"/>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
  if(!user) return (
    <div>
      <AuthScreen onAuth={handleAuth}/>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;}"}</style>
    </div>
  );

  return (
    <UserCtx.Provider value={user}>
      <div style={{display:"flex",flexDirection:"column",height:"100vh",fontFamily:T.font,background:T.n50,overflow:"hidden"}}>
        <style>{"@keyframes spin{to{transform:rotate(360deg)}} @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}} *{box-sizing:border-box;} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:"+T.n200+";border-radius:2px}"}</style>

        {toast&&<Toaster type={toastType} msg={toast} onDone={()=>setToast(null)}/>}
        {showHist&&<HistoryPanel sessions={sessions} onResume={handleResume} onDelete={handleDeleteSession} onClose={()=>setShowHist(false)}/>}
        {showAdminPw&&<AdminPasswordModal onSuccess={()=>{setShowAdminPw(false);setShowPrompts(true);}} onClose={()=>setShowAdminPw(false)}/>}

        {showPrompts&&<PromptSettings onClose={handlePromptsClose} onToast={m=>showT(m,"error")} onToastOk={m=>showT(m,"success")}/>}
        {showUsers&&<UsersModal onClose={()=>setShowUsers(false)} currentUser={user}/>}

        <header style={{height:52,background:T.sidebarBg,borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",padding:"0 20px",gap:16,flexShrink:0,boxShadow:"0 2px 12px rgba(0,0,0,.2)"}}>
          <PloomesLogo/>
          <div style={{flex:1}}/>
          <button onClick={()=>setShowHist(true)}
            style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:T.r6,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",fontSize:11,fontWeight:500,color:"rgba(255,255,255,.8)",cursor:"pointer",fontFamily:T.font}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>
            <History size={12}/> Histórico
            {sessions.length>0&&<span style={{background:T.p400,color:"#fff",borderRadius:T.rFull,padding:"1px 5px",fontSize:9,fontWeight:700}}>{sessions.length}</span>}
          </button>
          {isAdmin&&(
            <button onClick={()=>setShowPrompts(true)}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:T.r6,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",fontSize:11,fontWeight:500,color:"rgba(255,255,255,.8)",cursor:"pointer",fontFamily:T.font}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>
              <Settings size={12}/> Agentes
            </button>
          )}
          <div ref={menuRef} style={{position:"relative"}}>
            <button onClick={()=>setShowMenu(v=>!v)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"4px 8px",borderRadius:T.r6,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}>
              <div style={{width:24,height:24,borderRadius:"50%",background:T.p400,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700}}>{user[0].toUpperCase()}</div>
              <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,.85)",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user}</span>
              <ChevronDown size={11} color="rgba(255,255,255,.4)"/>
            </button>
            {showMenu&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:T.n0,borderRadius:T.r8,boxShadow:T.shadowXl,border:"1px solid "+T.n100,minWidth:190,zIndex:500,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid "+T.n100,background:T.n50}}>
                  <div style={{fontSize:10,color:T.n400}}>Conta</div>
                  <div style={{fontSize:12,fontWeight:600,color:T.n800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user}</div>
                </div>
                {isAdmin&&(
                  <button onClick={()=>{setShowMenu(false);setShowUsers(true);}}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:500,color:T.n700,fontFamily:T.font,borderBottom:"1px solid "+T.n100}}
                    onMouseOver={e=>e.currentTarget.style.background=T.n50} onMouseOut={e=>e.currentTarget.style.background="none"}>
                    👥 Usuários
                  </button>
                )}
                <button onClick={()=>{setShowMenu(false);handleLogout();}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:500,color:T.eT,fontFamily:T.font}}
                  onMouseOver={e=>e.currentTarget.style.background=T.n50} onMouseOut={e=>e.currentTarget.style.background="none"}>
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <div style={{flex:1,minHeight:0,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:T.n0,border:"1px solid "+T.n100,borderRadius:T.r12,padding:"14px 20px",boxShadow:T.shadowSm}}>
            <div style={{fontSize:11,fontWeight:600,color:T.n500,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><span>🧠</span> Pipeline ScopeOps</div>
            <StepBar phase={phase} agentCfg={agentCfg}/>
          </div>

          {phase==="input"&&(
            <Panel icon="📝" title="Defina o Escopo" subtitle="Preencha as informações iniciais da feature" color={T.p500}>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <Field label="Nome da Feature" value={featureName} onChange={setFeatureName} placeholder="Ex: Importação de Contatos via CSV" required/>
                <Field label="Problem Statement" value={statement} onChange={setStatement} placeholder="Qual problema estamos resolvendo? Para quem? Qual o impacto esperado?" required rows={4}/>
                <Field label="Pré-requisitos" value={prereqs} onChange={setPrereqs} placeholder="Features ou configurações necessárias antes…" required rows={3}/>
                <Field label="Escopo Preliminar" value={notes} onChange={setNotes} placeholder="Ideia inicial de funcionamento da feature: como o usuário interage, fluxo básico de uso…" rows={3}/>
                <FileDropZone files={docFiles} onFiles={setDocFiles}/>
                <div style={{display:"flex",justifyContent:"flex-end",paddingTop:4,borderTop:"1px solid "+T.n100}}>
                  <Btn variant="primary" size="lg" onClick={startPipeline}>Iniciar Pipeline →</Btn>
                </div>
              </div>
            </Panel>
          )}

          {PIPELINE.filter(k=>k!=="final").map(k=>phase===k&&(
            <AgentChatPhase key={k} agentKey={k} cfg={agentCfg[k]} scopeText={scopeText()} fileParts={fileParts} prevContext={prevContext} savedMessages={agentMessages[k]||null}
              onAdvance={(sum,msgs)=>handleAgentAdvance(k,sum,msgs)}
              onBack={()=>{const idx=PIPELINE.indexOf(k);setPhase(idx===0?"input":PIPELINE[idx-1]);}}/>
          ))}

          {phase==="final"&&<FinalPhase cfg={agentCfg} scopeText={scopeText()} fileParts={fileParts} prevContext={prevContext} onReset={reset}/>}
        </div>
      </div>
    </UserCtx.Provider>
  );
}
