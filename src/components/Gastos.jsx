import { useState, useRef, useEffect } from 'react';
import { fmt, fmtDate, dateKey } from '../utils/format';
import { INC_TIPOS, CATS_DEF } from '../utils/constants';
import { categorizar, detectIncType } from '../utils/categorizar';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { SecTitle, ConfirmModal, SwipeRow } from './ui';

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
        </SwipeRow>
      })}
    </div>
  );
}

// ── MERCADO ────────────────────────────────────────────────
// Caderninho de preços reais — o usuário registra o que pagou, o app compara

export default Gastos;
