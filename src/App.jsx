import { useState, useRef } from "react";

const GEMINI_KEY = "AIzaSyA-gx5FUXaJfJ4IWU7MciY-gLlUk6D0TII"; // Substitua pela sua chave do Google AI Studio

async function askGemini(systemPrompt, userMessage) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 }
      })
    }
  );
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}


const fmt = v => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

const CATS = [
  { id:"moradia",     label:"Moradia",     emoji:"🏠", budget:1500, spent:1200, color:"#60a5fa" },
  { id:"alimentacao", label:"Alimentação", emoji:"🛒", budget:800,  spent:870,  color:"#4ade80" },
  { id:"transporte",  label:"Transporte",  emoji:"🚗", budget:400,  spent:150,  color:"#f59e0b" },
  { id:"saude",       label:"Saúde",       emoji:"💊", budget:300,  spent:80,   color:"#f472b6" },
  { id:"lazer",       label:"Lazer",       emoji:"🎬", budget:200,  spent:210,  color:"#fb923c" },
  { id:"outros",      label:"Outros",      emoji:"📦", budget:200,  spent:128,  color:"#94a3b8" },
];

const EXPS = [
  { id:1, desc:"Salário março",  kind:"inc", type:"Salário",     emoji:"💼", value:5500, date:"01/03" },
  { id:2, desc:"Supermercado",   kind:"exp", cat:"alimentacao",  emoji:"🛒", value:320,  date:"03/03" },
  { id:3, desc:"Combustível",    kind:"exp", cat:"transporte",   emoji:"🚗", value:150,  date:"03/03" },
  { id:4, desc:"iFood",          kind:"exp", cat:"alimentacao",  emoji:"🛒", value:48,   date:"02/03" },
  { id:5, desc:"Conta de luz",   kind:"exp", cat:"moradia",      emoji:"🏠", value:120,  date:"01/03" },
  { id:6, desc:"Netflix",        kind:"exp", cat:"lazer",        emoji:"🎬", value:55,   date:"01/03" },
];

const PRESETS = ["#60a5fa","#4ade80","#f59e0b","#f472b6","#a78bfa","#fb923c","#34d399","#94a3b8","#f87171","#38bdf8"];

