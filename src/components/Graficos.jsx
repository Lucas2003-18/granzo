import { useState } from 'react';
import { fmt } from '../utils/format';
import { MESES_CURTO } from '../utils/constants';
import { CARD } from '../utils/styles';
import { SecTitle } from './ui';

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
              <polygon points={saldoAcum.map((e,i)=>(i*64+16)+","+saldoY(e.saldo)).join(" ")+" "+((saldoAcum.length-1)*64+16)+","+lineH+" 16,"+lineH} fill="url(#saldoGrad)"/>
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

export default Graficos;
