import { useState, useRef, useEffect } from "react";

// Chave Gemini: lida do localStorage (configurável por usuário)
function getGeminiKey(){try{return localStorage.getItem("mf_gemini_key")||"";}catch{return "";}}
function setGeminiKey(k){try{localStorage.setItem("mf_gemini_key",k);}catch{}}

// ── UTILS ──────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));
const fmt   = v  => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtPct= v  => (v>=0?"+":"")+v.toFixed(1)+"%";
// Normaliza "DD/MM" ou "DD/MM/YYYY" → "YYYYMMDD" para sort correto
function dateKey(d){
  if(!d) return "00000000";
  const p=d.split("/");
  if(p.length>=3) return p[2].padStart(4,"0")+p[1].padStart(2,"0")+p[0].padStart(2,"0");
  const y=String(new Date().getFullYear());
  return y+( p[1]?.padStart(2,"0")||"00")+(p[0]?.padStart(2,"0")||"00");
}
// Converte "YYYY-MM-DD" → "DD/MM/YYYY" de forma segura (sem depender de locale do Android)
function fmtDate(iso){if(!iso)return "";const[y,m,d]=(iso+"").split("-");return `${(d||"??").padStart(2,"0")}/${(m||"??").padStart(2,"0")}/${y||"????"}`;}
const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_CURTO = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

async function askGemini(sys, msg, maxTokens=1000, retries=3) {
  for (let i=0; i<retries; i++) {
    if (i>0) await delay(2000*i);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiKey()}`,
      { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ contents:[{parts:[{text:sys+"\n\n"+msg}]}], generationConfig:{temperature:0.3,maxOutputTokens:maxTokens} }) }
    );
    if (r.status===429) { if (i<retries-1) continue; throw new Error("Limite atingido. Aguarde e tente novamente."); }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}

// ── CATEGORIZAÇÃO ──────────────────────────────────────────
function categorizar(desc, kind) {
  if (kind==="inc") return null;
  const d = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  // Ignorar pagamento de fatura do cartão (não é gasto novo)
  if (/pagamento de fatura/.test(d)) return "_ignorar";
  // Pet
  if (/pet.?camp|veterinar|petshop|petz|cobasi|racao|pet.?shop|banho.?tosa|castracao/.test(d)) return "pet";
  // Alimentação
  if (/ifood|rappi|uber.?eat|james|99.?food|melfood|restaur|lanche|pizza|burguer|mcdon|subway|sushi|padaria|superm|carrefour|atacadao|enxuto|higa|extra|pao.?de.?acucar|hortifrut|acougue|peixar|bebida|sorvete|supermercado|jim\.com|kamikase|espaco.?nobre|d.?burger|cacau/.test(d)) return "alimentacao";
  // Transporte
  if (/uber|99pop|cabify|taxi|gasolina|combustiv|posto|shell|ipiranga|chiminazzo|diamante.?auto|pauliceia|estacion|onibus|metro|trem|passagem|pedagio|autopeca|oficina|mecanica|detran|ipva|seguro.?auto|ancar.?park/.test(d)) return "transporte";
  // Saúde
  if (/farmac|drogari|remedio|medico|medica|hospital|clinica|consulta|exame|laborat|dentist|odontos|plano.?saude|unimed|amil|notredame|hapvida|academia|gym|crossfit/.test(d)) return "saude";
  // Lazer — inclui assinaturas internacionais
  if (/netflix|spotify|amazon|disney|hbo|youtube|prime|deezer|apple.?music|cinema|teatro|show|ingresso|jogo|steam|playstation|xbox|nintendo|balada|clube|viagem|hotel|airbnb|booking|ebanx|pagbrasil|ea9/.test(d)) return "lazer";
  // Moradia
  if (/aluguel|condom|energia|enel|cpfl|sabesp|internet|vivo|claro|tim|sky |telefon|gas |seguro.?resid|iptu|manutencao|hm.?72|empreendimento.?imob|london.?point/.test(d)) return "moradia";
  // Educação
  if (/escola|faculdade|univers|curso|mensalid|material|livro|papelaria|udemy|alura|coursera|duolingo/.test(d)) return "educacao";
  // Vestuário
  if (/renner|riachuelo|c&a|cea |hm |zara|marisa|shein|shopee|calcado|sapato|tenis |roupa/.test(d)) return "vestuario";
  // Investimento — aplicações e RDB
  if (/aplicac|aplicacao|rdb|poupanca|tesouro|fundo|cdb|lci|lca|previd|previdenc/.test(d)) return "investimento";
  // PIX / TED genéricos sem destino identificado → ignorar (provavelmente transferência)
  if (/^pix\s|^ted\s|^doc\s|transferencia|pagamento\s+pix|pix\s+enviado/.test(d)) return "_ignorar";
  // Assinaturas e serviços digitais comuns
  if (/google|microsoft|apple|icloud|dropbox|canva|chatgpt|openai|adobe|figma|notion/.test(d)) return "lazer";
  // Delivery / alimentação extra
  if (/lanchonete|sorveteria|confeitaria|hamburger|temakeria|yakisoba|churrascaria/.test(d)) return "alimentacao";
  return "outros";
}

// ── CONSTANTES ─────────────────────────────────────────────
// incType: "salario" | "extra" | "transferencia" | "investimento_ret" | "outro"
// Apenas salario + extra contam como RENDA real
const INC_TIPOS = [
  { id:"salario",        label:"Salário/Pró-labore",     emoji:"💼" },
  { id:"extra",          label:"Renda extra",             emoji:"💵" },
  { id:"transferencia",  label:"Transferência recebida",  emoji:"🔄" },
  { id:"transf_interna", label:"Transferência entre contas", emoji:"↔️" },
  { id:"investimento_ret",label:"Retorno de investimento", emoji:"📈" },
  { id:"outro",          label:"Outro",                   emoji:"💰" },
];

const CATS_DEF = [
  { id:"moradia",      label:"Moradia",      emoji:"🏠", budget:1500, color:"#60a5fa" },
  { id:"alimentacao",  label:"Alimentação",  emoji:"🛒", budget:800,  color:"#4ade80" },
  { id:"transporte",   label:"Transporte",   emoji:"🚗", budget:400,  color:"#f59e0b" },
  { id:"saude",        label:"Saúde",        emoji:"💊", budget:300,  color:"#f472b6" },
  { id:"lazer",        label:"Lazer",        emoji:"🎬", budget:200,  color:"#fb923c" },
  { id:"educacao",     label:"Educação",     emoji:"📚", budget:300,  color:"#a78bfa" },
  { id:"vestuario",    label:"Vestuário",    emoji:"👕", budget:200,  color:"#38bdf8" },
  { id:"pet",          label:"Pet",           emoji:"🐶", budget:300,  color:"#f97316" },
  { id:"investimento", label:"Investimento", emoji:"📈", budget:0,    color:"#34d399" },
  { id:"outros",       label:"Outros",       emoji:"📦", budget:200,  color:"#94a3b8" },
];

// Despesas fixas padrão
const FIXAS_DEF = [
  { id:"fx1", desc:"Aluguel",    valor:0, cat:"moradia",   emoji:"🏠", ativo:true },
  { id:"fx2", desc:"Internet",   valor:0, cat:"moradia",   emoji:"📶", ativo:true },
  { id:"fx3", desc:"Plano de saúde", valor:0, cat:"saude", emoji:"💊", ativo:true },
];
const MKTS_DEF = [
  {id:"carrefour",label:"Carrefour",emoji:"🔵"},
  {id:"paodeacucar",label:"Pão de Açúcar",emoji:"🍞"},
  {id:"atacadao",label:"Atacadão",emoji:"🏭"},
];
const GROCERY = ["Frango (kg)","Carne moída (kg)","Leite integral (L)","Arroz 5kg","Feijão 1kg","Óleo de soja","Macarrão 500g","Pão de forma","Ovos (dz)","Manteiga 200g","Sabão em pó","Detergente 500ml"];
const PRESETS = ["#60a5fa","#4ade80","#f59e0b","#f472b6","#a78bfa","#fb923c","#34d399","#94a3b8","#f87171","#38bdf8"];

// ── CONTAS ─────────────────────────────────────────────────
const CONTAS_DEF = [
  { id:"geral", label:"Geral", emoji:"🏦", color:"#94a3b8" },
];

// ── ESTILOS ────────────────────────────────────────────────
function inp(extra) { return {width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#e2e8f0",padding:"11px 13px",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",...extra}; }
function btn(bg,c="#fff",extra) { return {background:bg,border:"none",color:c,borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit",...extra}; }
const CARD = {background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px 16px",marginBottom:12,border:"1px solid rgba(255,255,255,0.07)"};
const ROW  = {display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"11px 14px",marginBottom:8,border:"1px solid rgba(255,255,255,0.06)"};

function Bar({pct,color="#4ade80"}) {
  return <div style={{background:"rgba(255,255,255,0.08)",borderRadius:99,height:6,overflow:"hidden",margin:"6px 0 3px"}}>
    <div style={{width:`${Math.min(100,Math.max(0,pct))}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.4s ease"}}/>
  </div>;
}
function SecTitle({t,sub}) {
  return <div style={{margin:"18px 0 10px"}}>
    <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t}</div>
    {sub&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>{sub}</div>}
  </div>;
}
function AlertBox({tipo,texto}) {
  const cfg={
    info:{bg:"rgba(99,102,241,0.1)",border:"rgba(99,102,241,0.3)",color:"#818cf8"},
    warn:{bg:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.3)",color:"#f59e0b"},
    err :{bg:"rgba(248,113,113,0.1)",border:"rgba(248,113,113,0.3)",color:"#f87171"},
    ok  :{bg:"rgba(74,222,128,0.1)",border:"rgba(74,222,128,0.3)",color:"#4ade80"},
  };
  const s=cfg[tipo]||cfg.info;
  return <div style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,padding:"10px 14px",color:s.color,fontSize:13,marginBottom:12,lineHeight:1.5}}>{texto}</div>;
}

// ── MODAL DE CONFIRMAÇÃO (substitui window.confirm) ────────
function ConfirmModal({msg,sub,onOk,onCancel,okLabel="Confirmar",okColor="#ef4444",cancelLabel="Cancelar"}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
    onClick={onCancel}>
    <div style={{background:"#0f172a",borderRadius:18,padding:"24px 20px",maxWidth:340,width:"100%",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:16,fontWeight:700,color:"#e2e8f0",marginBottom:sub?8:20,textAlign:"center"}}>{msg}</div>
      {sub&&<div style={{fontSize:13,color:"#64748b",marginBottom:20,textAlign:"center",lineHeight:1.6}}>{sub}</div>}
      <div style={{display:"flex",gap:10}}>
        <button style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onCancel}>{cancelLabel}</button>
        <button style={{flex:1,background:okColor,border:"none",color:"#fff",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onOk}>{okLabel}</button>
      </div>
    </div>
  </div>;
}

