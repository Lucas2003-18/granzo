import { useState } from 'react';
import { fmt, fmtPct, dateKey } from '../utils/format';
import { MESES, MESES_CURTO, INC_TIPOS, CONTAS_DEF } from '../utils/constants';
import { ROW, CARD } from '../utils/styles';
import { Bar, SecTitle, AlertBox } from './ui';
import { gerarRelatorioPDF } from '../utils/pdf';

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
  let projecao=null, projecaoEconomia=null, diasRestantes=null, mediadiaria=null;
  if(mesFiltro!=="todos"&&mesFiltro===mesAtual&&gastos.length>0){
    const hoje=new Date().getDate();
    const [anoP,mesN]=mesFiltro.split("-");
    const diasMes=new Date(+anoP,+mesN,0).getDate();
    diasRestantes=diasMes-hoje;
    mediadiaria=totalExp/hoje;
    if(hoje>=3&&hoje<diasMes&&totalExp>0){
      projecao=mediadiaria*diasMes;
      if(totalInc>0) projecaoEconomia=totalInc-projecao;
    }
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
      {/* Nudge de backup */}
      {exps.length>0&&(()=>{
        let last=null;
        try{ last=localStorage.getItem("mf_last_export"); }catch{}
        const dias=last?Math.floor((Date.now()-new Date(last).getTime())/86400000):null;
        if(dias!==null&&dias<7) return null;
        const txt=dias===null
          ?"⚠️ Você ainda não fez backup. Vá em ⚙️ Config → Dados → Exportar backup JSON e guarde o arquivo."
          :`⚠️ Último backup há ${dias} dias. Faça um novo em ⚙️ Config → Dados → Exportar.`;
        return <AlertBox tipo="warn" texto={txt}/>;
      })()}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          ["Salário/Renda",fmt(totalInc),"#3DBA6F"],
          ["Gastos",fmt(totalExp),"#E05252"],
          ["Saldo",fmt(totalInc-totalExp),(totalInc-totalExp)>=0?"#3DBA6F":"#E05252"],
          ["Poupança",txPoup.toFixed(0)+"%",txPoup>=20?"#3DBA6F":txPoup>=10?"#E8A832":"#E05252"],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:"#181E19",borderRadius:12,padding:"12px 10px",border:`1px solid ${c}33`,textAlign:"center"}}>
            <div style={{fontSize:9,color:"#536057",textTransform:"uppercase",marginBottom:3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:800,color:c}}>{hide?"••••":v}</div>
          </div>
        ))}
      </div>

      {/* Métricas extras */}
      {!hide&&(totalInv>0||totalTransf>0||diffPct!==null)&&(
        <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
          {totalInv>0&&<div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#536057",textTransform:"uppercase"}}>Investido</div>
            <div style={{fontSize:13,fontWeight:700,color:"#34d399"}}>{fmt(totalInv)}</div>
          </div>}
          {totalTransf>0&&<div style={{background:"rgba(143,168,147,0.08)",border:"1px solid rgba(143,168,147,0.2)",borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#536057",textTransform:"uppercase"}}>Transferências</div>
            <div style={{fontSize:13,fontWeight:700,color:"#8FA893"}}>{fmt(totalTransf)}</div>
          </div>}
          {diffPct!==null&&<div style={{background:diffPct>0?"rgba(224,82,82,0.08)":"rgba(61,186,111,0.08)",border:`1px solid ${diffPct>0?"rgba(224,82,82,0.2)":"rgba(61,186,111,0.2)"}`,borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:9,color:"#536057",textTransform:"uppercase"}}>Vs {mesAnterior}</div>
            <div style={{fontSize:13,fontWeight:700,color:diffPct>0?"#E05252":"#3DBA6F"}}>{fmtPct(diffPct)}</div>
          </div>}
        </div>
      )}

      {/* Projeção do mês — card expandido */}
      {!hide&&projecao!==null&&(()=>{
        const [anoP,mesN]=mesFiltro.split("-");
        const diasMes=new Date(+anoP,+mesN,0).getDate();
        const hoje=new Date().getDate();
        const pctMes=Math.round((hoje/diasMes)*100);
        const ok=projecaoEconomia>=0;
        // Quanto ainda pode gastar por dia para fechar no zero
        const saldoAtual=totalInc-totalExp;
        const limiteDiario=saldoAtual>0&&diasRestantes>0?saldoAtual/diasRestantes:null;
        // Semáforo: verde <70% renda, amarelo 70-90%, vermelho >90%
        const pctProjecao=totalInc>0?(projecao/totalInc)*100:0;
        const semaforo=pctProjecao<=70?"#3DBA6F":pctProjecao<=90?"#E8A832":"#E05252";
        return <div style={{background:"rgba(61,186,111,0.07)",border:`1px solid ${semaforo}33`,borderLeft:`3px solid ${semaforo}`,borderRadius:14,padding:"14px 16px",marginBottom:14}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#DDE8DF"}}>📅 Projeção do mês</div>
            <div style={{fontSize:11,color:"#536057"}}>{diasRestantes}d restantes</div>
          </div>
          {/* Barra de progresso do mês */}
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:10,color:"#536057"}}>Mês: dia {hoje} de {diasMes}</span>
              <span style={{fontSize:10,color:"#536057"}}>{pctMes}% decorrido</span>
            </div>
            <div style={{background:"#232B24",borderRadius:99,height:4,overflow:"hidden"}}>
              <div style={{width:`${pctMes}%`,height:"100%",background:"#536057",borderRadius:99}}/>
            </div>
          </div>
          {/* Métricas principais */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{background:"#181E19",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:"#536057",textTransform:"uppercase",marginBottom:4}}>Gasto até agora</div>
              <div style={{fontSize:15,fontWeight:800,color:"#E05252"}}>{fmt(totalExp)}</div>
              <div style={{fontSize:10,color:"#536057",marginTop:2}}>{fmt(mediadiaria)}/dia em média</div>
            </div>
            <div style={{background:"#181E19",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:"#536057",textTransform:"uppercase",marginBottom:4}}>Se continuar assim</div>
              <div style={{fontSize:15,fontWeight:800,color:semaforo}}>{fmt(projecao)}</div>
              <div style={{fontSize:10,color:"#536057",marginTop:2}}>no fim do mês</div>
            </div>
          </div>
          {/* Limite diário restante */}
          {limiteDiario!==null&&limiteDiario>0&&<div style={{background:"rgba(61,186,111,0.06)",border:"1px solid rgba(61,186,111,0.15)",borderRadius:10,padding:"9px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>💡</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#3DBA6F"}}>Gaste até {fmt(limiteDiario)}/dia</div>
              <div style={{fontSize:10,color:"#536057"}}>para fechar o mês no zero com sua renda atual</div>
            </div>
          </div>}
          {!ok&&<div style={{background:"rgba(224,82,82,0.07)",border:"1px solid rgba(224,82,82,0.2)",borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>⚠️</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#E05252"}}>Renda insuficiente no ritmo atual</div>
              <div style={{fontSize:10,color:"#536057"}}>Reduza {fmt(Math.abs(mediadiaria-(totalInc/diasMes)))}/dia para equilibrar</div>
            </div>
          </div>}
          {ok&&projecaoEconomia>0&&<div style={{background:"rgba(61,186,111,0.06)",border:"1px solid rgba(61,186,111,0.15)",borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>✅</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#3DBA6F"}}>Projeção de sobra: {fmt(projecaoEconomia)}</div>
              <div style={{fontSize:10,color:"#536057"}}>mantendo o ritmo de {fmt(mediadiaria)}/dia</div>
            </div>
          </div>}
        </div>;
      })()}

      {/* Por conta */}
      {(()=>{
        const contasDef=contas||CONTAS_DEF;
        const contasComDados=contasDef.filter(c=>c.id!=="geral"&&exps.some(e=>e.conta===c.id));
        if(contasComDados.length===0) return null;
        return <>
          <div style={{margin:"14px 0 8px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#536057",textTransform:"uppercase",letterSpacing:"0.1em"}}>Por conta</div>
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
                {cInc>0&&<div style={{fontSize:10,color:"#536057"}}>💼 <span style={{color:"#3DBA6F"}}>{hide?"••••":fmt(cInc)}</span></div>}
                {cExp>0&&<div style={{fontSize:10,color:"#536057"}}>💸 <span style={{color:"#E05252"}}>{hide?"••••":fmt(cExp)}</span></div>}
                {cTransfRec>0&&<div style={{fontSize:10,color:"#536057"}}>↔️ <span style={{color:"#8FA893"}}>{hide?"••••":fmt(cTransfRec)}</span></div>}
                <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${c.color}22`,fontSize:11,fontWeight:800,color:saldo>=0?"#3DBA6F":"#E05252"}}>{hide?"••••":fmt(saldo)}</div>
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
            <div style={{fontSize:11,fontWeight:700,color:"#536057",textTransform:"uppercase",letterSpacing:"0.1em"}}>Reservas / Caixinhas</div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
            {reservas.map(r=>{
              const pct=r.meta>0?Math.min(100,(r.saldo/r.meta)*100):null;
              return <div key={r.id} style={{flexShrink:0,minWidth:120,background:"rgba(61,186,111,0.07)",border:"1px solid rgba(61,186,111,0.2)",borderRadius:12,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                  <span style={{fontSize:16}}>{r.emoji}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#3DBA6F",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nome}</span>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:"#DDE8DF"}}>{hide?"••••":fmt(r.saldo)}</div>
                {r.meta>0&&<>
                  <Bar pct={pct} color="#3DBA6F"/>
                  <div style={{fontSize:9,color:"#536057"}}>{pct.toFixed(0)}% de {hide?"••••":fmt(r.meta)}</div>
                </>}
              </div>;
            })}
            <div style={{flexShrink:0,minWidth:100,background:"#181E19",border:"1px solid #232B24",borderRadius:12,padding:"10px 12px",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
              <div style={{fontSize:9,color:"#536057",textTransform:"uppercase",marginBottom:4}}>Total</div>
              <div style={{fontSize:14,fontWeight:800,color:"#3DBA6F"}}>{hide?"••••":fmt(totalRes)}</div>
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
        return <div style={{...CARD,marginBottom:14,borderLeft:`3px solid ${ok?"#3DBA6F":pct>60?"#E8A832":"#E05252"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:700,color:"#DDE8DF"}}>🎯 Meta de economia</div>
            <div style={{fontSize:12,color:ok?"#3DBA6F":pct>60?"#E8A832":"#E05252",fontWeight:700}}>
              {ok?"✓ Atingida!":pct.toFixed(0)+"%"}
            </div>
          </div>
          <Bar pct={pct} color={ok?"#3DBA6F":pct>60?"#E8A832":"#E05252"}/>
          <div style={{fontSize:11,color:"#536057",marginTop:4}}>
            {hide?"••••":fmt(poupadoReal)} poupado de {hide?"••••":fmt(meta)} planejados
            {!ok&&<span style={{color:"#E05252"}}> · faltam {hide?"••••":fmt(faltam)}</span>}
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
              <span style={{fontSize:13,fontWeight:600,color:"#DDE8DF"}}>{cat.label}</span>
              <span style={{fontSize:12,color:spent>cat.budget&&cat.budget>0?"#E05252":"#536057"}}>{hide?"••••":fmt(spent)+(cat.budget>0?"/"+fmt(cat.budget):"")}</span>
            </div>
            {cat.budget>0&&<Bar pct={pct} color={spent>cat.budget?"#E05252":pct>75?"#E8A832":cat.color}/>}
          </div>
          <span style={{fontSize:14,color:"#536057",flexShrink:0}}>›</span>
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
          return <div key={f.id} style={{...ROW,borderLeft:`3px solid ${jaLancado?"#3DBA6F":"#E8A832"}`}}>
            <span style={{fontSize:20}}>{f.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF"}}>{f.desc}</div>
              <div style={{fontSize:11,color:"#536057"}}>{cat?.label||"Outros"} · todo mês</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
              <span style={{fontSize:13,fontWeight:700,color:"#8FA893"}}>{hide?"••••":fmt(f.valor)}</span>
              <span style={{fontSize:10,color:jaLancado?"#3DBA6F":"#E8A832",fontWeight:700}}>{jaLancado?"✓ lançado":"⚠️ pendente"}</span>
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
              <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
              <div style={{fontSize:11,color:"#536057"}}>{e.date}</div>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:"#E05252",flexShrink:0}}>{hide?"••••":fmt(e.value)}</span>
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
              <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.desc}</div>
              <div style={{fontSize:11,color:"#536057"}}>{r.count}x · {hide?"••••":fmt(r.value)}</div>
            </div>
            {!jaEhFixa&&onAddFixa&&<button
              style={{fontSize:10,color:"#3DBA6F",background:"rgba(61,186,111,0.1)",border:"1px solid rgba(61,186,111,0.12)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit"}}
              onClick={()=>onAddFixa(r)}>+ Fixas</button>}
            {jaEhFixa&&<span style={{fontSize:10,color:"#3DBA6F",flexShrink:0}}>✓ fixa</span>}
          </div>;
        })}
      </>}

      {/* Últimos lançamentos */}
      <SecTitle t="Últimos lançamentos"/>
      {[...allExps].sort((a,b)=>dateKey(b.date).localeCompare(dateKey(a.date))||b.id-a.id).slice(0,6).map(e=>{
        const cat=cats.find(c=>c.id===e.cat);
        const isTransf=e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret"||e.incType==="outro");
        const incLabel=e.kind==="inc"?(INC_TIPOS.find(t=>t.id===e.incType)?.label||e.type||"Entrada"):null;
        return <div key={e.id} style={{...ROW,...(e.kind==="inc"?{borderColor:isTransf?"rgba(143,168,147,0.2)":"rgba(61,186,111,0.2)",background:isTransf?"rgba(143,168,147,0.03)":"rgba(61,186,111,0.04)"}:{})}}>
          <div style={{width:38,height:38,borderRadius:10,background:e.kind==="inc"?(isTransf?"rgba(143,168,147,0.1)":"rgba(61,186,111,0.12)"):"#232B24",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{e.emoji||cat?.emoji||"📦"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
            <div style={{fontSize:11,color:"#536057"}}>{e.kind==="inc"?incLabel:(cat?.label||"Outros")} · {e.date}</div>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:e.kind==="inc"?(isTransf?"#8FA893":"#3DBA6F"):"#E05252",flexShrink:0}}>{hide?"••••":(e.kind==="inc"?"+":"-")+fmt(e.value)}</span>
        </div>;
      })}
      {/* Botões de ação do mês */}
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
${totalInvRes>0?"📈 Investido: "+fmt(totalInvRes)+"\n":""}💰 Saldo: ${fmt(saldoRes)} (${poupPct}% poupado)

📋 Por categoria:
${linCats}

—
Gerado pelo Granzo`;
          if(navigator.share){navigator.share({text:txt}).catch(()=>{});}
          else{navigator.clipboard?.writeText(txt).then(()=>showToast("📋 Resumo copiado!")).catch(()=>showToast("❌ Não foi possível copiar"));}
        }
        return <div style={{display:"flex",gap:8}}>
          <button style={{flex:1,background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.25)",color:"#E05252",borderRadius:12,padding:"11px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>gerarRelatorioPDF(exps,cats,fixas,reservas,meta,mesFiltro,showToast)}>
            📄 Relatório PDF
          </button>
          <button style={{flex:1,background:"rgba(61,186,111,0.1)",border:"1px solid rgba(61,186,111,0.12)",color:"#3DBA6F",borderRadius:12,padding:"11px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={gerarResumo}>📤 Compartilhar</button>
        </div>;
      })()}

      {/* Estado vazio */}
      {exps.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#536057"}}>
          <div style={{fontSize:52,marginBottom:12}}>📊</div>
          <div style={{fontSize:16,fontWeight:700,color:"#8FA893",marginBottom:8}}>Nenhum lançamento ainda</div>
          <div style={{fontSize:13,lineHeight:1.7,marginBottom:20}}>
            Comece registrando seus gastos e receitas,<br/>ou importe um extrato em <strong style={{color:"#3DBA6F"}}>⚙️ Config → Importar</strong>.
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
