import { useState, useRef, useEffect } from "react";

const GEMINI_KEY = "AIzaSyA-gx5FUXaJfJ4IWU7MciY-gLlUk6D0TII";

// ── UTILS ──────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));
const fmt   = v  => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtPct= v  => (v>=0?"+":"")+v.toFixed(1)+"%";
const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_CURTO = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

async function askGemini(sys, msg, maxTokens=1000, retries=3) {
  for (let i=0; i<retries; i++) {
    if (i>0) await delay(2000*i);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
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
  if (/ifood|rappi|uber.?eat|james|restaur|lanche|pizza|burguer|mcdon|subway|sushi|padaria|mercado|superm|carrefour|atacadao|enxuto|higa|extra|pao.?de.?acucar|hortifrut|acougue|peixar|bebida|sorvete/.test(d)) return "alimentacao";
  if (/uber|99pop|cabify|taxi|gasolina|combustiv|posto|shell|ipiranga|estacion|onibus|metro|trem|passagem|pedagio|autopeca|oficina|mecanica|detran|ipva|seguro.?auto/.test(d)) return "transporte";
  if (/farmac|drogari|remedio|medico|medica|hospital|clinica|consulta|exame|laborat|dentist|odontos|plano.?saude|unimed|amil|notredame|hapvida|academia|gym|crossfit/.test(d)) return "saude";
  if (/netflix|spotify|amazon|disney|hbo|youtube|prime|deezer|apple.?music|cinema|teatro|show|ingresso|jogo|steam|playstation|xbox|nintendo|balada|clube|viagem|hotel|airbnb|booking/.test(d)) return "lazer";
  if (/aluguel|condom|energia|enel|cpfl|sabesp|internet|vivo|claro|tim|sky |telefon|gas |seguro.?resid|iptu|manutencao/.test(d)) return "moradia";
  if (/escola|faculdade|univers|curso|mensalid|material|livro|papelaria|udemy|alura|coursera|duolingo/.test(d)) return "educacao";
  if (/renner|riachuelo|c&a|cea |hm |zara|marisa|shein|shopee|calcado|sapato|tenis |roupa/.test(d)) return "vestuario";
  if (/invest|aplicac|poupanca|tesouro|fundo|cdb|lci|lca|previd|previdenc|transferen|ted|doc|pix.?para/.test(d)) return "investimento";
  return "outros";
}

// ── CONSTANTES ─────────────────────────────────────────────
// incType: "salario" | "extra" | "transferencia" | "investimento_ret" | "outro"
// Apenas salario + extra contam como RENDA real
const INC_TIPOS = [
  { id:"salario",        label:"Salário/Pró-labore", emoji:"💼" },
  { id:"extra",          label:"Renda extra",         emoji:"💵" },
  { id:"transferencia",  label:"Transferência recebida", emoji:"🔄" },
  { id:"investimento_ret",label:"Retorno de investimento", emoji:"📈" },
  { id:"outro",          label:"Outro",               emoji:"💰" },
];

const CATS_DEF = [
  { id:"moradia",      label:"Moradia",      emoji:"🏠", budget:1500, color:"#60a5fa" },
  { id:"alimentacao",  label:"Alimentação",  emoji:"🛒", budget:800,  color:"#4ade80" },
  { id:"transporte",   label:"Transporte",   emoji:"🚗", budget:400,  color:"#f59e0b" },
  { id:"saude",        label:"Saúde",        emoji:"💊", budget:300,  color:"#f472b6" },
  { id:"lazer",        label:"Lazer",        emoji:"🎬", budget:200,  color:"#fb923c" },
  { id:"educacao",     label:"Educação",     emoji:"📚", budget:300,  color:"#a78bfa" },
  { id:"vestuario",    label:"Vestuário",    emoji:"👕", budget:200,  color:"#38bdf8" },
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
  {id:"enxuto",label:"Enxuto",emoji:"🟢"},
  {id:"higa",label:"Higa Atacado",emoji:"🟡"},
];
const GROCERY = ["Frango (kg)","Carne moída (kg)","Leite integral (L)","Arroz 5kg","Feijão 1kg","Óleo de soja","Macarrão 500g","Pão de forma","Ovos (dz)","Manteiga 200g","Sabão em pó","Detergente 500ml"];
const PRESETS = ["#60a5fa","#4ade80","#f59e0b","#f472b6","#a78bfa","#fb923c","#34d399","#94a3b8","#f87171","#38bdf8"];

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

// ── DASHBOARD ──────────────────────────────────────────────
function Dashboard({ exps, cats, hide, onCatClick, mesFiltro, allExps, fixas, mesAtual }) {
  const gastos  = exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const invests = exps.filter(e=>e.cat==="investimento");
  const totalExp= gastos.reduce((s,e)=>s+e.value,0);
  const totalInv= invests.reduce((s,e)=>s+e.value,0);

  // Renda REAL = só salário + renda extra (exclui transferências e retornos)
  const entRenda= exps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType));
  // Transferências e retornos de invest ficam separados
  const entTransf=exps.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret"));
  const totalInc= entRenda.reduce((s,e)=>s+e.value,0);
  const totalTransf=entTransf.reduce((s,e)=>s+e.value,0);
  const txPoup  = totalInc>0?((totalInc-totalExp)/totalInc)*100:0;

  // Total de fixas ativas com valor configurado
  const totalFixas = (fixas||[]).filter(f=>f.ativo&&f.valor>0).reduce((s,f)=>s+f.valor,0);

  // Comparativo mês anterior
  let mesAnterior=null, diffPct=null;
  if (mesFiltro!=="todos") {
    const mn=+mesFiltro, mesAnt=mn===1?"12":String(mn-1).padStart(2,"0");
    const expsAnt=allExps.filter(e=>{ const p=e.date?.split("/"); return p?.length>=2&&p[1]===mesAnt&&e.kind==="exp"&&e.cat!=="investimento"; });
    const totAnt=expsAnt.reduce((s,e)=>s+e.value,0);
    if(totAnt>0){mesAnterior=MESES_CURTO[+mesAnt];diffPct=((totalExp-totAnt)/totAnt)*100;}
  }

  // Projeção: só faz sentido no mês atual, não em meses passados
  let projecao=null;
  if(mesFiltro!=="todos"&&mesFiltro===mesAtual&&gastos.length>0){
    const hoje=new Date().getDate();
    const diasMes=new Date(new Date().getFullYear(),+mesFiltro,0).getDate();
    if(hoje>0&&hoje<diasMes) projecao=(totalExp/hoje)*diasMes;
  }

  const top3=[...gastos].sort((a,b)=>b.value-a.value).slice(0,3);

  // Recorrentes
  const recorrentes=(()=>{
    const freq={};
    allExps.filter(e=>e.kind==="exp").forEach(e=>{
      const key=(e.desc||"").slice(0,20).toLowerCase();
      if(!freq[key]) freq[key]={count:0,value:e.value,desc:e.desc,emoji:e.emoji||"📦"};
      freq[key].count++;
    });
    return Object.values(freq).filter(f=>f.count>=2).sort((a,b)=>b.value-a.value).slice(0,4);
  })();

  return (
    <div style={{padding:16,paddingBottom:100}}>
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

      {/* Alertas orçamento */}
      {cats.filter(c=>c.budget>0&&c.id!=="investimento").map(cat=>{
        const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
        const pct=spent/cat.budget*100;
        if(pct<80) return null;
        return <AlertBox key={cat.id} tipo={pct>=100?"err":"warn"}
          texto={pct>=100?`${cat.emoji} ${cat.label} estourou o limite! (${fmt(spent)} de ${fmt(cat.budget)})`:`${cat.emoji} ${cat.label} em ${pct.toFixed(0)}% do limite`}/>;
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
            const mesOk=mesFiltro==="todos"||(p?.length>=2&&p[1]===mesFiltro);
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
        {recorrentes.map((r,i)=>(
          <div key={i} style={ROW}>
            <span style={{fontSize:20}}>{r.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.desc}</div>
              <div style={{fontSize:11,color:"#475569"}}>{r.count}x registrado(s)</div>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:"#94a3b8",flexShrink:0}}>{hide?"••••":fmt(r.value)}</span>
          </div>
        ))}
      </>}

      {/* Últimos lançamentos */}
      <SecTitle t="Últimos lançamentos"/>
      {[...exps].sort((a,b)=>{
        const da=a.date?.split("/").reverse().join("")||"";
        const db=b.date?.split("/").reverse().join("")||"";
        return db.localeCompare(da)||b.id-a.id;
      }).slice(0,6).map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        return <div key={e.id} style={{...ROW,...(e.kind==="inc"?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.04)"}:{})}}>
          <div style={{width:38,height:38,borderRadius:10,background:e.kind==="inc"?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{e.emoji||cat?.emoji||"📦"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
            <div style={{fontSize:11,color:"#475569"}}>{e.kind==="inc"?(e.type||"Entrada"):(cat?.label||"Outros")} · {e.date}</div>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:e.kind==="inc"?"#4ade80":"#f87171",flexShrink:0}}>{hide?"••••":(e.kind==="inc"?"+":"-")+fmt(e.value)}</span>
        </div>;
      })}
    </div>
  );
}