// ── DASHBOARD ──────────────────────────────────────────────
function Dashboard({ exps, cats, contas, hide, onCatClick, mesFiltro, allExps, fixas, setFixas, mesAtual, reservas, meta, showToast, onAddFixa }) {
  const gastos  = exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const invests = exps.filter(e=>e.cat==="investimento");
  const totalExp= gastos.reduce((s,e)=>s+e.value,0);
  const totalInv= invests.reduce((s,e)=>s+e.value,0);

  // Renda REAL = só salário + renda extra (exclui transferências e retornos)
  const entRenda= exps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType));
  // Transferências e retornos de invest ficam separados
  const entTransf=exps.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret")&&e.incType!=="transf_interna");
  const totalInc= entRenda.reduce((s,e)=>s+e.value,0);
  const totalTransf=entTransf.reduce((s,e)=>s+e.value,0);
  const txPoup  = totalInc>0?((totalInc-totalExp)/totalInc)*100:0;

  // Total de fixas ativas com valor configurado
  const totalFixas = (fixas||[]).filter(f=>f.ativo&&f.valor>0).reduce((s,f)=>s+f.valor,0);

  // Comparativo mês anterior — com ano correto
  let mesAnterior=null, diffPct=null;
  if (mesFiltro!=="todos") {
    const [anoAtualStr,mesAtualStr]=mesFiltro.split("-");
    const anoAtual=+anoAtualStr, mesAtualN=+mesAtualStr;
    const anoAnt=mesAtualN===1?anoAtual-1:anoAtual;
    const mesAnt=mesAtualN===1?12:mesAtualN-1;
    const mesAntPad=String(mesAnt).padStart(2,"0");
    const anoAntPad=String(anoAnt);
    const expsAnt=allExps.filter(e=>{
      const p=e.date?.split("/");if(!p||p.length<2)return false;
      const eAno=p.length>=3?p[2]:String(new Date().getFullYear());
      return p[1]===mesAntPad&&eAno===anoAntPad&&e.kind==="exp"&&e.cat!=="investimento";
    });
    const totAnt=expsAnt.reduce((s,e)=>s+e.value,0);
    if(totAnt>0){mesAnterior=MESES_CURTO[mesAnt];diffPct=((totalExp-totAnt)/totAnt)*100;}
  }

  // Projeção: só faz sentido no mês atual, não em meses passados
  let projecao=null;
  if(mesFiltro!=="todos"&&mesFiltro===mesAtual&&gastos.length>0){
    const hoje=new Date().getDate();
    const [,mesN]=mesFiltro.split("-");const diasMes=new Date(+mesFiltro.split("-")[0],+mesN,0).getDate();
    if(hoje>=3&&hoje<diasMes&&totalExp>0) projecao=(totalExp/hoje)*diasMes;
  }

  const top3=[...gastos].sort((a,b)=>b.value-a.value).slice(0,3);

  // Recorrentes
  const recorrentes=(()=>{
    const freq={};
    allExps.filter(e=>e.kind==="exp").forEach(e=>{
      const key=(e.desc||"").slice(0,20).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
      if(!freq[key]) freq[key]={count:0,value:e.value,desc:e.desc,emoji:e.emoji||"📦"};
      freq[key].count++;
    });
    return Object.values(freq).filter(f=>f.count>=2).sort((a,b)=>b.count-a.count||b.value-a.value).slice(0,5);
  })();

  return (
    <div style={{padding:16,paddingBottom:100}}>
      {/* Aviso: nenhuma conta real cadastrada */}
      {(contas||[]).filter(c=>c.id!=="geral").length===0&&(
        <AlertBox tipo="warn" texto="🏦 Nenhuma conta cadastrada ainda. Vá em ⚙️ Config → Contas para adicionar seu banco."/>
      )}
      {/* Alerta fixas pendentes */}
      {mesFiltro!=="todos"&&fixas&&(()=>{
        const pendentes=fixas.filter(f=>{
          if(!f.ativo||!f.valor) return false;
          const descMatch=new RegExp(f.desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(" ")[0],"i");
          return !exps.some(e=>e.kind==="exp"&&descMatch.test((e.desc||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")));
        });
        if(pendentes.length===0) return null;
        return <AlertBox tipo="warn" texto={`⏰ ${pendentes.length} despesa${pendentes.length>1?"s":""} fixa${pendentes.length>1?"s":""} pendente${pendentes.length>1?"s":""} este mês: ${pendentes.map(f=>f.desc).join(", ")}`}/>;
      })()}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          ["Salário/Renda",fmt(totalInc),"#4ade80"],
          ["Gastos",fmt(totalExp),"#f87171"],
          ["Saldo",fmt(totalInc-totalExp),(totalInc-totalExp)>=0?"#60a5fa":"#f87171"],
          ["Poupança",txPoup.toFixed(0)+"%",txPoup>=20?"#4ade80":txPoup>=10?"#f59e0b":"#f87171"],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 10px",border:`1px solid ${c}33`,textAlign:"center"}}>
            <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",marginBottom:3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:800,color:c}}>{hide?"••••":v}</div>
          </div>
        ))}
      </div>

      {/* Métricas extras */}
      {!hide&&(totalInv>0||totalTransf>0||diffPct!==null||projecao!==null)&&(
        <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
          {totalInv>0&&<div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase"}}>Investido</div>
            <div style={{fontSize:13,fontWeight:700,color:"#34d399"}}>{fmt(totalInv)}</div>
          </div>}
          {totalTransf>0&&<div style={{background:"rgba(148,163,184,0.08)",border:"1px solid rgba(148,163,184,0.2)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase"}}>Transferências</div>
            <div style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>{fmt(totalTransf)}</div>
          </div>}
          {diffPct!==null&&<div style={{background:diffPct>0?"rgba(248,113,113,0.08)":"rgba(74,222,128,0.08)",border:`1px solid ${diffPct>0?"rgba(248,113,113,0.2)":"rgba(74,222,128,0.2)"}`,borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase"}}>Vs {mesAnterior}</div>
            <div style={{fontSize:13,fontWeight:700,color:diffPct>0?"#f87171":"#4ade80"}}>{fmtPct(diffPct)}</div>
          </div>}
          {projecao!==null&&<div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase"}}>Projeção</div>
            <div style={{fontSize:13,fontWeight:700,color:"#818cf8"}}>{fmt(projecao)}</div>
          </div>}
        </div>
      )}

      {/* Por conta */}
      {(()=>{
        const contasDef=contas||CONTAS_DEF;
        const contasComDados=contasDef.filter(c=>c.id!=="geral"&&exps.some(e=>e.conta===c.id));
        if(contasComDados.length===0) return null;
        return <>
          <div style={{margin:"14px 0 8px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>Por conta</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {contasDef.filter(c=>c.id!=="geral").map(c=>{
              const cExps=exps.filter(e=>e.conta===c.id||(!e.conta&&c.id==="geral"));
              const cInc=cExps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
              const cExp=cExps.filter(e=>e.kind==="exp"&&e.cat!=="investimento").reduce((s,e)=>s+e.value,0);
              const cTransfEnv=cExps.filter(e=>e.kind==="exp"&&e.incType==="transf_interna").reduce((s,e)=>s+e.value,0);
              const cTransfRec=cExps.filter(e=>e.kind==="inc"&&e.incType==="transf_interna").reduce((s,e)=>s+e.value,0);
              const saldo=cInc-cExp;
              if(cInc===0&&cExp===0) return null;
              return <div key={c.id} style={{flex:1,background:`${c.color}0f`,border:`1px solid ${c.color}33`,borderRadius:12,padding:"10px 10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:14}}>{c.emoji}</span>
                  <span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.label}</span>
                </div>
                {cInc>0&&<div style={{fontSize:10,color:"#64748b"}}>💼 <span style={{color:"#4ade80"}}>{hide?"••••":fmt(cInc)}</span></div>}
                {cExp>0&&<div style={{fontSize:10,color:"#64748b"}}>💸 <span style={{color:"#f87171"}}>{hide?"••••":fmt(cExp)}</span></div>}
                {cTransfRec>0&&<div style={{fontSize:10,color:"#64748b"}}>↔️ <span style={{color:"#94a3b8"}}>{hide?"••••":fmt(cTransfRec)}</span></div>}
                <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${c.color}22`,fontSize:11,fontWeight:800,color:saldo>=0?"#4ade80":"#f87171"}}>{hide?"••••":fmt(saldo)}</div>
              </div>;
            })}
          </div>
        </>;
      })()}

      {/* Reservas resumo */}
      {reservas&&reservas.length>0&&(()=>{
        const totalRes=reservas.reduce((s,r)=>s+r.saldo,0);
        return <>
          <div style={{margin:"14px 0 8px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>Reservas / Caixinhas</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
            {reservas.map(r=>{
              const pct=r.meta>0?Math.min(100,(r.saldo/r.meta)*100):null;
              return <div key={r.id} style={{flexShrink:0,minWidth:120,background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                  <span style={{fontSize:16}}>{r.emoji}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#818cf8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nome}</span>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:"#e2e8f0"}}>{hide?"••••":fmt(r.saldo)}</div>
                {r.meta>0&&<>
                  <Bar pct={pct} color={pct>=100?"#4ade80":"#818cf8"}/>
                  <div style={{fontSize:9,color:"#64748b"}}>{pct.toFixed(0)}% de {hide?"••••":fmt(r.meta)}</div>
                </>}
              </div>;
            })}
            <div style={{flexShrink:0,minWidth:100,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"10px 12px",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
              <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",marginBottom:4}}>Total</div>
              <div style={{fontSize:14,fontWeight:800,color:"#818cf8"}}>{hide?"••••":fmt(totalRes)}</div>
            </div>
          </div>
        </>;
      })()}

      {/* Meta de economia */}
      {mesFiltro!=="todos"&&totalInc>0&&(()=>{
        try{
        if(!meta||meta<=0) return null;
        const poupado=totalInc-totalExp;
        const poupadoReal=Math.max(0,poupado);
        const pct=Math.max(0,Math.min(100,(poupadoReal/meta)*100));
        const ok=poupado>=meta;
        const faltam=Math.max(0,meta-poupadoReal);
        return <div style={{...CARD,marginBottom:14,borderLeft:`3px solid ${ok?"#4ade80":pct>60?"#f59e0b":"#f87171"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>🎯 Meta de economia</div>
            <div style={{fontSize:12,color:ok?"#4ade80":pct>60?"#f59e0b":"#f87171",fontWeight:700}}>
              {ok?"✓ Atingida!":pct.toFixed(0)+"%"}
            </div>
          </div>
          <Bar pct={pct} color={ok?"#4ade80":pct>60?"#f59e0b":"#f87171"}/>
          <div style={{fontSize:11,color:"#64748b",marginTop:4}}>
            {hide?"••••":fmt(poupadoReal)} poupado de {hide?"••••":fmt(meta)} planejados
            {!ok&&<span style={{color:"#f87171"}}> · faltam {hide?"••••":fmt(faltam)}</span>}
          </div>
        </div>;}catch{return null;}
      })()}

      {/* Aviso lançamentos sem conta */}
      {(()=>{
        const semConta=exps.filter(e=>!e.conta||e.conta==="geral").length;
        const temMultiConta=(contas||CONTAS_DEF).filter(c=>c.id!=="geral").length>=2;
        if(!temMultiConta||semConta===0) return null;
        return <AlertBox tipo="info" texto={`🏦 ${semConta} lançamento${semConta>1?"s":""} sem conta definida — vá em Gastos e edite para atribuir ao Bradesco ou Nubank.`}/>;
      })()}

      {/* Alertas orçamento — só faz sentido num mês específico */}
      {mesFiltro!=="todos"&&cats.filter(c=>c.budget>0&&c.id!=="investimento").map(cat=>{
        const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
        const pct=spent/cat.budget*100;
        if(pct<80) return null;
        if(pct>100) return <AlertBox key={cat.id} tipo="err"
          texto={`${cat.emoji} ${cat.label} estourou o limite! (${hide?"••••":fmt(spent)} de ${hide?"••••":fmt(cat.budget)})`}/>;
        if(pct===100) return <AlertBox key={cat.id} tipo="ok"
          texto={`${cat.emoji} ${cat.label} atingiu exatamente o limite — ${hide?"••••":fmt(cat.budget)} ✓`}/>;
        return <AlertBox key={cat.id} tipo="warn"
          texto={`${cat.emoji} ${cat.label} em ${pct.toFixed(0)}% do limite (${hide?"••••":fmt(spent)} de ${hide?"••••":fmt(cat.budget)})`}/>;
      })}

      {/* Categorias */}
      <SecTitle t="Por categoria" sub={mesFiltro!=="todos"?"Toque para ver as transações":undefined}/>
      {cats.map(cat=>{
        const spent=exps.filter(e=>e.kind==="exp"&&e.cat===cat.id).reduce((s,e)=>s+e.value,0);
        if(spent===0&&cat.budget===0) return null;
        const pct=cat.budget>0?(spent/cat.budget)*100:0;
        return <div key={cat.id} style={{...ROW,cursor:"pointer"}} onClick={()=>onCatClick&&onCatClick(cat)}>
          <div style={{width:38,height:38,borderRadius:10,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{cat.emoji}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{cat.label}</span>
              <span style={{fontSize:12,color:spent>cat.budget&&cat.budget>0?"#f87171":"#64748b"}}>{hide?"••••":fmt(spent)+(cat.budget>0?"/"+fmt(cat.budget):"")}</span>
            </div>
            {cat.budget>0&&<Bar pct={pct} color={spent>cat.budget?"#f87171":pct>75?"#f59e0b":cat.color}/>}
          </div>
          <span style={{fontSize:14,color:"#475569",flexShrink:0}}>›</span>
        </div>;
      })}

      {/* Despesas Fixas */}
      {fixas&&fixas.filter(f=>f.ativo&&f.valor>0).length>0&&<>
        <SecTitle t="Despesas fixas" sub={`Total: ${hide?"••••":fmt(totalFixas)}/mês`}/>
        {fixas.filter(f=>f.ativo&&f.valor>0).map(f=>{
          const cat=cats.find(c=>c.id===f.cat);
          // Verifica se há lançamento real no mês filtrado com descrição parecida
          const descMatch=new RegExp(f.desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(" ")[0],"i");
          const jaLancado=exps.some(e=>{
            const p=e.date?.split("/");
            if(!p||p.length<2) return false;
            const anoMesE=p.length>=3?`${p[2]}-${p[1]}`:`${new Date().getFullYear()}-${p[1]}`;
            const mesOk=mesFiltro==="todos"||anoMesE===mesFiltro;
            return mesOk&&e.kind==="exp"&&descMatch.test((e.desc||"").normalize("NFD").replace(/[\u0300-\u036f]/g,""));
          });
          return <div key={f.id} style={{...ROW,borderLeft:`3px solid ${jaLancado?"#4ade80":"#f59e0b"}`}}>
            <span style={{fontSize:20}}>{f.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{f.desc}</div>
              <div style={{fontSize:11,color:"#475569"}}>{cat?.label||"Outros"} · todo mês</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
              <span style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>{hide?"••••":fmt(f.valor)}</span>
              <span style={{fontSize:10,color:jaLancado?"#4ade80":"#f59e0b",fontWeight:700}}>{jaLancado?"✓ lançado":"⚠️ pendente"}</span>
            </div>
          </div>;
        })}
      </>}

      {/* Maiores gastos */}
      {top3.length>0&&<>
        <SecTitle t="Maiores gastos"/>
        {top3.map((e,i)=>(
          <div key={e.id||i} style={ROW}>
            <span style={{fontSize:16,width:24,textAlign:"center"}}>{["🥇","🥈","🥉"][i]}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
              <div style={{fontSize:11,color:"#475569"}}>{e.date}</div>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:"#f87171",flexShrink:0}}>{hide?"••••":fmt(e.value)}</span>
          </div>
        ))}
      </>}

      {/* Recorrentes */}
      {recorrentes.length>0&&<>
        <SecTitle t="Gastos recorrentes" sub="Aparecem em mais de 1 mês"/>
        {recorrentes.map((r,i)=>{
          const jaEhFixa=fixas&&fixas.some(f=>f.desc.toLowerCase()===r.desc.toLowerCase());
          return <div key={i} style={ROW}>
            <span style={{fontSize:20}}>{r.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.desc}</div>
              <div style={{fontSize:11,color:"#475569"}}>{r.count}x · {hide?"••••":fmt(r.value)}</div>
            </div>
            {!jaEhFixa&&onAddFixa&&<button
              style={{fontSize:10,color:"#818cf8",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit"}}
              onClick={()=>onAddFixa(r)}>+ Fixas</button>}
            {jaEhFixa&&<span style={{fontSize:10,color:"#4ade80",flexShrink:0}}>✓ fixa</span>}
          </div>;
        })}
      </>}

      {/* Últimos lançamentos */}
      <SecTitle t="Últimos lançamentos"/>
      {[...allExps].sort((a,b)=>dateKey(b.date).localeCompare(dateKey(a.date))||b.id-a.id).slice(0,6).map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        const isTransf=e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret"||e.incType==="outro");
        const incLabel=e.kind==="inc"?(INC_TIPOS.find(t=>t.id===e.incType)?.label||e.type||"Entrada"):null;
        return <div key={e.id} style={{...ROW,...(e.kind==="inc"?{borderColor:isTransf?"rgba(148,163,184,0.2)":"rgba(74,222,128,0.2)",background:isTransf?"rgba(148,163,184,0.03)":"rgba(74,222,128,0.04)"}:{})}}>
          <div style={{width:38,height:38,borderRadius:10,background:e.kind==="inc"?(isTransf?"rgba(148,163,184,0.1)":"rgba(74,222,128,0.12)"):"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{e.emoji||cat?.emoji||"📦"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
            <div style={{fontSize:11,color:"#475569"}}>{e.kind==="inc"?incLabel:(cat?.label||"Outros")} · {e.date}</div>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:e.kind==="inc"?(isTransf?"#94a3b8":"#4ade80"):"#f87171",flexShrink:0}}>{hide?"••••":(e.kind==="inc"?"+":"-")+fmt(e.value)}</span>
        </div>;
      })}
      {/* Botão compartilhar resumo */}
      {mesFiltro!=="todos"&&exps.length>0&&(()=>{
        const [ano,mes]=mesFiltro.split("-");
        const nomeMes=MESES[+mes];
        function gerarResumo(){
          const linCats=cats.filter(c=>c.id!=="investimento").map(c=>{
            const s=exps.filter(e=>e.kind==="exp"&&e.cat===c.id).reduce((a,e)=>a+e.value,0);
            if(s===0) return null;
            return `  ${c.emoji} ${c.label}: ${fmt(s)}`;
          }).filter(Boolean).join("\n");
          const totalGastos=exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento").reduce((s,e)=>s+e.value,0);
          const totalInvRes=exps.filter(e=>e.cat==="investimento").reduce((s,e)=>s+e.value,0);
          const rendaRes=exps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
          const saldoRes=rendaRes-totalGastos;
          const poupPct=rendaRes>0?((saldoRes/rendaRes)*100).toFixed(0):0;
          const txt=`📊 Resumo financeiro — ${nomeMes}/${ano}

💼 Renda: ${fmt(rendaRes)}
💸 Gastos: ${fmt(totalGastos)}
${totalInvRes>0?`📈 Investido: ${fmt(totalInvRes)}
`:""}💰 Saldo: ${fmt(saldoRes)} (${poupPct}% poupado)

📋 Por categoria:
${linCats}

—
Gerado pelo meu app financeiro`;
          if(navigator.share){navigator.share({text:txt}).catch(()=>{});}
          else{navigator.clipboard?.writeText(txt).then(()=>showToast("📋 Resumo copiado!")).catch(()=>showToast("❌ Não foi possível copiar"));}
        }
        return <button style={{width:"100%",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8",borderRadius:12,padding:"10px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
          onClick={gerarResumo}>📤 Compartilhar resumo de {nomeMes}</button>;
      })()}

      {/* Estado vazio */}
      {exps.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#475569"}}>
          <div style={{fontSize:52,marginBottom:12}}>📊</div>
          <div style={{fontSize:16,fontWeight:700,color:"#94a3b8",marginBottom:8}}>Nenhum lançamento ainda</div>
          <div style={{fontSize:13,lineHeight:1.7,marginBottom:20}}>
            Comece registrando seus gastos e receitas,<br/>ou importe um extrato em <strong style={{color:"#818cf8"}}>⚙️ Config → Importar</strong>.
          </div>
        </div>
      )}
    </div>
  );
}

// ── GRÁFICOS ───────────────────────────────────────────────
function Graficos({ exps, cats, hide, allExps, mesFiltro }) {
  const gastos =exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const pieData=cats.filter(c=>c.id!=="investimento").map(c=>({...c,spent:gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0)})).filter(c=>c.spent>0);
  const pieTotal=pieData.reduce((s,c)=>s+c.spent,0);
  const sz=160,cx=sz/2,cy=sz/2,r=sz*.38,ir=sz*.22;
  let cum=-Math.PI/2;
  const slices=pieData.map(d=>{const a=(d.spent/pieTotal)*Math.PI*2,sa=cum;cum+=a;return{...d,sa,ea:cum};});
  function arc(sa,ea){const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa),x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${ea-sa>Math.PI?1:0} 1 ${x2} ${y2}Z`;}

  // Evolução mensal — com ano para não misturar Jan/2026 com Jan/2027
  function getAnoMes(e){const p=e.date?.split("/");if(!p||p.length<2)return null;return p.length>=3?`${p[2]}-${p[1]}`:`${new Date().getFullYear()}-${p[1]}`;}
  const mesesDisp=[...new Set(allExps.map(getAnoMes).filter(Boolean))].sort();
  const evolucao=mesesDisp.map(m=>{
    const [ano,mes]=m.split("-");
    const label=MESES_CURTO[+mes]+(mesesDisp.some(x=>x.split("-")[0]!==ano)?"'"+ano.slice(2):"");
    const inc =allExps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)&&getAnoMes(e)===m).reduce((s,e)=>s+e.value,0);
    const transf=allExps.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret")&&getAnoMes(e)===m).reduce((s,e)=>s+e.value,0);
    const exp =allExps.filter(e=>e.kind==="exp"&&e.cat!=="investimento"&&getAnoMes(e)===m).reduce((s,e)=>s+e.value,0);
    const inv =allExps.filter(e=>e.cat==="investimento"&&getAnoMes(e)===m).reduce((s,e)=>s+e.value,0);
    return {m,label,inc,transf,exp,inv,saldo:inc-exp};
  });
  const maxEv=Math.max(...evolucao.flatMap(e=>[e.inc,e.exp]),1);
  const chartH=110,barW=22;

  // Gráfico de linha — evolução do saldo acumulado
  const saldoAcum=evolucao.reduce((acc,e,i)=>{
    const prev=i>0?acc[i-1].saldo:0;
    return [...acc,{label:e.label,saldo:prev+e.saldo}];
  },[]);
  const minSaldo=Math.min(...saldoAcum.map(e=>e.saldo),0);
  const maxSaldo=Math.max(...saldoAcum.map(e=>e.saldo),1);
  const lineH=90,linePad=20;
  function saldoY(v){return lineH-((v-minSaldo)/(maxSaldo-minSaldo||1))*(lineH-linePad)+linePad/2;}
  const lineW=Math.max(saldoAcum.length*64,280);
  const pts=saldoAcum.map((e,i)=>`${i*64+16},${saldoY(e.saldo)}`).join(" ");

  return (
    <div style={{padding:16,paddingBottom:100}}>
      {/* Evolução mensal */}
      {evolucao.length>=2&&<>
        <SecTitle t="Evolução mensal" sub={evolucao.length>6?"Últimos "+evolucao.length+" meses":undefined}/>
        <div style={CARD}>
          <div style={{overflowX:"auto"}}>
            <svg width={Math.max(evolucao.length*64,280)} height={chartH+36} style={{display:"block",overflow:"visible"}}>
              {[0.25,0.5,0.75,1].map(f=>(
                <line key={f} x1={0} y1={chartH*(1-f)} x2={evolucao.length*64} y2={chartH*(1-f)} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
              ))}
              {evolucao.map((e,i)=>{
                const x=i*64+6,hInc=(e.inc/maxEv)*chartH,hExp=(e.exp/maxEv)*chartH,hTransf=((e.inc+e.transf)/maxEv)*chartH;
                return <g key={i}>
                  {e.transf>0&&<rect x={x} y={chartH-hTransf} width={barW} height={hTransf-hInc} rx={0} fill="rgba(148,163,184,0.35)"/>}
                  <rect x={x} y={chartH-hInc} width={barW} height={hInc} rx={3} fill="rgba(74,222,128,0.7)"/>
                  <rect x={x+barW+3} y={chartH-hExp} width={barW} height={hExp} rx={3} fill={e.exp>e.inc?"rgba(248,113,113,0.85)":"rgba(248,113,113,0.5)"}/>
                  <text x={x+barW+1} y={chartH+14} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="Outfit,sans-serif">{e.label}</text>
                  {e.inv>0&&<text x={x+barW+1} y={chartH-hExp-8} textAnchor="middle" fill="#34d399" fontSize="9">💹</text>}
                </g>;
              })}
            </svg>
          </div>
          <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
            {[["rgba(74,222,128,0.7)","Salário/Renda"],["rgba(148,163,184,0.5)","Transferências"],["rgba(248,113,113,0.7)","Gastos"],["#34d399","Investimento"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:11,color:"#94a3b8"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* Linha de saldo acumulado */}
      {saldoAcum.length>=2&&<>
        <SecTitle t="Saldo acumulado" sub="Evolução do patrimônio mês a mês"/>
        <div style={CARD}>
          <div style={{overflowX:"auto"}}>
            <svg width={lineW} height={lineH+28} style={{display:"block",overflow:"visible"}}>
              {/* Linha zero */}
              {minSaldo<0&&<line x1={0} y1={saldoY(0)} x2={lineW} y2={saldoY(0)} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4,3"/>}
              {/* Área preenchida */}
              <defs>
                <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={saldoAcum[saldoAcum.length-1]?.saldo>=0?"#4ade80":"#f87171"} stopOpacity="0.25"/>
                  <stop offset="100%" stopColor={saldoAcum[saldoAcum.length-1]?.saldo>=0?"#4ade80":"#f87171"} stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              <polygon points={`${saldoAcum.map((e,i)=>`${i*64+16},${saldoY(e.saldo)}`).join(" ")} ${(saldoAcum.length-1)*64+16},${lineH} 16,${lineH}`} fill="url(#saldoGrad)"/>
              {/* Linha principal */}
              <polyline points={pts} fill="none" stroke={saldoAcum[saldoAcum.length-1]?.saldo>=0?"#4ade80":"#f87171"} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>
              {/* Pontos e labels */}
              {saldoAcum.map((e,i)=>{
                const x=i*64+16,y=saldoY(e.saldo),pos=e.saldo>=0;
                return <g key={i}>
                  <circle cx={x} cy={y} r={4} fill={pos?"#4ade80":"#f87171"} stroke="#080e1d" strokeWidth={2}/>
                  <text x={x} y={y-(pos?10:-3)} textAnchor="middle" fill={pos?"#4ade80":"#f87171"} fontSize="9" fontFamily="Outfit,sans-serif" fontWeight="700">{hide?"••":fmt(e.saldo).replace("R$","").trim()}</text>
                  <text x={x} y={lineH+16} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="Outfit,sans-serif">{e.label}</text>
                </g>;
              })}
            </svg>
          </div>
        </div>
      </>}

      {/* Pizza */}
      <SecTitle t="Gastos por categoria" sub={mesFiltro==="todos"?"Acumulado de todos os meses":undefined}/>
      <div style={CARD}>
        {pieTotal>0?<>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
              {slices.map((s,i)=><path key={i} d={arc(s.sa,s.ea)} fill={s.color} opacity={.85} stroke="#080e1d" strokeWidth={2}/>)}
              <circle cx={cx} cy={cy} r={ir} fill="#0f172a"/>
              <text x={cx} y={cy-3} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="Outfit,sans-serif">TOTAL</text>
              <text x={cx} y={cy+9} textAnchor="middle" fill="#4ade80" fontSize="9" fontWeight="800" fontFamily="Outfit,sans-serif">{hide?"••••":fmt(pieTotal)}</text>
            </svg>
          </div>
          {[...pieData].sort((a,b)=>b.spent-a.spent).map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{width:10,height:10,borderRadius:2,background:c.color,flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:"#cbd5e1"}}>{c.emoji} {c.label}</span>
              <span style={{fontSize:13,fontWeight:700,color:c.color}}>{hide?"••••":fmt(c.spent)}</span>
              <span style={{fontSize:11,color:"#64748b",width:34,textAlign:"right"}}>{((c.spent/pieTotal)*100).toFixed(0)}%</span>
            </div>
          ))}
        </>:<div style={{textAlign:"center",padding:"20px 0",color:"#475569",fontSize:13}}>Nenhum gasto registrado</div>}
      </div>

      {/* Orçado vs Realizado */}
      <SecTitle t="Orçado vs Realizado" sub={mesFiltro==="todos"?"Selecione um mês para comparar corretamente":undefined}/>
      <div style={CARD}>
        <div style={{overflowX:"auto"}}>
          <svg width={Math.max(cats.filter(c=>c.id!=="investimento").length*56,300)} height={160} style={{display:"block"}}>
            {(()=>{const catsNI=cats.filter(c=>c.id!=="investimento");const mx=Math.max(...catsNI.map(c=>Math.max(c.budget,gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0))),1);return catsNI.map((cat,i)=>{
              const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
              const bH=(cat.budget/mx)*100,sH=(spent/mx)*100,x=i*56+6;
              return <g key={cat.id}>
                <text x={x+22} y={115-Math.max(bH,sH)-4} textAnchor="middle" fill={spent>cat.budget?"#f87171":"#94a3b8"} fontSize="9" fontFamily="Outfit,sans-serif">{cat.budget>0?Math.round((spent/cat.budget)*100)+"%":""}</text>
                <rect x={x} y={115-bH} width={20} height={bH} rx={3} fill="rgba(99,102,241,0.55)"/>
                <rect x={x+22} y={115-sH} width={20} height={sH} rx={3} fill={spent>cat.budget?"#f87171":"#f59e0b"}/>
                <text x={x+20} y={130} textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="Outfit,sans-serif">{cat.emoji}</text>
              </g>;
            })})()}
          </svg>
        </div>
        <div style={{display:"flex",gap:14,marginTop:8}}>
          {[["rgba(99,102,241,0.7)","Orçado"],["#f59e0b","Realizado"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,borderRadius:2,background:c}}/><span style={{fontSize:11,color:"#94a3b8"}}>{l}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ORÇAMENTO ──────────────────────────────────────────────
function Orcamento({ exps, cats, setCats, hide, mesFiltro }) {
  const gastos=exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const totalOrc=cats.filter(c=>c.budget>0&&c.id!=="investimento").reduce((s,c)=>s+c.budget,0);
  const totalGasto=gastos.reduce((s,e)=>s+e.value,0);
  const isTodos=mesFiltro==="todos";
  const mesesCount=isTodos?Math.max(1,[...new Set(exps.map(e=>{const p=e.date?.split("/");if(!p||p.length<2)return null;return p.length>=3?`${p[2]}-${p[1]}`:`${new Date().getFullYear()}-${p[1]}`;}).filter(Boolean))].length):1;
  return (
    <div style={{padding:16,paddingBottom:100}}>
      {isTodos&&mesesCount>1&&(
        <AlertBox tipo="warn" texto={`⚠️ Você está vendo ${mesesCount} meses acumulados. Os limites são mensais — use o filtro de mês no topo para comparar corretamente.`}/>
      )}
      <div style={{...CARD,background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:13,color:"#818cf8",fontWeight:700}}>Total orçado</div>
          <div style={{fontSize:15,fontWeight:800,color:"#818cf8"}}>{hide?"••••":fmt(totalOrc)}</div>
        </div>
        <Bar pct={totalOrc>0?(totalGasto/totalOrc)*100:0} color={totalGasto>totalOrc?"#f87171":"#4ade80"}/>
        <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{hide?"••••":fmt(totalGasto)} gasto de {hide?"••••":fmt(totalOrc)} orçado</div>
      </div>
      {cats.map((cat,idx)=>{
        const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
        const rawPct=cat.budget>0?(spent/cat.budget)*100:0;
        const pct=Math.min(100,rawPct);
        const over=cat.budget>0&&spent>cat.budget;
        const exact=cat.budget>0&&spent===cat.budget;
        const borderColor=over?"#f87171":exact?"#4ade80":cat.color;
        const barColor=over?"#f87171":exact?"#4ade80":pct>75?"#f59e0b":cat.color;
        return <div key={cat.id} style={{...CARD,padding:14,borderLeft:`3px solid ${borderColor}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cat.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{cat.label}</div>
              {over&&<div style={{fontSize:11,color:"#f87171"}}>⚠️ Excedido em {hide?"••••":fmt(spent-cat.budget)}</div>}
              {exact&&<div style={{fontSize:11,color:"#4ade80"}}>✓ Limite atingido exatamente</div>}
            </div>
            <span style={{fontSize:12,color:over?"#f87171":exact?"#4ade80":"#64748b"}}>{hide?"••••":fmt(spent)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:12,color:"#64748b",flexShrink:0}}>Limite R$</span>
            <input style={inp({flex:1,padding:"8px 12px",fontSize:15,fontWeight:700})} type="number" value={cat.budget}
              onChange={e=>setCats(p=>p.map((c,i)=>i===idx?{...c,budget:+e.target.value}:c))}/>
          </div>
          {cat.budget>0&&<>
            <Bar pct={pct} color={barColor}/>
            <div style={{fontSize:11,color:"#64748b",marginTop:4}}>
              {rawPct.toFixed(0)}% · {over?<span style={{color:"#f87171"}}>{hide?"••••":fmt(spent-cat.budget)} acima</span>:exact?<span style={{color:"#4ade80"}}>no limite ✓</span>:<span>{hide?"••••":fmt(cat.budget-spent)} restante</span>}
            </div>
          </>}
        </div>;
      })}
    </div>
  );
}

