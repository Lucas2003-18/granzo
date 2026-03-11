import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { Bar, SecTitle, ConfirmModal } from './ui';

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


export default Reservas;
