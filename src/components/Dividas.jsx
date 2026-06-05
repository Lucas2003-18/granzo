import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';
import { inp, btn, ROW, CARD } from '../utils/styles';
import { SwipeRow, ConfirmModal } from './ui';

function parseData(str) {
  if (!str) return null;
  const [d, m, y] = str.split("/");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

function diasAteVencer(vencimento) {
  const dt = parseData(vencimento);
  if (!dt) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.round((dt - hoje) / 86400000);
}

function urgencyColor(dias) {
  if (dias === null) return null;
  if (dias < 0)  return "#f87171";
  if (dias <= 3) return "#f59e0b";
  return null;
}

function emptyForm() {
  return {
    pessoa: "", valor: "", tipo: "emprestei",
    data: fmtDate(new Date().toISOString().slice(0, 10)),
    vencimento: "", obs: "", status: "pendente",
  };
}

export default function Dividas({ dividas, setDividas }) {
  const [modal,        setModal]        = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState(emptyForm);
  const [activeSwipe,  setActiveSwipe]  = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [showPagas,    setShowPagas]    = useState(false);

  function openAdd()  { setEditId(null); setForm(emptyForm()); setModal(true); }
  function openEdit(d){ setEditId(d.id); setForm({...d, valor: String(d.valor)}); setModal(true); }

  function salvar() {
    const valorNum = Math.abs(+form.valor);
    if (!form.pessoa.trim() || !valorNum) return;
    const entry = { ...form, valor: valorNum, id: editId || `d${Date.now()}` };
    setDividas(p => editId ? p.map(d => d.id === editId ? entry : d) : [entry, ...p]);
    setModal(false);
  }

  function marcarPago(id) { setDividas(p => p.map(d => d.id === id ? {...d, status:"pago"} : d)); }
  function remover(id)    { setDividas(p => p.filter(d => d.id !== id)); setConfirm(null); }

  const pendentes = dividas.filter(d => d.status === "pendente");
  const pagas     = dividas.filter(d => d.status === "pago");

  const totalEmprestei  = pendentes.filter(d => d.tipo === "emprestei").reduce((s, d) => s + d.valor, 0);
  const totalDevo       = pendentes.filter(d => d.tipo === "devo").reduce((s, d) => s + d.valor, 0);
  const saldoPendente   = totalEmprestei - totalDevo;

  return (
    <div style={{padding:"16px 16px 100px"}}>

      {/* Banner resumo */}
      {pendentes.length > 0 && (
        <div style={{...CARD, background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05))", border:"1px solid rgba(99,102,241,0.25)", marginBottom:16}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
            <div>
              <div style={{fontSize:11, color:"#64748b", marginBottom:2}}>A receber</div>
              <div style={{fontSize:18, fontWeight:800, color:"#4ade80"}}>{fmt(totalEmprestei)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11, color:"#64748b", marginBottom:2}}>A pagar</div>
              <div style={{fontSize:18, fontWeight:800, color:"#f87171"}}>{fmt(totalDevo)}</div>
            </div>
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:8, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <span style={{fontSize:12, color:"#64748b"}}>Saldo pendente</span>
            <span style={{fontSize:15, fontWeight:800, color: saldoPendente >= 0 ? "#4ade80" : "#f87171"}}>
              {saldoPendente >= 0 ? "+" : "-"}{fmt(Math.abs(saldoPendente))}
            </span>
          </div>
        </div>
      )}

      {/* Lista pendentes */}
      {pendentes.length === 0 ? (
        <div style={{textAlign:"center", padding:"52px 0", color:"#475569"}}>
          <div style={{fontSize:44, marginBottom:12}}>🤝</div>
          <div style={{fontSize:15, fontWeight:700, color:"#64748b", marginBottom:4}}>Nenhuma dívida pendente</div>
          <div style={{fontSize:13}}>Toque em + para registrar</div>
        </div>
      ) : pendentes.map(d => (
        <DividaCard key={d.id} d={d}
          onEdit={openEdit}
          onDelete={id => setConfirm(id)}
          onPago={marcarPago}
          activeSwipe={activeSwipe}
          setActiveSwipe={setActiveSwipe}/>
      ))}

      {/* Dívidas pagas */}
      {pagas.length > 0 && (
        <>
          <button style={{...btn("rgba(255,255,255,0.04)","#475569",{border:"1px solid rgba(255,255,255,0.08)", fontSize:12, marginTop:4, marginBottom:8})}}
            onClick={() => setShowPagas(v => !v)}>
            {showPagas ? "▲" : "▼"} {pagas.length} dívida{pagas.length > 1 ? "s" : ""} paga{pagas.length > 1 ? "s" : ""}
          </button>
          {showPagas && pagas.map(d => (
            <DividaCard key={d.id} d={d}
              onEdit={openEdit}
              onDelete={id => setConfirm(id)}
              onPago={marcarPago}
              activeSwipe={activeSwipe}
              setActiveSwipe={setActiveSwipe}/>
          ))}
        </>
      )}

      {/* FAB */}
      <button
        style={{position:"fixed", bottom:84, right:16, width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#818cf8,#6366f1)", border:"none", color:"white", fontSize:26, cursor:"pointer", boxShadow:"0 4px 20px rgba(99,102,241,0.5)", zIndex:49, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700}}
        onClick={openAdd}>+</button>

      {confirm && (
        <ConfirmModal
          msg="Remover dívida?"
          sub="Esta ação não pode ser desfeita."
          onOk={() => remover(confirm)}
          onCancel={() => setConfirm(null)}/>
      )}

      {modal && (
        <DividaModal
          form={form}
          setForm={setForm}
          onSalvar={salvar}
          onClose={() => setModal(false)}
          isEdit={!!editId}/>
      )}
    </div>
  );
}

function DividaCard({ d, onEdit, onDelete, onPago, activeSwipe, setActiveSwipe }) {
  const dias       = diasAteVencer(d.vencimento);
  const urgColor   = d.status === "pendente" ? urgencyColor(dias) : null;
  const isPendente = d.status === "pendente";

  return (
    <SwipeRow swipeId={d.id} onDelete={() => onDelete(d.id)} activeSwipe={activeSwipe} setActiveSwipe={setActiveSwipe}>
      <div
        style={{...ROW, marginBottom:0, borderLeft: urgColor ? `3px solid ${urgColor}` : "3px solid transparent", cursor:"pointer"}}
        onClick={() => onEdit(d)}>

        {/* Avatar */}
        <div style={{width:40, height:40, borderRadius:"50%", background: d.tipo === "emprestei" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color: d.tipo === "emprestei" ? "#4ade80" : "#f87171", flexShrink:0}}>
          {d.pessoa.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13, fontWeight:700, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{d.pessoa}</div>
          <div style={{fontSize:11, color:"#475569", display:"flex", gap:5, alignItems:"center", flexWrap:"wrap"}}>
            <span>{d.tipo === "emprestei" ? "Emprestei" : "Devo"} · {d.data}</span>
            {d.vencimento && (
              <span style={{color: urgColor || "#475569"}}>
                · vence {d.vencimento}
                {dias !== null && isPendente && (dias < 0 ? " ⚠️" : dias <= 3 ? ` (${dias}d)` : "")}
              </span>
            )}
          </div>
          {d.obs ? <div style={{fontSize:11, color:"#334155", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{d.obs}</div> : null}
        </div>

        {/* Valor + ação */}
        <div style={{textAlign:"right", flexShrink:0}}>
          <div style={{fontSize:14, fontWeight:700, color: d.tipo === "emprestei" ? "#4ade80" : "#f87171"}}>
            {d.tipo === "emprestei" ? "+" : "-"}{fmt(d.valor)}
          </div>
          {isPendente ? (
            <button
              style={{fontSize:10, background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.2)", color:"#4ade80", borderRadius:6, padding:"2px 7px", cursor:"pointer", marginTop:4, fontFamily:"inherit"}}
              onClick={e => { e.stopPropagation(); onPago(d.id); }}>✓ Recebido</button>
          ) : (
            <span style={{fontSize:10, color:"#4ade80", background:"rgba(74,222,128,0.08)", borderRadius:6, padding:"2px 7px"}}>✓ Pago</span>
          )}
        </div>
      </div>
    </SwipeRow>
  );
}

function DividaModal({ form, setForm, onSalvar, onClose, isEdit }) {
  function f(k, v) { setForm(p => ({...p, [k]: v})); }

  function isoParaBr(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
  }
  function brParaIso(br) {
    if (!br) return "";
    const [d, m, y] = br.split("/");
    if (!d || !m || !y) return "";
    return `${y}-${m}-${d}`;
  }

  return (
    <div
      style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center"}}
      onClick={onClose}>
      <div
        style={{background:"#0f172a", borderRadius:"18px 18px 0 0", padding:"24px 20px 44px", width:"100%", maxWidth:520, border:"1px solid rgba(255,255,255,0.1)", maxHeight:"90vh", overflowY:"auto"}}
        onClick={e => e.stopPropagation()}>

        <div style={{fontSize:16, fontWeight:800, color:"#e2e8f0", marginBottom:20, textAlign:"center"}}>
          {isEdit ? "✏️ Editar dívida" : "🤝 Nova dívida"}
        </div>

        {/* Tipo */}
        <div style={{display:"flex", gap:8, marginBottom:14}}>
          {[["emprestei","💚 Emprestei","#4ade80"],["devo","❤️ Devo","#f87171"]].map(([v,l,c]) => (
            <button key={v} style={{flex:1, borderRadius:10, padding:"10px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background:form.tipo===v?`${c}22`:"rgba(255,255,255,0.05)", border:form.tipo===v?`1px solid ${c}55`:"1px solid rgba(255,255,255,0.1)", color:form.tipo===v?c:"#94a3b8"}}
              onClick={() => f("tipo", v)}>{l}</button>
          ))}
        </div>

        <div style={{fontSize:11, color:"#64748b", marginBottom:4}}>Pessoa</div>
        <input style={{...inp(), marginBottom:12}} placeholder="Nome de quem deve / a quem devo" value={form.pessoa} onChange={e => f("pessoa", e.target.value)}/>

        <div style={{fontSize:11, color:"#64748b", marginBottom:4}}>Valor (R$)</div>
        <input style={{...inp(), marginBottom:12}} type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => f("valor", e.target.value)}/>

        <div style={{display:"flex", gap:8, marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:"#64748b", marginBottom:4}}>Data</div>
            <input style={inp()} type="date" value={brParaIso(form.data)} onChange={e => f("data", isoParaBr(e.target.value))}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:"#64748b", marginBottom:4}}>Vencimento</div>
            <input style={inp()} type="date" value={brParaIso(form.vencimento)} onChange={e => f("vencimento", isoParaBr(e.target.value))}/>
          </div>
        </div>

        <div style={{fontSize:11, color:"#64748b", marginBottom:4}}>Observação (opcional)</div>
        <input style={{...inp(), marginBottom:20}} placeholder="Ex: reforma da casa" value={form.obs} onChange={e => f("obs", e.target.value)}/>

        <div style={{display:"flex", gap:10}}>
          <button style={{...btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)", flex:1})}} onClick={onClose}>Cancelar</button>
          <button style={{...btn("linear-gradient(135deg,#818cf8,#6366f1)",undefined,{flex:1})}} onClick={onSalvar}>
            {isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