// ── GRÁFICOS ───────────────────────────────────────────────
function Graficos({ exps, cats, hide, allExps }) {
  const gastos =exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const pieData=cats.filter(c=>c.id!=="investimento").map(c=>({...c,spent:gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0)})).filter(c=>c.spent>0);
  const pieTotal=pieData.reduce((s,c)=>s+c.spent,0);
  const sz=160,cx=sz/2,cy=sz/2,r=sz*.38,ir=sz*.22;
  let cum=-Math.PI/2;
  const slices=pieData.map(d=>{const a=(d.spent/pieTotal)*Math.PI*2,sa=cum;cum+=a;return{...d,sa,ea:cum};});
  function arc(sa,ea){const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa),x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${ea-sa>Math.PI?1:0} 1 ${x2} ${y2}Z`;}

  // Evolução mensal
  const mesesDisp=[...new Set(allExps.map(e=>{const p=e.date?.split("/");return p?.length>=2?p[1]:null;}).filter(Boolean))].sort();
  const evolucao=mesesDisp.map(m=>({
    mes:MESES_CURTO[+m],
    inc:allExps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)&&e.date?.split("/")?.[1]===m).reduce((s,e)=>s+e.value,0),
    transf:allExps.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret")&&e.date?.split("/")?.[1]===m).reduce((s,e)=>s+e.value,0),
    exp:allExps.filter(e=>e.kind==="exp"&&e.cat!=="investimento"&&e.date?.split("/")?.[1]===m).reduce((s,e)=>s+e.value,0),
    inv:allExps.filter(e=>e.cat==="investimento"&&e.date?.split("/")?.[1]===m).reduce((s,e)=>s+e.value,0),
  }));
  const maxEv=Math.max(...evolucao.flatMap(e=>[e.inc,e.exp]),1);
  const chartH=110,barW=22;

  return (
    <div style={{padding:16,paddingBottom:100}}>
      {/* Evolução mensal */}
      {evolucao.length>=2&&<>
        <SecTitle t="Evolução mensal"/>
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
                  <text x={x+barW+1} y={chartH+14} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="Outfit,sans-serif">{e.mes}</text>
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

      {/* Pizza */}
      <SecTitle t="Gastos por categoria"/>
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
      <SecTitle t="Orçado vs Realizado"/>
      <div style={CARD}>
        <div style={{overflowX:"auto"}}>
          <svg width={Math.max(cats.filter(c=>c.id!=="investimento").length*56,300)} height={160} style={{display:"block"}}>
            {cats.filter(c=>c.id!=="investimento").map((cat,i)=>{
              const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
              const mx=Math.max(...cats.map(c=>Math.max(c.budget,gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0))),1);
              const bH=(cat.budget/mx)*100,sH=(spent/mx)*100,x=i*56+6;
              return <g key={cat.id}>
                <text x={x+22} y={115-Math.max(bH,sH)-4} textAnchor="middle" fill={spent>cat.budget?"#f87171":"#94a3b8"} fontSize="9" fontFamily="Outfit,sans-serif">{cat.budget>0?Math.round((spent/cat.budget)*100)+"%":""}</text>
                <rect x={x} y={115-bH} width={20} height={bH} rx={3} fill="rgba(99,102,241,0.55)"/>
                <rect x={x+22} y={115-sH} width={20} height={sH} rx={3} fill={spent>cat.budget?"#f87171":"#f59e0b"}/>
                <text x={x+20} y={130} textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="Outfit,sans-serif">{cat.emoji}</text>
              </g>;
            })}
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
  const mesesCount=isTodos?Math.max(1,[...new Set(exps.map(e=>e.date?.split("/")?.[1]).filter(Boolean))].length):1;
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
        const pct=cat.budget>0?Math.min(100,(spent/cat.budget)*100):0;
        const over=cat.budget>0&&spent>cat.budget;
        return <div key={cat.id} style={{...CARD,padding:14,borderLeft:`3px solid ${over?"#f87171":cat.color}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cat.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{cat.label}</div>
              {over&&<div style={{fontSize:11,color:"#f87171"}}>⚠️ Excedido em {hide?"••••":fmt(spent-cat.budget)}</div>}
            </div>
            <span style={{fontSize:12,color:over?"#f87171":"#64748b"}}>{hide?"••••":fmt(spent)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:12,color:"#64748b",flexShrink:0}}>Limite R$</span>
            <input style={inp({flex:1,padding:"8px 12px",fontSize:15,fontWeight:700})} type="number" value={cat.budget}
              onChange={e=>setCats(p=>p.map((c,i)=>i===idx?{...c,budget:+e.target.value}:c))}/>
          </div>
          {cat.budget>0&&<>
            <Bar pct={pct} color={over?"#f87171":pct>75?"#f59e0b":cat.color}/>
            <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{pct.toFixed(0)}% · {hide?"••••":fmt(Math.max(0,cat.budget-spent))} restante</div>
          </>}
        </div>;
      })}
    </div>
  );
}

