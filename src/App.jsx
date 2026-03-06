import { useState, useRef, useEffect } from "react";

const GEMINI_KEY = "AIzaSyA-gx5FUXaJfJ4IWU7MciY-gLlUk6D0TII";

const delay = ms => new Promise(r => setTimeout(r, ms));

async function askGemini(sys, msg, maxTokens = 1000, retries = 3) {
  for (let i = 0; i < retries; i++) {
    if (i > 0) {
      const wait = 2000 * i; // 2s, 4s...
      console.log(`Aguardando ${wait}ms antes de tentar novamente...`);
      await delay(wait);
    }
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: sys + "\n\n" + msg }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens }
        })
      }
    );
    if (r.status === 429) {
      if (i < retries - 1) continue; // tenta de novo
      throw new Error("Limite de requisições atingido. Aguarde um momento e tente novamente.");
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}

const fmt = v => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

const CATS_DEF = [
  { id:"moradia",     label:"Moradia",     emoji:"🏠", budget:1500, color:"#60a5fa" },
  { id:"alimentacao", label:"Alimentação", emoji:"🛒", budget:800,  color:"#4ade80" },
  { id:"transporte",  label:"Transporte",  emoji:"🚗", budget:400,  color:"#f59e0b" },
  { id:"saude",       label:"Saúde",       emoji:"💊", budget:300,  color:"#f472b6" },
  { id:"lazer",       label:"Lazer",       emoji:"🎬", budget:200,  color:"#fb923c" },
  { id:"outros",      label:"Outros",      emoji:"📦", budget:200,  color:"#94a3b8" },
];

const MKTS_DEF = [
  { id:"carrefour",   label:"Carrefour",    emoji:"🔵" },
  { id:"paodeacucar", label:"Pão de Açúcar",emoji:"🍞" },
  { id:"atacadao",    label:"Atacadão",     emoji:"🏭" },
  { id:"enxuto",      label:"Enxuto",       emoji:"🟢" },
  { id:"higa",        label:"Higa Atacado", emoji:"🟡" },
];

const GROCERY = [
  "Frango (kg)","Carne moída (kg)","Leite integral (L)","Arroz 5kg",
  "Feijão 1kg","Óleo de soja","Macarrão 500g","Pão de forma",
  "Ovos (dz)","Manteiga 200g","Sabão em pó","Detergente 500ml"
];

const PRESETS = ["#60a5fa","#4ade80","#f59e0b","#f472b6","#a78bfa","#fb923c","#34d399","#94a3b8","#f87171","#38bdf8"];

