import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { Bar, ConfirmModal } from './ui';

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
      <button style={{background:"none",border:"none",color:"#3DBA6F",fontSize:13,cursor:"pointer",padding:"0 0 12px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}} onClick={()=>setSelId(null)}>
        ← Voltar
      </button>

      {/* Card principal */}
      <div style={{background:"rgba(61,186,111,0.1)",border:"1px solid rgba(61,186,111,0.12)",borderRadius:18,padding:20,marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:6}}>{sel.emoji}</div>
        <div style={{fontSize:18,fontWeight:800,color:"#DDE8DF",marginBottom:4}}>{sel.nome}</div>
        <div style={{fontSize:28,fontWeight:800,color:"#3DBA6F",marginBottom:sel.meta>0?8:0}}>{hide?"••••":fmt(sel.saldo)}</div>
        {sel.meta>0&&(()=>{
          const pct=Math.min(100,(sel.saldo/sel.meta)*100);
          return <>
            <Bar pct={pct} color={pct>=100?"#3DBA6F":"#3DBA6F"}/>
            <div style={{fontSize:11,color:"#536057",marginTop:4}}>
              {pct.toFixed(0)}% da meta · {hide?"••••":fmt(sel.meta-sel.saldo>0?sel.meta-sel.saldo:0)} {sel.saldo>=sel.meta?"✓ Meta atingida!":"para atingir a meta"}
            </div>
          </>;
        })()}
      </div>

      {/* Botões de ação */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button style={{...btn("rgba(61,186,111,0.15)","#3DBA6F",{border:"1px solid rgba(61,186,111,0.3)",flex:1}),padding:"10px 0"}}
          onClick={()=>{setFormMov(p=>({...p,tipo:"depositar"}));setShowMov(true);}}>+ Depositar</button>
        <button style={{...btn("rgba(224,82,82,0.15)","#E05252",{border:"1px solid rgba(224,82,82,0.3)",flex:1}),padding:"10px 0"}}
          onClick={()=>{setFormMov(p=>({...p,tipo:"retirar"}));setShowMov(true);}}>− Retirar</button>
        <button style={{...btn("rgba(61,186,111,0.15)","#3DBA6F",{border:"1px solid rgba(61,186,111,0.12)",width:44}),padding:"10px 0"}}
          onClick={()=>{const n=prompt("Novo nome:",sel.nome);if(n?.trim())setReservas(p=>p.map(r=>r.id===sel.id?{...r,nome:n.trim()}:r));
          }}>✏️</button>
        <button style={{...btn("#232B24","#8FA893",{border:"1px solid #2E3A2F",width:44}),padding:"10px 0"}}
          onClick={()=>excluirReserva(sel.id)}>🗑️</button>
      </div>

      {/* Formulário movimentação */}
      {showMov&&(
        <div style={{background:"rgba(17,23,19,0.98)",border:"1px solid rgba(61,186,111,0.12)",borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:formMov.tipo==="depositar"?"#3DBA6F":"#E05252",marginBottom:12}}>
            {formMov.tipo==="depositar"?"💚 Depositar":"🔴 Retirar"}
          </div>
          <input style={{...inp(),marginBottom:10}} type="number" placeholder="Valor (R$)" value={formMov.valor} onChange={e=>setFormMov(p=>({...p,valor:e.target.value}))}/>
          <input style={{...inp(),marginBottom:10}} placeholder="Descrição (opcional)" value={formMov.desc} onChange={e=>setFormMov(p=>({...p,desc:e.target.value}))}/>
          <input style={{...inp({colorScheme:"dark"}),marginBottom:10}} type="date" value={formMov.date} onChange={e=>setFormMov(p=>({...p,date:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("#232B24","#8FA893",{border:"1px solid #2E3A2F"})} onClick={()=>setShowMov(false)}>Cancelar</button>
            <button style={btn(formMov.tipo==="depositar"?"#3DBA6F":"#E05252",formMov.tipo==="depositar"?"#0A0F0D":"#fff")} onClick={registrarMov}>Confirmar</button>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div style={{fontSize:11,fontWeight:700,color:"#536057",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Histórico</div>
      {(!sel.movs||sel.movs.length===0)&&(
        <div style={{textAlign:"center",padding:"30px 0",color:"#536057",fontSize:13}}>Nenhuma movimentação ainda</div>
      )}
      {(sel.movs||[]).map(m=>(
        <div key={m.id} style={{...ROW,borderLeft:`3px solid ${m.tipo==="depositar"?"#3DBA6F":"#E05252"}`}}>
          <span style={{fontSize:20}}>{m.tipo==="depositar"?"⬆️":"⬇️"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF"}}>{m.desc}</div>
            <div style={{fontSize:11,color:"#536057"}}>{m.date}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,fontWeight:700,color:m.tipo==="depositar"?"#3DBA6F":"#E05252"}}>
              {m.tipo==="depositar"?"+":"-"}{hide?"••••":fmt(m.valor)}
            </span>
            <button style={{fontSize:11,color:"#536057",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}} onClick={()=>excluirMov(sel.id,m.id)}>🗑️</button>
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
        okLabel="Excluir" okColor="#E05252"
        onOk={()=>{setReservas(p=>p.filter(r=>r.id!==confirmReserva));if(selId===confirmReserva)setSelId(null);setConfirmReserva(null);}}
        onCancel={()=>setConfirmReserva(null)}/>}
      {/* Totalizador */}
      {reservas.length>0&&(
        <div style={{background:"rgba(61,186,111,0.08)",border:"1px solid rgba(61,186,111,0.12)",borderRadius:16,padding:16,marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:10,color:"#536057",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Total em reservas</div>
          <div style={{fontSize:26,fontWeight:800,color:"#3DBA6F"}}>{hide?"••••":fmt(totalReservas)}</div>
        </div>
      )}

      {/* Botão nova reserva */}
      {!showNew&&(
        <button style={btn("#3DBA6F","#0A0F0D",{marginBottom:16})} onClick={()=>setShowNew(true)}>
          + Nova reserva / caixinha
        </button>
      )}

      {/* Formulário nova reserva */}
      {showNew&&(
        <div style={{background:"rgba(17,23,19,0.98)",border:"1px solid rgba(61,186,111,0.12)",borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:"#3DBA6F",marginBottom:14}}>🏦 Nova reserva</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={inp({width:52,textAlign:"center",fontSize:22,padding:8})} placeholder="💰" value={novaRes.emoji} onChange={e=>setNovaRes(p=>({...p,emoji:e.target.value}))}/>
            <input style={inp({flex:1})} placeholder="Nome (ex: Emergência, Viagem...)" value={novaRes.nome} onChange={e=>setNovaRes(p=>({...p,nome:e.target.value}))}/>
          </div>
          <div style={{fontSize:11,color:"#536057",marginBottom:4}}>Meta (opcional)</div>
          <input style={{...inp(),marginBottom:12}} type="number" placeholder="R$ 0 = sem meta" value={novaRes.meta} onChange={e=>setNovaRes(p=>({...p,meta:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("#232B24","#8FA893",{border:"1px solid #2E3A2F"})} onClick={()=>setShowNew(false)}>Cancelar</button>
            <button style={btn("#3DBA6F","#0A0F0D")} onClick={criarReserva}>Criar</button>
          </div>
        </div>
      )}

      {/* Lista de reservas */}
      {reservas.length===0&&!showNew&&(
        <div style={{textAlign:"center",padding:"50px 20px",color:"#536057"}}>
          <div style={{fontSize:48,marginBottom:12}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:"#8FA893",marginBottom:8}}>Nenhuma reserva ainda</div>
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
          <div key={r.id} style={{...CARD,cursor:"pointer",borderLeft:`3px solid rgba(61,186,111,0.35)`}} onClick={()=>setSelId(r.id)}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:"rgba(61,186,111,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{r.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#DDE8DF"}}>{r.nome}</span>
                  <span style={{fontSize:15,fontWeight:800,color:"#3DBA6F"}}>{hide?"••••":fmt(r.saldo)}</span>
                </div>
                {pct!==null&&<Bar pct={pct} color={pct>=100?"#3DBA6F":"#3DBA6F"}/>}
                <div style={{fontSize:11,color:"#536057",marginTop:pct===null?4:0}}>
                  {r.meta>0?`Meta: ${hide?"••••":fmt(r.meta)} · ${pct.toFixed(0)}%`:"Sem meta"}
                  {ultimaMov&&<span> · último: {ultimaMov.date?.slice(0,5)}</span>}
                </div>
              </div>
              <span style={{fontSize:16,color:"#536057",flexShrink:0}}>›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


export default Reservas;