// ── MARKDOWN SIMPLES ──────────────────────────────────────
function MdText({ text }) {
  // Converte **negrito**, *itálico* e quebras de linha
  const html = (text||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/\n/g,"<br/>");
  return <span dangerouslySetInnerHTML={{__html:html}}/>;
}

// ── SWIPE ROW ─────────────────────────────────────────────
function SwipeRow({ children, onDelete, disabled, swipeId, activeSwipe, setActiveSwipe }) {
  const startX  = useRef(null);
  const threshold = 80;
  const isOpen = activeSwipe === swipeId;
  const innerRef = useRef(null);

  // Sincronizar quando activeSwipe muda (ex: outro item aberto fecha este)
  useEffect(()=>{
    if(!innerRef.current) return;
    innerRef.current.style.transform = isOpen ? `translateX(-${threshold}px)` : "translateX(0px)";
    innerRef.current.style.transition = "transform 0.22s ease";
  },[isOpen]);

  if(disabled) return <>{children}</>;

  function onTouchStart(e){
    startX.current = e.touches[0].clientX;
    if(activeSwipe && activeSwipe !== swipeId) setActiveSwipe(null);
  }
  function onTouchMove(e){
    if(startX.current===null||!innerRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if(dx < 0) {
      innerRef.current.style.transform = `translateX(${Math.max(dx,-threshold)}px)`;
      innerRef.current.style.transition = "none";
    } else if(isOpen && dx > 0) {
      innerRef.current.style.transform = `translateX(${Math.min(0, -threshold+dx)}px)`;
      innerRef.current.style.transition = "none";
    }
  }
  function onTouchEnd(e){
    if(startX.current===null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if(dx < -(threshold * 0.5)){
      setActiveSwipe(swipeId); // useEffect vai animar
    } else {
      setActiveSwipe(prev => prev===swipeId ? null : prev); // fechar se estava aberto
      if(innerRef.current){
        innerRef.current.style.transform = "translateX(0px)";
        innerRef.current.style.transition = "transform 0.22s ease";
      }
    }
    startX.current = null;
  }

  return (
    <div style={{position:"relative",borderRadius:12,marginBottom:8,overflow:"hidden",background:"#1e1e2e"}}>
      {/* Botão delete fixo à direita, sempre visível atrás */}
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:threshold,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"#ef4444",cursor:"pointer",zIndex:0}}
        onClick={()=>{setActiveSwipe(null);onDelete();}}>
        <span style={{fontSize:20}}>🗑️</span>
        <span style={{fontSize:10,color:"white",fontWeight:700}}>Deletar</span>
      </div>
      {/* Card deslizável — background sólido cobre o vermelho quando fechado */}
      <div ref={innerRef} style={{transform:"translateX(0px)",position:"relative",zIndex:1,background:"#1e1e2e",borderRadius:12}}>
        {children}
      </div>
    </div>
  );
}