// ── GASTOS ─────────────────────────────────────────────────
function Gastos({ exps, setExps, cats, openWith, onOpened, hide, mesFiltro, catFiltro, onClearCat }) {
  const [show,    setShow]    = useState(false);
  const [mode,    setMode]    = useState("expense");
  const [form,    setForm]    = useState({desc:"",value:"",cat:"alimentacao",date:"",payment:"dinheiro",parcelas:1,vencimento:"10",incType:"salario"});
  const [editId,  setEditId]  = useState(null);
  const [editForm,setEditForm]= useState({});
  const [busca,   setBusca]   = useState("");
  const [ordenar, setOrdenar] = useState("data");
  const [confirm, setConfirm] = useState(null);

  useEffect(()=>{ if(openWith){setMode(openWith);setShow(true);if(onOpened)onOpened();} },[openWith]);

  function startEdit(e){setEditId(e.id);setEditForm({desc:e.desc,value:e.value,cat:e.cat||"outros",kind:e.kind,date:e.date||"",incType:e.incType||"salario"});}
  function saveEdit(){
    const cat=cats.find(c=>c.id===editForm.cat);
    const incEmoji=INC_TIPOS.find(t=>t.id===editForm.incType)?.emoji||"💰";
    setExps(p=>p.map(e=>e.id===editId?{...e,...editForm,value:+editForm.value,incType:editForm.kind==="inc"?editForm.incType:undefined,emoji:editForm.kind==="inc"?incEmoji:(cat?.emoji||"📦")}:e));
    setEditId(null);
  }

  function add() {
    if(!form.desc||!form.value) return;
    const cat=cats.find(c=>c.id===form.cat);
    const isCard=mode==="expense"&&form.payment==="cartao";
    const parcelas=isCard?Math.max(1,+form.parcelas||1):1;
    const total=+form.value,venc=+form.vencimento||10;
    const baseDate=form.date?new Date(form.date+"T12:00:00"):new Date();
    const novos=Array.from({length:parcelas},(_,i)=>{
      let d=new Date(baseDate);
      if(isCard){const off=d.getDate()<venc?0:1;d.setMonth(d.getMonth()+off+i);d.setDate(venc);}
      const parValor=i<parcelas-1?Math.floor((total/parcelas)*100)/100:+(total-Math.floor((total/parcelas)*100)/100*(parcelas-1)).toFixed(2);
      return {id:Date.now()+i,desc:parcelas>1?`${form.desc} (${i+1}/${parcelas})`:form.desc,kind:mode==="expense"?"exp":"inc",cat:mode==="expense"?form.cat:undefined,incType:mode==="income"?form.incType:undefined,type:mode==="income"?"Manual":undefined,emoji:isCard?"💳":(mode==="expense"?(cat?.emoji||"📦"):(INC_TIPOS.find(t=>t.id===form.incType)?.emoji||"💰")),value:parValor,date:d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}),payment:isCard?"cartao":"dinheiro"};
    });
    setExps(p=>[...novos,...p]);
    setForm({desc:"",value:"",cat:"alimentacao",date:"",payment:"dinheiro",parcelas:1,vencimento:"10",incType:"salario"});
    setShow(false);
  }

  const expsFilt=exps.filter(e=>{
    const p=e.date?.split("/");
    const mesOk=!mesFiltro||mesFiltro==="todos"||(p?.length>=2&&p[1]===mesFiltro);
    const catOk=!catFiltro||e.cat===catFiltro.id;
    const buscaOk=!busca||(e.desc||"").toLowerCase().includes(busca.toLowerCase());
    return mesOk&&catOk&&buscaOk;
  });

  const sorted=[...expsFilt].sort((a,b)=>{
    if(ordenar==="valor") return b.value-a.value;
    if(ordenar==="cat")   return (a.cat||"").localeCompare(b.cat||"");
    const da=a.date?.split("/").reverse().join("")||"";
    const db=b.date?.split("/").reverse().join("")||"";
    return db.localeCompare(da)||b.id-a.id;
  });

  const totalFilt=expsFilt.filter(e=>e.kind==="exp").reduce((s,e)=>s+e.value,0);

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

      {(mesFiltro!=="todos"||catFiltro||busca)&&(
        <div style={{fontSize:12,color:"#64748b",marginBottom:10,padding:"6px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
          {sorted.length} lançamento(s) · Gastos: {hide?"••••":fmt(totalFilt)}
        </div>
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
          <input style={{...inp(),marginBottom:10,colorScheme:"dark"}} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
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
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setShow(false)}>Cancelar</button>
            <button style={btn(mode==="income"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#ef4444,#dc2626)")} onClick={add}>Salvar</button>
          </div>
        </div>
      )}

      {/* Confirmação exclusão */}
      {confirm&&(
        <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{fontSize:13,color:"#f87171",marginBottom:10}}>⚠️ Excluir este lançamento?</div>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setConfirm(null)}>Cancelar</button>
            <button style={btn("rgba(248,113,113,0.2)","#f87171",{border:"1px solid rgba(248,113,113,0.3)"})} onClick={()=>{setExps(p=>p.filter(x=>x.id!==confirm));setConfirm(null);}}>Excluir</button>
          </div>
        </div>
      )}

      {sorted.length===0&&!show&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#475569"}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <div style={{fontSize:14}}>{busca?`Nenhum resultado para "${busca}"`:catFiltro?"Nenhum lançamento nesta categoria":"Nenhum lançamento"}</div>
          {!busca&&!catFiltro&&<div style={{fontSize:12,marginTop:6}}>Use os botões acima ou importe em ⚙️ Config</div>}
        </div>
      )}

      {/* Lista */}
      {sorted.map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        return <div key={e.id}>
          <div style={{...ROW,...(e.kind==="inc"?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.04)"}:{})}}>
            <div style={{width:38,height:38,borderRadius:10,background:e.kind==="inc"?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{e.emoji||cat?.emoji||"📦"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
              <div style={{fontSize:11,color:"#475569"}}>{e.kind==="inc"?(e.type||"Entrada"):(cat?.label||"Outros")} · {e.date}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
              <span style={{fontSize:14,fontWeight:700,color:e.kind==="inc"?"#4ade80":"#f87171"}}>{hide?"••••":(e.kind==="inc"?"+":"-")+fmt(e.value)}</span>
              <div style={{display:"flex",gap:4}}>
                <button style={{fontSize:11,color:"#818cf8",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} onClick={()=>startEdit(e)}>✏️</button>
                <button style={{fontSize:11,color:"#475569",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} onClick={()=>setConfirm(e.id)}>🗑️</button>
              </div>
            </div>
          </div>
          {editId===e.id&&(
            <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.4)",borderRadius:14,padding:16,marginTop:-4,marginBottom:8}}>
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
                    value={()=>{const pts=(editForm.date||"").split("/");if(pts.length>=2)return `${new Date().getFullYear()}-${pts[1].padStart(2,"0")}-${pts[0].padStart(2,"0")}`;return "";}}
                    onChange={e=>{if(!e.target.value)return;const d=new Date(e.target.value+"T12:00:00");setEditForm(p=>({...p,date:d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}));}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setEditId(null)}>Cancelar</button>
                <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={saveEdit}>Salvar ✓</button>
              </div>
            </div>
          )}
        </div>;
      })}
    </div>
  );
}

// ── MERCADO ────────────────────────────────────────────────
function Mercado({ markets }) {
  const [produtos,  setProdutos] = useState(GROCERY);
  const [sel,       setSel]      = useState({"Frango (kg)":true,"Arroz 5kg":true,"Feijão 1kg":true,"Leite integral (L)":true,"Ovos (dz)":true,"Macarrão 500g":true});
  const [novoProd,  setNovoProd] = useState("");
  const [gerenciar, setGerenciar]= useState(false);
  const [loading,   setLoading]  = useState(false);
  const [result,    setResult]   = useState(null);
  const [erro,      setErro]     = useState("");
  const count=Object.values(sel).filter(Boolean).length;

  function addProd(){const n=novoProd.trim();if(!n||produtos.includes(n))return;setProdutos(p=>[...p,n]);setSel(p=>({...p,[n]:true}));setNovoProd("");}
  function remProd(n){setProdutos(p=>p.filter(x=>x!==n));setSel(p=>{const q={...p};delete q[n];return q;});}

  async function buscar(){
    if(GEMINI_KEY==="SUA_CHAVE_AQUI"){setErro("Configure a chave do Gemini no App.jsx linha 3");return;}
    setLoading(true);setResult(null);setErro("");
    const items=Object.keys(sel).filter(k=>sel[k]);
    const mktNames=markets.map(m=>m.label);
    const sys="Voce retorna APENAS numeros. Sem texto, sem R$, sem unidades.";
    const msg="Precos em reais Campinas SP "+new Date().getFullYear()+". Para cada produto preco em cada mercado separado por virgula. Um produto por linha. Mercados: "+mktNames.join(", ")+". Produtos: "+items.join("; ");
    try {
      const txt=await askGemini(sys,msg,800);
      const extrNums=s=>s.match(/\d+[.,]\d+|\d+/g)?.map(n=>parseFloat(n.replace(",",".")))??[];
      const linhas=txt.split(/[;\n]/).map(l=>l.trim()).filter(l=>l.length>0);
      const matriz=items.map((_,i)=>{
        const nums=extrNums(linhas[i]||"");
        if(nums.length<mktNames.length){const all=extrNums(txt);const off=i*mktNames.length;return mktNames.map((_,j)=>all[off+j]||9.99);}
        return mktNames.map((_,j)=>nums[j]||9.99);
      });
      const ri=items.map((nome,i)=>({name:nome,prices:Object.fromEntries(mktNames.map((m,j)=>[m,+matriz[i][j].toFixed(2)]))}));
      const totais=Object.fromEntries(mktNames.map((m,j)=>[m,+ri.reduce((a,it)=>a+(it.prices[m]||0),0).toFixed(2)]));
      const sorted=Object.entries(totais).sort(([,a],[,b])=>a-b);
      setResult({items:ri,recommendation:sorted[0][0],totalByMarket:totais,savings:+(sorted[sorted.length-1][1]-sorted[0][1]).toFixed(2),tip:"Compare preço por kg ou litro para economizar mais"});
    }catch(err){setErro(err.message);}
    setLoading(false);
  }

  return (
    <div style={{padding:16,paddingBottom:100}}>
      <p style={{fontSize:13,color:"#64748b",marginBottom:12,lineHeight:1.5}}>Estimativas de preços para Campinas SP. Selecione os itens:</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
        {produtos.map(item=>(
          <div key={item} style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
            <button style={{background:sel[item]?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.05)",border:sel[item]?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.1)",color:sel[item]?"#818cf8":"#94a3b8",borderRadius:99,padding:"6px 12px",paddingRight:gerenciar?"28px":"12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
              onClick={()=>!gerenciar&&setSel(p=>({...p,[item]:!p[item]}))}>
              {sel[item]&&!gerenciar?"✓ ":""}{item}
            </button>
            {gerenciar&&<button style={{position:"absolute",right:6,background:"none",border:"none",color:"#f87171",fontSize:12,cursor:"pointer",lineHeight:1,padding:0}} onClick={()=>remProd(item)}>✕</button>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {gerenciar?<>
          <input style={{...inp({flex:1,padding:"8px 12px",fontSize:13})}} placeholder="Novo produto..." value={novoProd} onChange={e=>setNovoProd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProd()}/>
          <button style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}} onClick={addProd}>+ Add</button>
          <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:10,padding:"8px 12px",fontSize:13,cursor:"pointer"}} onClick={()=>setGerenciar(false)}>✓ OK</button>
        </>:<button style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",borderRadius:10,padding:"8px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setGerenciar(true)}>✏️ Gerenciar produtos</button>}
      </div>
      <button style={btn("linear-gradient(135deg,#1d4ed8,#1e40af)",undefined,{opacity:loading||count===0?0.6:1,marginBottom:8})} onClick={buscar} disabled={loading||count===0}>
        {loading?"🔍 Consultando...":count===0?"Selecione ao menos 1 item":`🛒 Comparar preços (${count} itens)`}
      </button>
      {loading&&<div style={{textAlign:"center",padding:20}}><div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:8}}><span className="dot"/><span className="dot"/><span className="dot"/></div><div style={{fontSize:13,color:"#64748b"}}>Buscando estimativas...</div></div>}
      {erro&&<AlertBox tipo="err" texto={erro}/>}
      {result&&<>
        <div style={{background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,163,74,0.06))",border:"1px solid rgba(74,222,128,0.25)",borderRadius:16,padding:20,marginTop:16,textAlign:"center"}}>
          <div style={{fontSize:11,color:"#4ade80",textTransform:"uppercase",marginBottom:6}}>🏆 Melhor opção</div>
          <div style={{fontSize:22,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>{result.recommendation}</div>
          <div style={{fontSize:14,color:"#94a3b8"}}>Economia estimada de <strong style={{color:"#4ade80"}}>{fmt(result.savings||0)}</strong></div>
          {result.tip&&<div style={{fontSize:12,color:"#64748b",marginTop:8,fontStyle:"italic"}}>💡 {result.tip}</div>}
        </div>
        <SecTitle t="Total por mercado"/>
        {Object.entries(result.totalByMarket||{}).sort(([,a],[,b])=>a-b).map(([m,t],i)=>(
          <div key={m} style={{...ROW,...(i===0?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.07)"}:{})}}>
            <span style={{fontSize:16,width:24}}>{["🥇","🥈","🥉","4°","5°"][i]||"·"}</span>
            <span style={{flex:1,fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{m}</span>
            <span style={{fontSize:14,fontWeight:700,color:i===0?"#4ade80":"#e2e8f0"}}>{fmt(t)}</span>
          </div>
        ))}
        <SecTitle t="Por produto"/>
        {result.items?.map(item=>{
          const min=Math.min(...Object.values(item.prices||{}));
          return <div key={item.name} style={CARD}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",marginBottom:10}}>{item.name}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(item.prices||{}).map(([mkt,p])=>(
                <div key={mkt} style={{flex:"1 0 18%",background:p===min?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.04)",borderRadius:8,padding:"6px 4px",textAlign:"center",border:p===min?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:9,color:"#64748b",marginBottom:3}}>{mkt.split(" ")[0]}</div>
                  <div style={{fontSize:12,fontWeight:700,color:p===min?"#4ade80":"#94a3b8"}}>{fmt(p)}</div>
                </div>
              ))}
            </div>
          </div>;
        })}
      </>}
    </div>
  );
}

// ── IA CHAT ────────────────────────────────────────────────
function IAChat({ exps, cats }) {
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
    if(GEMINI_KEY==="SUA_CHAVE_AQUI"){setMsgs(p=>[...p,{role:"ai",text:"⚠️ Configure a chave do Gemini no App.jsx linha 3."}]);setLoading(false);return;}
    const catRes=cats.map(c=>{const s=gastos.filter(e=>e.cat===c.id).reduce((a,e)=>a+e.value,0);return `${c.label}: ${fmt(s)}/${fmt(c.budget)}`;}).join("; ");
    const top3=[...gastos].sort((a,b)=>b.value-a.value).slice(0,3).map(e=>e.desc+" "+fmt(e.value)).join(", ");
    const sys=`Você é um consultor financeiro pessoal brasileiro, empático e direto.
Dados do usuário:
- Salário/Renda real: ${fmt(totalInc)} (excluindo transferências e retornos)
- Gastos: ${fmt(totalExp)} | Saldo: ${fmt(totalInc-totalExp)}
- Investimentos aportados: ${fmt(totalInv)} | Taxa de poupança: ${txPoup}
${totalTransf>0?`- Transferências/retornos recebidos (não contam como renda): ${fmt(totalTransf)}`:""}
- Categorias: ${catRes}
- Maiores gastos: ${top3}
Responda em português. Seja específico com os números. Máx 150 palavras.`;
    try{const txt=await askGemini(sys,msg,1200);setMsgs(p=>[...p,{role:"ai",text:txt||"Não consegui responder."}]);}
    catch(e){setMsgs(p=>[...p,{role:"ai",text:`Erro: ${e.message}`}]);}
    setLoading(false);
    setTimeout(()=>ref.current?.scrollTo(0,99999),100);
  }

  const suggs=["Onde estou gastando mais?","Como economizar este mês?","Minha taxa de poupança está boa?","Quais gastos posso cortar?","Diagnóstico das minhas finanças","Estou investindo o suficiente?"];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 116px)"}}>
      <div style={{display:"flex",gap:12,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:24,background:"rgba(99,102,241,0.2)",borderRadius:12,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center"}}>🤖</div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>Consultor Financeiro IA</div>
          <div style={{fontSize:11,color:"#64748b"}}>Baseado nos seus dados · {exps.length} lançamentos</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}} ref={ref}>
        {msgs.length===0&&(
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
            {m.text}
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
  if (/pix|ted|doc|transf|transferen/.test(d)) return "transferencia";
  if (/rendimento|juros|dividendo|cdb|lci|lca|fundo|tesouro|invest/.test(d)) return "investimento_ret";
  if (/freelance|freela|servico|serviço|consultor|comissao|comissão|bico|extra/.test(d)) return "extra";
  return null; // null = usuário decide na tela de preview
}{const t=text.toLowerCase();if(t.includes("date")&&t.includes("title")&&t.includes("amount"))return "nubank_card";if(t.includes("data")&&(t.includes("descrição")||t.includes("descricao"))&&t.includes("valor"))return "nubank_conta";if(t.includes("bradesco")||t.includes("histórico")||t.includes("historico"))return "bradesco";return "unknown";}
function parseCSVRows(text){const lines=text.trim().split(/\r?\n/);const header=lines[0].split(",").map(h=>h.trim().replace(/"/g,"").toLowerCase());return lines.slice(1).filter(l=>l.trim()).map(line=>{const cols=[];let cur="",inQ=false;for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){cols.push(cur.trim());cur="";}else cur+=ch;}cols.push(cur.trim());return Object.fromEntries(header.map((h,i)=>[h,(cols[i]||"").replace(/"/g,"").trim()]));});}
function parseTxs(rows,tipo){
  if(tipo==="nubank_card")return rows.map(r=>({date:r.date||"",desc:r.title||r.description||"",value:Math.abs(parseFloat((r.amount||"0").replace(",","."))),kind:"exp",source:"Nubank Cartão"})).filter(r=>r.date&&r.value>0);
  if(tipo==="nubank_conta")return rows.map(r=>{const v=parseFloat((r["valor"]||r["value"]||"0").replace(",","."));return{date:r["data"]||r["date"]||"",desc:r["descrição"]||r["descricao"]||"",value:Math.abs(v),kind:v>=0?"inc":"exp",source:"Nubank Conta"};}).filter(r=>r.date&&r.value>0);
  if(tipo==="bradesco")return rows.map(r=>{const keys=Object.keys(r);const dK=keys.find(k=>k.includes("data")),descK=keys.find(k=>k.includes("hist")||k.includes("desc")),vK=keys.find(k=>k.includes("valor")||k.includes("créd")||k.includes("déb"));const v=parseFloat((r[vK]||"0").replace(/\./g,"").replace(",","."));return{date:r[dK]||"",desc:r[descK]||"",value:Math.abs(v),kind:v>=0?"inc":"exp",source:"Bradesco"};}).filter(r=>r.date&&r.value>0&&r.desc);
  return [];
}

