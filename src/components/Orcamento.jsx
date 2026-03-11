import { useState } from 'react';
import { fmt } from '../utils/format';
import { PRESETS } from '../utils/constants';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { Bar, SecTitle } from './ui';

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

export default Orcamento;