// ── GASTOS ─────────────────────────────────────────────────
function Gastos({ exps, setExps, cats, contas, openWith, onOpened, hide, mesFiltro, catFiltro, onClearCat }) {
  const [show,    setShow]    = useState(false);
  const [mode,    setMode]    = useState("expense");
  const contaDefault=(contas||[]).find(c=>c.id!=="geral")?.id||"geral";
  const [form,    setForm]    = useState({desc:"",value:"",cat:"alimentacao",date:"",payment:"dinheiro",parcelas:1,vencimento:"10",incType:"salario",conta:contaDefault});
  const [editId,  setEditId]  = useState(null);
  const [editForm,setEditForm]= useState({});
  const [busca,   setBusca]   = useState("");
  const [ordenar, setOrdenar] = useState("data");
  const [confirm, setConfirm] = useState(null);
  const [contaFiltro, setContaFiltro] = useState(null);
  const [parcelarId,  setParcelarId]  = useState(null);
  const [pagina,      setPagina]      = useState(1);
  const [activeSwipe, setActiveSwipe] = useState(null);
  const POR_PAGINA = 50;
  const [parcelarN,   setParcelarN]   = useState(2);

  // Resetar paginação e swipe ao mudar filtros
  useEffect(()=>{setPagina(1);setActiveSwipe(null);},[busca,mesFiltro,catFiltro,contaFiltro,ordenar]);

  function aplicarParcelamento(){
    const orig=exps.find(e=>e.id===parcelarId);
    if(!orig||parcelarN<2) return;
    const n=parcelarN;
    const total=orig.value;
    const baseDate=orig.date?new Date(orig.date.split("/").reverse().join("-")+"T12:00:00"):new Date();
    // Detectar dia de vencimento do original
    const diaVenc=baseDate.getDate();
    const novas=Array.from({length:n},(_,i)=>{
      let d=new Date(baseDate);
      d.setMonth(d.getMonth()+i);
      d.setDate(diaVenc);
      const parValor=i<n-1?Math.floor((total/n)*100)/100:+(total-Math.floor((total/n)*100)/100*(n-1)).toFixed(2);
      const descBase=orig.desc.replace(/ \(\d+\/\d+\)$/,""); // remove parcelamento anterior se houver
      return {...orig,id:Date.now()+i,desc:`${descBase} (${i+1}/${n})`,value:parValor,date:fmtDate(d.toISOString().slice(0,10)),emoji:"💳",payment:"cartao"};
    });
    setExps(p=>[...p.filter(e=>e.id!==parcelarId),...novas]);
    setParcelarId(null);
  }

  useEffect(()=>{ if(openWith){setMode(openWith);setShow(true);if(onOpened)onOpened();} },[openWith]);

  function startEdit(e){setEditId(e.id);setEditForm({desc:e.desc,value:e.value,cat:e.cat||"outros",kind:e.kind,date:e.date||"",incType:e.incType||"salario",conta:e.conta||"geral"});}
  function saveEdit(){
    const cat=cats.find(c=>c.id===editForm.cat);
    const incEmoji=INC_TIPOS.find(t=>t.id===editForm.incType)?.emoji||"💰";
    // Preservar emoji customizado se categoria não mudou, senão usar da nova categoria
    setExps(p=>p.map(e=>{
      if(e.id!==editId) return e;
      const catMudou=e.cat!==editForm.cat;
      const newEmoji=editForm.kind==="inc"?incEmoji:(catMudou?(cat?.emoji||"📦"):e.emoji);
      return {...e,...editForm,value:+editForm.value,incType:editForm.kind==="inc"?editForm.incType:undefined,emoji:newEmoji,conta:editForm.conta||"geral"};
    }));
    setEditId(null);
  }

  function add() {
    if(!form.desc||!form.value) return;
    const cat=cats.find(c=>c.id===form.cat);
    const isCard=mode==="expense"&&form.payment==="cartao";
    const parcelas=isCard?Math.max(1,+form.parcelas||1):1;
    const total=+form.value,venc=+form.vencimento||10;
    const baseDate=form.date?new Date(form.date+"T12:00:00"):new Date();
    // Garante que a data é sempre preenchida (default = hoje)
    const novos=Array.from({length:parcelas},(_,i)=>{
      let d=new Date(baseDate);
      if(isCard){const off=d.getDate()<venc?0:1;d.setMonth(d.getMonth()+off+i);d.setDate(venc);}
      const parValor=i<parcelas-1?Math.floor((total/parcelas)*100)/100:+(total-Math.floor((total/parcelas)*100)/100*(parcelas-1)).toFixed(2);
      return {id:Date.now()+i,desc:parcelas>1?`${form.desc} (${i+1}/${parcelas})`:form.desc,kind:mode==="expense"?"exp":"inc",cat:mode==="expense"?form.cat:undefined,incType:mode==="income"?form.incType:undefined,type:mode==="income"?"Manual":undefined,emoji:isCard?"💳":(mode==="expense"?(cat?.emoji||"📦"):(INC_TIPOS.find(t=>t.id===form.incType)?.emoji||"💰")),value:parValor,date:fmtDate(d.toISOString().slice(0,10)),payment:isCard?"cartao":"dinheiro",conta:form.conta||"geral"};
    });
    setExps(p=>[...novos,...p]);
    setForm({desc:"",value:"",cat:"alimentacao",date:"",payment:"dinheiro",parcelas:1,vencimento:"10",incType:"salario",conta:contaDefault});
    setShow(false);
  }

  const expsFilt=exps.filter(e=>{
    const p=e.date?.split("/");
    // Respeita mesFiltro sempre — catFiltro não bypassa o filtro de mês
    let mesOk=!mesFiltro||mesFiltro==="todos";
    if(!mesOk&&p?.length>=2){
      const anoMes=p.length>=3?`${p[2]}-${p[1]}`:`${new Date().getFullYear()}-${p[1]}`;
      mesOk=anoMes===mesFiltro;
    }
    const catOk=!catFiltro||e.cat===catFiltro.id;
    const buscaOk=!busca||(e.desc||"").toLowerCase().includes(busca.toLowerCase());
    const contaOk=!contaFiltro||e.conta===contaFiltro;
    return mesOk&&catOk&&buscaOk&&contaOk;
  });

  const sorted=[...expsFilt].sort((a,b)=>{
    if(ordenar==="valor") return b.value-a.value;
    if(ordenar==="cat")   return (a.cat||"").localeCompare(b.cat||"");
    return dateKey(b.date).localeCompare(dateKey(a.date))||b.id-a.id;
  });

  const totalFilt   = expsFilt.filter(e=>e.kind==="exp").reduce((s,e)=>s+e.value,0);
  const totalIncFilt= expsFilt.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
  const totalTransfFilt=expsFilt.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret"||e.incType==="outro")).reduce((s,e)=>s+e.value,0);

  return (
    <div style={{padding:16,paddingBottom:100}}>
      {/* Banner categoria */}
      {catFiltro&&(
        <div style={{display:"flex",alignItems:"center",gap:10,background:`${catFiltro.color}18`,border:`1px solid ${catFiltro.color}44`,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
          <span style={{fontSize:22}}>{catFiltro.emoji}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{catFiltro.label}</div>
            <div style={{fontSize:11,color:"#64748b"}}>{expsFilt.length} lançamento(s) · {fmt(totalFilt)}</div>
          </div>
          <button style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>onClearCat&&onClearCat()}>✕</button>
        </div>
      )}

      {/* Botões + busca + ordenar */}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <button style={{flex:1,...btn("rgba(74,222,128,0.15)","#4ade80",{border:"1px solid rgba(74,222,128,0.3)",padding:"9px 0",fontSize:13})}} onClick={()=>{setMode("income");setShow(true);}}>+💰</button>
        <button style={{flex:1,...btn("rgba(248,113,113,0.15)","#f87171",{border:"1px solid rgba(248,113,113,0.3)",padding:"9px 0",fontSize:13})}} onClick={()=>{setMode("expense");setShow(true);}}>+💸</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input style={{...inp({flex:1,padding:"9px 12px",fontSize:13})}} placeholder="🔍 Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select style={{...inp({width:"auto",padding:"9px 10px",fontSize:12,flexShrink:0})}} value={ordenar} onChange={e=>setOrdenar(e.target.value)}>
          <option value="data">📅 Data</option>
          <option value="valor">💰 Valor</option>
          <option value="cat">🏷️ Cat.</option>
        </select>
      </div>
      {(contas||CONTAS_DEF).filter(c=>c.id!=="geral").length>0&&(
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <button style={{background:!contaFiltro?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:!contaFiltro?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:!contaFiltro?"#818cf8":"#64748b",borderRadius:99,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:!contaFiltro?700:400}}
            onClick={()=>setContaFiltro(null)}>Todas</button>
          {(contas||CONTAS_DEF).filter(c=>c.id!=="geral").map(c=>(
            <button key={c.id} style={{background:contaFiltro===c.id?`${c.color}22`:"rgba(255,255,255,0.04)",border:contaFiltro===c.id?`1px solid ${c.color}55`:"1px solid rgba(255,255,255,0.08)",color:contaFiltro===c.id?c.color:"#64748b",borderRadius:99,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:contaFiltro===c.id?700:400}}
              onClick={()=>setContaFiltro(contaFiltro===c.id?null:c.id)}>{c.emoji} {c.label}</button>
          ))}
        </div>
      )}

      {(mesFiltro!=="todos"||catFiltro||busca)&&(
        <div style={{fontSize:12,color:"#64748b",marginBottom:10,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,display:"flex",gap:12,flexWrap:"wrap"}}>
          <span>📋 {sorted.length} lançamentos</span>
          {totalFilt>0&&<span style={{color:"#f87171"}}>💸 {hide?"••••":fmt(totalFilt)}</span>}
          {totalIncFilt>0&&<span style={{color:"#4ade80"}}>💼 {hide?"••••":fmt(totalIncFilt)}</span>}
          {totalTransfFilt>0&&<span style={{color:"#94a3b8"}}>🔄 {hide?"••••":fmt(totalTransfFilt)}</span>}
        </div>
      )}

      {/* Carregar mais */}
      {sorted.length>pagina*POR_PAGINA&&(
        <button style={{width:"100%",background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",color:"#818cf8",borderRadius:12,padding:"12px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}
          onClick={()=>setPagina(p=>p+1)}>
          ⬇️ Carregar mais ({sorted.length-pagina*POR_PAGINA} restantes)
        </button>
      )}

      {/* Formulário novo lançamento */}
      {show&&(
        <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:16,padding:20,marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginBottom:14}}>{mode==="income"?"💰 Nova entrada":"💸 Novo gasto"}</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[["expense","💸 Gasto","#f87171"],["income","💰 Entrada","#4ade80"]].map(([m,l,c])=>(
              <button key={m} style={{flex:1,borderRadius:10,padding:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mode===m?`${c}22`:"rgba(255,255,255,0.05)",border:mode===m?`1px solid ${c}55`:"1px solid rgba(255,255,255,0.1)",color:mode===m?c:"#94a3b8"}} onClick={()=>setMode(m)}>{l}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:10}} placeholder="Descrição" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}/>
          <input style={{...inp(),marginBottom:10}} type="number" placeholder="Valor (R$)" value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))}/>
          <input style={{...inp(),marginBottom:10,colorScheme:"dark"}} type="date" value={form.date||new Date().toISOString().slice(0,10)} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
          {mode==="income"&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Tipo de entrada</div>
              <select style={inp()} value={form.incType} onChange={e=>setForm(p=>({...p,incType:e.target.value}))}>
                {INC_TIPOS.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
              </select>
              {(form.incType==="transferencia"||form.incType==="investimento_ret")&&(
                <div style={{fontSize:11,color:"#f59e0b",marginTop:6,padding:"6px 10px",background:"rgba(245,158,11,0.08)",borderRadius:8}}>
                  ⚠️ Esta entrada não será contada como renda — não afeta o KPI "Salário/Renda".
                </div>
              )}
            </div>
          )}
          {mode==="expense"&&<select style={{...inp(),marginBottom:10}} value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}>
            {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>}
          {mode==="expense"&&(
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[["dinheiro","💵 Débito/Pix"],["cartao","💳 Cartão"]].map(([v,l])=>(
                <button key={v} style={{flex:1,borderRadius:10,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:form.payment===v?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",border:form.payment===v?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.1)",color:form.payment===v?"#818cf8":"#94a3b8"}}
                  onClick={()=>setForm(p=>({...p,payment:v}))}>{l}</button>
              ))}
            </div>
          )}
          {mode==="expense"&&form.payment==="cartao"&&(
            <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:12,marginBottom:10}}>
              <div style={{fontSize:11,color:"#818cf8",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>💳 Parcelamento</div>
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Parcelas</div>
                  <select style={inp()} value={form.parcelas} onChange={e=>setForm(p=>({...p,parcelas:+e.target.value}))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x{n>1?" de "+fmt(+form.value/n||0):""}</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Vencimento (dia)</div>
                  <select style={inp()} value={form.vencimento} onChange={e=>setForm(p=>({...p,vencimento:e.target.value}))}>
                    {[1,5,7,10,12,15,17,20,25,28].map(d=><option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>
              </div>
              {form.parcelas>1&&<div style={{fontSize:12,color:"#64748b"}}>💡 {form.parcelas}x de {fmt(+form.value/form.parcelas||0)} — vence dia {form.vencimento}</div>}
            </div>
          )}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>Conta</div>
            <div style={{display:"flex",gap:6}}>
              {(contas||CONTAS_DEF).filter(c=>c.id!=="geral").map(c=>(
                <button key={c.id} style={{flex:1,borderRadius:10,padding:"8px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:form.conta===c.id?`${c.color}22`:"rgba(255,255,255,0.05)",border:form.conta===c.id?`1px solid ${c.color}55`:"1px solid rgba(255,255,255,0.1)",color:form.conta===c.id?c.color:"#94a3b8"}}
                  onClick={()=>setForm(p=>({...p,conta:c.id}))}>{c.emoji} {c.label}</button>
              ))}
            </div>
          </div>
                    <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setShow(false)}>Cancelar</button>
            <button style={btn(mode==="income"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#ef4444,#dc2626)")} onClick={add}>Salvar</button>
          </div>
        </div>
      )}

      {/* Confirmação exclusão */}
      {confirm&&(()=>{
        const item=exps.find(e=>e.id===confirm);
        return <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{fontSize:13,color:"#f87171",marginBottom:4}}>⚠️ Excluir este lançamento?</div>
          {item&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>{item.desc} · {item.kind==="inc"?"+":"-"}{fmt(item.value)}</div>}
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setConfirm(null)}>Cancelar</button>
            <button style={btn("rgba(248,113,113,0.2)","#f87171",{border:"1px solid rgba(248,113,113,0.3)"})} onClick={()=>{setExps(p=>p.filter(x=>x.id!==confirm));setConfirm(null);}}>Excluir</button>
          </div>
        </div>;
      })()}

      {sorted.length===0&&!show&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#475569"}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <div style={{fontSize:14}}>{busca?`Nenhum resultado para "${busca}"`:catFiltro?"Nenhum lançamento nesta categoria":"Nenhum lançamento"}</div>
          {!busca&&!catFiltro&&<div style={{fontSize:12,marginTop:6}}>Use os botões acima ou importe em ⚙️ Config</div>}
        </div>
      )}

      {/* Modal parcelamento retroativo */}
      {parcelarId&&(()=>{
        const orig=exps.find(e=>e.id===parcelarId);
        if(!orig) return null;
        return <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.4)",borderRadius:14,padding:16,marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:800,color:"#818cf8",marginBottom:4}}>💳 Parcelar retroativamente</div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{orig.desc} · {fmt(orig.value)}</div>
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:6}}>Número de parcelas</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {[2,3,4,5,6,8,10,12].map(n=>(
              <button key={n} style={{borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:parcelarN===n?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:parcelarN===n?"1px solid rgba(99,102,241,0.6)":"1px solid rgba(255,255,255,0.1)",color:parcelarN===n?"#818cf8":"#64748b"}}
                onClick={()=>setParcelarN(n)}>{n}x</button>
            ))}
          </div>
          {parcelarN>1&&<div style={{fontSize:12,color:"#64748b",marginBottom:12,padding:"8px 10px",background:"rgba(99,102,241,0.06)",borderRadius:8}}>
            {parcelarN}x de {fmt(orig.value/parcelarN)} · a partir de {orig.date}
          </div>}
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setParcelarId(null)}>Cancelar</button>
            <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={aplicarParcelamento}>✓ Parcelar em {parcelarN}x</button>
          </div>
        </div>;
      })()}

      {/* Lista */}
      {sorted.slice(0,pagina*POR_PAGINA).map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        const conta=(contas||CONTAS_DEF).find(c=>c.id===e.conta);
        const incLabel=e.kind==="inc"?(INC_TIPOS.find(t=>t.id===e.incType)?.label||e.type||"Entrada"):null;
        const isTransf=e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret"||e.incType==="outro");
        const isTransfInt=e.incType==="transf_interna";
        const rowBg=e.kind==="inc"
          ?isTransfInt?"rgba(148,163,184,0.03)":isTransf?"rgba(148,163,184,0.04)":"rgba(74,222,128,0.04)"
          :{};
        const rowBorder=e.kind==="inc"
          ?isTransfInt?"rgba(148,163,184,0.15)":isTransf?"rgba(148,163,184,0.2)":"rgba(74,222,128,0.2)"
          :undefined;
        const valColor=e.kind==="inc"?(isTransfInt||isTransf?"#94a3b8":"#4ade80"):"#f87171";
        return <SwipeRow key={e.id} swipeId={e.id} activeSwipe={activeSwipe} setActiveSwipe={setActiveSwipe} onDelete={()=>setConfirm(e.id)} disabled={!!editId}>
          <div style={{...ROW,marginBottom:0,...(e.kind==="inc"?{borderColor:rowBorder,background:rowBg}:{})}}>
            <div style={{width:38,height:38,borderRadius:10,background:e.kind==="inc"?(isTransfInt||isTransf?"rgba(148,163,184,0.1)":"rgba(74,222,128,0.12)"):"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{e.emoji||cat?.emoji||"📦"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
              <div style={{fontSize:11,color:"#475569",display:"flex",alignItems:"center",gap:5}}>
                <span>{e.kind==="inc"?incLabel:(cat?.label||"Outros")} · {e.date}</span>
                {conta&&conta.id!=="geral"&&<span style={{background:`${conta.color}22`,color:conta.color,borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,flexShrink:0}}>{conta.emoji}</span>}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
              <span style={{fontSize:14,fontWeight:700,color:valColor}}>{hide?"••••":(e.kind==="inc"?"+":"-")+fmt(e.value)}</span>
              <div style={{display:"flex",gap:4}}>
                <button style={{fontSize:11,color:"#818cf8",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} onClick={()=>startEdit(e)}>✏️</button>
                {e.kind==="exp"&&(!e.payment||e.payment!=="cartao"||e.desc.indexOf("(1/")!==-1===false)&&<button style={{fontSize:11,color:"#a78bfa",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} title="Parcelar" onClick={()=>{setParcelarId(e.id);setParcelarN(2);}}>✂️</button>}
                <button style={{fontSize:11,color:"#475569",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} onClick={()=>setConfirm(e.id)}>🗑️</button>
              </div>
            </div>
          </div>
          {editId===e.id&&(
            <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.4)",borderRadius:14,padding:16,marginBottom:8,marginTop:4}}>
              <div style={{fontSize:13,fontWeight:700,color:"#818cf8",marginBottom:14}}>✏️ Editando</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Tipo</div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[["inc","💰 Entrada","#4ade80"],["exp","💸 Gasto","#f87171"]].map(([v,l,c])=>(
                  <button key={v} style={{flex:1,borderRadius:10,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:editForm.kind===v?`${c}22`:"rgba(255,255,255,0.05)",border:editForm.kind===v?`1px solid ${c}55`:"1px solid rgba(255,255,255,0.1)",color:editForm.kind===v?c:"#94a3b8"}}
                    onClick={()=>setEditForm(p=>({...p,kind:v}))}>{l}</button>
                ))}
              </div>
              {editForm.kind==="exp"&&<>
                <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Categoria</div>
                <select style={{...inp(),marginBottom:12}} value={editForm.cat||"outros"} onChange={e=>setEditForm(p=>({...p,cat:e.target.value}))}>
                  {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </>}
              {editForm.kind==="inc"&&<>
                <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Tipo de entrada</div>
                <select style={{...inp(),marginBottom:12}} value={editForm.incType||"salario"} onChange={e=>setEditForm(p=>({...p,incType:e.target.value}))}>
                  {INC_TIPOS.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                </select>
              </>}
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Descrição</div>
              <input style={{...inp(),marginBottom:12}} value={editForm.desc} onChange={e=>setEditForm(p=>({...p,desc:e.target.value}))}/>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Valor (R$)</div>
                  <input style={inp()} type="number" value={editForm.value} onChange={e=>setEditForm(p=>({...p,value:e.target.value}))}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Data</div>
                  <input style={{...inp(),colorScheme:"dark"}} type="date"
                    value={(()=>{const pts=(editForm.date||"").split("/");if(pts.length>=3)return `${pts[2]}-${pts[1].padStart(2,"0")}-${pts[0].padStart(2,"0")}`;if(pts.length>=2)return `${new Date().getFullYear()}-${pts[1].padStart(2,"0")}-${pts[0].padStart(2,"0")}`;return "";})()}
                    onChange={e=>{if(!e.target.value)return;const d=new Date(e.target.value+"T12:00:00");setEditForm(p=>({...p,date:fmtDate(d.toISOString().slice(0,10))}));}}/>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>Conta</div>
                <select style={inp()} value={editForm.conta||"geral"} onChange={e=>setEditForm(p=>({...p,conta:e.target.value}))}>
                  {(contas||CONTAS_DEF).map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setEditId(null)}>Cancelar</button>
                <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={saveEdit}>Salvar ✓</button>
              </div>
            </div>
          )}
        </SwipeRow>;
      })}
    </div>
  );
}

// ── MERCADO ────────────────────────────────────────────────
// Caderninho de preços reais — o usuário registra o que pagou, o app compara
const MERCADO_KEY="mf_precos";
const MERCADO_PRODS_KEY="mf_prods_extra";
function loadPrecos(){try{const v=localStorage.getItem(MERCADO_KEY);return v?JSON.parse(v):{}}catch{return {}}}
function savePrecos(p){try{localStorage.setItem(MERCADO_KEY,JSON.stringify(p))}catch{}}
function loadProdsExtra(){try{const v=localStorage.getItem(MERCADO_PRODS_KEY);return v?JSON.parse(v):[]}catch{return []}}
function saveProdsExtra(list){try{localStorage.setItem(MERCADO_PRODS_KEY,JSON.stringify(list))}catch{}}

function Mercado({ markets, setMarkets, hide }) {
  // precos: { "Frango (kg)": { "Carrefour": {valor:12.9, data:"15/03"}, ... }, ... }
  const [precos,    setPrecos]   = useState(loadPrecos);
  const [produtos,  setProdutos] = useState(()=>{
    const extras=loadProdsExtra();
    // Também recupera produtos que têm preços mas não estão em nenhuma lista (migração)
    const fromPrecos=Object.keys(loadPrecos()).filter(p=>!GROCERY.includes(p)&&!extras.includes(p));
    return [...GROCERY,...extras,...fromPrecos];
  });
  const [aba,       setAba]      = useState("comparar"); // "comparar" | "registrar" | "gerenciar"
  const [selProd,   setSelProd]  = useState(null); // produto selecionado para registrar preço
  const [selMkt,    setSelMkt]   = useState(null); // mercado selecionado
  const [inputVal,  setInputVal] = useState("");
  const [novoProd,  setNovoProd] = useState("");
  const [filtro,    setFiltro]   = useState(""); // busca rápida

  function salvarPreco(){
    if(!selProd||!selMkt||!inputVal) return;
    const v=parseFloat(inputVal.replace(",","."));
    if(isNaN(v)||v<=0) return;
    const hoje=fmtDate(new Date().toISOString().slice(0,10)).slice(0,5); // DD/MM
    const novo={...precos,[selProd]:{...(precos[selProd]||{}),[selMkt]:{valor:v,data:hoje}}};
    setPrecos(novo);savePrecos(novo);
    setInputVal("");setSelMkt(null);
  }

  function removerPreco(prod,mkt){
    const novo={...precos};
    if(novo[prod]){delete novo[prod][mkt];if(Object.keys(novo[prod]).length===0)delete novo[prod];}
    setPrecos(novo);savePrecos(novo);
  }

  function addProd(){
    const n=novoProd.trim();if(!n||produtos.includes(n))return;
    setProdutos(p=>{
      const nova=[...p,n];
      const extras=nova.filter(x=>!GROCERY.includes(x));
      saveProdsExtra(extras);
      return nova;
    });
    setNovoProd("");setSelProd(n);setAba("registrar");
  }

  function remProd(n){
    setProdutos(p=>{
      const nova=p.filter(x=>x!==n);
      saveProdsExtra(nova.filter(x=>!GROCERY.includes(x)));
      return nova;
    });
    const novo={...precos};delete novo[n];
    setPrecos(novo);savePrecos(novo);
  }

  // Para cada produto, pega o menor preço e qual mercado
  const comparacao=produtos.filter(p=>filtro?p.toLowerCase().includes(filtro.toLowerCase()):true).map(prod=>{
    const mktPrecos=precos[prod]||{};
    const entradas=Object.entries(mktPrecos);
    if(entradas.length===0) return {prod,entradas:[],min:null,minMkt:null};
    const min=Math.min(...entradas.map(([,v])=>v.valor));
    const minMkt=entradas.find(([,v])=>v.valor===min)?.[0];
    return {prod,entradas,min,minMkt};
  });

  // Total estimado por mercado (só produtos que têm preço naquele mercado)
  const totaisMkt={};
  markets.forEach(m=>{
    const total=produtos.reduce((s,p)=>s+(precos[p]?.[m.label]?.valor||0),0);
    if(total>0) totaisMkt[m.label]=total;
  });
  const totSorted=Object.entries(totaisMkt).sort(([,a],[,b])=>a-b);
  const temPrecos=Object.keys(precos).length>0;

  return (
    <div style={{padding:16,paddingBottom:100}}>
      {/* Abas */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["comparar","📊 Comparar"],["registrar","✏️ Registrar"],["gerenciar","⚙️ Produtos"]].map(([id,label])=>(
          <button key={id} style={{flex:1,background:aba===id?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:aba===id?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:aba===id?"#818cf8":"#64748b",borderRadius:10,padding:"8px 4px",fontSize:12,fontWeight:aba===id?700:400,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>setAba(id)}>{label}</button>
        ))}
      </div>

      {/* ABA: COMPARAR */}
      {aba==="comparar"&&<>
        {!temPrecos&&(
          <AlertBox tipo="info" texto="Nenhum preço registrado ainda. Vá em ✏️ Registrar para anotar os preços que você viu no mercado — o app compara automaticamente!"/>
        )}
        {temPrecos&&totSorted.length>=2&&(
          <div style={{background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,163,74,0.06))",border:"1px solid rgba(74,222,128,0.25)",borderRadius:16,padding:16,marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:10,color:"#4ade80",textTransform:"uppercase",marginBottom:4}}>🏆 Mais barato (itens comparáveis)</div>
            <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:2}}>{totSorted[0][0]}</div>
            <div style={{fontSize:13,color:"#94a3b8"}}>Economia de <strong style={{color:"#4ade80"}}>{fmt(totSorted[totSorted.length-1][1]-totSorted[0][1])}</strong> vs mais caro</div>
          </div>
        )}
        {temPrecos&&totSorted.length>=2&&<>
          <SecTitle t="Total por mercado" sub="Baseado nos preços que você registrou"/>
          {totSorted.map(([m,t],i)=>(
            <div key={m} style={{...ROW,...(i===0?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.06)"}:{})}}>
              <span style={{fontSize:16,width:24}}>{["🥇","🥈","🥉","4°","5°"][i]||"·"}</span>
              <span style={{flex:1,fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{m}</span>
              <span style={{fontSize:14,fontWeight:700,color:i===0?"#4ade80":"#e2e8f0"}}>{fmt(t)}</span>
            </div>
          ))}
        </>}
        <SecTitle t="Preços por produto"/>
        <input style={{...inp({marginBottom:12,padding:"9px 13px",fontSize:13})}} placeholder="🔍 Filtrar produto..." value={filtro} onChange={e=>setFiltro(e.target.value)}/>
        {comparacao.map(({prod,entradas,min,minMkt})=>(
          <div key={prod} style={CARD}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:entradas.length>0?10:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{prod}</div>
              {entradas.length===0&&<button style={{fontSize:12,color:"#818cf8",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setSelProd(prod);setAba("registrar");}}>+ Registrar</button>}
              {entradas.length>0&&<span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>🏆 {minMkt}</span>}
            </div>
            {entradas.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {entradas.sort(([,a],[,b])=>a.valor-b.valor).map(([mkt,info])=>(
                  <div key={mkt} style={{flex:"1 0 calc(33% - 6px)",background:info.valor===min?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.03)",borderRadius:8,padding:"7px 6px",textAlign:"center",border:info.valor===min?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.06)"}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:2}}>{mkt.split(" ")[0]}</div>
                    <div style={{fontSize:13,fontWeight:700,color:info.valor===min?"#4ade80":"#94a3b8"}}>{fmt(info.valor)}</div>
                    <div style={{fontSize:9,color:"#475569",marginTop:1}}>{info.data}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </>}

      {/* ABA: REGISTRAR */}
      {aba==="registrar"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.6}}>Anote o preço que você viu hoje no mercado. O app guarda o histórico e compara automaticamente.</div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>1. Escolha o produto</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
          {produtos.map(p=>(
            <button key={p} style={{background:selProd===p?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:selProd===p?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:selProd===p?"#818cf8":"#94a3b8",borderRadius:99,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:selProd===p?700:400}}
              onClick={()=>{setSelProd(p);setSelMkt(null);setInputVal("");}}>
              {selProd===p?"✓ ":""}{p}
            </button>
          ))}
        </div>
        {selProd&&<>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>2. Qual mercado?</div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {markets.map(m=>(
              <button key={m.id} style={{background:selMkt===m.label?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:selMkt===m.label?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:selMkt===m.label?"#818cf8":"#94a3b8",borderRadius:10,padding:"8px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:selMkt===m.label?700:400}}
                onClick={()=>setSelMkt(m.label)}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </>}
        {selProd&&selMkt&&<>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>3. Preço (R$)</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={{...inp({flex:1}),fontSize:18,fontWeight:700,textAlign:"center"}} type="number" step="0.01" placeholder="0,00" value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&salvarPreco()}/>
            <button style={{...btn("linear-gradient(135deg,#22c55e,#16a34a)"),width:"auto",padding:"11px 20px"}} onClick={salvarPreco}>✓ Salvar</button>
          </div>
          {precos[selProd]?.[selMkt]&&(
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Último registrado: <strong style={{color:"#94a3b8"}}>{fmt(precos[selProd][selMkt].valor)}</strong> em {precos[selProd][selMkt].data}</div>
          )}
        </>}
      </>}

      {/* ABA: GERENCIAR */}
      {aba==="gerenciar"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>Adicione produtos ou remova os que não usa.</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input style={{...inp({flex:1})}} placeholder="Novo produto (ex: Sabão em pó 1kg)" value={novoProd} onChange={e=>setNovoProd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProd()}/>
          <button style={{...btn("linear-gradient(135deg,#22c55e,#16a34a)"),width:"auto",padding:"11px 16px"}} onClick={addProd}>+</button>
        </div>
        {produtos.map(p=>{
          const nReg=Object.keys(precos[p]||{}).length;
          return <div key={p} style={ROW}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{p}</div>
              <div style={{fontSize:11,color:"#475569"}}>{nReg>0?`${nReg} mercado(s) registrado(s)`:"Sem preços ainda"}</div>
            </div>
            <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>remProd(p)}>✕</button>
          </div>;
        })}
      </>}
    </div>
  );
}

// ── IA CHAT ────────────────────────────────────────────────
function IAChat({ exps, cats, mesFiltro }) {
  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const gastos   = exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const totalInc = exps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
  const totalTransf = exps.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret")).reduce((s,e)=>s+e.value,0);
  const totalExp = gastos.reduce((s,e)=>s+e.value,0);
  const totalInv = exps.filter(e=>e.cat==="investimento").reduce((s,e)=>s+e.value,0);
  const txPoup   = totalInc>0?((totalInc-totalExp)/totalInc*100).toFixed(1)+"%":"N/A";

  async function send(){
    const msg=input.trim();if(!msg||loading)return;
    setInput("");setLoading(true);
    setMsgs(p=>[...p,{role:"user",text:msg}]);
    if(!getGeminiKey()){setMsgs(p=>[...p,{role:"ai",text:"⚠️ Configure sua chave do Gemini em ⚙️ Config → Chave IA."}]);setLoading(false);return;}
    const catRes=cats.map(c=>{const s=gastos.filter(e=>e.cat===c.id).reduce((a,e)=>a+e.value,0);return `${c.label}: ${fmt(s)}/${fmt(c.budget)}`;}).join("; ");
    const top3=[...gastos].sort((a,b)=>b.value-a.value).slice(0,3).map(e=>e.desc+" "+fmt(e.value)).join(", ");
    const periodoLabel=mesFiltro&&mesFiltro!=="todos"?(()=>{const[a,m]=mesFiltro.split("-");return `${MESES[+m]}/${a}`;})():"todos os meses";
    const sys=`Você é um consultor financeiro pessoal brasileiro, empático e direto.
Período analisado: ${periodoLabel}
Dados do usuário:
- Salário/Renda real: ${fmt(totalInc)} (excluindo transferências e retornos)
- Gastos: ${fmt(totalExp)} | Saldo: ${fmt(totalInc-totalExp)}
- Investimentos aportados: ${fmt(totalInv)} | Taxa de poupança: ${typeof txPoup==="number"?txPoup.toFixed(1)+"%":txPoup}
${totalTransf>0?`- Transferências/retornos recebidos (não contam como renda): ${fmt(totalTransf)}`:""}
- Categorias: ${catRes}
- Maiores gastos: ${top3}
Responda em português. Seja específico com os números. Escreva a resposta COMPLETA — nunca corte no meio. Use entre 2 e 4 parágrafos.`;
    try{const txt=await askGemini(sys,msg,3000);setMsgs(p=>[...p,{role:"ai",text:txt||"Não consegui responder."}]);}
    catch(e){setMsgs(p=>[...p,{role:"ai",text:`Erro: ${e.message}`}]);}
    setLoading(false);
    setTimeout(()=>ref.current?.scrollTo({top:99999,behavior:"smooth"}),100);
  }

  const suggs=["Onde estou gastando mais?","Como economizar este mês?","Minha taxa de poupança está boa?","Quais gastos posso cortar?","Diagnóstico das minhas finanças","Estou investindo o suficiente?"];
  // Limpa conversa quando mês muda para o resumo ficar sempre atualizado
  const [lastMes,setLastMes]=useState(mesFiltro);
  useEffect(()=>{
    if(mesFiltro!==lastMes){setMsgs([]);setLastMes(mesFiltro);}
  },[mesFiltro]);

  // Resumo automático ao abrir a aba com dados
  useEffect(()=>{
    if(loading) setLoading(false);
    if(msgs.length>0||exps.length===0||!getGeminiKey()) return;
    const catRes=cats.map(c=>{const s=gastos.filter(e=>e.cat===c.id).reduce((a,e)=>a+e.value,0);return `${c.label}: ${fmt(s)}`;}).filter(s=>!s.includes("R$ 0")).join("; ");
    const periodoLabelAuto=mesFiltro&&mesFiltro!=="todos"?(()=>{const[a,m]=mesFiltro.split("-");return `${MESES[+m]}/${a}`;})():"período geral";
    const sys=`Você é um consultor financeiro pessoal brasileiro, empático e direto. Faça um diagnóstico financeiro completo (entre 80 e 150 palavras) dos dados de ${periodoLabelAuto}. Comece com um emoji e uma frase de diagnóstico. Cite 2-3 pontos específicos com números. Conclua com 1 sugestão prática. Escreva até o fim — nunca corte no meio de uma frase.
Dados: Renda ${fmt(totalInc)} | Gastos ${fmt(totalExp)} | Saldo ${fmt(totalInc-totalExp)} | Poupança ${typeof txPoup==="number"?txPoup.toFixed(1)+"%":txPoup} | Categorias: ${catRes}`;
    setLoading(true);
    askGemini(sys,"Resumo do período",1200).then(txt=>{
      if(txt) setMsgs([{role:"ai",text:"📊 "+txt}]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 116px)"}}>
      {!getGeminiKey()&&<div style={{padding:"10px 16px"}}>
        <AlertBox tipo="warn" texto="⚠️ Chave Gemini não configurada. Vá em ⚙️ Config → Chave IA para ativar o assistente."/>
      </div>}
      <div style={{display:"flex",gap:12,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:24,background:"rgba(99,102,241,0.2)",borderRadius:12,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center"}}>🤖</div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>Consultor Financeiro IA</div>
          <div style={{fontSize:11,color:"#64748b"}}>Baseado nos seus dados · {exps.length} lançamentos</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}} ref={ref}>
        {msgs.length===0&&!loading&&(
          <div style={{textAlign:"center",marginTop:12}}>
            <div style={{fontSize:36,marginBottom:8}}>💬</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Pergunte qualquer coisa sobre suas finanças!</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {suggs.map(s=>(
                <button key={s} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8",borderRadius:10,padding:"10px 12px",fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",lineHeight:1.4}}
                  onClick={()=>setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{padding:"12px 14px",borderRadius:14,maxWidth:"85%",fontSize:14,lineHeight:1.6,
            ...(m.role==="user"?{alignSelf:"flex-end",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"white",borderBottomRightRadius:4}:{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",color:"#e2e8f0",border:"1px solid rgba(255,255,255,0.08)",borderBottomLeftRadius:4})}}>
            <MdText text={m.text}/>
          </div>
        ))}
        {loading&&<div style={{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"12px 14px",display:"flex",gap:5}}><span className="dot"/><span className="dot"/><span className="dot"/></div>}
      </div>
      <div style={{display:"flex",gap:8,padding:"10px 14px",background:"rgba(8,14,29,0.98)",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <input style={{...inp(),flex:1}} placeholder="Pergunte algo..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button style={{background:"linear-gradient(135deg,#4f46e5,#4338ca)",border:"none",color:"white",borderRadius:12,width:44,height:44,fontSize:16,cursor:"pointer"}} onClick={send}>➤</button>
      </div>
    </div>
  );
}

function detectIncType(desc) {
  const d = (desc||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if (/salario|salário|pro.?labore|prolabore|pagamento.?folha|holerite|vencimento/.test(d)) return "salario";
  // Retorno de investimento
  if (/devolucao.*aplicac|devolução.*aplicac|rendimento|juros|dividendo|cdb|lci|lca|fundo|tesouro/.test(d)) return "investimento_ret";
  if (/credito em conta|crédito em conta/.test(d)) return "investimento_ret";
  // Reembolso → transferência
  if (/reembolso/.test(d)) return "transferencia";
  // Transferência/PIX recebido = renda (salário ou extra)
  if (/transferencia.?recebida|pix.?recebido|ted.?recebido|credito.?pix/.test(d)) return "salario";
  // Transferência enviada = ignorar nos gastos
  if (/transferencia.?enviada|pix.?enviado|ted.?enviado/.test(d)) return "transferencia";
  // Genérico — só marca transferência se não for recebida
  if (/^transf/.test(d)) return "transferencia";
  if (/freelance|freela|servico|serviço|consultor|comissao|comissão|bico|extra/.test(d)) return "extra";
  return null;
}

// ── IMPORTADOR ─────────────────────────────────────────────
function detectBank(text){const t=text.toLowerCase();if(t.includes("date")&&t.includes("title")&&t.includes("amount"))return "nubank_card";if(t.includes("identificador")||( t.includes("data")&&t.includes("valor")&&(t.includes("descri")||t.includes("desc"))))return "nubank_conta";if(t.includes("bradesco")||t.includes("histórico")||t.includes("historico"))return "bradesco";return "unknown";}
function parseCSVRows(text){const lines=text.trim().split(/\r?\n/);const header=lines[0].split(",").map(h=>h.trim().replace(/"/g,"").toLowerCase());return lines.slice(1).filter(l=>l.trim()).map(line=>{const cols=[];let cur="",inQ=false;for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){cols.push(cur.trim());cur="";}else cur+=ch;}cols.push(cur.trim());return Object.fromEntries(header.map((h,i)=>[h,(cols[i]||"").replace(/"/g,"").trim()]));});}
function parseTxs(rows,tipo){
  if(tipo==="nubank_card")return rows.map(r=>({date:r.date||"",desc:r.title||r.description||"",value:Math.abs(parseFloat((r.amount||"0").replace(",","."))),kind:"exp",source:"Nubank Cartão"})).filter(r=>r.date&&r.value>0);
  if(tipo==="nubank_conta")return rows.map(r=>{
    // Busca robusta dos campos — Nubank pode variar headers com/sem acento
    const keys=Object.keys(r);
    const valorKey=keys.find(k=>/^valor$|^value$|^amount$/i.test(k))||keys.find(k=>k.includes("valor")||k.includes("value"));
    const descKey=keys.find(k=>/descri/i.test(k))||keys.find(k=>k.includes("desc")||k.includes("título")||k.includes("titulo")||k.includes("title"));
    const dateKey=keys.find(k=>/^data$|^date$/i.test(k))||keys.find(k=>k.includes("data")||k.includes("date"));
    const rawVal=(r[valorKey]||"0").replace(/\s/g,"");
    // Nubank CSV usa ponto decimal americano "2857.31"; formato BR seria "2.857,31"
    const v=rawVal.includes(",") ? parseFloat(rawVal.replace(/\./g,"").replace(",",".")) : parseFloat(rawVal);
    const desc=r[descKey]||"";
    const dl=desc.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    const isAplicacao=/aplicac|rdb|investimento/.test(dl);
    const isDevolucao=/devolucao|resgate/.test(dl);
    const isFatura=/pagamento.*fatura|fatura.*cartao|cartao.*fatura/.test(dl);
    const isEntrada=isDevolucao||(v>0&&!isFatura);
    return {
      date:r[dateKey]||"",
      desc,
      value:Math.abs(v),
      kind: isFatura?"_skip":(isEntrada?"inc":"exp"),
      incType: isEntrada?(isDevolucao?"investimento_ret":undefined):undefined,
      cat: isAplicacao?"investimento":undefined,
      source:"Nubank Conta"
    };
  }).filter(r=>r.date&&r.value>0&&r.kind!=="_skip");
  if(tipo==="bradesco")return rows.map(r=>{const keys=Object.keys(r);const dK=keys.find(k=>k.includes("data")),descK=keys.find(k=>k.includes("hist")||k.includes("desc")),vK=keys.find(k=>k.includes("valor")||k.includes("créd")||k.includes("déb"));const v=parseFloat((r[vK]||"0").replace(/\./g,"").replace(",","."));return{date:r[dK]||"",desc:r[descK]||"",value:Math.abs(v),kind:v>=0?"inc":"exp",source:"Bradesco"};}).filter(r=>r.date&&r.value>0&&r.desc);
  return [];
}

function Importador({ exps, setExps, cats, setCats, contas, setContas, setTab, showToast }){
  const [step,setStep]=useState("upload");
  const [preview,setPreview]=useState([]);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const [editing,setEditing]=useState(null);
  const [resumoImport,setResumoImport]=useState(null);

  async function handleFile(e){
    const file=e.target.files?.[0];if(!file)return;
    setLoading(true);setMsg("Lendo arquivo...");
    try{
      const text=await file.text();
      const tipo=detectBank(text);
      if(tipo==="unknown"){setMsg("❌ Formato não reconhecido. Use CSV exportado pelo app do banco.");setLoading(false);return;}
      const rows=parseCSVRows(text);
      const parsed=parseTxs(rows,tipo);
      const semDup=parsed.filter(n=>!exps.some(e=>e.value===n.value&&e.date===n.date&&(e.desc||"").slice(0,10)===(n.desc||"").slice(0,10)));
      const dupCount=parsed.length-semDup.length;
      const catted=semDup.map(p=>({
        ...p,
        cat: p.kind==="inc" ? undefined : (p.cat || categorizar(p.desc,p.kind) || "outros"),
        incType: p.kind==="inc" ? (p.incType || detectIncType(p.desc) || "outro") : undefined,
      })).filter(p=>!(p.cat==="_ignorar" && p.kind==="exp"));
      if(catted.length===0){
        setMsg(dupCount>0?`ℹ️ Todos os ${dupCount} lançamentos já estão cadastrados. Nada novo para importar.`:"ℹ️ Nenhum lançamento encontrado no arquivo.");
        setLoading(false);return;
      }
      setPreview(catted);
      setMsg(dupCount>0?`ℹ️ ${dupCount} duplicata(s) já existente(s) foram ignoradas`:"");
      setStep("preview");
    }catch(err){setMsg(`❌ ${err.message}`);}
    setLoading(false);
  }

  function confirmar(){
    const ano=new Date().getFullYear();
    // ── Auto-cadastrar banco se não existir ──
    const contasAtuais=[...(contas||[])];
    const BANCO_MAP={
      "Nubank Conta":  {id:"nubank",   label:"Nubank",   emoji:"💜",color:"#8b5cf6"},
      "Nubank Cartão": {id:"nubank",   label:"Nubank",   emoji:"💜",color:"#8b5cf6"},
      "Bradesco":      {id:"bradesco", label:"Bradesco", emoji:"🔴",color:"#ef4444"},
    };
    const bancosNoImport=[...new Set(preview.map(p=>p.source))];
    const novasCont=[];
    bancosNoImport.forEach(src=>{
      const def=BANCO_MAP[src];
      if(def&&!contasAtuais.find(c=>c.id===def.id)){
        contasAtuais.push(def);
        novasCont.push(def.label);
      }
    });
    if(novasCont.length>0) setContas(contasAtuais);

    // ── Auto-cadastrar categorias desconhecidas ──
    const catsAtuais=[...cats];
    const novasCats=[];
    const CAT_COLORS=["#60a5fa","#f59e0b","#34d399","#f472b6","#a78bfa","#fb923c"];
    preview.filter(p=>p.kind==="exp"&&p.cat&&p.cat!=="outros").forEach(p=>{
      if(!catsAtuais.find(c=>c.id===p.cat)){
        const novaCat={id:p.cat,label:p.cat.charAt(0).toUpperCase()+p.cat.slice(1),emoji:"📦",budget:300,color:CAT_COLORS[catsAtuais.length%CAT_COLORS.length]};
        catsAtuais.push(novaCat);
        novasCats.push(novaCat.label);
      }
    });
    if(novasCats.length>0) setCats(catsAtuais);

    const novos=preview.map(p=>{
      const pts=p.date.split(/[-\/]/);
      const dateStr=pts.length===3&&pts[0].length===4?`${pts[2]}/${pts[1]}/${pts[0]}`:pts.length===3?`${pts[0]}/${pts[1]}/${pts[2]}`:`${pts[0]}/${pts[1]}/${ano}`;
      const cat=catsAtuais.find(c=>c.id===p.cat);
      const def=BANCO_MAP[p.source];
      const contaId=def?def.id:"geral";
      return {id:`imp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,desc:p.desc,kind:p.kind,cat:p.cat,incType:p.incType,type:p.kind==="inc"?p.source:undefined,emoji:p.kind==="inc"?(INC_TIPOS.find(t=>t.id===p.incType)?.emoji||"🏦"):(cat?.emoji||"📦"),value:p.value,date:dateStr,source:p.source,conta:contaId};
    });
    const nGastos=novos.filter(n=>n.kind==="exp").length;
    const nEntradas=novos.filter(n=>n.kind==="inc").length;
    const totalImp=novos.filter(n=>n.kind==="exp").reduce((s,n)=>s+n.value,0);
    setExps(prev=>[...novos,...prev]);
    setResumoImport({gastos:nGastos,entradas:nEntradas,total:totalImp,n:novos.length,novasCont,novasCats});
    setStep("done");
  }

  return (
    <div>
      {step==="upload"&&<>
        <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:20,marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:10}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Importar extrato bancário</div>
          <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:16}}>CSV do Nubank ou Bradesco. Dados ficam só no celular.</div>
          <label style={{display:"block",width:"100%",background:"linear-gradient(135deg,#4f46e5,#4338ca)",borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center",color:"white",fontFamily:"inherit",opacity:loading?0.6:1,boxSizing:"border-box"}}>
            {loading?"⏳ Processando...":"📂 Selecionar arquivo CSV"}
            <input type="file" accept=".csv,.CSV" style={{display:"none"}} onChange={handleFile} disabled={loading}/>
          </label>
        </div>
        {loading&&<div style={{textAlign:"center",padding:16}}><div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:8}}><span className="dot"/><span className="dot"/><span className="dot"/></div></div>}
        {msg&&!loading&&<AlertBox tipo={msg.startsWith("❌")?"err":"info"} texto={msg}/>}
        <SecTitle t="Como exportar" sub="Precisamos de um arquivo .CSV do seu banco"/>
        <div style={CARD}>
          <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.7}}>
            Acesse o extrato ou fatura no app ou internet banking do seu banco e procure a opção <strong style={{color:"#e2e8f0"}}>Exportar</strong> ou <strong style={{color:"#e2e8f0"}}>Baixar CSV</strong>. O arquivo será enviado por e-mail ou ficará disponível para download.
          </div>
        </div>
      </>}

      {step==="preview"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{preview.length} lançamentos encontrados</div>
            <div style={{fontSize:12,color:"#64748b"}}>Toque para editar categoria ou tipo</div>
          </div>
          <button style={{fontSize:11,color:"#64748b",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 10px",cursor:"pointer"}} onClick={()=>{setStep("upload");setPreview([]);setMsg("");}}>← Voltar</button>
        </div>
        {msg&&<AlertBox tipo="info" texto={msg}/>}
        {preview.map((p,i)=>(
          <div key={i} style={CARD}>
            {editing===i?<>
              {p.kind==="inc"&&(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Tipo de entrada</div>
                  <select style={inp()} value={p.incType||"outro"} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,incType:e.target.value}:x))}>
                    {INC_TIPOS.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
              )}
              {p.kind==="exp"&&<select style={{...inp(),marginBottom:8}} value={p.cat||"outros"} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,cat:e.target.value}:x))}>
                {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>}
              <select style={{...inp(),marginBottom:8}} value={p.kind} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,kind:e.target.value,incType:e.target.value==="inc"?"outro":undefined}:x))}>
                <option value="exp">💸 Gasto</option>
                <option value="inc">💰 Entrada</option>
              </select>
              <div style={{display:"flex",gap:8}}>
                <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setEditing(null)}>✓ Feito</button>
                <button style={btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.2)"})} onClick={()=>{setPreview(prev=>prev.filter((_,j)=>j!==i));setEditing(null);}}>Remover</button>
              </div>
            </>:(
              <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setEditing(i)}>
                <div style={{fontSize:11,color:"#475569",width:36,flexShrink:0}}>{p.date?.slice(0,5)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.desc}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>
                    {p.kind==="inc"
                      ? (INC_TIPOS.find(t=>t.id===p.incType)?.label||"Entrada")
                      : (cats.find(c=>c.id===p.cat)?.label||p.cat)
                    } · {p.source}
                  </div>
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700,color:p.kind==="inc"?"#4ade80":"#f87171"}}>{p.kind==="inc"?"+":"-"}{fmt(p.value)}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>✏️ editar</div>
                </div>
              </div>
            )}
          </div>
        ))}
        <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)",undefined,{marginTop:8})} onClick={confirmar}>✓ Confirmar {preview.length} lançamentos</button>
      </>}

      {step==="done"&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:52,marginBottom:12}}>✅</div>
          <div style={{fontSize:16,fontWeight:700,color:"#4ade80",marginBottom:16}}>Importação concluída!</div>
          {resumoImport&&<div style={{...CARD,textAlign:"left",marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:resumoImport.novasCont?.length||resumoImport.novasCats?.length?8:0}}>
              <div style={{background:"rgba(248,113,113,0.08)",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",marginBottom:2}}>Gastos</div>
                <div style={{fontSize:22,fontWeight:800,color:"#f87171"}}>{resumoImport.gastos}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{fmt(resumoImport.total)}</div>
              </div>
              <div style={{background:"rgba(74,222,128,0.08)",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",marginBottom:2}}>Entradas</div>
                <div style={{fontSize:22,fontWeight:800,color:"#4ade80"}}>{resumoImport.entradas}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{resumoImport.n} lançamentos</div>
              </div>
            </div>
            {resumoImport.novasCont?.length>0&&<AlertBox tipo="info" texto={`🏦 Conta cadastrada automaticamente: ${resumoImport.novasCont.join(", ")}`}/>}
            {resumoImport.novasCats?.length>0&&<AlertBox tipo="info" texto={`🏷️ Categoria(s) nova(s) cadastrada(s): ${resumoImport.novasCats.join(", ")}`}/>}
          </div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={()=>setTab&&setTab("dashboard")}>📊 Ver Dashboard</button>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>{setStep("upload");setPreview([]);setMsg("");setResumoImport(null);}}>📂 Importar outro arquivo</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHAVE IA CONFIG ───────────────────────────────────────
function ChaveIAConfig() {
  const [chave, setChave] = useState(getGeminiKey);
  const [salvo, setSalvo] = useState(false);
  return <div>
    <AlertBox tipo="info" texto="A chave fica salva só no seu celular. Nunca é enviada para nenhum servidor nosso."/>
    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>🤖 Chave da API Gemini</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:12,lineHeight:1.6}}>
        Obtenha gratuitamente em <span style={{color:"#818cf8"}}>aistudio.google.com</span> → Get API Key. O plano gratuito é suficiente para uso pessoal.
      </div>
      <input style={{...inp(),marginBottom:10,fontFamily:"monospace",fontSize:12}} placeholder="Cole sua chave aqui (AIza...)" value={chave} onChange={e=>setChave(e.target.value)}/>
      <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={()=>{setGeminiKey(chave.trim());setSalvo(true);setTimeout(()=>setSalvo(false),2000);}}>
        {salvo?"✓ Chave salva!":"Salvar chave"}
      </button>
      {getGeminiKey()&&<button style={{...btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.2)",marginTop:8})}} onClick={()=>{setGeminiKey("");setChave("");}}>🗑️ Remover chave</button>}
    </div>
    {!getGeminiKey()&&<AlertBox tipo="warn" texto="⚠️ Sem chave configurada — a aba IA ficará desabilitada."/>}
  </div>;
}

// ── META CONFIG ────────────────────────────────────────────
function MetaConfig({ meta, setMeta }) {
  const metaVal=meta||0;
  function salvarMeta(v){const n=Math.max(0,+v||0);setMeta(n);}
  return <div>
    <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
      Defina quanto quer poupar por mês. O Dashboard vai mostrar o progresso em relação à sua renda menos gastos.
    </div>
    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:12}}>🎯 Meta mensal de economia</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>Valor alvo (R$)</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input style={{...inp({flex:1}),fontSize:18,fontWeight:700,textAlign:"center"}} type="number" step="50" value={metaVal||""} placeholder="0" onChange={e=>salvarMeta(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[200,300,500,800,1000,1500].map(v=>(
          <button key={v} style={{background:metaVal===v?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",border:metaVal===v?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.1)",color:metaVal===v?"#818cf8":"#64748b",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>salvarMeta(v)}>{fmt(v)}</button>
        ))}
      </div>
      {metaVal>0&&<div style={{marginTop:12,fontSize:12,color:"#64748b",padding:"8px 12px",background:"rgba(99,102,241,0.06)",borderRadius:8}}>
        💡 Meta de {fmt(metaVal)}/mês — o progresso aparece no Dashboard quando você filtra um mês específico.
      </div>}
    </div>
  </div>;
}

// ── CONFIG ─────────────────────────────────────────────────
function Config({ cats, setCats, markets, setMarkets, exps, setExps, fixas, setFixas, contas, setContas, meta, setMeta, setTab, showToast }){
  const [sec,setsec]=useState("importar");
  const [showNM,setShowNM]=useState(false);
  const [newMkt,setNewMkt]=useState({label:"",emoji:"🏪"});
  const [showNC,setShowNC]=useState(false);
  const [newCat,setNewCat]=useState({label:"",emoji:"📁",budget:200,color:"#60a5fa"});
  const [novaFixa,setNovaFixa]=useState({desc:"",valor:"",cat:"moradia",emoji:"📌"});
  const [confirmModal, setConfirmModal] = useState(null);
  // Render ConfirmModal se ativo
  if(confirmModal) return <ConfirmModal
    msg={confirmModal.msg} sub={confirmModal.sub}
    okLabel={confirmModal.okLabel||"Confirmar"} okColor={confirmModal.okColor||"#ef4444"}
    onOk={()=>{confirmModal.onOk();setConfirmModal(null);}}
    onCancel={()=>setConfirmModal(null)}/>;

  const SECS=[{id:"importar",l:"📥 Importar"},{id:"fixas",l:"📌 Fixas"},{id:"meta",l:"🎯 Meta"},{id:"contas",l:"🏦 Contas"},{id:"mercados",l:"🏪 Mercados"},{id:"categorias",l:"🏷️ Categ."},{id:"chaveIA",l:"🤖 Chave IA"},{id:"dados",l:"🗄️ Dados"}];

  return (
    <div style={{padding:16,paddingBottom:100}}>
      <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>
        {SECS.map(s=>(
          <button key={s.id} style={{background:sec===s.id?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",border:sec===s.id?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.1)",color:sec===s.id?"#818cf8":"#64748b",borderRadius:99,padding:"7px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:sec===s.id?700:400}}
            onClick={()=>setsec(s.id)}>{s.l}</button>
        ))}
      </div>
      {sec==="fixas"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.6}}>
          Despesas que aparecem todo mês (aluguel, internet...). Aparecem no Resumo como referência — não são lançadas automaticamente.
        </div>
        {/* Nova fixa */}
        <div style={{...CARD,background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#818cf8",marginBottom:12}}>+ Nova despesa fixa</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={inp({width:52,textAlign:"center",fontSize:20,padding:8})} placeholder="📌" value={novaFixa.emoji} onChange={e=>setNovaFixa(p=>({...p,emoji:e.target.value}))}/>
            <input style={inp({flex:1})} placeholder="Descrição (ex: Aluguel)" value={novaFixa.desc} onChange={e=>setNovaFixa(p=>({...p,desc:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={inp({flex:1})} type="number" placeholder="Valor R$" value={novaFixa.valor} onChange={e=>setNovaFixa(p=>({...p,valor:e.target.value}))}/>
            <select style={inp({flex:1})} value={novaFixa.cat} onChange={e=>setNovaFixa(p=>({...p,cat:e.target.value}))}>
              {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={()=>{
            if(!novaFixa.desc||!novaFixa.valor) return;
            setFixas(p=>[...p,{id:`fx${Date.now()}`,desc:novaFixa.desc,valor:+novaFixa.valor,cat:novaFixa.cat,emoji:novaFixa.emoji||"📌",ativo:true}]);
            setNovaFixa({desc:"",valor:"",cat:"moradia",emoji:"📌"});
          }}>Adicionar</button>
        </div>
        {/* Lista fixas */}
        {fixas.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#475569",fontSize:13}}>Nenhuma despesa fixa cadastrada</div>}
        {fixas.map((f,i)=>(
          <div key={f.id} style={{...CARD,borderLeft:`3px solid ${f.ativo?"#818cf8":"rgba(255,255,255,0.1)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>{f.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{f.desc}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{cats.find(c=>c.id===f.cat)?.label||"Outros"} · {fmt(f.valor)}/mês</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {/* Toggle ativo */}
                <button style={{background:f.ativo?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.06)",border:f.ativo?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.1)",color:f.ativo?"#818cf8":"#475569",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer"}}
                  onClick={()=>setFixas(p=>p.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x))}>
                  {f.ativo?"✓ Ativa":"Pausada"}
                </button>
                <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setFixas(p=>p.filter((_,j)=>j!==i))}>✕</button>
              </div>
            </div>
            {/* Editar valor inline */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
              <span style={{fontSize:12,color:"#64748b",flexShrink:0}}>Valor R$</span>
              <input style={inp({flex:1,padding:"7px 12px",fontSize:14,fontWeight:700})} type="number" value={f.valor}
                onChange={e=>setFixas(p=>p.map((x,j)=>j===i?{...x,valor:+e.target.value}:x))}/>
            </div>
            {/* Lançar este mês */}
            {f.ativo&&f.valor>0&&(()=>{
              const hoje=new Date();
              const mesAtualKey=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
              const jaLancou=exps.some(e=>e.kind==="exp"&&e.desc===f.desc&&e.value===f.valor&&(e.date||"").slice(3,10)===`${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`);
              return <button
                style={{...btn(jaLancou?"rgba(74,222,128,0.08)":"rgba(99,102,241,0.12)",jaLancou?"#4ade80":"#818cf8",{border:`1px solid ${jaLancou?"rgba(74,222,128,0.25)":"rgba(99,102,241,0.25)"}`,marginTop:8,padding:"8px 0",fontSize:12,fontWeight:600})}}
                onClick={()=>{
                  if(jaLancou){showToast("✓ Já lançado este mês");return;}
                  const hojeStr=fmtDate(hoje.toISOString().slice(0,10));
                  const cat=cats.find(c=>c.id===f.cat);
                  setExps(p=>[...p,{id:Date.now(),desc:f.desc,kind:"exp",cat:f.cat,emoji:f.emoji||cat?.emoji||"📌",value:f.valor,date:hojeStr,payment:"dinheiro",conta:(contas||[]).find(c=>c.id!=="geral")?.id||"geral",fixo:true}]);
                  showToast(`✓ ${f.desc} lançado`);
                }}>
                {jaLancou?"✓ Já lançado este mês":"📌 Lançar este mês"}
              </button>;
            })()}
          </div>
        ))}
        {fixas.length>0&&(
          <div style={{...CARD,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",textAlign:"center"}}>
            <div style={{fontSize:12,color:"#64748b"}}>Total fixas ativas</div>
            <div style={{fontSize:20,fontWeight:800,color:"#818cf8"}}>{fmt(fixas.filter(f=>f.ativo).reduce((s,f)=>s+f.valor,0))}<span style={{fontSize:12,fontWeight:400}}>/mês</span></div>
          </div>
        )}
      </>}
      {sec==="importar"&&<Importador exps={exps} setExps={setExps} cats={cats} setCats={setCats} contas={contas} setContas={setContas} setTab={setTab} showToast={showToast}/>}
      {sec==="mercados"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>Mercados</div>
          <button style={{fontSize:11,background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,padding:"4px 12px",cursor:"pointer"}} onClick={()=>setShowNM(!showNM)}>+ Novo</button>
        </div>
        {showNM&&<div style={{...CARD,background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)"}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={inp({width:52,textAlign:"center",fontSize:20,padding:8})} placeholder="🏪" value={newMkt.emoji} onChange={e=>setNewMkt(p=>({...p,emoji:e.target.value}))}/>
            <input style={inp({flex:1})} placeholder="Nome do mercado" value={newMkt.label} onChange={e=>setNewMkt(p=>({...p,label:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setShowNM(false)}>Cancelar</button>
            <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={()=>{if(newMkt.label){setMarkets(p=>[...p,{...newMkt,id:`m${Date.now()}`}]);setShowNM(false);setNewMkt({label:"",emoji:"🏪"});}}}>Salvar</button>
          </div>
        </div>}
        {markets.map(m=>(
          <div key={m.id} style={ROW}>
            <div style={{width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{m.emoji}</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{m.label}</div></div>
            <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>markets.length>1&&setMarkets(p=>p.filter(x=>x.id!==m.id))}>✕</button>
          </div>
        ))}
      </>}
      {sec==="categorias"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>Categorias</div>
          <button style={{fontSize:11,background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,padding:"4px 12px",cursor:"pointer"}} onClick={()=>setShowNC(!showNC)}>+ Nova</button>
        </div>
        {showNC&&<div style={{...CARD,background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)"}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={inp({width:52,textAlign:"center",fontSize:20,padding:8})} placeholder="📁" value={newCat.emoji} onChange={e=>setNewCat(p=>({...p,emoji:e.target.value}))}/>
            <input style={inp({flex:1})} placeholder="Nome da categoria" value={newCat.label} onChange={e=>setNewCat(p=>({...p,label:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {PRESETS.map(c=><button key={c} style={{width:28,height:28,borderRadius:6,background:c,border:newCat.color===c?"2px solid white":"2px solid transparent",cursor:"pointer"}} onClick={()=>setNewCat(p=>({...p,color:c}))}/>)}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setShowNC(false)}>Cancelar</button>
            <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={()=>{if(newCat.label){setCats(p=>[...p,{...newCat,id:`c${Date.now()}`}]);setShowNC(false);setNewCat({label:"",emoji:"📁",budget:200,color:"#60a5fa"});}}}>Criar</button>
          </div>
        </div>}
        {cats.map(cat=>(
          <div key={cat.id} style={ROW}>
            <div style={{width:34,height:34,borderRadius:8,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cat.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{cat.label}</div>
              <div style={{fontSize:11,color:"#64748b"}}>Limite: {fmt(cat.budget)} <span style={{color:cat.color}}>●</span></div>
            </div>
            <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>cats.length>1&&setCats(p=>p.filter(c=>c.id!==cat.id))}>✕</button>
          </div>
        ))}
      </>}
      {sec==="meta"&&<MetaConfig meta={meta} setMeta={setMeta}/>}
      {sec==="contas"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.6}}>
          Gerencie suas contas. Transferências entre contas próprias são marcadas como neutras — não inflam renda nem gastos.
        </div>
        {contas.map((c,i)=>(
          <div key={c.id} style={{...ROW,borderLeft:`3px solid ${c.color}`}}>
            <div style={{width:36,height:36,borderRadius:10,background:`${c.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.emoji}</div>
            <div style={{flex:1}}>
              <input style={{...inp({padding:"6px 10px",fontSize:13,fontWeight:600,background:"transparent",border:"none",color:"#e2e8f0"})}} value={c.label}
                onChange={e=>setContas(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
            </div>
            {c.id!=="geral"&&<button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setContas(p=>p.filter((_,j)=>j!==i))}>✕</button>}
          </div>
        ))}
        <button style={{...btn("rgba(99,102,241,0.15)","#818cf8",{border:"1px solid rgba(99,102,241,0.3)",marginTop:8})}} onClick={()=>{
          const nome=prompt("Nome da nova conta:");
          if(nome?.trim()) setContas(p=>[...p,{id:`c${Date.now()}`,label:nome.trim(),emoji:"🏦",color:"#94a3b8"}]);
        }}>+ Nova conta</button>
        <div style={{...CARD,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",marginTop:16}}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>💡 Como registrar transferência interna</div>
          <div style={{fontSize:12,color:"#475569",lineHeight:1.7}}>
            Quando transferir dinheiro entre suas contas (ex: Bradesco → Nubank):<br/>
            1. Lance como <strong style={{color:"#94a3b8"}}>Entrada</strong> na conta destino<br/>
            2. Selecione tipo <strong style={{color:"#94a3b8"}}>↔️ Transferência entre contas</strong><br/>
            3. O valor aparece no extrato mas não conta como renda
          </div>
        </div>
      </>}
       {sec==="chaveIA"&&<ChaveIAConfig/>}
      {sec==="dados"&&<div style={CARD}>
        <button style={{...btn("rgba(99,102,241,0.1)","#818cf8",{border:"1px solid rgba(99,102,241,0.2)",marginBottom:10})}} onClick={()=>{
          try{localStorage.removeItem("mf_onboarding_done");}catch{}
          window.location.reload();
        }}>🎓 Ver tutorial novamente</button>
        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>🗄️ Dados</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
          💾 Salvamento automático ativo<br/>
          {exps.length} lançamentos · {cats.length} categorias · {markets.length} mercados · {fixas.length} fixas · {(contas||[]).filter(c=>c.id!=="geral").length} contas
        </div>
        <button style={btn("linear-gradient(135deg,#1d4ed8,#1e40af)",undefined,{marginBottom:10})} onClick={()=>{
          const prodsExtra=loadProdsExtra();const precosMkt=loadPrecos();const json=JSON.stringify({exps,cats,markets,fixas,contas,reservas,meta,prodsExtra,precosMkt},null,2);
          // Abre modal com textarea para copiar manualmente - funciona em qualquer WebView
          const overlay=document.createElement("div");
          overlay.style.cssText="position:fixed;inset:0;background:rgba(8,14,29,0.98);z-index:9999;display:flex;flex-direction:column;padding:16px;box-sizing:border-box;";
          overlay.innerHTML=`
            <div style="color:#e2e8f0;font-size:15px;font-weight:700;margin-bottom:8px;">📋 Copie o JSON abaixo</div>
            <div style="color:#64748b;font-size:12px;margin-bottom:12px;">Selecione tudo → Copie → Cole no Google Keep, Drive ou Notes</div>
            <textarea id="backup-json" style="flex:1;background:#0f172a;color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:12px;padding:12px;font-size:11px;font-family:monospace;resize:none;outline:none;" readonly>${json}</textarea>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button id="btn-select-all" style="flex:1;background:linear-gradient(135deg,#1d4ed8,#1e40af);color:white;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">Selecionar tudo</button>
              <button id="btn-fechar" style="flex:1;background:rgba(255,255,255,0.08);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">Fechar</button>
            </div>`;
          document.body.appendChild(overlay);
          const ta=overlay.querySelector("#backup-json");
          const btnSel=overlay.querySelector("#btn-select-all");
          const btnFch=overlay.querySelector("#btn-fechar");
          setTimeout(()=>{ta.focus();ta.select();},100);
          btnSel.onclick=()=>{ta.focus();ta.select();try{document.execCommand("copy");btnSel.textContent="✓ Copiado!";}catch{}};
          btnFch.onclick=()=>document.body.removeChild(overlay);
        }}>📤 Exportar backup JSON</button>
        <label style={{display:"block",width:"100%",background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.3)",color:"#818cf8",borderRadius:12,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box"}}>
          📥 Importar backup JSON
          <input type="file" accept=".json" style={{display:"none"}} onChange={async e=>{
            const file=e.target.files?.[0];if(!file)return;
            try{
              const text=await file.text();
              const data=JSON.parse(text);
              if(!data.exps||!Array.isArray(data.exps)) throw new Error("Arquivo inválido");
              // Guardar data para usar no modal
              const _data=data;
              setConfirmModal({
                msg:"Restaurar backup?",
                sub:`${_data.exps.length} lançamentos · ${(_data.cats||[]).length} categorias\n\nIsso VAI SUBSTITUIR todos os dados atuais.`,
                okLabel:"Restaurar",okColor:"#4f46e5",
                onOk:()=>{
                  setExps(_data.exps||[]);
                  setCats(_data.cats||CATS_DEF);
                  setMarkets(_data.markets||MKTS_DEF);
                  setFixas(_data.fixas||FIXAS_DEF);
                  if(_data.contas) setContas(_data.contas);
                  if(_data.reservas) setReservas(_data.reservas);
                  if(_data.meta!==undefined) setMeta(_data.meta);
                  if(_data.prodsExtra) saveProdsExtra(_data.prodsExtra);
                  if(_data.precosMkt) savePrecos(_data.precosMkt);
                  showToast("✓ Backup restaurado!");
                }
              });
            }catch(err){showToast("❌ Erro: "+err.message);}
            e.target.value="";
          }}/>
        </label>
        <button style={btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.3)"})} onClick={()=>{
          setConfirmModal({
            msg:"⚠️ Apagar todos os dados?",
            sub:"Esta ação não pode ser desfeita. Todos os lançamentos, configurações e histórico serão removidos.",
            okLabel:"Apagar tudo",okColor:"#ef4444",
            onOk:()=>{
              catsInit.current=true;fixasInit.current=true;reservasInit.current=true;
              setExps([]);setCats(CATS_DEF);setMarkets(MKTS_DEF);setFixas(FIXAS_DEF);setContas(CONTAS_DEF);setReservas([]);setMeta(0);
              try{["mf_exps","mf_cats","mf_mkts","mf_fixas","mf_contas","mf_reservas","mf_meta","mf_prods_extra","mf_precos"].forEach(k=>localStorage.removeItem(k));}catch{}
              showToast("✓ Dados apagados");
            }
          });
        }}>🗑️ Apagar todos os dados</button>
      </div>}
    </div>
  );
}


// ── RESERVAS ───────────────────────────────────────────────
// reserva: { id, nome, emoji, saldo, meta, movs: [{id,tipo,valor,desc,date}] }
function Reservas({ reservas, setReservas, hide }) {
  const [selId,    setSelId]    = useState(null); // reserva aberta
  const [showNew,  setShowNew]  = useState(false);
  const [novaRes,  setNovaRes]  = useState({nome:"",emoji:"💰",meta:""});
  const [showMov,  setShowMov]  = useState(false);
  const [formMov,  setFormMov]  = useState({tipo:"depositar",valor:"",desc:"",date:new Date().toISOString().slice(0,10)});

  const sel = reservas.find(r=>r.id===selId);

  function criarReserva() {
    if(!novaRes.nome.trim()) return;
    const nova = {id:`res_${Date.now()}`,nome:novaRes.nome.trim(),emoji:novaRes.emoji||"💰",saldo:0,meta:+novaRes.meta||0,movs:[]};
    setReservas(p=>[...p,nova]);
    setNovaRes({nome:"",emoji:"💰",meta:""});
    setShowNew(false);
    setSelId(nova.id);
  }

  function registrarMov() {
    if(!formMov.valor||!selId) return;
    const v = parseFloat(formMov.valor);
    if(isNaN(v)||v<=0) return;
    const d = fmtDate((formMov.date||new Date().toISOString().slice(0,10)));
    const mov = {id:`mov_${Date.now()}`,tipo:formMov.tipo,valor:v,desc:formMov.desc||formMov.tipo,date:d};
    setReservas(p=>p.map(r=>{
      if(r.id!==selId) return r;
      const novoSaldo = formMov.tipo==="depositar" ? r.saldo+v : Math.max(0,r.saldo-v);
      return {...r,saldo:novoSaldo,movs:[mov,...(r.movs||[])]};
    }));
    setFormMov({tipo:formMov.tipo,valor:"",desc:"",date:new Date().toISOString().slice(0,10)});
    setShowMov(false);
  }

  const [confirmReserva, setConfirmReserva] = useState(null);
  function excluirReserva(id) {
    setConfirmReserva(id);
  }

  function excluirMov(resId, movId) {
    setReservas(p=>p.map(r=>{
      if(r.id!==resId) return r;
      const novaMovs=r.movs.filter(m=>m.id!==movId);
      // Recalcula saldo do zero para evitar deriva
      const novoSaldo=novaMovs.reduce((s,m)=>m.tipo==="depositar"?s+m.valor:s-m.valor,0);
      return {...r, saldo:Math.max(0,novoSaldo), movs:novaMovs};
    }));
  }

  const totalReservas = reservas.reduce((s,r)=>s+r.saldo,0);

  // ── Tela detalhe de uma reserva ──
  if(sel) return (
    <div style={{padding:16,paddingBottom:100}}>
      <button style={{background:"none",border:"none",color:"#818cf8",fontSize:13,cursor:"pointer",padding:"0 0 12px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}} onClick={()=>setSelId(null)}>
        ← Voltar
      </button>

      {/* Card principal */}
      <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(79,70,229,0.08))",border:"1px solid rgba(99,102,241,0.3)",borderRadius:18,padding:20,marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:6}}>{sel.emoji}</div>
        <div style={{fontSize:18,fontWeight:800,color:"#e2e8f0",marginBottom:4}}>{sel.nome}</div>
        <div style={{fontSize:28,fontWeight:800,color:"#818cf8",marginBottom:sel.meta>0?8:0}}>{hide?"••••":fmt(sel.saldo)}</div>
        {sel.meta>0&&(()=>{
          const pct=Math.min(100,(sel.saldo/sel.meta)*100);
          return <>
            <Bar pct={pct} color={pct>=100?"#4ade80":"#818cf8"}/>
            <div style={{fontSize:11,color:"#64748b",marginTop:4}}>
              {pct.toFixed(0)}% da meta · {hide?"••••":fmt(sel.meta-sel.saldo>0?sel.meta-sel.saldo:0)} {sel.saldo>=sel.meta?"✓ Meta atingida!":"para atingir a meta"}
            </div>
          </>;
        })()}
      </div>

      {/* Botões de ação */}
      <div style={{display:"flex",gap:8,marginBottom:16}}> 
        <button style={{...btn("rgba(74,222,128,0.15)","#4ade80",{border:"1px solid rgba(74,222,128,0.3)",flex:1}),padding:"10px 0"}}
          onClick={()=>{setFormMov(p=>({...p,tipo:"depositar"}));setShowMov(true);}}>+ Depositar</button>
        <button style={{...btn("rgba(248,113,113,0.15)","#f87171",{border:"1px solid rgba(248,113,113,0.3)",flex:1}),padding:"10px 0"}}
          onClick={()=>{setFormMov(p=>({...p,tipo:"retirar"}));setShowMov(true);}}>− Retirar</button>
        <button style={{...btn("rgba(99,102,241,0.15)","#818cf8",{border:"1px solid rgba(99,102,241,0.3)",width:44}),padding:"10px 0"}}
          onClick={()=>{const n=prompt("Novo nome:",sel.nome);if(n?.trim())setReservas(p=>p.map(r=>r.id===sel.id?{...r,nome:n.trim()}:r));
          }}>✏️</button>
        <button style={{...btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)",width:44}),padding:"10px 0"}}
          onClick={()=>excluirReserva(sel.id)}>🗑️</button>
      </div>

      {/* Formulário movimentação */}
      {showMov&&(
        <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:formMov.tipo==="depositar"?"#4ade80":"#f87171",marginBottom:12}}>
            {formMov.tipo==="depositar"?"💚 Depositar":"🔴 Retirar"}
          </div>
          <input style={{...inp(),marginBottom:10}} type="number" placeholder="Valor (R$)" value={formMov.valor} onChange={e=>setFormMov(p=>({...p,valor:e.target.value}))}/>
          <input style={{...inp(),marginBottom:10}} placeholder="Descrição (opcional)" value={formMov.desc} onChange={e=>setFormMov(p=>({...p,desc:e.target.value}))}/>
          <input style={{...inp({colorScheme:"dark"}),marginBottom:10}} type="date" value={formMov.date} onChange={e=>setFormMov(p=>({...p,date:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setShowMov(false)}>Cancelar</button>
            <button style={btn(formMov.tipo==="depositar"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#ef4444,#dc2626)")} onClick={registrarMov}>Confirmar</button>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Histórico</div>
      {(!sel.movs||sel.movs.length===0)&&(
        <div style={{textAlign:"center",padding:"30px 0",color:"#475569",fontSize:13}}>Nenhuma movimentação ainda</div>
      )}
      {(sel.movs||[]).map(m=>(
        <div key={m.id} style={{...ROW,borderLeft:`3px solid ${m.tipo==="depositar"?"#4ade80":"#f87171"}`}}>
          <span style={{fontSize:20}}>{m.tipo==="depositar"?"⬆️":"⬇️"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{m.desc}</div>
            <div style={{fontSize:11,color:"#475569"}}>{m.date}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:m.tipo==="depositar"?"#4ade80":"#f87171"}}>
              {m.tipo==="depositar"?"+":"-"}{hide?"••••":fmt(m.valor)}
            </span>
            <button style={{fontSize:11,color:"#475569",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} onClick={()=>excluirMov(sel.id,m.id)}>🗑️</button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Tela lista de reservas ──
  return (
    <div style={{padding:16,paddingBottom:100}}>
      {confirmReserva&&<ConfirmModal
        msg="Excluir reserva?"
        sub="Todo o histórico de movimentações será removido permanentemente."
        okLabel="Excluir" okColor="#ef4444"
        onOk={()=>{setReservas(p=>p.filter(r=>r.id!==confirmReserva));if(selId===confirmReserva)setSelId(null);setConfirmReserva(null);}}
        onCancel={()=>setConfirmReserva(null)}/>}
      {/* Totalizador */}
      {reservas.length>0&&(
        <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.12),rgba(79,70,229,0.06))",border:"1px solid rgba(99,102,241,0.25)",borderRadius:16,padding:16,marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Total em reservas</div>
          <div style={{fontSize:26,fontWeight:800,color:"#818cf8"}}>{hide?"••••":fmt(totalReservas)}</div>
        </div>
      )}

      {/* Botão nova reserva */}
      {!showNew&&(
        <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)",undefined,{marginBottom:16})} onClick={()=>setShowNew(true)}>
          + Nova reserva / caixinha
        </button>
      )}

      {/* Formulário nova reserva */}
      {showNew&&(
        <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:"#818cf8",marginBottom:14}}>🏦 Nova reserva</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={inp({width:52,textAlign:"center",fontSize:22,padding:8})} placeholder="💰" value={novaRes.emoji} onChange={e=>setNovaRes(p=>({...p,emoji:e.target.value}))}/>
            <input style={inp({flex:1})} placeholder="Nome (ex: Emergência, Viagem...)" value={novaRes.nome} onChange={e=>setNovaRes(p=>({...p,nome:e.target.value}))}/>
          </div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Meta (opcional)</div>
          <input style={{...inp(),marginBottom:12}} type="number" placeholder="R$ 0 = sem meta" value={novaRes.meta} onChange={e=>setNovaRes(p=>({...p,meta:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setShowNew(false)}>Cancelar</button>
            <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={criarReserva}>Criar</button>
          </div>
        </div>
      )}

      {/* Lista de reservas */}
      {reservas.length===0&&!showNew&&(
        <div style={{textAlign:"center",padding:"50px 20px",color:"#475569"}}>
          <div style={{fontSize:48,marginBottom:12}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:"#94a3b8",marginBottom:8}}>Nenhuma reserva ainda</div>
          <div style={{fontSize:13,lineHeight:1.7}}>
            Crie caixinhas para separar dinheiro com propósito — emergência, viagem, férias, o que quiser.
            <br/>O saldo não conta como gasto nem como renda.
          </div>
        </div>
      )}
      {reservas.map(r=>{
        const pct=r.meta>0?Math.min(100,(r.saldo/r.meta)*100):null;
        const ultimaMov=(r.movs||[])[0];
        return (
          <div key={r.id} style={{...CARD,cursor:"pointer",borderLeft:`3px solid rgba(99,102,241,0.5)`}} onClick={()=>setSelId(r.id)}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:"rgba(99,102,241,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{r.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{r.nome}</span>
                  <span style={{fontSize:15,fontWeight:800,color:"#818cf8"}}>{hide?"••••":fmt(r.saldo)}</span>
                </div>
                {pct!==null&&<Bar pct={pct} color={pct>=100?"#4ade80":"#818cf8"}/>}
                <div style={{fontSize:11,color:"#475569",marginTop:pct===null?4:0}}>
                  {r.meta>0?`Meta: ${hide?"••••":fmt(r.meta)} · ${pct.toFixed(0)}%`:"Sem meta"}
                  {ultimaMov&&<span> · último: {ultimaMov.date?.slice(0,5)}</span>}
                </div>
              </div>
              <span style={{fontSize:16,color:"#475569",flexShrink:0}}>›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── ONBOARDING ─────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    id:"welcome",
    emoji:"👋",
    titulo:"Bem-vindo ao\nGranzo",
    sub:"Seu controle financeiro pessoal,\nsimples e no seu celular.",
    dica:null,
    cor:"#818cf8",
  },
  {
    id:"conta",
    emoji:"🏦",
    titulo:"Cadastre seu banco",
    sub:"Primeiro, adicione a conta do seu banco.\nAssim seus lançamentos ficam organizados por fonte.",
    dica:"⚙️ Config → Contas → + Nova conta",
    cor:"#4ade80",
    destaque:"config",
  },
  {
    id:"orcamento",
    emoji:"💰",
    titulo:"Defina seu orçamento",
    sub:"Configure quanto você quer gastar por categoria — alimentação, moradia, lazer...\nO app avisa quando estiver chegando no limite.",
    dica:"Aba Orçamento → toque em cada categoria",
    cor:"#f59e0b",
    destaque:"orcamento",
  },
  {
    id:"fixas",
    emoji:"📌",
    titulo:"Cadastre despesas fixas",
    sub:"Aluguel, internet, plano de saúde...\nDespesas que aparecem todo mês. Com um toque você lança no mês atual.",
    dica:"⚙️ Config → Fixas → + Nova",
    cor:"#f472b6",
    destaque:"config",
  },
  {
    id:"import",
    emoji:"📥",
    titulo:"Importe seu extrato",
    sub:"Conecte seu histórico real importando o CSV do Nubank ou Bradesco.\nO app categoriza tudo automaticamente.",
    dica:"⚙️ Config → Importar → selecione o arquivo CSV",
    cor:"#34d399",
    destaque:"config",
  },
  {
    id:"ia",
    emoji:"🤖",
    titulo:"IA financeira pessoal",
    sub:"Ative o assistente com sua chave Gemini gratuita.\nEle analisa seus gastos e responde perguntas sobre suas finanças.",
    dica:"⚙️ Config → Chave IA → cole sua chave",
    cor:"#a78bfa",
    destaque:"ia",
  },
  {
    id:"pronto",
    emoji:"🚀",
    titulo:"Tudo pronto!",
    sub:"Você já pode começar a usar.\nLembre-se: quanto mais você registra, mais o app te ajuda.",
    dica:null,
    cor:"#818cf8",
  },
];

function Onboarding({ onDone, setTab }) {
  const [step, setStep] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const isFirst = step === 0;

  function avancar() {
    if(isLast){ concluir(); return; }
    setStep(p=>p+1);
  }
  function concluir(){
    setSaindo(true);
    setTimeout(()=>{ onDone(); }, 350);
  }
  function irPara(){
    if(s.destaque){ concluir(); setTimeout(()=>setTab(s.destaque==="config"?"config":s.destaque),400); }
  }

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:1000,
      background:"#080e1d",
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"space-between",
      padding:"env(safe-area-inset-top,24px) 28px 40px",
      opacity:saindo?0:1,
      transition:"opacity 0.35s ease",
      fontFamily:"'Outfit',sans-serif",
    }}>
      {/* Barra de progresso */}
      <div style={{width:"100%",maxWidth:360,paddingTop:20}}>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:32}}>
          {ONBOARDING_STEPS.map((_,i)=>(
            <div key={i} style={{
              height:4,flex:1,borderRadius:99,
              background: i<=step ? s.cor : "rgba(255,255,255,0.08)",
              transition:"background 0.4s ease",
            }}/>
          ))}
        </div>

        {/* Conteúdo central */}
        <div style={{textAlign:"center",paddingBottom:24}}>
          <div style={{
            fontSize:72,marginBottom:28,
            filter:`drop-shadow(0 0 24px ${s.cor}55)`,
            lineHeight:1,
          }}>{s.emoji}</div>

          <div style={{
            fontSize:26,fontWeight:800,color:"#f1f5f9",
            lineHeight:1.3,marginBottom:14,whiteSpace:"pre-line",
          }}>{s.titulo}</div>

          <div style={{
            fontSize:15,color:"#94a3b8",
            lineHeight:1.7,marginBottom:s.dica?24:0,
            whiteSpace:"pre-line",
          }}>{s.sub}</div>

          {s.dica&&(
            <div style={{
              display:"inline-flex",alignItems:"center",gap:8,
              background:`${s.cor}15`,
              border:`1px solid ${s.cor}40`,
              borderRadius:12,padding:"10px 16px",
              fontSize:13,color:s.cor,fontWeight:600,
              marginTop:4,
            }}>
              <span style={{fontSize:16}}>💡</span>
              {s.dica}
            </div>
          )}
        </div>
      </div>

      {/* Botões */}
      <div style={{width:"100%",maxWidth:360}}>
        {/* Botão de ação contextual */}
        {s.destaque&&(
          <button style={{
            width:"100%",marginBottom:12,
            background:`linear-gradient(135deg,${s.cor}CC,${s.cor}99)`,
            border:"none",color:"#fff",
            borderRadius:14,padding:"14px 0",
            fontSize:15,fontWeight:700,cursor:"pointer",
            fontFamily:"'Outfit',sans-serif",
            boxShadow:`0 4px 20px ${s.cor}44`,
          }} onClick={irPara}>
            Configurar agora →
          </button>
        )}

        <button style={{
          width:"100%",
          background: isLast
            ? `linear-gradient(135deg,#818cf8,#6366f1)`
            : "rgba(255,255,255,0.06)",
          border: isLast ? "none" : "1px solid rgba(255,255,255,0.1)",
          color: isLast ? "#fff" : "#94a3b8",
          borderRadius:14,padding:"14px 0",
          fontSize:15,fontWeight:700,cursor:"pointer",
          fontFamily:"'Outfit',sans-serif",
          boxShadow: isLast ? "0 4px 20px rgba(99,102,241,0.4)" : "none",
        }} onClick={avancar}>
          {isLast?"Começar a usar 🚀":"Próximo"}
        </button>

        {!isLast&&!isFirst&&(
          <button style={{
            width:"100%",marginTop:10,
            background:"none",border:"none",
            color:"#475569",fontSize:13,cursor:"pointer",
            fontFamily:"'Outfit',sans-serif",padding:"8px 0",
          }} onClick={concluir}>Pular tutorial</button>
        )}
      </div>
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────
export default function App() {
  // Onboarding — mostrar só na primeira vez
  const [showOnboarding, setShowOnboarding] = useState(()=>{
    try{ return !localStorage.getItem("mf_onboarding_done"); }catch{ return true; }
  });
  function finishOnboarding(){ try{localStorage.setItem("mf_onboarding_done","1");}catch{} setShowOnboarding(false); }

  const [tab,      setTab]     = useState("dashboard");
  const [openWith, setOpenWith]= useState(null);
  const [hideVals, setHideVals]= useState(false);
  const [catModal, setCatModal]= useState(null);
  const [toast,    setToast]   = useState("");

  const [exps,    setExps]    = useState(()=>{ try{const v=localStorage.getItem("mf_exps");return v?JSON.parse(v):[]}catch{return []} });
  const [cats,    setCats]    = useState(()=>{ try{const v=localStorage.getItem("mf_cats");return v?JSON.parse(v):CATS_DEF}catch{return CATS_DEF} });
  const [markets, setMarkets] = useState(()=>{ try{const v=localStorage.getItem("mf_mkts");return v?JSON.parse(v):MKTS_DEF}catch{return MKTS_DEF} });
  const [fixas,   setFixas]   = useState(()=>{ try{const v=localStorage.getItem("mf_fixas");return v?JSON.parse(v):FIXAS_DEF}catch{return FIXAS_DEF} });
  const [contas,  setContas]  = useState(()=>{ try{const v=localStorage.getItem("mf_contas");return v?JSON.parse(v):CONTAS_DEF}catch{return CONTAS_DEF} });
  const [reservas,setReservas]= useState(()=>{ try{const v=localStorage.getItem("mf_reservas");return v?JSON.parse(v):[]}catch{return []} });
  const [meta,    setMeta]    = useState(()=>{ try{const v=localStorage.getItem("mf_meta");return v?JSON.parse(v):0;}catch{return 0;} });

  const toastTimer = useRef(null);
  function showToast(msg){
    if(toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current=setTimeout(()=>setToast(""),2000);
  }

  useEffect(()=>{ try{localStorage.setItem("mf_exps",JSON.stringify(exps));}catch{} },[exps]);
  const catsInit=useRef(true);
  useEffect(()=>{ if(catsInit.current){catsInit.current=false;return;} try{localStorage.setItem("mf_cats",JSON.stringify(cats));showToast("✓ Salvo");}catch{} },[cats]);
  useEffect(()=>{ try{localStorage.setItem("mf_mkts",JSON.stringify(markets))}catch{} },[markets]);
  const fixasInit=useRef(true);
  useEffect(()=>{ if(fixasInit.current){fixasInit.current=false;return;} try{localStorage.setItem("mf_fixas",JSON.stringify(fixas));showToast("✓ Salvo");}catch{} },[fixas]);
  useEffect(()=>{ try{localStorage.setItem("mf_contas",JSON.stringify(contas))}catch{} },[contas]);
  const reservasInit=useRef(true);
  useEffect(()=>{ if(reservasInit.current){reservasInit.current=false;return;} try{localStorage.setItem("mf_reservas",JSON.stringify(reservas));showToast("✓ Salvo");}catch{} },[reservas]);
  useEffect(()=>{ try{localStorage.setItem("mf_meta",JSON.stringify(meta));}catch{} },[meta]);

  // Melhoria 1: filtro com ANO+MÊS para não misturar Jan/2026 com Jan/2027
  const mesesDisp=[...new Set(exps.map(e=>{
    const p=e.date?.split("/");
    // date pode ser "DD/MM" (sem ano) ou "DD/MM/YYYY"
    if(p?.length>=3) return `${p[2]}-${p[1]}`; // YYYY-MM
    if(p?.length>=2) return `${new Date().getFullYear()}-${p[1]}`; // assume ano atual
    return null;
  }).filter(Boolean))].sort();
  const [mesFiltro,setMesFiltro]=useState(()=>{
    // Inicia no mês atual; o useEffect abaixo ajusta se não houver dados nele
    const m=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
    return m;
  });

  // Ajusta mesFiltro para "todos" se mês atual não tiver lançamentos (primeiro acesso)
  useEffect(()=>{
    if(mesFiltro!=="todos"&&mesesDisp.length>0&&!mesesDisp.includes(mesFiltro)){
      setMesFiltro(mesesDisp[mesesDisp.length-1]||"todos");
    }
  },[mesesDisp.length]);

  // Reseta catModal ao trocar de mês (evita filtro de categoria "fantasma")
  useEffect(()=>{ setCatModal(null); },[mesFiltro]);

  // Bug 9: Projeção só faz sentido no mês atual
  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const expsFiltrados=mesFiltro==="todos"?exps:exps.filter(e=>{
    const p=e.date?.split("/");
    if(!p||p.length<2) return false;
    const anoMes=p.length>=3?`${p[2]}-${p[1]}`:`${new Date().getFullYear()}-${p[1]}`;
    return anoMes===mesFiltro;
  });

  // Saldo: apenas renda real (salário/extra) menos gastos (sem investimentos)
  const totalInc=expsFiltrados.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
  const totalExp=expsFiltrados.filter(e=>e.kind==="exp"&&e.cat!=="investimento").reduce((s,e)=>s+e.value,0);
  const saldo=totalInc-totalExp;

  const TABS=[
    {id:"dashboard",emoji:"📊",label:"Início"},
    {id:"graficos", emoji:"📈",label:"Gráficos"},
    {id:"orcamento",emoji:"💰",label:"Orçamento"},
    {id:"gastos",   emoji:"💸",label:"Gastos"},
    {id:"reservas", emoji:"🏦",label:"Reservas"},
    {id:"mercado",  emoji:"🛒",label:"Mercado"},
    {id:"ia",       emoji:"🤖",label:"IA"},
    // Config não aparece na nav inferior — acessível pelo ⚙️ no header
  ];

  return (
    <>
    {showOnboarding&&<Onboarding onDone={finishOnboarding} setTab={t=>{finishOnboarding();setTab(t);}}/>}
    <div style={{fontFamily:"'Outfit',sans-serif",background:"#080e1d",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",maxWidth:"min(600px,100vw)",margin:"0 auto",paddingTop:"env(safe-area-inset-top,0px)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;background:#080e1d;}
        input,button,select{font-family:'Outfit',sans-serif;}
        select option{background:#1e293b;color:#e2e8f0;}
        .dot{display:inline-block;width:7px;height:7px;background:#64748b;border-radius:50%;animation:bounce 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px;}
      `}</style>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",top:"calc(env(safe-area-inset-top,0px) + 12px)",left:"50%",transform:"translateX(-50%)",background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.35)",backdropFilter:"blur(12px)",borderRadius:99,padding:"6px 18px",fontSize:12,fontWeight:700,color:"#4ade80",zIndex:999,whiteSpace:"nowrap",pointerEvents:"none",transition:"opacity 0.3s"}}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0d1b3e,#162547)",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        <div style={{padding:"14px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>Granzo</div>
            <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9"}}>
              {mesFiltro==="todos"?"Todos os meses":(()=>{const[ano,mes]=mesFiltro.split("-");return MESES[+mes]+" "+ano;})()}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:1}}>Saldo {mesFiltro!=="todos"?"do mês":"total"}</div>
              <div style={{fontSize:17,fontWeight:800,color:saldo>=0?"#4ade80":"#f87171"}}>{hideVals?"R$ ••••":fmt(saldo)}</div>
            </div>
            <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#94a3b8",fontSize:18,padding:"6px 8px",cursor:"pointer"}} onClick={()=>setHideVals(v=>!v)}>{hideVals?"🙈":"👁️"}</button>
            <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#94a3b8",fontSize:18,padding:"6px 8px",cursor:"pointer"}} onClick={()=>setTab("config")}>⚙️</button>
          </div>
        </div>
        {mesesDisp.length>0&&(
          <div style={{display:"flex",gap:6,overflowX:"auto",padding:"0 16px 10px",scrollbarWidth:"none"}}>
            <button style={{background:mesFiltro==="todos"?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:mesFiltro==="todos"?"1px solid rgba(99,102,241,0.6)":"1px solid rgba(255,255,255,0.1)",color:mesFiltro==="todos"?"#818cf8":"#64748b",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro==="todos"?700:400}}
              onClick={()=>setMesFiltro("todos")}>Todos</button>
            {mesesDisp.map(m=>{
              const[ano,mes]=m.split("-");
              const multiAno=mesesDisp.some(x=>x.split("-")[0]!==ano);
              const label=MESES_CURTO[+mes]+(multiAno?" '"+ano.slice(2):"");
              return <button key={m} style={{background:mesFiltro===m?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:mesFiltro===m?"1px solid rgba(99,102,241,0.6)":"1px solid rgba(255,255,255,0.1)",color:mesFiltro===m?"#818cf8":"#64748b",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro===m?700:400}}
                onClick={()=>setMesFiltro(m)}>{label}</button>;
            })}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
        {tab==="dashboard"&&<Dashboard exps={expsFiltrados} cats={cats} contas={contas} hide={hideVals} onCatClick={cat=>{setCatModal(cat);setTab("gastos");}} mesFiltro={mesFiltro} allExps={exps} fixas={fixas} setFixas={setFixas} mesAtual={mesAtual} reservas={reservas} meta={meta} showToast={showToast}
          onAddFixa={r=>{setFixas(p=>[...p,{id:"fx"+Date.now(),desc:r.desc,valor:r.value,cat:r.cat||"outros",emoji:r.emoji||"📌",ativo:true}]);showToast("✓ Adicionado às fixas!");}}/>}
        {tab==="graficos" &&<Graficos  exps={expsFiltrados} cats={cats} hide={hideVals} allExps={exps} mesFiltro={mesFiltro}/>}
        {tab==="orcamento"&&<Orcamento exps={expsFiltrados} cats={cats} setCats={setCats} hide={hideVals} mesFiltro={mesFiltro}/>}
        {tab==="gastos"   &&<Gastos    exps={exps} setExps={setExps} cats={cats} contas={contas} openWith={openWith} onOpened={()=>setOpenWith(null)} hide={hideVals} mesFiltro={mesFiltro} catFiltro={catModal} onClearCat={()=>setCatModal(null)}/>}
        {tab==="reservas" &&<Reservas  reservas={reservas} setReservas={setReservas} hide={hideVals}/>}
        {tab==="mercado"  &&<Mercado   markets={markets} setMarkets={setMarkets} hide={hideVals}/>}
        {tab==="ia"       &&<IAChat    exps={expsFiltrados} cats={cats} mesFiltro={mesFiltro}/>}
        {tab==="config"   &&<Config    cats={cats} setCats={setCats} markets={markets} setMarkets={setMarkets} exps={exps} setExps={setExps} fixas={fixas} setFixas={setFixas} contas={contas} setContas={setContas} meta={meta} setMeta={setMeta} setTab={setTab} showToast={showToast}/>}
      </div>

      {/* FABs */}
      {tab!=="ia"&&tab!=="config"&&(
        <div style={{position:"fixed",bottom:76,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:49}}>
          <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(34,197,94,0.4)",fontWeight:700}} onClick={()=>{setOpenWith("income");setTab("gastos");}}>+💰</button>
          <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.4)",fontWeight:700}} onClick={()=>{setOpenWith("expense");setTab("gastos");}}>+💸</button>
        </div>
      )}

      {/* Nav */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"min(600px,100vw)",background:"rgba(8,14,29,0.97)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",overflowX:"auto",padding:"6px 2px 10px",backdropFilter:"blur(20px)",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} style={{flex:"0 0 auto",minWidth:60,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 2px",opacity:tab===t.id?1:0.38,transition:"opacity 0.15s"}} onClick={()=>setTab(t.id)}>
            <span style={{fontSize:18}}>{t.emoji}</span>
            <span style={{fontSize:9,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.03em"}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </>
  );
}