function Importador({ exps, setExps, cats }){
  const [step,setStep]=useState("upload");
  const [preview,setPreview]=useState([]);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const [editing,setEditing]=useState(null);

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
        cat: categorizar(p.desc,p.kind)||"outros",
        incType: p.kind==="inc" ? (detectIncType(p.desc)||"outro") : undefined,
      }));
      setPreview(catted);
      setMsg(dupCount>0?`ℹ️ ${dupCount} duplicata(s) ignorada(s)`:"");
      setStep("preview");
    }catch(err){setMsg(`❌ ${err.message}`);}
    setLoading(false);
  }

  function confirmar(){
    const novos=preview.map(p=>{
      const pts=p.date.split(/[-\/]/);
      const dateStr=pts.length===3&&pts[0].length===4?`${pts[2]}/${pts[1]}`:pts.slice(0,2).join("/");
      const cat=cats.find(c=>c.id===p.cat);
      return {id:`imp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,desc:p.desc,kind:p.kind,cat:p.cat,incType:p.incType,type:p.kind==="inc"?p.source:undefined,emoji:p.kind==="inc"?(INC_TIPOS.find(t=>t.id===p.incType)?.emoji||"🏦"):(cat?.emoji||"📦"),value:p.value,date:dateStr,source:p.source};
    });
    setExps(prev=>[...novos,...prev]);
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
        <SecTitle t="Como exportar"/>
        {[{bank:"💜 Nubank Cartão",steps:["App → Cartão → ··· → Exportar fatura","Salve o CSV do e-mail"]},{bank:"💜 Nubank Conta",steps:["App → Extrato → ··· → Exportar extrato","Escolha o período e salve o CSV"]},{bank:"🔴 Bradesco",steps:["Internet banking → Extrato","Período → Exportar CSV"]}].map(b=>(
          <div key={b.bank} style={CARD}>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>{b.bank}</div>
            {b.steps.map((s,i)=><div key={i} style={{fontSize:12,color:"#64748b",padding:"2px 0"}}>{i+1}. {s}</div>)}
          </div>
        ))}
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
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:16,fontWeight:700,color:"#4ade80",marginBottom:8}}>Importado com sucesso!</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:24}}>Seus lançamentos já aparecem nas outras abas.</div>
          <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)",undefined,{maxWidth:260,margin:"0 auto"})} onClick={()=>{setStep("upload");setPreview([]);setMsg("");}}>📂 Importar outro arquivo</button>
        </div>
      )}
    </div>
  );
}

// ── CONFIG ─────────────────────────────────────────────────
function Config({ cats, setCats, markets, setMarkets, exps, setExps, fixas, setFixas }){
  const [sec,setsec]=useState("importar");
  const [showNM,setShowNM]=useState(false);
  const [newMkt,setNewMkt]=useState({label:"",emoji:"🏪"});
  const [showNC,setShowNC]=useState(false);
  const [newCat,setNewCat]=useState({label:"",emoji:"📁",budget:200,color:"#60a5fa"});
  const [novaFixa,setNovaFixa]=useState({desc:"",valor:"",cat:"moradia",emoji:"📌"});
  const SECS=[{id:"importar",l:"📥 Importar"},{id:"fixas",l:"📌 Fixas"},{id:"mercados",l:"🏪 Mercados"},{id:"categorias",l:"🏷️ Categ."},{id:"dados",l:"🗄️ Dados"}];

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
          </div>
        ))}
        {fixas.length>0&&(
          <div style={{...CARD,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",textAlign:"center"}}>
            <div style={{fontSize:12,color:"#64748b"}}>Total fixas ativas</div>
            <div style={{fontSize:20,fontWeight:800,color:"#818cf8"}}>{fmt(fixas.filter(f=>f.ativo).reduce((s,f)=>s+f.valor,0))}<span style={{fontSize:12,fontWeight:400}}>/mês</span></div>
          </div>
        )}
      </>}
      {sec==="importar"&&<Importador exps={exps} setExps={setExps} cats={cats}/>}
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
      {sec==="dados"&&<div style={CARD}>
        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>🗄️ Dados</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
          💾 Salvamento automático ativo<br/>
          {exps.length} lançamentos · {cats.length} categorias · {markets.length} mercados · {fixas.length} fixas
        </div>
        <button style={btn("linear-gradient(135deg,#1d4ed8,#1e40af)",undefined,{marginBottom:10})} onClick={()=>{
          const blob=new Blob([JSON.stringify({exps,cats,markets,fixas},null,2)],{type:"application/json"});
          const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meufinanceiro-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();
        }}>📤 Exportar backup JSON</button>
        <button style={btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.3)"})} onClick={()=>{
          if(window.confirm("Apagar TODOS os dados?")){
            setExps([]);setCats(CATS_DEF);setMarkets(MKTS_DEF);setFixas(FIXAS_DEF);
            try{localStorage.removeItem("mf_exps");localStorage.removeItem("mf_cats");localStorage.removeItem("mf_mkts");localStorage.removeItem("mf_fixas");}catch{}
          }
        }}>🗑️ Apagar todos os dados</button>
      </div>}
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────
export default function App() {
  const [tab,      setTab]     = useState("dashboard");
  const [openWith, setOpenWith]= useState(null);
  const [hideVals, setHideVals]= useState(false);
  const [catModal, setCatModal]= useState(null);
  const [toast,    setToast]   = useState("");

  const [exps,    setExps]    = useState(()=>{ try{const v=localStorage.getItem("mf_exps");return v?JSON.parse(v):[]}catch{return []} });
  const [cats,    setCats]    = useState(()=>{ try{const v=localStorage.getItem("mf_cats");return v?JSON.parse(v):CATS_DEF}catch{return CATS_DEF} });
  const [markets, setMarkets] = useState(()=>{ try{const v=localStorage.getItem("mf_mkts");return v?JSON.parse(v):MKTS_DEF}catch{return MKTS_DEF} });
  const [fixas,   setFixas]   = useState(()=>{ try{const v=localStorage.getItem("mf_fixas");return v?JSON.parse(v):FIXAS_DEF}catch{return FIXAS_DEF} });

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(""),2000);}

  useEffect(()=>{ try{localStorage.setItem("mf_exps",JSON.stringify(exps));showToast("✓ Salvo");}catch{} },[exps]);
  useEffect(()=>{ try{localStorage.setItem("mf_cats",JSON.stringify(cats));showToast("✓ Salvo");}catch{} },[cats]);
  useEffect(()=>{ try{localStorage.setItem("mf_mkts",JSON.stringify(markets))}catch{} },[markets]);
  useEffect(()=>{ try{localStorage.setItem("mf_fixas",JSON.stringify(fixas));showToast("✓ Salvo");}catch{} },[fixas]);

  const mesesDisp=[...new Set(exps.map(e=>{const p=e.date?.split("/");return p?.length>=2?p[1]:null;}).filter(Boolean))].sort();
  const [mesFiltro,setMesFiltro]=useState("todos");

  // Bug 9: Projeção só faz sentido no mês atual
  const mesAtual = String(new Date().getMonth()+1).padStart(2,"0");
  const expsFiltrados=mesFiltro==="todos"?exps:exps.filter(e=>{const p=e.date?.split("/");return p?.length>=2&&p[1]===mesFiltro;});

  // Saldo: apenas renda real (salário/extra) menos gastos (sem investimentos)
  const totalInc=expsFiltrados.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
  const totalExp=expsFiltrados.filter(e=>e.kind==="exp"&&e.cat!=="investimento").reduce((s,e)=>s+e.value,0);
  const saldo=totalInc-totalExp;

  const TABS=[
    {id:"dashboard",emoji:"📊",label:"Resumo"},
    {id:"graficos", emoji:"📈",label:"Gráficos"},
    {id:"orcamento",emoji:"💰",label:"Orçamento"},
    {id:"gastos",   emoji:"💸",label:"Gastos"},
    {id:"mercado",  emoji:"🛒",label:"Mercado"},
    {id:"ia",       emoji:"🤖",label:"IA"},
    {id:"config",   emoji:"⚙️",label:"Config"},
  ];

  return (
    <div style={{fontFamily:"'Outfit',sans-serif",background:"#080e1d",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",paddingTop:"env(safe-area-inset-top,0px)"}}>
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
            <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>Meu Financeiro</div>
            <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9"}}>
              {mesFiltro==="todos"?"Todos os meses":MESES[+mesFiltro]+" "+new Date().getFullYear()}
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
            {mesesDisp.map(m=>(
              <button key={m} style={{background:mesFiltro===m?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:mesFiltro===m?"1px solid rgba(99,102,241,0.6)":"1px solid rgba(255,255,255,0.1)",color:mesFiltro===m?"#818cf8":"#64748b",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro===m?700:400}}
                onClick={()=>setMesFiltro(m)}>{MESES_CURTO[+m]}</button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
        {tab==="dashboard"&&<Dashboard exps={expsFiltrados} cats={cats} hide={hideVals} onCatClick={cat=>{setCatModal(cat);setTab("gastos");}} mesFiltro={mesFiltro} allExps={exps} fixas={fixas} mesAtual={mesAtual}/>}
        {tab==="graficos" &&<Graficos  exps={expsFiltrados} cats={cats} hide={hideVals} allExps={exps}/>}
        {tab==="orcamento"&&<Orcamento exps={expsFiltrados} cats={cats} setCats={setCats} hide={hideVals} mesFiltro={mesFiltro}/>}
        {tab==="gastos"   &&<Gastos    exps={exps} setExps={setExps} cats={cats} openWith={openWith} onOpened={()=>setOpenWith(null)} hide={hideVals} mesFiltro={mesFiltro} catFiltro={catModal} onClearCat={()=>setCatModal(null)}/>}
        {tab==="mercado"  &&<Mercado   markets={markets}/>}
        {tab==="ia"       &&<IAChat    exps={expsFiltrados} cats={cats}/>}
        {tab==="config"   &&<Config    cats={cats} setCats={setCats} markets={markets} setMarkets={setMarkets} exps={exps} setExps={setExps} fixas={fixas} setFixas={setFixas}/>}
      </div>

      {/* FABs */}
      {tab!=="ia"&&tab!=="config"&&(
        <div style={{position:"fixed",bottom:76,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:49}}>
          <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(34,197,94,0.4)",fontWeight:700}} onClick={()=>{setOpenWith("income");setTab("gastos");}}>+💰</button>
          <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.4)",fontWeight:700}} onClick={()=>{setOpenWith("expense");setTab("gastos");}}>+💸</button>
        </div>
      )}

      {/* Nav */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(8,14,29,0.97)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",overflowX:"auto",padding:"6px 2px 10px",backdropFilter:"blur(20px)",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} style={{flex:"0 0 auto",minWidth:60,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 2px",opacity:tab===t.id?1:0.38,transition:"opacity 0.15s"}} onClick={()=>setTab(t.id)}>
            <span style={{fontSize:18}}>{t.emoji}</span>
            <span style={{fontSize:8,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