function Bar({ pct, color="#4ade80", thin=false }) {
  return (
    <div style={{background:"rgba(255,255,255,0.08)",borderRadius:99,height:thin?5:8,overflow:"hidden",margin:thin?"4px 0 0":"8px 0 4px"}}>
      <div style={{width:`${Math.min(100,Math.max(0,pct))}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.5s"}}/>
    </div>
  );
}

function SecTitle({ title }) {
  return <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",margin:"18px 0 10px"}}>{title}</div>;
}

function Card({ children, style={} }) {
  return <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px 16px",marginBottom:12,border:"1px solid rgba(255,255,255,0.07)",...style}}>{children}</div>;
}

function Row({ children, style={} }) {
  return <div className="hov" style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"11px 14px",marginBottom:8,border:"1px solid rgba(255,255,255,0.06)",...style}}>{children}</div>;
}

// ── DASHBOARD ────────────────────────────────────────────
function Dashboard() {
  const income=5500, spent=2638, balance=income-spent, savePct=((balance/income)*100);
  const health=74, hc="#f59e0b";
  return (
    <div style={{padding:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[["Renda",fmt(income),"#4ade80","1 entrada"],["Gasto",fmt(spent),"#f59e0b","5 lançamentos"],["Saldo",fmt(balance),"#60a5fa","✅ Positivo"],["Saúde","74","#f59e0b","/ 100 pts"]].map(([l,v,c,s])=>(
          <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 10px",border:`1px solid ${c}33`,textAlign:"center"}}>
            <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{l}</div>
            <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
            <div style={{fontSize:9,color:"#475569",marginTop:3}}>{s}</div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:"#94a3b8",fontWeight:600,textTransform:"uppercase"}}>Orçamento do mês</span>
          <span style={{fontSize:12,color:"#64748b"}}>48%</span>
        </div>
        <Bar pct={48} color="#4ade80"/>
        <div style={{fontSize:11,color:"#475569"}}>{fmt(spent)} de {fmt(income)}</div>
      </Card>

      <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span>🛒</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>Alimentação — 109% do limite</div>
          <Bar pct={109} color="#f87171" thin/>
        </div>
        <span style={{fontSize:13,fontWeight:700,color:"#f87171"}}>⚠️</span>
      </div>

      <SecTitle title="Por categoria"/>
      {CATS.map(cat=>{
        const pct=Math.min(100,(cat.spent/cat.budget)*100), over=cat.spent>cat.budget;
        return (
          <Row key={cat.id}>
            <span style={{fontSize:20,width:26,textAlign:"center"}}>{cat.emoji}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{cat.label}</span>
                <span style={{fontSize:12,color:over?"#f87171":"#64748b"}}>{fmt(cat.spent)}/{fmt(cat.budget)}</span>
              </div>
              <Bar pct={pct} color={over?"#f87171":pct>75?"#f59e0b":cat.color} thin/>
            </div>
          </Row>
        );
      })}

      <SecTitle title="🎯 Metas"/>
      {[{name:"Comprar Carro",emoji:"🚗",saved:2000,target:50000,monthly:1000},{name:"Reserva Emergência",emoji:"🛡️",saved:3500,target:15000,monthly:500}].map(g=>{
        const p=Math.min(100,(g.saved/g.target)*100), mo=Math.ceil((g.target-g.saved)/g.monthly);
        return (
          <Row key={g.name}>
            <span style={{fontSize:22}}>{g.emoji}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{g.name}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>{p.toFixed(0)}%</span>
              </div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:2}}>{fmt(g.saved)}/{fmt(g.target)} · {mo} meses</div>
              <Bar pct={p} color="#a78bfa" thin/>
            </div>
          </Row>
        );
      })}

      <SecTitle title="Últimas movimentações"/>
      {EXPS.slice(0,5).map(e=>(
        <Row key={e.id} style={e.kind==="inc"?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.04)"}:{}}>
          <span style={{fontSize:20,width:26,textAlign:"center"}}>{e.emoji}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{e.desc}</div>
            <div style={{fontSize:11,color:"#475569"}}>{e.kind==="inc"?e.type:CATS.find(c=>c.id===e.cat)?.label} · {e.date}</div>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:e.kind==="inc"?"#4ade80":"#f87171"}}>{e.kind==="inc"?"+":"-"}{fmt(e.value)}</span>
        </Row>
      ))}
    </div>
  );
}

// ── GRÁFICOS ─────────────────────────────────────────────
function Graficos() {
  const hc="#f59e0b";
  const pieData=CATS.filter(c=>c.spent>0), pieTotal=pieData.reduce((s,c)=>s+c.spent,0);
  let cum=-Math.PI/2;
  const sz=180,cx=sz/2,cy=sz/2,r=sz*.38,ir=sz*.22;
  const slices=pieData.map(d=>{const a=(d.spent/pieTotal)*Math.PI*2,sa=cum;cum+=a;return{...d,sa,ea:cum};});
  function arc(sa,ea){
    const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa),x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${ea-sa>Math.PI?1:0} 1 ${x2} ${y2} Z`;
  }

  const months=[{l:"nov",inc:5000,exp:4200,sav:800},{l:"dez",inc:5500,exp:5100,sav:400},{l:"jan",inc:5000,exp:3800,sav:1200},{l:"fev",inc:5500,exp:4100,sav:1400},{l:"mar",inc:5500,exp:2638,sav:2862}];
  const lW=280,lH=110,maxV=6000;
  const pts=key=>months.map((m,i)=>{const x=16+(i/(months.length-1))*(lW-32),y=lH-8-(m[key]/maxV)*(lH-20);return `${x},${y}`;}).join(" ");

  return (
    <div style={{padding:16}}>
      <SecTitle title="💪 Saúde Financeira"/>
      <Card style={{textAlign:"center",padding:"20px 16px"}}>
        <svg width={200} height={110} viewBox="0 0 200 110" style={{display:"block",margin:"0 auto 8px"}}>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={18} strokeLinecap="round"/>
          <path d="M 20 100 A 80 80 0 0 1 148.7 52.6" fill="none" stroke={hc} strokeWidth={18} strokeLinecap="round" style={{filter:`drop-shadow(0 0 8px ${hc}88)`}}/>
          <text x="100" y="86" textAnchor="middle" fill={hc} fontSize="30" fontWeight="800" fontFamily="Outfit,sans-serif">74</text>
          <text x="100" y="104" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="Outfit,sans-serif">/ 100</text>
          <text x="20" y="115" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="Outfit,sans-serif">0</text>
          <text x="180" y="115" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="Outfit,sans-serif">100</text>
        </svg>
        <div style={{fontSize:18,fontWeight:800,color:hc,marginBottom:12}}>Boa 👍</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,textAlign:"left"}}>
          {[["Poupança","✅ 48%","#4ade80"],["Orçamento","✅ OK","#4ade80"],["Metas","✅ Ativas","#4ade80"],["Renda","✅ Registrada","#4ade80"]].map(([l,v,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",marginBottom:3}}>{l}</div>
              <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <SecTitle title="🥧 Gastos por Categoria"/>
      <Card>
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
          <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
            {slices.map((s,i)=><path key={i} d={arc(s.sa,s.ea)} fill={s.color} opacity={.85} stroke="#080e1d" strokeWidth={2}/>)}
            <circle cx={cx} cy={cy} r={ir} fill="#0f172a"/>
            <text x={cx} y={cy-5} textAnchor="middle" fill="#e2e8f0" fontSize={10} fontWeight="700" fontFamily="Outfit,sans-serif">Total</text>
            <text x={cx} y={cy+10} textAnchor="middle" fill="#4ade80" fontSize={11} fontWeight="800" fontFamily="Outfit,sans-serif">{fmt(pieTotal)}</text>
          </svg>
        </div>
        {[...pieData].sort((a,b)=>b.spent-a.spent).map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"4px 0"}}>
            <div style={{width:10,height:10,borderRadius:2,background:c.color,flexShrink:0}}/>
            <span style={{flex:1,fontSize:13,color:"#cbd5e1"}}>{c.emoji} {c.label}</span>
            <span style={{fontSize:13,fontWeight:700,color:c.color}}>{fmt(c.spent)}</span>
            <span style={{fontSize:11,color:"#64748b",width:34,textAlign:"right"}}>{((c.spent/pieTotal)*100).toFixed(0)}%</span>
          </div>
        ))}
      </Card>

      <SecTitle title="📊 Orçado vs Realizado"/>
      <Card>
        <div style={{display:"flex",gap:14,marginBottom:10}}>
          {[["rgba(99,102,241,0.7)","Orçado"],["#f59e0b","Realizado"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,borderRadius:2,background:c}}/><span style={{fontSize:11,color:"#94a3b8"}}>{l}</span></div>
          ))}
        </div>
        <div style={{overflowX:"auto"}}>
          <svg width={CATS.length*56} height={175} style={{display:"block"}}>
            {CATS.map((cat,i)=>{
              const mx=Math.max(...CATS.map(c=>Math.max(c.budget,c.spent)));
              const bH=(cat.budget/mx)*120,sH=(cat.spent/mx)*120,x=i*56+6;
              const pct=cat.budget>0?Math.round((cat.spent/cat.budget)*100):0;
              const over=cat.spent>cat.budget;
              const barColor=over?"#f87171":"#f59e0b";
              return (
                <g key={cat.id}>
                  {/* % label above spent bar */}
                  <text x={x+29} y={130-sH-5} textAnchor="middle" fill={over?"#f87171":"#94a3b8"} fontSize="9" fontWeight="700" fontFamily="Outfit,sans-serif">{pct}%</text>
                  {/* budget bar */}
                  <rect x={x} y={130-bH} width={20} height={bH} rx={3} fill="rgba(99,102,241,0.55)"/>
                  {/* spent bar */}
                  <rect x={x+22} y={130-sH} width={20} height={sH} rx={3} fill={barColor}/>
                  {/* emoji label */}
                  <text x={x+20} y={147} textAnchor="middle" fill="#64748b" fontSize="13" fontFamily="Outfit,sans-serif">{cat.emoji}</text>
                  {/* over-budget bang */}
                  {over&&<text x={x+31} y={128-sH} textAnchor="middle" fill="#f87171" fontSize="9" fontFamily="Outfit,sans-serif">!</text>}
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      <SecTitle title="📉 Evolução Mensal"/>
      <Card>
        <div style={{display:"flex",gap:14,marginBottom:10}}>
          {[["#4ade80","Renda"],["#f87171","Gastos"],["#60a5fa","Poupado"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:18,height:3,background:c,borderRadius:99}}/><span style={{fontSize:11,color:"#94a3b8"}}>{l}</span></div>
          ))}
        </div>
        <svg width="100%" viewBox={`0 0 ${lW} ${lH+24}`} style={{display:"block"}}>
          {[["inc","#4ade80"],["exp","#f87171"],["sav","#60a5fa"]].map(([k,c])=>(
            <g key={k}>
              <polyline points={pts(k)} fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 4px ${c}66)`}}/>
              {months.map((m,i)=>{const x=16+(i/(months.length-1))*(lW-32),y=lH-8-(m[k]/maxV)*(lH-20);return <circle key={i} cx={x} cy={y} r={3} fill={c}/>;} )}
            </g>
          ))}
          {months.map((m,i)=>{const x=16+(i/(months.length-1))*(lW-32);return <text key={i} x={x} y={lH+18} textAnchor="middle" fill="#475569" fontSize="10" fontFamily="Outfit,sans-serif">{m.l}</text>;})}
        </svg>
        <div style={{marginTop:8}}>
          {[...months].reverse().slice(0,3).map(m=>(
            <div key={m.l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              <span style={{color:"#94a3b8",width:36}}>{m.l}</span>
              <span style={{color:"#4ade80"}}>+{fmt(m.inc)}</span>
              <span style={{color:"#f87171"}}>-{fmt(m.exp)}</span>
              <span style={{color:"#60a5fa",fontWeight:700}}>{fmt(m.sav)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── ORÇAMENTO ─────────────────────────────────────────────
function Orcamento() {
  const [cats,setCats]=useState(CATS);
  return (
    <div style={{padding:16}}>
      <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#94a3b8",lineHeight:1.5}}>
        💡 Edite os limites de cada categoria. Para criar/excluir, use ⚙️ Configurações.
      </div>
      {cats.map((cat,idx)=>{
        const pct=Math.min(100,(cat.spent/cat.budget)*100),over=cat.spent>cat.budget;
        return (
          <div key={cat.id} style={{background:"rgba(255,255,255,0.03)",borderRadius:14,padding:14,marginBottom:10,border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cat.emoji}</div>
              <span style={{flex:1,fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{cat.label}</span>
              <span style={{fontSize:12,color:over?"#f87171":"#64748b"}}>{fmt(cat.spent)} gasto</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>Limite R$</span>
              <input style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#e2e8f0",padding:"8px 12px",fontSize:15,fontWeight:700,width:"100%",outline:"none"}}
                type="number" value={cat.budget} onChange={e=>setCats(p=>p.map((c,i)=>i===idx?{...c,budget:+e.target.value}:c))}/>
            </div>
            <Bar pct={pct} color={over?"#f87171":pct>75?"#f59e0b":cat.color} thin/>
            <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{pct.toFixed(0)}% · {fmt(Math.max(0,cat.budget-cat.spent))} restante</div>
          </div>
        );
      })}
    </div>
  );
}

// ── GASTOS ────────────────────────────────────────────────
function Gastos({ openWith, onOpened, importados }) {
  const [exps,setExps]=useState(EXPS);
  const todosExps = [...(props.importados||[]), ...exps].sort((a,b)=>b.id-a.id);
  const [show,setShow]=useState(false);
  const [mode,setMode]=useState("expense");
  const props = { importados };
  React.useEffect(()=>{
    if(openWith){setMode(openWith);setShow(true);onOpened&&onOpened();}
  },[openWith]);
  const [form,setForm]=useState({desc:"",value:"",cat:"alimentacao"});
  function add(){
    if(!form.desc||!form.value)return;
    setExps(p=>[{id:Date.now(),desc:form.desc,kind:mode==="expense"?"exp":"inc",emoji:mode==="expense"?"📦":"💰",cat:form.cat,type:"Outro",value:+form.value,date:"03/03"},...p]);
    setForm({desc:"",value:"",cat:"alimentacao"});setShow(false);
  }
  return (
    <div style={{padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:14,fontWeight:700,color:"#cbd5e1",textTransform:"uppercase",letterSpacing:"0.06em"}}>Lançamentos</span>
        <div style={{display:"flex",gap:8}}>
          <button style={{fontSize:12,background:"rgba(74,222,128,0.15)",color:"#4ade80",border:"1px solid rgba(74,222,128,0.3)",borderRadius:8,padding:"5px 12px",cursor:"pointer"}} onClick={()=>{setMode("income");setShow(true);}}>+💰</button>
          <button style={{fontSize:12,background:"rgba(248,113,113,0.15)",color:"#f87171",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,padding:"5px 12px",cursor:"pointer"}} onClick={()=>{setMode("expense");setShow(true);}}>+💸</button>
        </div>
      </div>
      {show&&(
        <div style={{background:"rgba(17,24,39,0.98)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:16,padding:20,marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginBottom:14}}>{mode==="income"?"💰 Nova entrada":"💸 Novo gasto"}</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[["expense","💸 Gasto","#f87171"],["income","💰 Entrada","#4ade80"]].map(([m,l,c])=>(
              <button key={m} style={{flex:1,borderRadius:10,padding:10,fontSize:13,fontWeight:700,cursor:"pointer",background:mode===m?`${c}22`:"rgba(255,255,255,0.05)",border:mode===m?`1px solid ${c}55`:"1px solid rgba(255,255,255,0.1)",color:mode===m?c:"#94a3b8"}} onClick={()=>setMode(m)}>{l}</button>
            ))}
          </div>
          <input style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#e2e8f0",padding:"11px 13px",fontSize:14,marginBottom:10,outline:"none"}} placeholder="Descrição" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}/>
          <input style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#e2e8f0",padding:"11px 13px",fontSize:14,marginBottom:14,outline:"none"}} type="number" placeholder="Valor (R$)" value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:10,padding:11,fontSize:14,cursor:"pointer"}} onClick={()=>setShow(false)}>Cancelar</button>
            <button style={{flex:1,background:mode==="income"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",color:"white",borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={add}>Salvar</button>
          </div>
        </div>
      )}
      {todosExps.map(e=>(
        <Row key={e.id} style={e.kind==="inc"?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.04)"}:{}}>
          <div style={{fontSize:22,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:10,background:e.kind==="inc"?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.06)"}}>{e.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{e.desc}</div>
            <div style={{fontSize:11,color:"#475569",marginTop:2}}>{e.kind==="inc"?e.type:CATS.find(c=>c.id===e.cat)?.label} · {e.date}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <span style={{fontSize:14,fontWeight:700,color:e.kind==="inc"?"#4ade80":"#f87171"}}>{e.kind==="inc"?"+":"-"}{fmt(e.value)}</span>
            <button style={{fontSize:10,color:"#475569",background:"none",border:"none",cursor:"pointer"}} onClick={()=>setExps(p=>p.filter(x=>x.id!==e.id))}>✕</button>
          </div>
        </Row>
      ))}
    </div>
  );
}

// ── CONFIG ────────────────────────────────────────────────
const DEFAULT_MARKETS = [
  {id:"carrefour",   label:"Carrefour",    emoji:"🔵"},
  {id:"paodeacucar", label:"Pão de Açúcar",emoji:"🍞"},
  {id:"atacadao",    label:"Atacadão",     emoji:"🏭"},
  {id:"enxuto",      label:"Enxuto",       emoji:"🟢"},
  {id:"higa",        label:"Higa Atacado", emoji:"🟡"},
];

function Config({ markets, setMarkets, existentes, onImport }) {
  const [cats,setCats]       = useState(CATS);
  const [sec,setSec]         = useState("mercados");
  const [showNewCat,setShowNewCat] = useState(false);
  const [newCat,setNewCat]   = useState({label:"",emoji:"📁",budget:200,color:"#60a5fa"});
  const [showNewMkt,setShowNewMkt] = useState(false);
  const [newMkt,setNewMkt]   = useState({label:"",emoji:"🏪"});
  const [editMkt,setEditMkt] = useState(null); // {id,label,emoji}

  function addCat(){if(!newCat.label)return;setCats(p=>[...p,{...newCat,id:`c${Date.now()}`,spent:0}]);setShowNewCat(false);setNewCat({label:"",emoji:"📁",budget:200,color:"#60a5fa"});}
  function addMkt(){if(!newMkt.label)return;setMarkets(p=>[...p,{...newMkt,id:`m${Date.now()}`}]);setShowNewMkt(false);setNewMkt({label:"",emoji:"🏪"});}
  function saveEditMkt(){if(!editMkt.label)return;setMarkets(p=>p.map(m=>m.id===editMkt.id?{...m,...editMkt}:m));setEditMkt(null);}
  function delMkt(id){if(markets.length<=1)return;setMarkets(p=>p.filter(m=>m.id!==id));}

  const inpStyle={width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#e2e8f0",padding:"10px 13px",fontSize:14,outline:"none",marginBottom:10,boxSizing:"border-box"};
  const secs=[{id:"importar",l:"📥 Importar"},{id:"mercados",l:"🛒 Mercados"},{id:"categorias",l:"📂 Categorias"},{id:"perfil",l:"👤 Perfil"},{id:"dados",l:"🗄️ Dados"}];

  return (
    <div style={{padding:16}}>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {secs.map(s=>(
          <button key={s.id} style={{background:sec===s.id?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.04)",border:sec===s.id?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.08)",color:sec===s.id?"#818cf8":"#64748b",borderRadius:99,padding:"6px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}} onClick={()=>setSec(s.id)}>{s.l}</button>
        ))}
      </div>

      {/* ── IMPORTAR ── */}
      {sec==="importar"&&<Importador onImport={onImport} existentes={existentes}/>}

      {/* ── MERCADOS ── */}
      {sec==="mercados"&&<>
        <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#94a3b8",lineHeight:1.5}}>
          💡 Cadastre os supermercados da sua cidade. A IA vai comparar preços entre eles na aba Mercado.
        </div>

        {/* Lista de mercados */}
        {markets.map(m=>(
          <div key={m.id}>
            {editMkt?.id===m.id ? (
              <div style={{background:"rgba(99,102,241,0.08)",borderRadius:14,padding:14,marginBottom:10,border:"1px solid rgba(99,102,241,0.25)"}}>
                <div style={{fontSize:12,color:"#818cf8",fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Editando mercado</div>
                <div style={{display:"flex",gap:8,marginBottom:0}}>
                  <input style={{...inpStyle,width:60,marginBottom:0,textAlign:"center",fontSize:22,padding:"8px"}} value={editMkt.emoji} onChange={e=>setEditMkt(p=>({...p,emoji:e.target.value}))}/>
                  <input style={{...inpStyle,flex:1,marginBottom:0}} placeholder="Nome do mercado" value={editMkt.label} onChange={e=>setEditMkt(p=>({...p,label:e.target.value}))}/>
                </div>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:9,fontSize:13,cursor:"pointer"}} onClick={()=>setEditMkt(null)}>Cancelar</button>
                  <button style={{flex:1,background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:8,padding:9,fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={saveEditMkt}>Salvar</button>
                </div>
              </div>
            ) : (
              <div className="hov" style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",marginBottom:8,border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{fontSize:24,width:42,height:42,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>{m.emoji}</div>
                <span style={{flex:1,fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{m.label}</span>
                <button style={{fontSize:11,color:"#818cf8",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer",marginRight:6}} onClick={()=>setEditMkt({...m})}>✏️</button>
                <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}} onClick={()=>delMkt(m.id)}>✕</button>
              </div>
            )}
          </div>
        ))}

        {/* Formulário novo mercado */}
        {showNewMkt ? (
          <div style={{background:"rgba(99,102,241,0.08)",borderRadius:14,padding:14,marginTop:4,border:"1px solid rgba(99,102,241,0.25)"}}>
            <div style={{fontSize:12,color:"#818cf8",fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Novo mercado</div>
            <div style={{display:"flex",gap:8}}>
              <input style={{...inpStyle,width:60,marginBottom:10,textAlign:"center",fontSize:22,padding:"8px"}} placeholder="🏪" value={newMkt.emoji} onChange={e=>setNewMkt(p=>({...p,emoji:e.target.value}))}/>
              <input style={{...inpStyle,flex:1,marginBottom:10}} placeholder="Ex: Atacadão do Bairro" value={newMkt.label} onChange={e=>setNewMkt(p=>({...p,label:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addMkt()}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:10,fontSize:13,cursor:"pointer"}} onClick={()=>setShowNewMkt(false)}>Cancelar</button>
              <button style={{flex:1,background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:8,padding:10,fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={addMkt}>Adicionar</button>
            </div>
          </div>
        ) : (
          <button style={{width:"100%",marginTop:4,background:"transparent",border:"2px dashed rgba(99,102,241,0.3)",color:"#818cf8",borderRadius:12,padding:13,fontSize:13,cursor:"pointer"}} onClick={()=>setShowNewMkt(true)}>
            + Adicionar mercado
          </button>
        )}

        <div style={{marginTop:14,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"10px 14px",border:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6,fontWeight:600}}>💡 Sobre os preços</div>
          <div style={{fontSize:12,color:"#475569",lineHeight:1.6}}>A IA estima preços com base nos seus dados de treinamento. Para preços 100% precisos, você pode lançar manualmente na aba Mercado após visitar os supermercados.</div>
        </div>
      </>}

      {/* ── CATEGORIAS ── */}
      {sec==="categorias"&&<>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>📂 Categorias</div>
            <button style={{fontSize:11,background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,padding:"4px 12px",cursor:"pointer"}} onClick={()=>setShowNewCat(!showNewCat)}>+ Nova</button>
          </div>
          {showNewCat&&(
            <div style={{background:"rgba(99,102,241,0.08)",borderRadius:12,padding:14,marginBottom:12,border:"1px solid rgba(99,102,241,0.2)"}}>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input style={{width:54,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#e2e8f0",padding:"8px",fontSize:20,outline:"none",textAlign:"center"}} placeholder="🏠" value={newCat.emoji} onChange={e=>setNewCat(p=>({...p,emoji:e.target.value}))}/>
                <input style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#e2e8f0",padding:"8px 12px",fontSize:14,outline:"none"}} placeholder="Nome da categoria" value={newCat.label} onChange={e=>setNewCat(p=>({...p,label:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {PRESETS.map(c=><button key={c} style={{width:28,height:28,borderRadius:6,background:c,border:newCat.color===c?"2px solid white":"2px solid transparent",cursor:"pointer"}} onClick={()=>setNewCat(p=>({...p,color:c}))}/>)}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:9,fontSize:13,cursor:"pointer"}} onClick={()=>setShowNewCat(false)}>Cancelar</button>
                <button style={{flex:1,background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:8,padding:9,fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={addCat}>Criar</button>
              </div>
            </div>
          )}
          {cats.map(cat=>(
            <div key={cat.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{width:34,height:34,borderRadius:8,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cat.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{cat.label}</div>
                <div style={{fontSize:11,color:"#64748b"}}>Limite: {fmt(cat.budget)} <span style={{color:cat.color}}>●</span></div>
              </div>
              <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setCats(p=>p.filter(c=>c.id!==cat.id))}>✕</button>
            </div>
          ))}
        </Card>
      </>}

      {/* ── PERFIL ── */}
      {sec==="perfil"&&<Card>
        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:14}}>👤 Perfil</div>
        {[["Nome","Seu nome completo"],["Cidade","Ex: Campinas"]].map(([l,p])=>(
          <div key={l} style={{marginBottom:10}}>
            <div style={{fontSize:11,color:"#64748b",textTransform:"uppercase",marginBottom:4}}>{l}</div>
            <input style={{...inpStyle,marginBottom:0}} placeholder={p}/>
          </div>
        ))}
        <button style={{width:"100%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:12}}>Salvar perfil</button>
      </Card>}

      {/* ── DADOS ── */}
      {sec==="dados"&&<Card>
        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:12}}>🗄️ Dados</div>
        <button style={{width:"100%",marginBottom:10,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",border:"none",color:"white",borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:"pointer"}}>📤 Exportar backup</button>
        <button style={{width:"100%",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",color:"#f87171",borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:"pointer"}}>🗑️ Apagar todos os dados</button>
      </Card>}
    </div>
  );
}

// ── MERCADO ───────────────────────────────────────────────
const GROCERY = ["Frango (kg)","Carne moída (kg)","Leite integral (L)","Arroz 5kg","Feijão 1kg","Óleo de soja 900ml","Macarrão 500g","Pão de forma","Ovos (dz)","Manteiga 200g","Sabão em pó 1kg","Detergente 500ml"];

function Mercado({ markets }) {
  const [sel,setSel]=useState({"Frango (kg)":true,"Arroz 5kg":true,"Feijão 1kg":true,"Leite integral (L)":true,"Ovos (dz)":true,"Macarrão 500g":true});
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const count=Object.values(sel).filter(Boolean).length;

  async function buscar(){
    setLoading(true);setResult(null);
    const items=Object.keys(sel).filter(k=>sel[k]);
    const mktNames = markets.map(m=>m.label);
    const mktObj   = mktNames.reduce((a,n)=>({...a,[n]:0.00}),{});
    const sys=`Especialista em preços de supermercados em Campinas SP. Responda APENAS JSON sem markdown:
{"items":[{"name":"produto","prices":${JSON.stringify(mktObj)}}],
"recommendation":"mercado","totalByMarket":${JSON.stringify(mktObj)},
"savings":0.00,"tip":"dica curta"}`;
    try{
      const txt = await askGemini(sys, `Preços em Campinas nos mercados: ${mktNames.join(", ")} — produtos: ${items.join(", ")}`);
      setResult(JSON.parse(txt.replace(/```json|```/g,"").trim()));
    }catch{setResult({error:"Não consegui buscar os preços. Tente novamente."});}
    setLoading(false);
  }

  const fmtR=v=>Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

  return (
    <div style={{padding:16}}>
      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 10px"}}>Lista de compras</div>
      <p style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.5}}>Selecione os itens e a IA compara preços nos mercados de Campinas:</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
        {GROCERY.map(item=>(
          <button key={item} style={{background:sel[item]?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.05)",border:sel[item]?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.1)",color:sel[item]?"#818cf8":"#94a3b8",borderRadius:99,padding:"6px 12px",fontSize:12,cursor:"pointer"}} onClick={()=>setSel(p=>({...p,[item]:!p[item]}))}>
            {sel[item]?"✓ ":""}{item}
          </button>
        ))}
      </div>
      <button style={{width:"100%",background:"linear-gradient(135deg,#1d4ed8,#1e40af)",border:"none",color:"white",borderRadius:10,padding:13,fontSize:14,fontWeight:700,cursor:"pointer",opacity:loading||count===0?.6:1}} onClick={buscar} disabled={loading||count===0}>
        {loading?"🔍 Buscando em Campinas...":`🛒 Comparar preços (${count} itens)`}
      </button>
      {loading&&<div style={{textAlign:"center",padding:32}}><div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:12}}><span className="dot"/><span className="dot"/><span className="dot"/></div><p style={{fontSize:13,color:"#64748b"}}>Consultando mercados de Campinas...</p></div>}
      {result&&!result.error&&<>
        <div style={{background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,163,74,0.06))",border:"1px solid rgba(74,222,128,0.25)",borderRadius:16,padding:20,marginTop:16,textAlign:"center"}}>
          <div style={{fontSize:11,color:"#4ade80",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>🏆 Melhor opção para sua lista</div>
          <div style={{fontSize:24,fontWeight:800,color:"#f1f5f9",marginBottom:4}}>{result.recommendation}</div>
          <div style={{fontSize:14,color:"#94a3b8"}}>Economia de até <strong style={{color:"#4ade80"}}>{fmtR(result.savings)}</strong></div>
          {result.tip&&<div style={{fontSize:12,color:"#64748b",marginTop:8,fontStyle:"italic"}}>💡 {result.tip}</div>}
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",margin:"18px 0 10px"}}>Total por mercado</div>
        {Object.entries(result.totalByMarket||{}).sort(([,a],[,b])=>a-b).map(([m,t],i)=>(
          <div key={m} className="hov" style={{display:"flex",alignItems:"center",gap:12,background:i===0?"rgba(74,222,128,0.07)":"rgba(255,255,255,0.03)",borderRadius:12,padding:"11px 14px",marginBottom:8,border:i===0?"1px solid rgba(74,222,128,0.2)":"1px solid rgba(255,255,255,0.06)"}}>
            <span style={{fontSize:16,width:24,textAlign:"center"}}>{["🥇","🥈","🥉","4º","5º"][i]}</span>
            <span style={{flex:1,fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{m}</span>
            <span style={{fontSize:14,fontWeight:700,color:i===0?"#4ade80":"#e2e8f0"}}>{fmtR(t)}</span>
          </div>
        ))}
        <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",margin:"18px 0 10px"}}>Preços por produto</div>
        {result.items?.map(item=>{
          const min=Math.min(...Object.values(item.prices));
          return (
            <div key={item.name} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",marginBottom:10,border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",marginBottom:10}}>{item.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(item.prices).map(([mkt,p])=>(
                  <div key={mkt} style={{flex:"1 0 18%",background:p===min?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.04)",borderRadius:8,padding:"6px 4px",textAlign:"center",border:p===min?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.06)"}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:3,textTransform:"uppercase"}}>{mkt.split(" ")[0]}</div>
                    <div style={{fontSize:12,fontWeight:700,color:p===min?"#4ade80":"#94a3b8"}}>{fmtR(p)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </>}
      {result?.error&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:16,color:"#f87171",fontSize:14,textAlign:"center",marginTop:16}}>{result.error}</div>}
    </div>
  );
}

// ── IA ────────────────────────────────────────────────────
function IAChat() {
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const ref=React.useRef(null);
  const suggs=["Onde estou gastando mais?","Como economizar este mês?","Quando vou conseguir comprar o carro?","Estou no caminho certo?"];

  async function send(){
    if(!input.trim()||loading)return;
    const msg=input.trim();setInput("");setLoading(true);
    setMsgs(p=>[...p,{role:"user",text:msg}]);
    const sys=`Consultor financeiro pessoal. Usuário em Campinas/SP.
Renda: R$5.500, Gasto este mês: R$2.638, Saldo: R$2.862, Poupado: 52%
Categorias: Moradia R$1.200/R$1.500, Alimentação R$870/R$800 (acima!), Transporte R$150/R$400, Lazer R$210/R$200
Metas: Carro R$2.000/R$50.000 (48 meses), Reserva R$3.500/R$15.000
Responda em português, máx 150 palavras, prático e direto.`;
    try{
      const txt = await askGemini(sys, msg);
      setMsgs(p=>[...p,{role:"ai",text:txt||"Não entendi, tente novamente."}]);
    }catch{setMsgs(p=>[...p,{role:"ai",text:"Ops, problema de conexão. Tente novamente! 😅"}]);}
    setLoading(false);
    setTimeout(()=>ref.current?.scrollTo(0,99999),100);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <div style={{display:"flex",gap:12,alignItems:"center",padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.02)"}}>
        <div style={{fontSize:26,background:"rgba(99,102,241,0.2)",borderRadius:12,width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(99,102,241,0.3)"}}>🤖</div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0"}}>Consultor Financeiro IA</div>
          <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Baseado nos seus dados reais</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:12}} ref={ref}>
        {msgs.length===0&&(
          <div style={{textAlign:"center",marginTop:16}}>
            <div style={{fontSize:40,marginBottom:10}}>💬</div>
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:18}}>Pergunte qualquer coisa sobre suas finanças!</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {suggs.map(s=><button key={s} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8",borderRadius:10,padding:"10px 14px",fontSize:13,cursor:"pointer",textAlign:"left"}} onClick={()=>setInput(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{padding:"12px 16px",borderRadius:14,maxWidth:"82%",fontSize:14,lineHeight:1.6,...(m.role==="user"?{alignSelf:"flex-end",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"white",borderBottomRightRadius:4}:{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",color:"#e2e8f0",border:"1px solid rgba(255,255,255,0.08)",borderBottomLeftRadius:4})}}>
            {m.text}
          </div>
        ))}
        {loading&&<div style={{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,borderBottomLeftRadius:4,padding:"12px 16px",display:"flex",gap:5}}><span className="dot"/><span className="dot"/><span className="dot"/></div>}
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 16px",background:"rgba(255,255,255,0.02)",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <input style={{flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e2e8f0",padding:"11px 14px",fontSize:14,outline:"none"}} placeholder="Pergunte algo..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button style={{background:"linear-gradient(135deg,#4f46e5,#4338ca)",border:"none",color:"white",borderRadius:12,width:44,height:44,fontSize:16,cursor:"pointer"}} onClick={send}>➤</button>
      </div>
    </div>
  );
}


// ── IMPORTADOR BANCÁRIO ───────────────────────────────────
const CAT_LIST = ["moradia","alimentacao","transporte","saude","educacao","lazer","vestuario","outros"];
const CAT_LABELS = {moradia:"Moradia",alimentacao:"Alimentação",transporte:"Transporte",saude:"Saúde",educacao:"Educação",lazer:"Lazer",vestuario:"Vestuário",outros:"Outros"};

function detectBank(text) {
  const t = text.toLowerCase();
  if (t.includes("nu pagamentos") || t.includes("nubank") || (t.includes("date") && t.includes("title") && t.includes("amount"))) return "nubank_card";
  if (t.includes("data lançamento") || t.includes("data lancamento") || t.includes("bradesco")) return "bradesco";
  if (t.includes("data") && t.includes("descrição") && t.includes("valor") && !t.includes("bradesco")) return "nubank_account";
  return "unknown";
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(h => h.trim().replace(/"/g,"").toLowerCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    const row = {};
    header.forEach((h, i) => row[h] = (cols[i]||"").replace(/"/g,"").trim());
    return row;
  });
}

function parseNubankCard(rows) {
  return rows.map(r => {
    const val = parseFloat((r.amount||"0").replace(",","."));
    return { date: r.date||"", desc: r.title||r.description||"", value: Math.abs(val), kind: "exp", source: "nubank_card" };
  }).filter(r => r.date && r.value > 0);
}

function parseNubankAccount(rows) {
  return rows.map(r => {
    const val = parseFloat((r["valor"]||r["value"]||"0").replace(",","."));
    const desc = r["descrição"]||r["descricao"]||r["description"]||"";
    const date = r["data"]||r["date"]||"";
    return { date, desc, value: Math.abs(val), kind: val >= 0 ? "inc" : "exp", source: "nubank_account" };
  }).filter(r => r.date && r.value > 0);
}

function parseBradesco(rows) {
  return rows.map(r => {
    const keys = Object.keys(r);
    const dateKey = keys.find(k => k.includes("data"));
    const descKey = keys.find(k => k.includes("hist") || k.includes("desc") || k.includes("lançamento") || k.includes("lancamento"));
    const valKey  = keys.find(k => k.includes("valor") || k.includes("crédito") || k.includes("débito") || k.includes("credito") || k.includes("debito"));
    const val = parseFloat(((r[valKey]||"0")).replace(/\./g,"").replace(",","."));
    const desc = r[descKey]||"";
    const date = r[dateKey]||"";
    return { date, desc, value: Math.abs(val), kind: val >= 0 ? "inc" : "exp", source: "bradesco" };
  }).filter(r => r.date && r.value > 0 && r.desc);
}

function deduplicar(novos, existentes) {
  return novos.filter(n => {
    return !existentes.some(e =>
      e.value === n.value &&
      e.date === n.date &&
      e.desc?.toLowerCase().slice(0,12) === n.desc?.toLowerCase().slice(0,12)
    );
  });
}

async function categorizarIA(itens) {
  if (!GEMINI_KEY || GEMINI_KEY === "SUA_CHAVE_AQUI") {
    return itens.map(i => ({ ...i, cat: "outros" }));
  }
  const sys = `Você é um categorizador de transações bancárias brasileiras.
Categorias disponíveis: moradia, alimentacao, transporte, saude, educacao, lazer, vestuario, outros.
Responda APENAS JSON array sem markdown: [{"i":0,"cat":"categoria"}]
Regras: iFood/restaurante/mercado=alimentacao, uber/99/gasolina/estacionamento=transporte, 
farmácia/médico/hospital=saude, netflix/spotify/cinema/jogo=lazer, shopping/roupa/calçado=vestuario,
aluguel/condomínio/luz/água/internet=moradia, escola/curso/livro=educacao, resto=outros`;
  const lista = itens.map((it,i) => `${i}:${it.desc}`).join("\n");
  try {
    const txt = await askGemini(sys, lista);
    const clean = txt.replace(/\`\`\`json|\`\`\`/g,"").trim();
    const cats = JSON.parse(clean);
    return itens.map((it, i) => {
      const found = cats.find(c => c.i === i);
      return { ...it, cat: found?.cat || "outros" };
    });
  } catch {
    return itens.map(i => ({ ...i, cat: "outros" }));
  }
}

function Importador({ onImport, existentes }) {
  const [step, setStep]       = useState("upload"); // upload | preview | done
  const [bank, setBank]       = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setMsg("Lendo arquivo...");
    const text = await file.text();
    const tipo = detectBank(text);
    setBank(tipo);
    const rows = parseCSV(text);
    let parsed = [];
    if (tipo === "nubank_card")    parsed = parseNubankCard(rows);
    else if (tipo === "nubank_account") parsed = parseNubankAccount(rows);
    else if (tipo === "bradesco")  parsed = parseBradesco(rows);
    else { setMsg("❌ Formato não reconhecido. Tente exportar novamente."); setLoading(false); return; }

    const semDup = deduplicar(parsed, existentes);
    const diff = parsed.length - semDup.length;
    setMsg(`🤖 Categorizando ${semDup.length} lançamentos com IA...`);
    const categorizados = await categorizarIA(semDup);
    setPreview(categorizados);
    setStep("preview");
    setMsg(diff > 0 ? `ℹ️ ${diff} duplicata(s) ignorada(s)` : "");
    setLoading(false);
  }

  function confirmar() {
    const fmt = (d) => {
      // normalizar data para DD/MM
      const parts = d.split(/[-\/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[2]}/${parts[1]}`; // YYYY-MM-DD
        return `${parts[0]}/${parts[1]}`; // DD/MM/YYYY
      }
      return d;
    };
    const novos = preview.map(p => ({
      id: `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      desc: p.desc,
      kind: p.kind,
      cat: p.cat,
      type: p.kind === "inc" ? "Importado" : undefined,
      emoji: p.kind === "inc" ? "🏦" : (CAT_LABELS[p.cat] ? "📦" : "📦"),
      value: p.value,
      date: fmt(p.date),
      source: p.source,
    }));
    onImport(novos);
    setStep("done");
  }

  const bankName = { nubank_card:"Nubank Cartão", nubank_account:"Nubank Conta", bradesco:"Bradesco", unknown:"Desconhecido" };
  const inpStyle = {background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#e2e8f0",padding:"8px 10px",fontSize:13,outline:"none",width:"100%"};

  return (
    <div style={{padding:16}}>
      {/* STEP: UPLOAD */}
      {step==="upload"&&<>
        <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:20,marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:10}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Importar extrato bancário</div>
          <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:16}}>Selecione o CSV exportado do Nubank ou Bradesco. Os dados ficam só no seu celular.</div>
          <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleFile}/>
          <button style={{width:"100%",background:"linear-gradient(135deg,#4f46e5,#4338ca)",border:"none",color:"white",borderRadius:10,padding:13,fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
            {loading ? "Processando..." : "📂 Selecionar arquivo CSV"}
          </button>
        </div>

        {loading&&<div style={{textAlign:"center",padding:20}}>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:10}}><span className="dot"/><span className="dot"/><span className="dot"/></div>
          <div style={{fontSize:13,color:"#64748b"}}>{msg}</div>
        </div>}
        {msg&&!loading&&<div style={{fontSize:13,color:"#f87171",textAlign:"center",marginTop:8}}>{msg}</div>}

        <div style={{marginTop:8}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Como exportar o CSV</div>
          {[
            {bank:"💜 Nubank Cartão", steps:["Abra o app Nubank","Toque em 'Cartão de crédito'","Vá em 'Todos os lançamentos'","Toque nos 3 pontinhos ···","Exportar por e-mail → abra o CSV"]},
            {bank:"💜 Nubank Conta", steps:["Abra o app Nubank","Vá em 'Extrato'","Toque nos 3 pontinhos ···","Exportar extrato → CSV"]},
            {bank:"🔴 Bradesco", steps:["Acesse o app ou internet banking","Vá em Extrato","Selecione o período","Exportar → CSV ou OFX"]},
          ].map(b=>(
            <div key={b.bank} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",marginBottom:10,border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>{b.bank}</div>
              {b.steps.map((s,i)=><div key={i} style={{fontSize:12,color:"#64748b",padding:"2px 0"}}>{i+1}. {s}</div>)}
            </div>
          ))}
        </div>
      </>}

      {/* STEP: PREVIEW */}
      {step==="preview"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{bankName[bank]}</div>
            <div style={{fontSize:12,color:"#64748b"}}>{preview.length} lançamentos prontos para importar</div>
          </div>
          <button style={{fontSize:11,color:"#64748b",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 10px",cursor:"pointer"}} onClick={()=>{setStep("upload");setPreview([]);setMsg("");}}>← Voltar</button>
        </div>
        {msg&&<div style={{fontSize:12,color:"#818cf8",background:"rgba(99,102,241,0.08)",borderRadius:10,padding:"8px 12px",marginBottom:12}}>{msg}</div>}

        {/* Lista prévia — editável */}
        <div style={{marginBottom:14}}>
          {preview.map((p,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"10px 12px",marginBottom:8,border:"1px solid rgba(255,255,255,0.06)"}}>
              {editing===i ? (
                <div>
                  <div style={{fontSize:11,color:"#818cf8",fontWeight:600,marginBottom:8,textTransform:"uppercase"}}>Editando</div>
                  <input style={{...inpStyle,marginBottom:8}} value={p.desc} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,desc:e.target.value}:x))} placeholder="Descrição"/>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <select style={{...inpStyle,flex:1}} value={p.cat} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,cat:e.target.value}:x))}>
                      {CAT_LIST.map(c=><option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                    </select>
                    <select style={{...inpStyle,width:110}} value={p.kind} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,kind:e.target.value}:x))}>
                      <option value="exp">💸 Gasto</option>
                      <option value="inc">💰 Entrada</option>
                    </select>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:8,fontSize:13,cursor:"pointer"}} onClick={()=>setEditing(null)}>Feito</button>
                    <button style={{flex:1,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",color:"#f87171",borderRadius:8,padding:8,fontSize:13,cursor:"pointer"}} onClick={()=>{setPreview(prev=>prev.filter((_,j)=>j!==i));setEditing(null);}}>Remover</button>
                  </div>
                </div>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setEditing(i)}>
                  <div style={{fontSize:11,color:"#475569",width:36,flexShrink:0}}>{p.date?.slice(0,5)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.desc}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{CAT_LABELS[p.cat]||p.cat}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:p.kind==="inc"?"#4ade80":"#f87171"}}>{p.kind==="inc"?"+":"-"}R${p.value.toFixed(2)}</div>
                    <div style={{fontSize:10,color:"#475569"}}>✏️ editar</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button style={{width:"100%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:12,padding:14,fontSize:15,fontWeight:800,cursor:"pointer"}} onClick={confirmar}>
          ✅ Importar {preview.length} lançamentos
        </button>
      </>}

      {/* STEP: DONE */}
      {step==="done"&&<div style={{textAlign:"center",padding:"60px 20px"}}>
        <div style={{fontSize:60,marginBottom:16}}>🎉</div>
        <div style={{fontSize:20,fontWeight:800,color:"#4ade80",marginBottom:8}}>Importado com sucesso!</div>
        <div style={{fontSize:14,color:"#64748b",marginBottom:24}}>Os lançamentos já aparecem na aba Gastos e nos gráficos.</div>
        <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:10,padding:"10px 24px",fontSize:14,cursor:"pointer"}} onClick={()=>setStep("upload")}>Importar outro arquivo</button>
      </div>}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────
function App() {
  const [tab,setTab]=useState("dashboard");
  const [markets,setMarkets]=useState(DEFAULT_MARKETS);
  const [openGastos,setOpenGastos]=useState(null);
  const [allExps,setAllExps]=useState([]);
  function handleImport(novos){ setAllExps(p=>[...novos,...p]); }
  const TABS=[{id:"dashboard",emoji:"📊",label:"Resumo"},{id:"graficos",emoji:"📈",label:"Gráficos"},{id:"orcamento",emoji:"💰",label:"Orçamento"},{id:"gastos",emoji:"💸",label:"Gastos"},{id:"mercado",emoji:"🛒",label:"Mercado"},{id:"ia",emoji:"🤖",label:"IA"},{id:"config",emoji:"⚙️",label:"Config"}];
  return (
    <div style={{fontFamily:"'Outfit',sans-serif",background:"#080e1d",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",paddingTop:"env(safe-area-inset-top)"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0d1b3e,#162547)",padding:"16px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Campinas · março de 2025</div>
          <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em"}}>Meu Financeiro</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:"rgba(245,158,11,0.15)",color:"#fbbf24",border:"1px solid rgba(245,158,11,0.3)",borderRadius:99,fontSize:11,fontWeight:700,padding:"4px 10px"}}>🔔 1</div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#475569",marginBottom:2}}>Saldo</div>
            <div style={{fontSize:18,fontWeight:800,color:"#4ade80"}}>R$ 2.862,00</div>
          </div>
          <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#94a3b8",fontSize:18,padding:"6px 8px",cursor:"pointer"}} onClick={()=>setTab("config")}>⚙️</button>
        </div>
      </div>

      {/* Alert strip */}
      <div style={{background:"rgba(245,158,11,0.1)",borderBottom:"1px solid rgba(245,158,11,0.2)",padding:"7px 20px",fontSize:12,color:"#fbbf24"}}>
        ⚠️ 🛒 <strong>Alimentação</strong> em 109% do limite
      </div>

      <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
        {tab==="dashboard" && <Dashboard/>}
        {tab==="graficos"  && <Graficos/>}
        {tab==="orcamento" && <Orcamento/>}
        {tab==="gastos"    && <Gastos openWith={openGastos} onOpened={()=>setOpenGastos(null)} importados={allExps}/>}
        {tab==="mercado"   && <Mercado markets={markets}/>}
        {tab==="ia"        && <IAChat/>}
        {tab==="config"    && <Config markets={markets} setMarkets={setMarkets} existentes={allExps} onImport={handleImport}/>}
      </div>

      {/* FABs */}
      {tab!=="ia"&&tab!=="config"&&<div style={{position:"fixed",bottom:78,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:49}}>
        <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(34,197,94,0.35)",fontWeight:700}} onClick={()=>{setTab("gastos");setOpenGastos("income");}}>+💰</button>
        <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.35)",fontWeight:700}} onClick={()=>{setTab("gastos");setOpenGastos("expense");}}>+💸</button>
      </div>}

      {/* Nav — scrollável para caber 7 abas */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(8,14,29,0.97)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",overflowX:"auto",padding:"8px 4px 12px",backdropFilter:"blur(20px)",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} style={{flex:"0 0 auto",minWidth:62,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 2px",opacity:tab===t.id?1:0.4,transition:"opacity 0.2s"}} onClick={()=>setTab(t.id)}>
            <span style={{fontSize:18}}>{t.emoji}</span>
            <span style={{fontSize:8,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