function inp(extra) { return { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, color:"#e2e8f0", padding:"11px 13px", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", ...extra }; }
function btn(bg, c="#fff", extra) { return { background:bg, border:"none", color:c, borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", fontFamily:"inherit", ...extra }; }
const CARD = { background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"14px 16px", marginBottom:12, border:"1px solid rgba(255,255,255,0.07)" };
const ROW  = { display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"11px 14px", marginBottom:8, border:"1px solid rgba(255,255,255,0.06)" };

function Bar({ pct, color="#4ade80" }) {
  return <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:99, height:6, overflow:"hidden", margin:"6px 0 3px" }}>
    <div style={{ width:`${Math.min(100,Math.max(0,pct))}%`, height:"100%", background:color, borderRadius:99 }}/>
  </div>;
}

function SecTitle({ t }) {
  return <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.1em", margin:"16px 0 8px" }}>{t}</div>;
}

// ── DASHBOARD ──────────────────────────────────────────────
function Dashboard({ exps, cats, hide }) {
  const totalInc = exps.filter(e=>e.kind==="inc").reduce((s,e)=>s+e.value,0);
  const totalExp = exps.filter(e=>e.kind==="exp").reduce((s,e)=>s+e.value,0);
  const saldo    = totalInc - totalExp;
  return (
    <div style={{ padding:16, paddingBottom:100 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {[["Renda",fmt(totalInc),"#4ade80"],["Gastos",fmt(totalExp),"#f87171"],["Saldo",fmt(saldo),saldo>=0?"#60a5fa":"#f87171"],["Lançamentos",exps.length+" itens","#a78bfa"]].map(([l,v,c])=>{const vv=hide&&l!=="Lançamentos"?"••••":v; return(
          <div key={l} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"12px 10px", border:`1px solid ${c}33`, textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#64748b", textTransform:"uppercase", marginBottom:3 }}>{l}</div>
            <div style={{ fontSize:15, fontWeight:800, color:c }}>{vv}</div>
          </div>
        );})}
      </div>
      <SecTitle t="Por categoria"/>
      {cats.map(cat=>{
        const spent=exps.filter(e=>e.kind==="exp"&&e.cat===cat.id).reduce((s,e)=>s+e.value,0);
        const pct=cat.budget>0?(spent/cat.budget)*100:0;
        return <div key={cat.id} style={ROW}>
          <span style={{ fontSize:20 }}>{cat.emoji}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{cat.label}</span>
              <span style={{ fontSize:12, color:spent>cat.budget?"#f87171":"#64748b" }}>{hide?"••••/••••":(fmt(spent)+"/"+fmt(cat.budget))}</span>
            </div>
            <Bar pct={pct} color={spent>cat.budget?"#f87171":pct>75?"#f59e0b":cat.color}/>
          </div>
        </div>;
      })}
      <SecTitle t="Últimos lançamentos"/>
      {[...exps].slice(0,8).map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        return <div key={e.id} style={{ ...ROW, ...(e.kind==="inc"?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.04)"}:{}) }}>
          <span style={{ fontSize:20 }}>{e.emoji||cat?.emoji||"📦"}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{e.desc}</div>
            <div style={{ fontSize:11, color:"#475569" }}>{e.kind==="inc"?(e.type||"Entrada"):(cat?.label||"Outros")} · {e.date}</div>
          </div>
          <span style={{ fontSize:14, fontWeight:700, color:e.kind==="inc"?"#4ade80":"#f87171" }}>{e.kind==="inc"?"+":"-"}{fmt(e.value)}</span>
        </div>;
      })}
    </div>
  );
}

// ── GRÁFICOS ───────────────────────────────────────────────
function Graficos({ exps, cats, hide }) {
  const gastos=exps.filter(e=>e.kind==="exp");
  const pieData=cats.map(c=>({...c,spent:gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0)})).filter(c=>c.spent>0);
  const pieTotal=pieData.reduce((s,c)=>s+c.spent,0);
  const sz=160,cx=sz/2,cy=sz/2,r=sz*.38,ir=sz*.22;
  let cum=-Math.PI/2;
  const slices=pieData.map(d=>{const a=(d.spent/pieTotal)*Math.PI*2,sa=cum;cum+=a;return{...d,sa,ea:cum};});
  function arc(sa,ea){const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa),x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);return `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${ea-sa>Math.PI?1:0} 1 ${x2} ${y2}Z`;}
  return (
    <div style={{ padding:16, paddingBottom:100 }}>
      <SecTitle t="Gastos por categoria"/>
      <div style={CARD}>
        {pieTotal>0 ? <>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
            <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
              {slices.map((s,i)=><path key={i} d={arc(s.sa,s.ea)} fill={s.color} opacity={.85} stroke="#080e1d" strokeWidth={2}/>)}
              <circle cx={cx} cy={cy} r={ir} fill="#0f172a"/>
              <text x={cx} y={cy+4} textAnchor="middle" fill="#4ade80" fontSize={10} fontWeight="800" fontFamily="Outfit,sans-serif">{fmt(pieTotal)}</text>
            </svg>
          </div>
          {[...pieData].sort((a,b)=>b.spent-a.spent).map(c=>(
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 0" }}>
              <div style={{ width:10, height:10, borderRadius:2, background:c.color }}/>
              <span style={{ flex:1, fontSize:13, color:"#cbd5e1" }}>{c.emoji} {c.label}</span>
              <span style={{ fontSize:13, fontWeight:700, color:c.color }}>{hide?"••••":fmt(c.spent)}</span>
              <span style={{ fontSize:11, color:"#64748b", width:34, textAlign:"right" }}>{((c.spent/pieTotal)*100).toFixed(0)}%</span>
            </div>
          ))}
        </> : <div style={{ textAlign:"center", padding:"20px 0", color:"#475569", fontSize:13 }}>Nenhum gasto registrado</div>}
      </div>
      <SecTitle t="Orçado vs Realizado"/>
      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <svg width={Math.max(cats.length*56,300)} height={160} style={{ display:"block" }}>
            {cats.map((cat,i)=>{
              const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
              const mx=Math.max(...cats.map(c=>Math.max(c.budget,gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0))),1);
              const bH=(cat.budget/mx)*100,sH=(spent/mx)*100,x=i*56+6;
              const pct=cat.budget>0?Math.round((spent/cat.budget)*100):0;
              return <g key={cat.id}>
                <text x={x+29} y={115-sH-4} textAnchor="middle" fill={spent>cat.budget?"#f87171":"#94a3b8"} fontSize="9" fontFamily="Outfit,sans-serif">{pct}%</text>
                <rect x={x} y={115-bH} width={20} height={bH} rx={3} fill="rgba(99,102,241,0.55)"/>
                <rect x={x+22} y={115-sH} width={20} height={sH} rx={3} fill={spent>cat.budget?"#f87171":"#f59e0b"}/>
                <text x={x+20} y={130} textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="Outfit,sans-serif">{cat.emoji}</text>
              </g>;
            })}
          </svg>
        </div>
        <div style={{ display:"flex", gap:14, marginTop:8 }}>
          {[["rgba(99,102,241,0.7)","Orçado"],["#f59e0b","Realizado"]].map(([c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:12, height:12, borderRadius:2, background:c }}/>
              <span style={{ fontSize:11, color:"#94a3b8" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ORÇAMENTO ──────────────────────────────────────────────
function Orcamento({ exps, cats, setCats, hide }) {
  const gastos=exps.filter(e=>e.kind==="exp");
  return (
    <div style={{ padding:16, paddingBottom:100 }}>
      {cats.map((cat,idx)=>{
        const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
        const pct=cat.budget>0?Math.min(100,(spent/cat.budget)*100):0;
        const over=spent>cat.budget;
        return <div key={cat.id} style={{ ...CARD, padding:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{cat.emoji}</div>
            <span style={{ flex:1, fontSize:14, fontWeight:700, color:"#e2e8f0" }}>{cat.label}</span>
            <span style={{ fontSize:12, color:over?"#f87171":"#64748b" }}>{hide?"••••":fmt(spent)} gasto</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:12, color:"#64748b" }}>Limite R$</span>
            <input style={inp({ flex:1, padding:"8px 12px", fontSize:15, fontWeight:700 })} type="number" value={cat.budget}
              onChange={e=>setCats(p=>p.map((c,i)=>i===idx?{...c,budget:+e.target.value}:c))}/>
          </div>
          <Bar pct={pct} color={over?"#f87171":pct>75?"#f59e0b":cat.color}/>
          <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>{pct.toFixed(0)}% · {fmt(Math.max(0,cat.budget-spent))} restante</div>
        </div>;
      })}
    </div>
  );
}

// ── GASTOS ─────────────────────────────────────────────────
function Gastos({ exps, setExps, cats, openWith, onOpened, hide }) {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState("expense");
  const [form, setForm] = useState({ desc:"", value:"", cat:"alimentacao", date:"", payment:"dinheiro", parcelas:1, vencimento:"10" });
  const todayStr = new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState("todos");

  function startEdit(e) {
    setEditId(e.id);
    setEditForm({ desc:e.desc, value:e.value, cat:e.cat||"outros", kind:e.kind, date:e.date||"" });
  }
  function saveEdit() {
    setExps(p=>p.map(e=>e.id===editId ? {...e,...editForm, value:+editForm.value} : e));
    setEditId(null);
  }

  // Meses disponíveis para filtro
  const monthsAvail = [...new Set(exps.map(e=>{
    const p=e.date?.split("/"); return p?.length>=2?p[1]:null;
  }).filter(Boolean))].sort();

  useEffect(()=>{
    if (openWith) { setMode(openWith); setShow(true); if(onOpened) onOpened(); }
  }, [openWith]);

  function add() {
    if (!form.desc || !form.value) return;
    const cat      = cats.find(c => c.id === form.cat);
    const isCard   = mode === "expense" && form.payment === "cartao";
    const parcelas = isCard ? Math.max(1, +form.parcelas || 1) : 1;
    const total    = +form.value;
    const venc     = +form.vencimento || 10;
    const baseDate = form.date ? new Date(form.date + "T12:00:00") : new Date();

    const novos = Array.from({ length: parcelas }, (_, i) => {
      let d;
      if (isCard) {
        d = new Date(baseDate);
        // Se a compra foi feita ANTES do vencimento, primeira parcela é neste mês; senão, mês que vem
        const offsetMeses = baseDate.getDate() < venc ? 0 : 1;
        d.setMonth(d.getMonth() + offsetMeses + i);
        d.setDate(venc);
      } else {
        d = baseDate;
      }
      const dateStr  = d.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
      const descStr  = parcelas > 1 ? `${form.desc} (${i+1}/${parcelas})` : form.desc;
      const valor    = i < parcelas - 1
        ? Math.floor((total / parcelas) * 100) / 100
        : +(total - Math.floor((total / parcelas) * 100) / 100 * (parcelas - 1)).toFixed(2); // última parcela absorve centavos

      return {
        id:      Date.now() + i,
        desc:    descStr,
        kind:    mode === "expense" ? "exp" : "inc",
        cat:     mode === "expense" ? form.cat : undefined,
        type:    mode === "income"  ? "Manual" : undefined,
        emoji:   isCard ? "💳" : (mode === "expense" ? (cat?.emoji || "📦") : "💰"),
        value:   valor,
        date:    dateStr,
        payment: isCard ? "cartao" : "dinheiro",
      };
    });

    setExps(p => [...novos, ...p]);
    setForm({ desc:"", value:"", cat:"alimentacao", date:"", payment:"dinheiro", parcelas:1, vencimento:"10" });
    setShow(false);
  }

  return (
    <div style={{ padding:16, paddingBottom:100 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontSize:14, fontWeight:700, color:"#cbd5e1" }}>Lançamentos</span>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ fontSize:12, background:"rgba(74,222,128,0.15)", color:"#4ade80", border:"1px solid rgba(74,222,128,0.3)", borderRadius:8, padding:"5px 12px", cursor:"pointer" }}
            onClick={()=>{setMode("income");setShow(true);}}>+💰 Entrada</button>
          <button style={{ fontSize:12, background:"rgba(248,113,113,0.15)", color:"#f87171", border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, padding:"5px 12px", cursor:"pointer" }}
            onClick={()=>{setMode("expense");setShow(true);}}>+💸 Gasto</button>
        </div>
      </div>

      {/* Filtro por mês */}
      {monthsAvail.length > 1 && (
        <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:12, paddingBottom:2 }}>
          {["todos", ...monthsAvail].map(m=>(
            <button key={m} style={{ background:filter===m?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)", border:filter===m?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.1)", color:filter===m?"#818cf8":"#64748b", borderRadius:99, padding:"4px 12px", fontSize:12, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, fontFamily:"inherit" }}
              onClick={()=>setFilter(m)}>{m==="todos"?"Todos":m+"/"+new Date().getFullYear().toString().slice(2)}</button>
          ))}
        </div>
      )}

      {show && (
        <div style={{ background:"rgba(17,24,39,0.98)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:16, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#f1f5f9", marginBottom:14 }}>{mode==="income"?"💰 Nova entrada":"💸 Novo gasto"}</div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {[["expense","💸 Gasto","#f87171"],["income","💰 Entrada","#4ade80"]].map(([m,l,c])=>(
              <button key={m} style={{ flex:1, borderRadius:10, padding:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                background:mode===m?`${c}22`:"rgba(255,255,255,0.05)",
                border:mode===m?`1px solid ${c}55`:"1px solid rgba(255,255,255,0.1)",
                color:mode===m?c:"#94a3b8" }} onClick={()=>setMode(m)}>{l}</button>
            ))}
          </div>
          <input style={{ ...inp(), marginBottom:10 }} placeholder="Descrição (ex: iFood, Salário)" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}/>
          <input style={{ ...inp(), marginBottom:10 }} type="number" placeholder="Valor (R$)" value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))}/>
          <input style={{ ...inp(), marginBottom:10 }} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} placeholder="Data (deixe vazio = hoje)"
            style={{ ...inp(), marginBottom:10, colorScheme:"dark" }}/>
          {mode==="expense" && (
            <select style={{ ...inp(), marginBottom:10 }} value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}>
              {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          )}
          {mode==="expense" && (
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              {[["dinheiro","💵 Débito/Pix"],["cartao","💳 Cartão"]].map(([v,l])=>(
                <button key={v} style={{ flex:1, borderRadius:10, padding:"9px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  background:form.payment===v?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",
                  border:form.payment===v?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.1)",
                  color:form.payment===v?"#818cf8":"#94a3b8" }}
                  onClick={()=>setForm(p=>({...p,payment:v}))}>{l}</button>
              ))}
            </div>
          )}
          {mode==="expense" && form.payment==="cartao" && (
            <div style={{ background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:12, marginBottom:10 }}>
              <div style={{ fontSize:11, color:"#818cf8", fontWeight:700, textTransform:"uppercase", marginBottom:10 }}>💳 Configurar parcelamento</div>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Parcelas</div>
                  <select style={inp()} value={form.parcelas} onChange={e=>setForm(p=>({...p,parcelas:+e.target.value}))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x {n>1?"de "+fmt(+form.value/n||0):""}</option>)}
                  </select>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Vencimento (dia)</div>
                  <select style={inp()} value={form.vencimento} onChange={e=>setForm(p=>({...p,vencimento:e.target.value}))}>
                    {[1,5,7,10,12,15,17,20,25,28].map(d=><option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>
              </div>
              {form.parcelas > 1 && (
                <div style={{ fontSize:12, color:"#64748b", lineHeight:1.5 }}>
                  💡 {form.parcelas}x de {fmt(+form.value/form.parcelas||0)} — lançadas no dia {form.vencimento} de cada mês
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)" })} onClick={()=>setShow(false)}>Cancelar</button>
            <button style={btn(mode==="income"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#ef4444,#dc2626)")} onClick={add}>Salvar</button>
          </div>
        </div>
      )}

      {exps.length===0 && !show && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:"#475569" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
          <div style={{ fontSize:14 }}>Nenhum lançamento ainda</div>
          <div style={{ fontSize:12, marginTop:6 }}>Use os botões acima ou importe seu extrato em ⚙️ Config</div>
        </div>
      )}

      {[...exps].map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        return <div key={e.id} style={{ ...ROW, ...(e.kind==="inc"?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.04)"}:{}) }}>
          <div style={{ fontSize:22, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10, background:e.kind==="inc"?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.06)" }}>
            {e.emoji||cat?.emoji||"📦"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{e.desc}</div>
            <div style={{ fontSize:11, color:"#475569" }}>{e.kind==="inc"?(e.type||"Entrada"):(cat?.label||"Outros")} · {e.date}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
            <span style={{ fontSize:14, fontWeight:700, color:e.kind==="inc"?"#4ade80":"#f87171" }}>{hide?"••••":(e.kind==="inc"?"+":"-")+fmt(e.value)}</span>
            <div style={{ display:"flex", gap:6 }}>
              <button style={{ fontSize:10, color:"#818cf8", background:"none", border:"none", cursor:"pointer" }} onClick={()=>startEdit(e)}>✏️</button>
              <button style={{ fontSize:10, color:"#475569", background:"none", border:"none", cursor:"pointer" }} onClick={()=>setExps(p=>p.filter(x=>x.id!==e.id))}>✕</button>
            </div>
          </div>
        </div>
        {editId===e.id && (
          <div style={{ background:"rgba(17,24,39,0.98)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:14, padding:16, marginTop:-4, marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#818cf8", marginBottom:12 }}>✏️ Editando lançamento</div>
            <input style={{ ...inp(), marginBottom:8 }} placeholder="Descrição" value={editForm.desc} onChange={e=>setEditForm(p=>({...p,desc:e.target.value}))}/>
            <input style={{ ...inp(), marginBottom:8 }} type="number" placeholder="Valor" value={editForm.value} onChange={e=>setEditForm(p=>({...p,value:e.target.value}))}/>
            <input style={{ ...inp(), marginBottom:8, colorScheme:"dark" }} type="date" value={editForm.date?.length===5?("2025-"+editForm.date.split("/").reverse().join("-")):editForm.date} onChange={e=>{const d=new Date(e.target.value);const str=d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});setEditForm(p=>({...p,date:str}));}}/>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <select style={{ ...inp(), flex:1 }} value={editForm.kind} onChange={e=>setEditForm(p=>({...p,kind:e.target.value}))}>
                <option value="exp">💸 Gasto</option>
                <option value="inc">💰 Entrada</option>
              </select>
              {editForm.kind==="exp" && <select style={{ ...inp(), flex:1 }} value={editForm.cat} onChange={e=>setEditForm(p=>({...p,cat:e.target.value}))}>
                {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)" })} onClick={()=>setEditId(null)}>Cancelar</button>
              <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={saveEdit}>Salvar ✓</button>
            </div>
          </div>
        )};
      })}
    </div>
  );
}

// ── MERCADO ────────────────────────────────────────────────
function Mercado({ markets }) {
  const [produtos, setProdutos] = useState(GROCERY);
  const [sel, setSel]       = useState({"Frango (kg)":true,"Arroz 5kg":true,"Feijão 1kg":true,"Leite integral (L)":true,"Ovos (dz)":true,"Macarrão 500g":true});
  const [novoProd, setNovoProd] = useState("");
  const [gerenciar, setGerenciar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [erro, setErro]       = useState("");
  const count = Object.values(sel).filter(Boolean).length;
  
  function addProduto() {
    const nome = novoProd.trim();
    if (!nome || produtos.includes(nome)) return;
    setProdutos(p => [...p, nome]);
    setSel(p => ({...p, [nome]: true}));
    setNovoProd("");
  }
  function removeProduto(nome) {
    setProdutos(p => p.filter(x => x !== nome));
    setSel(p => { const n={...p}; delete n[nome]; return n; });
  }

  async function buscar() {
    if (GEMINI_KEY==="SUA_CHAVE_AQUI") { setErro("Configure a chave do Gemini no App.jsx linha 3"); return; }
    setLoading(true); setResult(null); setErro("");
    const items    = Object.keys(sel).filter(k=>sel[k]);
    const mktNames = markets.map(m=>m.label);
    const mktObj   = Object.fromEntries(mktNames.map(m=>[m,9.99]));
    const mktTotal = Object.fromEntries(mktNames.map(m=>[m,99.99]));
    const exemplo  = JSON.stringify({
      items: items.map(n=>({ name:n, prices:{...mktObj} })),
      recommendation: mktNames[0],
      totalByMarket: {...mktTotal},
      savings: 10.00,
      tip: "Compre aos sabados para melhores ofertas"
    });
    const sys = "Voce e um assistente que retorna APENAS JSON puro. Sem markdown, sem backticks, sem texto antes ou depois. Apenas o objeto JSON.";
    const msg = "Substitua os valores de preco 9.99 e totais 99.99 por precos REAIS estimados para Campinas SP " + new Date().getFullYear() + ". Produtos: " + items.join(", ") + ". Mercados: " + mktNames.join(", ") + ". Retorne SOMENTE este JSON preenchido: " + exemplo;
    try {
      // Pede precos como texto linha a linha - formato mais simples possivel
      const sys2 = "Voce e um assistente de precos. Responda SOMENTE com numeros separados por virgula e ponto-e-virgula. Sem texto, sem R$, sem unidades.";
      const msg2 = "Precos realistas em reais para Campinas SP " + new Date().getFullYear() + ". " +
        "Para cada produto abaixo, informe o preco em cada mercado separado por virgula. Um produto por linha, use ponto-e-virgula entre produtos. " +
        "Mercados na ordem: " + mktNames.join(", ") + ". " +
        "Produtos: " + items.join("; ") + ". " +
        "Exemplo de resposta para 2 produtos e 3 mercados: 8.90,9.50,7.80;3.20,3.50,2.90";

      const txt = await askGemini(sys2, msg2, 800);
      console.log("Gemini raw:", txt.slice(0, 400));

      // Parser tolerante: extrai todos os numeros do texto linha por linha
      function extrairNums(str) {
        return str.match(/\d+[.,]\d+|\d+/g)?.map(n => parseFloat(n.replace(",","."))) || [];
      }

      // Divide por ponto-e-virgula ou quebra de linha
      const linhas = txt.split(/[;\n]/).map(l => l.trim()).filter(l => l.length > 0);
      
      const matriz = items.map((_, i) => {
        const linha = linhas[i] || linhas[0] || "";
        const nums  = extrairNums(linha);
        // Se nao tiver numeros suficientes na linha, tenta extrair do texto todo
        if (nums.length < mktNames.length) {
          const todosNums = extrairNums(txt);
          const offset = i * mktNames.length;
          return mktNames.map((_, j) => todosNums[offset + j] || (8 + Math.random() * 12));
        }
        return mktNames.map((_, j) => nums[j] || nums[0] || 9.99);
      });

      // Monta resultado
      const resultItems = items.map((nome, i) => ({
        name: nome,
        prices: Object.fromEntries(mktNames.map((m, j) => [m, +matriz[i][j].toFixed(2)]))
      }));

      const totais = Object.fromEntries(mktNames.map((m, j) => [
        m, +resultItems.reduce((acc, it) => acc + (it.prices[m]||0), 0).toFixed(2)
      ]));

      const sorted   = Object.entries(totais).sort(([,a],[,b]) => a - b);
      const economia = +(sorted[sorted.length-1][1] - sorted[0][1]).toFixed(2);

      setResult({
        items: resultItems,
        recommendation: sorted[0][0],
        totalByMarket: totais,
        savings: economia,
        tip: "Compare o preco por kg ou litro — embalagens menores costumam ser mais caras"
      });
    } catch(err) {
      setErro("Nao foi possivel buscar os precos: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding:16, paddingBottom:100 }}>
      <p style={{ fontSize:13, color:"#64748b", marginBottom:14, lineHeight:1.5 }}>Selecione os itens para comparar preços nos seus mercados cadastrados:</p>
      {/* Chips de produtos */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:10 }}>
        {produtos.map(item=>(
          <div key={item} style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
            <button style={{ background:sel[item]?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.05)", border:sel[item]?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.1)", color:sel[item]?"#818cf8":"#94a3b8", borderRadius:99, padding:"6px 12px", paddingRight:gerenciar?"28px":"12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}
              onClick={()=>!gerenciar&&setSel(p=>({...p,[item]:!p[item]}))}>
              {sel[item]&&!gerenciar?"✓ ":""}{item}
            </button>
            {gerenciar && (
              <button style={{ position:"absolute", right:6, background:"none", border:"none", color:"#f87171", fontSize:12, cursor:"pointer", lineHeight:1, padding:0 }}
                onClick={()=>removeProduto(item)}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Adicionar produto / toggle gerenciar */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {gerenciar ? (
          <>
            <input style={{ ...inp(), flex:1, padding:"8px 12px", fontSize:13 }} placeholder="Novo produto..." value={novoProd}
              onChange={e=>setNovoProd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProduto()}/>
            <button style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", color:"white", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }} onClick={addProduto}>+ Add</button>
            <button style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#94a3b8", borderRadius:10, padding:"8px 12px", fontSize:13, cursor:"pointer" }} onClick={()=>setGerenciar(false)}>✓ OK</button>
          </>
        ) : (
          <button style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", borderRadius:10, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setGerenciar(true)}>✏️ Gerenciar produtos</button>
        )}
      </div>
      <button style={btn("linear-gradient(135deg,#1d4ed8,#1e40af)",undefined,{ opacity:loading||count===0?0.6:1, marginBottom:8 })}
        onClick={buscar} disabled={loading||count===0}>
        {loading?"🔍 Consultando Gemini...":count===0?"Selecione ao menos 1 item":`🛒 Comparar preços (${count} itens)`}
      </button>

      {loading && <div style={{ textAlign:"center", padding:24 }}>
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:8 }}><span className="dot"/><span className="dot"/><span className="dot"/></div>
        <div style={{ fontSize:13, color:"#64748b" }}>A IA está consultando preços...</div>
      </div>}

      {erro && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:12, padding:14, color:"#f87171", fontSize:13, marginTop:8, lineHeight:1.5 }}>{erro}</div>}

      {result && <>
        <div style={{ background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,163,74,0.06))", border:"1px solid rgba(74,222,128,0.25)", borderRadius:16, padding:20, marginTop:16, textAlign:"center" }}>
          <div style={{ fontSize:11, color:"#4ade80", textTransform:"uppercase", marginBottom:6 }}>🏆 Melhor opção</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#f1f5f9", marginBottom:4 }}>{result.recommendation}</div>
          <div style={{ fontSize:14, color:"#94a3b8" }}>Economia de <strong style={{ color:"#4ade80" }}>{fmt(result.savings||0)}</strong></div>
          {result.tip&&<div style={{ fontSize:12, color:"#64748b", marginTop:8, fontStyle:"italic" }}>💡 {result.tip}</div>}
        </div>
        <SecTitle t="Total por mercado"/>
        {Object.entries(result.totalByMarket||{}).sort(([,a],[,b])=>a-b).map(([m,t],i)=>(
          <div key={m} style={{ ...ROW, ...(i===0?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.07)"}:{}) }}>
            <span style={{ fontSize:16, width:24 }}>{["🥇","🥈","🥉","4°","5°","6°"][i]}</span>
            <span style={{ flex:1, fontSize:14, fontWeight:600, color:"#e2e8f0" }}>{m}</span>
            <span style={{ fontSize:14, fontWeight:700, color:i===0?"#4ade80":"#e2e8f0" }}>{fmt(t)}</span>
          </div>
        ))}
        <SecTitle t="Preços por produto"/>
        {result.items?.map(item=>{
          const min=Math.min(...Object.values(item.prices||{}));
          return <div key={item.name} style={CARD}>
            <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0", marginBottom:10 }}>{item.name}</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.entries(item.prices||{}).map(([mkt,p])=>(
                <div key={mkt} style={{ flex:"1 0 18%", background:p===min?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.04)", borderRadius:8, padding:"6px 4px", textAlign:"center", border:p===min?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize:9, color:"#64748b", marginBottom:3 }}>{mkt.split(" ")[0]}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:p===min?"#4ade80":"#94a3b8" }}>{fmt(p)}</div>
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
  const [msgs, setMsgs]     = useState([]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const totalInc = exps.filter(e=>e.kind==="inc").reduce((s,e)=>s+e.value,0);
  const totalExp = exps.filter(e=>e.kind==="exp").reduce((s,e)=>s+e.value,0);
  const saldo    = totalInc - totalExp;

  async function send() {
    const msg = input.trim(); if (!msg||loading) return;
    setInput(""); setLoading(true);
    setMsgs(p=>[...p,{role:"user",text:msg}]);
    if (GEMINI_KEY==="SUA_CHAVE_AQUI") {
      setMsgs(p=>[...p,{role:"ai",text:"⚠️ Configure a chave do Gemini no App.jsx linha 1 para usar o chat IA."}]);
      setLoading(false); return;
    }
    const catResumo = cats.map(c=>{
      const spent=exps.filter(e=>e.kind==="exp"&&e.cat===c.id).reduce((s,e)=>s+e.value,0);
      return `${c.label}: gasto ${fmt(spent)} de ${fmt(c.budget)}`;
    }).join("; ");
    const sys = `Você é um consultor financeiro pessoal brasileiro, amigável e prático.
Dados do usuário: Renda=${fmt(totalInc)}, Gastos=${fmt(totalExp)}, Saldo=${fmt(saldo)}.
Categorias: ${catResumo}.
Responda em português, máx 120 palavras, seja direto e motivador.`;
    try {
      const txt = await askGemini(sys, msg, 1200);
      setMsgs(p=>[...p,{role:"ai",text:txt||"Não consegui responder. Tente novamente."}]);
    } catch(e) {
      setMsgs(p=>[...p,{role:"ai",text:`Erro de conexão: ${e.message}. Verifique sua chave do Gemini.`}]);
    }
    setLoading(false);
    setTimeout(()=>ref.current?.scrollTo(0,99999),100);
  }

  const suggs = ["Onde estou gastando mais?","Como economizar este mês?","Estou no caminho certo?","O que devo priorizar?"];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 116px)" }}>
      <div style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize:24, background:"rgba(99,102,241,0.2)", borderRadius:12, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center" }}>🤖</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0" }}>Consultor Financeiro IA</div>
          <div style={{ fontSize:11, color:"#64748b" }}>Baseado nos seus dados reais</div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:10 }} ref={ref}>
        {msgs.length===0 && (
          <div style={{ textAlign:"center", marginTop:12 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>💬</div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:16 }}>Pergunte qualquer coisa sobre suas finanças!</div>
            {suggs.map(s=>(
              <button key={s} style={{ display:"block", width:"100%", marginBottom:8, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.25)", color:"#818cf8", borderRadius:10, padding:"10px 14px", fontSize:13, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}
                onClick={()=>setInput(s)}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{ padding:"12px 14px", borderRadius:14, maxWidth:"82%", fontSize:14, lineHeight:1.6,
            ...(m.role==="user"
              ?{alignSelf:"flex-end",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"white",borderBottomRightRadius:4}
              :{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",color:"#e2e8f0",border:"1px solid rgba(255,255,255,0.08)",borderBottomLeftRadius:4}) }}>
            {m.text}
          </div>
        ))}
        {loading && <div style={{ alignSelf:"flex-start", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"12px 14px", display:"flex", gap:5 }}>
          <span className="dot"/><span className="dot"/><span className="dot"/>
        </div>}
      </div>
      <div style={{ display:"flex", gap:8, padding:"10px 14px", background:"rgba(8,14,29,0.98)", borderTop:"1px solid rgba(255,255,255,0.07)" }}>
        <input style={{ ...inp(), flex:1 }} placeholder="Pergunte algo..." value={input}
          onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button style={{ background:"linear-gradient(135deg,#4f46e5,#4338ca)", border:"none", color:"white", borderRadius:12, width:44, height:44, fontSize:16, cursor:"pointer" }} onClick={send}>➤</button>
      </div>
    </div>
  );
}

// ── IMPORTADOR BANCÁRIO ────────────────────────────────────
function detectBank(text) {
  const t = text.toLowerCase();
  if (t.includes("date") && t.includes("title") && t.includes("amount")) return "nubank_card";
  if (t.includes("data") && (t.includes("descrição")||t.includes("descricao")) && t.includes("valor")) return "nubank_conta";
  if (t.includes("bradesco")||t.includes("histórico")||t.includes("historico")) return "bradesco";
  return "unknown";
}

function parseCSVRows(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(h=>h.trim().replace(/"/g,"").toLowerCase());
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const cols=[];let cur="",inQ=false;
    for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){cols.push(cur.trim());cur="";}else cur+=ch;}
    cols.push(cur.trim());
    return Object.fromEntries(header.map((h,i)=>[h,(cols[i]||"").replace(/"/g,"").trim()]));
  });
}

function parseTxs(rows, tipo) {
  if (tipo==="nubank_card") return rows.map(r=>({ date:r.date||"", desc:r.title||r.description||"", value:Math.abs(parseFloat((r.amount||"0").replace(",","."))), kind:"exp", source:"Nubank Cartão" })).filter(r=>r.date&&r.value>0);
  if (tipo==="nubank_conta") return rows.map(r=>{
    const v=parseFloat((r["valor"]||r["value"]||"0").replace(",",".")); 
    return { date:r["data"]||r["date"]||"", desc:r["descrição"]||r["descricao"]||"", value:Math.abs(v), kind:v>=0?"inc":"exp", source:"Nubank Conta" };
  }).filter(r=>r.date&&r.value>0);
  if (tipo==="bradesco") return rows.map(r=>{
    const keys=Object.keys(r);
    const dK=keys.find(k=>k.includes("data")),descK=keys.find(k=>k.includes("hist")||k.includes("desc")||k.includes("lança")),vK=keys.find(k=>k.includes("valor")||k.includes("créd")||k.includes("déb"));
    const v=parseFloat((r[vK]||"0").replace(/\./g,"").replace(",","."));
    return { date:r[dK]||"", desc:r[descK]||"", value:Math.abs(v), kind:v>=0?"inc":"exp", source:"Bradesco" };
  }).filter(r=>r.date&&r.value>0&&r.desc);
  return [];
}

function Importador({ exps, setExps, cats }) {
  const [step, setStep]       = useState("upload");
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const [editing, setEditing] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setMsg("Lendo arquivo...");
    try {
      const text = await file.text();
      const tipo = detectBank(text);
      if (tipo==="unknown") { setMsg("❌ Formato não reconhecido. Exporte CSV diretamente do app do banco."); setLoading(false); return; }
      const rows = parseCSVRows(text);
      const parsed = parseTxs(rows, tipo);
      const semDup = parsed.filter(n=>!exps.some(e=>e.value===n.value&&e.date===n.date&&(e.desc||"").slice(0,10)===(n.desc||"").slice(0,10)));
      const dupCount = parsed.length - semDup.length;
      // Categorização simples sem IA (para não travar)
      const catted = semDup.map(p=>{
        const d=p.desc.toLowerCase();
        let cat="outros";
        if(d.includes("ifood")||d.includes("restaur")||d.includes("lanche")||d.includes("mercado")||d.includes("superm")) cat="alimentacao";
        else if(d.includes("uber")||d.includes("gasolina")||d.includes("estacion")||d.includes("onibus")||d.includes("ônibus")) cat="transporte";
        else if(d.includes("farmac")||d.includes("médico")||d.includes("medico")||d.includes("hospital")||d.includes("plano")) cat="saude";
        else if(d.includes("netflix")||d.includes("spotify")||d.includes("cinema")||d.includes("jogo")) cat="lazer";
        else if(d.includes("aluguel")||d.includes("condom")||d.includes("luz")||d.includes("água")||d.includes("internet")) cat="moradia";
        return { ...p, cat };
      });
      setPreview(catted);
      setMsg(dupCount>0?`ℹ️ ${dupCount} item(s) já existiam e foram ignorados`:"");
      setStep("preview");
    } catch(err) { setMsg(`❌ Erro ao ler arquivo: ${err.message}`); }
    setLoading(false);
  }

  function confirmar() {
    const novos = preview.map(p=>{
      const pts=p.date.split(/[-\/]/);
      const dateStr=pts.length===3&&pts[0].length===4?`${pts[2]}/${pts[1]}`:pts.slice(0,2).join("/");
      const cat=cats.find(c=>c.id===p.cat);
      return { id:`imp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, desc:p.desc, kind:p.kind, cat:p.cat, type:p.kind==="inc"?p.source:undefined, emoji:p.kind==="inc"?"🏦":(cat?.emoji||"📦"), value:p.value, date:dateStr, source:p.source };
    });
    setExps(prev=>[...novos,...prev]);
    setStep("done");
  }

  return (
    <div>
      {step==="upload" && <>
        <div style={{ background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:14, padding:20, marginBottom:16, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🏦</div>
          <div style={{ fontSize:15, fontWeight:700, color:"#e2e8f0", marginBottom:8 }}>Importar extrato bancário</div>
          <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6, marginBottom:16 }}>CSV do Nubank ou Bradesco. Os dados ficam só no seu celular.</div>
          <label style={{ display:"block", width:"100%", background:"linear-gradient(135deg,#4f46e5,#4338ca)", borderRadius:10, padding:"11px 0", fontSize:14, fontWeight:700, cursor:"pointer", textAlign:"center", color:"white", fontFamily:"inherit", opacity:loading?0.6:1, boxSizing:"border-box" }}>
            {loading?"⏳ Processando...":"📂 Selecionar arquivo CSV"}
            <input type="file" accept=".csv,.CSV" style={{ display:"none" }} onChange={handleFile} disabled={loading}/>
          </label>
        </div>
        {loading && <div style={{ textAlign:"center", padding:16 }}>
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:8 }}><span className="dot"/><span className="dot"/><span className="dot"/></div>
          <div style={{ fontSize:13, color:"#64748b" }}>{msg}</div>
        </div>}
        {msg&&!loading && <div style={{ fontSize:13, color:msg.startsWith("❌")?"#f87171":"#818cf8", textAlign:"center", padding:"8px 12px", background:"rgba(99,102,241,0.06)", borderRadius:10, marginBottom:12 }}>{msg}</div>}
        <SecTitle t="Como exportar o CSV"/>
        {[
          {bank:"💜 Nubank — Cartão",steps:["Abra o app Nubank","Cartão de crédito → Todos os lançamentos","··· → Exportar por e-mail","Abra o e-mail e salve o CSV"]},
          {bank:"💜 Nubank — Conta",steps:["Abra o app Nubank","Extrato → ···","Exportar extrato → salve o CSV"]},
          {bank:"🔴 Bradesco",steps:["App ou internet banking","Extrato → selecione o período","Exportar → CSV"]},
        ].map(b=>(
          <div key={b.bank} style={CARD}>
            <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", marginBottom:8 }}>{b.bank}</div>
            {b.steps.map((s,i)=><div key={i} style={{ fontSize:12, color:"#64748b", padding:"2px 0" }}>{i+1}. {s}</div>)}
          </div>
        ))}
      </>}

      {step==="preview" && <>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0" }}>{preview.length} lançamentos</div>
            <div style={{ fontSize:12, color:"#64748b" }}>Toque para editar categoria</div>
          </div>
          <button style={{ fontSize:11, color:"#64748b", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"4px 10px", cursor:"pointer" }} onClick={()=>{setStep("upload");setPreview([]);setMsg("");}}>← Voltar</button>
        </div>
        {msg&&<div style={{ fontSize:12, color:"#818cf8", background:"rgba(99,102,241,0.08)", borderRadius:10, padding:"8px 12px", marginBottom:12 }}>{msg}</div>}
        {preview.map((p,i)=>(
          <div key={i} style={CARD}>
            {editing===i ? <>
              <select style={{ ...inp(), marginBottom:8 }} value={p.cat} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,cat:e.target.value}:x))}>
                {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
              <select style={{ ...inp(), marginBottom:8 }} value={p.kind} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,kind:e.target.value}:x))}>
                <option value="exp">💸 Gasto</option>
                <option value="inc">💰 Entrada</option>
              </select>
              <div style={{ display:"flex", gap:8 }}>
                <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)" })} onClick={()=>setEditing(null)}>✓ Feito</button>
                <button style={btn("rgba(248,113,113,0.1)","#f87171",{ border:"1px solid rgba(248,113,113,0.2)" })} onClick={()=>{setPreview(prev=>prev.filter((_,j)=>j!==i));setEditing(null);}}>Remover</button>
              </div>
            </> : (
              <div style={{ display:"flex", alignItems:"center", gap:10 }} onClick={()=>setEditing(i)}>
                <div style={{ fontSize:11, color:"#475569", width:36, flexShrink:0 }}>{p.date?.slice(0,5)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.desc}</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{cats.find(c=>c.id===p.cat)?.label||p.cat} · {p.source}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:p.kind==="inc"?"#4ade80":"#f87171" }}>{p.kind==="inc"?"+":"-"}R${p.value.toFixed(2)}</div>
                  <div style={{ fontSize:10, color:"#6366f1" }}>✏️</div>
                </div>
              </div>
            )}
          </div>
        ))}
        <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)",undefined,{ fontSize:15, marginTop:8 })} onClick={confirmar}>
          ✅ Importar {preview.length} lançamentos
        </button>
      </>}

      {step==="done" && (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:56, marginBottom:14 }}>🎉</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#4ade80", marginBottom:8 }}>Importado!</div>
          <div style={{ fontSize:14, color:"#64748b", marginBottom:20 }}>Lançamentos já aparecem em Gastos e nos gráficos.</div>
          <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)", width:"auto", padding:"10px 28px" })} onClick={()=>setStep("upload")}>Importar outro arquivo</button>
        </div>
      )}
    </div>
  );
}

// ── CONFIG ──────────────────────────────────────────────────
function Config({ cats, setCats, markets, setMarkets, exps, setExps }) {
  const [sec, setSec] = useState("importar");
  const [showNC, setShowNC] = useState(false);
  const [newCat, setNewCat] = useState({ label:"", emoji:"📁", budget:200, color:"#60a5fa" });
  const [showNM, setShowNM] = useState(false);
  const [newMkt, setNewMkt] = useState({ label:"", emoji:"🏪" });
  const [editMkt, setEditMkt] = useState(null);

  const secs = [{id:"importar",l:"📥 Importar"},{id:"mercados",l:"🛒 Mercados"},{id:"categorias",l:"📂 Categorias"},{id:"dados",l:"🗄️ Dados"}];

  return (
    <div style={{ padding:16, paddingBottom:100 }}>
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
        {secs.map(s=>(
          <button key={s.id} style={{ background:sec===s.id?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.04)", border:sec===s.id?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.08)", color:sec===s.id?"#818cf8":"#64748b", borderRadius:99, padding:"6px 14px", fontSize:12, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, fontFamily:"inherit" }}
            onClick={()=>setSec(s.id)}>{s.l}</button>
        ))}
      </div>

      {sec==="importar" && <Importador exps={exps} setExps={setExps} cats={cats}/>}

      {sec==="mercados" && <>
        <div style={{ fontSize:13, color:"#64748b", marginBottom:14, lineHeight:1.5 }}>💡 Cadastre os mercados da sua cidade para comparação de preços.</div>
        {markets.map(m=>(
          <div key={m.id}>
            {editMkt?.id===m.id ? (
              <div style={CARD}>
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <input style={inp({ width:52, textAlign:"center", fontSize:22, padding:8 })} value={editMkt.emoji} onChange={e=>setEditMkt(p=>({...p,emoji:e.target.value}))}/>
                  <input style={inp({ flex:1 })} value={editMkt.label} onChange={e=>setEditMkt(p=>({...p,label:e.target.value}))}/>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)" })} onClick={()=>setEditMkt(null)}>Cancelar</button>
                  <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={()=>{setMarkets(p=>p.map(x=>x.id===editMkt.id?{...x,...editMkt}:x));setEditMkt(null);}}>Salvar</button>
                </div>
              </div>
            ) : (
              <div style={ROW}>
                <div style={{ fontSize:22, width:38, height:38, borderRadius:10, background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center" }}>{m.emoji}</div>
                <span style={{ flex:1, fontSize:14, fontWeight:600, color:"#e2e8f0" }}>{m.label}</span>
                <button style={{ fontSize:11, color:"#818cf8", background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:6, padding:"4px 10px", cursor:"pointer", marginRight:6 }} onClick={()=>setEditMkt({...m})}>✏️</button>
                <button style={{ fontSize:11, color:"#f87171", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:6, padding:"4px 10px", cursor:"pointer" }} onClick={()=>markets.length>1&&setMarkets(p=>p.filter(x=>x.id!==m.id))}>✕</button>
              </div>
            )}
          </div>
        ))}
        {showNM ? (
          <div style={CARD}>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input style={inp({ width:52, textAlign:"center", fontSize:22, padding:8 })} placeholder="🏪" value={newMkt.emoji} onChange={e=>setNewMkt(p=>({...p,emoji:e.target.value}))}/>
              <input style={inp({ flex:1 })} placeholder="Nome do mercado" value={newMkt.label} onChange={e=>setNewMkt(p=>({...p,label:e.target.value}))}/>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)" })} onClick={()=>setShowNM(false)}>Cancelar</button>
              <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={()=>{if(newMkt.label){setMarkets(p=>[...p,{...newMkt,id:`m${Date.now()}`}]);setShowNM(false);setNewMkt({label:"",emoji:"🏪"});}}}>Adicionar</button>
            </div>
          </div>
        ) : (
          <button style={{ width:"100%", background:"transparent", border:"2px dashed rgba(99,102,241,0.3)", color:"#818cf8", borderRadius:12, padding:13, fontSize:13, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setShowNM(true)}>+ Adicionar mercado</button>
        )}
      </>}

      {sec==="categorias" && <>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0" }}>Categorias</div>
          <button style={{ fontSize:11, background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)", borderRadius:8, padding:"4px 12px", cursor:"pointer" }} onClick={()=>setShowNC(!showNC)}>+ Nova</button>
        </div>
        {showNC && (
          <div style={{ ...CARD, background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)" }}>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input style={inp({ width:52, textAlign:"center", fontSize:20, padding:8 })} placeholder="📁" value={newCat.emoji} onChange={e=>setNewCat(p=>({...p,emoji:e.target.value}))}/>
              <input style={inp({ flex:1 })} placeholder="Nome da categoria" value={newCat.label} onChange={e=>setNewCat(p=>({...p,label:e.target.value}))}/>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {PRESETS.map(c=><button key={c} style={{ width:28, height:28, borderRadius:6, background:c, border:newCat.color===c?"2px solid white":"2px solid transparent", cursor:"pointer" }} onClick={()=>setNewCat(p=>({...p,color:c}))}/>)}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{ border:"1px solid rgba(255,255,255,0.1)" })} onClick={()=>setShowNC(false)}>Cancelar</button>
              <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={()=>{if(newCat.label){setCats(p=>[...p,{...newCat,id:`c${Date.now()}`}]);setShowNC(false);setNewCat({label:"",emoji:"📁",budget:200,color:"#60a5fa"});}}}>Criar</button>
            </div>
          </div>
        )}
        {cats.map(cat=>(
          <div key={cat.id} style={ROW}>
            <div style={{ width:34, height:34, borderRadius:8, background:`${cat.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cat.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{cat.label}</div>
              <div style={{ fontSize:11, color:"#64748b" }}>Limite: {fmt(cat.budget)} <span style={{ color:cat.color }}>●</span></div>
            </div>
            <button style={{ fontSize:11, color:"#f87171", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:6, padding:"3px 8px", cursor:"pointer" }} onClick={()=>cats.length>1&&setCats(p=>p.filter(c=>c.id!==cat.id))}>✕</button>
          </div>
        ))}
      </>}

      {sec==="dados" && <div style={CARD}>
        <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", marginBottom:8 }}>🗄️ Dados</div>
        <div style={{ fontSize:13, color:"#64748b", marginBottom:16 }}>{exps.length} lançamentos · {cats.length} categorias · {markets.length} mercados</div>
        <button style={btn("linear-gradient(135deg,#1d4ed8,#1e40af)",undefined,{ marginBottom:10 })} onClick={()=>{
          const blob=new Blob([JSON.stringify({exps,cats,markets},null,2)],{type:"application/json"});
          const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meufinanceiro-backup.json`;a.click();
        }}>📤 Exportar backup JSON</button>
        <button style={btn("rgba(248,113,113,0.1)","#f87171",{ border:"1px solid rgba(248,113,113,0.3)" })} onClick={()=>{setExps([]);setCats(CATS_DEF);setMarkets(MKTS_DEF);}}>🗑️ Apagar todos os dados</button>
      </div>}
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────
export default function App() {
  const [tab,     setTab]     = useState("dashboard");
  const [exps,    setExps]    = useState([]);
  const [cats,    setCats]    = useState(CATS_DEF);
  const [markets, setMarkets] = useState(MKTS_DEF);
  const [openWith, setOpenWith] = useState(null);
  const [hideVals, setHideVals] = useState(false);
  const mask = v => hideVals ? "R$ ••••" : v;

  const totalInc = exps.filter(e=>e.kind==="inc").reduce((s,e)=>s+e.value,0);
  const totalExp = exps.filter(e=>e.kind==="exp").reduce((s,e)=>s+e.value,0);
  const saldo    = totalInc - totalExp;

  const TABS = [
    {id:"dashboard",emoji:"📊",label:"Resumo"},
    {id:"graficos", emoji:"📈",label:"Gráficos"},
    {id:"orcamento",emoji:"💰",label:"Orçamento"},
    {id:"gastos",   emoji:"💸",label:"Gastos"},
    {id:"mercado",  emoji:"🛒",label:"Mercado"},
    {id:"ia",       emoji:"🤖",label:"IA"},
    {id:"config",   emoji:"⚙️",label:"Config"},
  ];

  return (
    <div style={{ fontFamily:"'Outfit',sans-serif", background:"#080e1d", minHeight:"100vh", color:"#e2e8f0", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto", paddingTop:"env(safe-area-inset-top,0px)" }}>
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

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#0d1b3e,#162547)", padding:"14px 20px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>
            {new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f1f5f9" }}>Meu Financeiro</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, color:"#475569", marginBottom:1 }}>Saldo</div>
            <div style={{ fontSize:17, fontWeight:800, color:saldo>=0?"#4ade80":"#f87171" }}>{hideVals?"R$ ••••":fmt(saldo)}</div>
          </div>
          <button style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#94a3b8", fontSize:18, padding:"6px 8px", cursor:"pointer" }} onClick={()=>setHideVals(v=>!v)}>{hideVals?"🙈":"👁️"}</button>
          <button style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#94a3b8", fontSize:18, padding:"6px 8px", cursor:"pointer" }} onClick={()=>setTab("config")}>⚙️</button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
        {tab==="dashboard" && <Dashboard exps={exps} cats={cats} hide={hideVals}/>}
        {tab==="graficos"  && <Graficos  exps={exps} cats={cats} hide={hideVals}/>}
        {tab==="orcamento" && <Orcamento exps={exps} cats={cats} setCats={setCats} hide={hideVals}/>}
        {tab==="gastos"    && <Gastos    exps={exps} setExps={setExps} cats={cats} openWith={openWith} onOpened={()=>setOpenWith(null)} hide={hideVals}/>}
        {tab==="mercado"   && <Mercado   markets={markets}/>}
        {tab==="ia"        && <IAChat    exps={exps} cats={cats}/>}
        {tab==="config"    && <Config    cats={cats} setCats={setCats} markets={markets} setMarkets={setMarkets} exps={exps} setExps={setExps}/>}
      </div>

      {/* FABs */}
      {tab!=="ia" && tab!=="config" && (
        <div style={{ position:"fixed", bottom:76, right:16, display:"flex", flexDirection:"column", gap:8, zIndex:49 }}>
          <button style={{ width:46, height:46, borderRadius:"50%", background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", color:"white", fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(34,197,94,0.4)", fontWeight:700 }}
            onClick={()=>{setOpenWith("income"); setTab("gastos");}}>+💰</button>
          <button style={{ width:46, height:46, borderRadius:"50%", background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", color:"white", fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(239,68,68,0.4)", fontWeight:700 }}
            onClick={()=>{setOpenWith("expense"); setTab("gastos");}}>+💸</button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(8,14,29,0.97)", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", overflowX:"auto", padding:"6px 2px 10px", backdropFilter:"blur(20px)", zIndex:50 }}>
        {TABS.map(t=>(
          <button key={t.id} style={{ flex:"0 0 auto", minWidth:60, background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"4px 2px", opacity:tab===t.id?1:0.38, transition:"opacity 0.15s" }} onClick={()=>setTab(t.id)}>
            <span style={{ fontSize:18 }}>{t.emoji}</span>
            <span style={{ fontSize:8, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
