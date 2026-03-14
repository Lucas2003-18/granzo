import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';
import { PRESETS, CATS_DEF, FIXAS_DEF, MKTS_DEF, CONTAS_DEF, APP_VERSION } from '../utils/constants';
import { getGeminiKey, setGeminiKey } from '../utils/gemini';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { SecTitle, AlertBox, ConfirmModal } from './ui';
import Importador from './Importador';
import GoogleDriveBackup from './GoogleDriveBackup';
import NotifConfig from './NotifConfig';
import { categorizar } from '../utils/categorizar';
import { loadPrecos, savePrecos, loadProdsExtra, saveProdsExtra } from '../utils/mercadoStorage';

function ChaveIAConfig() {
  const [chave, setChave] = useState(getGeminiKey);
  const [salvo, setSalvo] = useState(false);
  return <div>
    <AlertBox tipo="info" texto="A chave fica salva só no seu celular. Nunca é enviada para nenhum servidor nosso."/>
    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>🤖 Chave da API Gemini</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:12,lineHeight:1.6}}>
        Obtenha gratuitamente em <span style={{color:"#818cf8"}}>aistudio.google.com</span> → Get API Key. O plano gratuito é suficiente para uso pessoal.
      </div>
      <input style={{...inp(),marginBottom:10,fontFamily:"monospace",fontSize:12}} placeholder="Cole sua chave aqui (AIza...)" value={chave} onChange={e=>setChave(e.target.value)}/>
      <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={()=>{setGeminiKey(chave.trim());setSalvo(true);setTimeout(()=>setSalvo(false),2000);}}>
        {salvo?"✓ Chave salva!":"Salvar chave"}
      </button>
      {getGeminiKey()&&<button style={{...btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.2)",marginTop:8})}} onClick={()=>{setGeminiKey("");setChave("");}}>🗑️ Remover chave</button>}
    </div>
    {!getGeminiKey()&&<AlertBox tipo="warn" texto="⚠️ Sem chave configurada — a aba IA ficará desabilitada."/>}
  </div>;
}

// ── META CONFIG ────────────────────────────────────────────
function MetaConfig({ meta, setMeta }) {
  const metaVal=meta||0;
  function salvarMeta(v){const n=Math.max(0,+v||0);setMeta(n);}
  return <div>
    <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
      Defina quanto quer poupar por mês. O Dashboard vai mostrar o progresso em relação à sua renda menos gastos.
    </div>
    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:12}}>🎯 Meta mensal de economia</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>Valor alvo (R$)</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input style={{...inp({flex:1}),fontSize:18,fontWeight:700,textAlign:"center"}} type="number" step="50" value={metaVal||""} placeholder="0" onChange={e=>salvarMeta(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[200,300,500,800,1000,1500].map(v=>(
          <button key={v} style={{background:metaVal===v?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",border:metaVal===v?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.1)",color:metaVal===v?"#818cf8":"#64748b",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>salvarMeta(v)}>{fmt(v)}</button>
        ))}
      </div>
      {metaVal>0&&<div style={{marginTop:12,fontSize:12,color:"#64748b",padding:"8px 12px",background:"rgba(99,102,241,0.06)",borderRadius:8}}>
        💡 Meta de {fmt(metaVal)}/mês — o progresso aparece no Dashboard quando você filtra um mês específico.
      </div>}
    </div>
  </div>;
}

// ── CONFIG ─────────────────────────────────────────────────

function Config({ cats, setCats, markets, setMarkets, exps, setExps, fixas, setFixas, contas, setContas, reservas, setReservas, meta, setMeta, setTab, showToast, mesFiltro }){
  const [sec,setsec]=useState("importar");
  const [showNM,setShowNM]=useState(false);
  const [newMkt,setNewMkt]=useState({label:"",emoji:"🏪"});
  const [showNC,setShowNC]=useState(false);
  const [newCat,setNewCat]=useState({label:"",emoji:"📁",budget:200,color:"#60a5fa"});
  const [novaFixa,setNovaFixa]=useState({desc:"",valor:"",cat:"moradia",emoji:"📌"});
  const [confirmModal, setConfirmModal] = useState(null);
  // Render ConfirmModal se ativo
  if(confirmModal) return <ConfirmModal
    msg={confirmModal.msg} sub={confirmModal.sub}
    okLabel={confirmModal.okLabel||"Confirmar"} okColor={confirmModal.okColor||"#ef4444"}
    onOk={()=>{confirmModal.onOk();setConfirmModal(null);}}
    onCancel={()=>setConfirmModal(null)}/>;

  const SECS=[{id:"importar",l:"📥 Importar"},{id:"fixas",l:"📌 Fixas"},{id:"meta",l:"🎯 Meta"},{id:"contas",l:"🏦 Contas"},{id:"mercados",l:"🏪 Mercados"},{id:"categorias",l:"🏷️ Categ."},{id:"chaveIA",l:"🤖 Chave IA"},{id:"drive",l:"☁️ Drive"},{id:"notif",l:"🔔 Notif."},{id:"dados",l:"🗄️ Dados"}];

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
            {/* Lançar este mês */}
            {f.ativo&&f.valor>0&&(()=>{
              const hoje=new Date();
              const mesAtualKey=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
              const jaLancou=exps.some(e=>e.kind==="exp"&&e.desc===f.desc&&e.value===f.valor&&(e.date||"").slice(3,10)===`${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`);
              return <button
                style={{...btn(jaLancou?"rgba(74,222,128,0.08)":"rgba(99,102,241,0.12)",jaLancou?"#4ade80":"#818cf8",{border:`1px solid ${jaLancou?"rgba(74,222,128,0.25)":"rgba(99,102,241,0.25)"}`,marginTop:8,padding:"8px 0",fontSize:12,fontWeight:600})}}
                onClick={()=>{
                  if(jaLancou){showToast("✓ Já lançado este mês");return;}
                  const hojeStr=fmtDate(hoje.toISOString().slice(0,10));
                  const cat=cats.find(c=>c.id===f.cat);
                  setExps(p=>[...p,{id:Date.now(),desc:f.desc,kind:"exp",cat:f.cat,emoji:f.emoji||cat?.emoji||"📌",value:f.valor,date:hojeStr,payment:"dinheiro",conta:(contas||[]).find(c=>c.id!=="geral")?.id||"geral",fixo:true}]);
                  showToast(`✓ ${f.desc} lançado`);
                }}>
                {jaLancou?"✓ Já lançado este mês":"📌 Lançar este mês"}
              </button>;
            })()}
          </div>
        ))}
        {fixas.length>0&&(
          <div style={{...CARD,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",textAlign:"center"}}>
            <div style={{fontSize:12,color:"#64748b"}}>Total fixas ativas</div>
            <div style={{fontSize:20,fontWeight:800,color:"#818cf8"}}>{fmt(fixas.filter(f=>f.ativo).reduce((s,f)=>s+f.valor,0))}<span style={{fontSize:12,fontWeight:400}}>/mês</span></div>
          </div>
        )}
      </>}
      {sec==="importar"&&<Importador exps={exps} setExps={setExps} cats={cats} setCats={setCats} contas={contas} setContas={setContas} setTab={setTab} showToast={showToast}/>}
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
      {sec==="meta"&&<MetaConfig meta={meta} setMeta={setMeta}/>}
      {sec==="contas"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.6}}>
          Gerencie suas contas. Transferências entre contas próprias são marcadas como neutras — não inflam renda nem gastos.
        </div>
        {contas.map((c,i)=>(
          <div key={c.id} style={{...ROW,borderLeft:`3px solid ${c.color}`}}>
            <div style={{width:36,height:36,borderRadius:10,background:`${c.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.emoji}</div>
            <div style={{flex:1}}>
              <input style={{...inp({padding:"6px 10px",fontSize:13,fontWeight:600,background:"transparent",border:"none",color:"#e2e8f0"})}} value={c.label}
                onChange={e=>setContas(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
            </div>
            {c.id!=="geral"&&<button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setContas(p=>p.filter((_,j)=>j!==i))}>✕</button>}
          </div>
        ))}
        <button style={{...btn("rgba(99,102,241,0.15)","#818cf8",{border:"1px solid rgba(99,102,241,0.3)",marginTop:8})}} onClick={()=>{
          const nome=prompt("Nome da nova conta:");
          if(nome?.trim()) setContas(p=>[...p,{id:`c${Date.now()}`,label:nome.trim(),emoji:"🏦",color:"#94a3b8"}]);
        }}>+ Nova conta</button>
        <div style={{...CARD,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",marginTop:16}}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>💡 Como registrar transferência interna</div>
          <div style={{fontSize:12,color:"#475569",lineHeight:1.7}}>
            Quando transferir dinheiro entre suas contas (ex: Bradesco → Nubank):<br/>
            1. Lance como <strong style={{color:"#94a3b8"}}>Entrada</strong> na conta destino<br/>
            2. Selecione tipo <strong style={{color:"#94a3b8"}}>↔️ Transferência entre contas</strong><br/>
            3. O valor aparece no extrato mas não conta como renda
          </div>
        </div>
      </>}
       {sec==="chaveIA"&&<ChaveIAConfig/>}
      {sec==="drive"&&<GoogleDriveBackup exps={exps} cats={cats} markets={markets} fixas={fixas} contas={contas} reservas={reservas} meta={meta} setExps={setExps} setCats={setCats} setMarkets={setMarkets} setFixas={setFixas} setContas={setContas} setReservas={setReservas} setMeta={setMeta} showToast={showToast} setConfirmModal={setConfirmModal}/>}
      {sec==="notif"&&<NotifConfig showToast={showToast}/>}
      {sec==="dados"&&<div style={CARD}>
        <button style={{...btn("rgba(99,102,241,0.1)","#818cf8",{border:"1px solid rgba(99,102,241,0.2)",marginBottom:10})}} onClick={()=>{
          try{localStorage.removeItem("mf_onboarding_done");}catch{}
          window.location.reload();
        }}>🎓 Ver tutorial novamente</button>
        <button style={{...btn("rgba(245,158,11,0.1)","#f59e0b",{border:"1px solid rgba(245,158,11,0.2)",marginBottom:10})}} onClick={()=>{
          let changed=0;
          const updated=exps.map(e=>{
            if(e.kind!=="exp") return e;
            const novaCat=categorizar(e.desc,"exp");
            if(novaCat&&novaCat!=="_ignorar"&&novaCat!==e.cat){changed++;return {...e,cat:novaCat};}
            return e;
          });
          if(changed>0){setExps(updated);showToast(`✓ ${changed} lançamento${changed>1?"s":""} recategorizado${changed>1?"s":""}`);}
          else showToast("Nenhuma mudança — tudo já está categorizado corretamente.");
        }}>🏷️ Recategorizar lançamentos</button>
        <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>🗄️ Dados</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
          💾 Salvamento automático ativo<br/>
          {exps.length} lançamentos · {cats.length} categorias · {markets.length} mercados · {fixas.length} fixas · {(contas||[]).filter(c=>c.id!=="geral").length} contas
        </div>
        <button style={btn("linear-gradient(135deg,#1d4ed8,#1e40af)",undefined,{marginBottom:10})} onClick={()=>{
          const prodsExtra=loadProdsExtra();const precosMkt=loadPrecos();const json=JSON.stringify({exps,cats,markets,fixas,contas,reservas,meta,prodsExtra,precosMkt},null,2);
          // Abre modal com textarea para copiar manualmente - funciona em qualquer WebView
          const overlay=document.createElement("div");
          overlay.style.cssText="position:fixed;inset:0;background:rgba(8,14,29,0.98);z-index:9999;display:flex;flex-direction:column;padding:16px;box-sizing:border-box;";
          (()=>{
            const h=document.createElement("div");h.style.cssText="color:#e2e8f0;font-size:15px;font-weight:700;margin-bottom:8px;";h.textContent="📋 Copie o JSON abaixo";overlay.appendChild(h);
            const s=document.createElement("div");s.style.cssText="color:#64748b;font-size:12px;margin-bottom:12px;";s.textContent="Selecione tudo → Copie → Cole no Google Keep, Drive ou Notes";overlay.appendChild(s);
            const ta2=document.createElement("textarea");ta2.id="backup-json";ta2.style.cssText="flex:1;background:#0f172a;color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:12px;padding:12px;font-size:11px;font-family:monospace;resize:none;outline:none;";ta2.readOnly=true;ta2.value=json;overlay.appendChild(ta2);
            const row=document.createElement("div");row.style.cssText="display:flex;gap:8px;margin-top:12px;";
            const btnSel2=document.createElement("button");btnSel2.id="btn-select-all";btnSel2.style.cssText="flex:1;background:linear-gradient(135deg,#1d4ed8,#1e40af);color:white;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;";btnSel2.textContent="Selecionar tudo";row.appendChild(btnSel2);
            const btnFch2=document.createElement("button");btnFch2.id="btn-fechar";btnFch2.style.cssText="flex:1;background:rgba(255,255,255,0.08);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;";btnFch2.textContent="Fechar";row.appendChild(btnFch2);
            overlay.appendChild(row);
          })();
          document.body.appendChild(overlay);
          const ta=ta2;
          const btnSel=btnSel2;
          const btnFch=btnFch2;
          setTimeout(()=>{ta.focus();ta.select();},100);
          btnSel.onclick=()=>{ta.focus();ta.select();try{document.execCommand("copy");btnSel.textContent="✓ Copiado!";}catch{}};
          btnFch.onclick=()=>document.body.removeChild(overlay);
        }}>📤 Exportar backup JSON</button>
        <label style={{display:"block",width:"100%",background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.3)",color:"#818cf8",borderRadius:12,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box"}}>
          📥 Importar backup JSON
          <input type="file" accept=".json" style={{display:"none"}} onChange={async e=>{
            const file=e.target.files?.[0];if(!file)return;
            try{
              const text=await file.text();
              const data=JSON.parse(text);
              if(!data.exps||!Array.isArray(data.exps)) throw new Error("Arquivo inválido");
              // Guardar data para usar no modal
              const _data=data;
              setConfirmModal({
                msg:"Restaurar backup?",
                sub:`${_data.exps.length} lançamentos · ${(_data.cats||[]).length} categorias\n\nIsso VAI SUBSTITUIR todos os dados atuais.`,
                okLabel:"Restaurar",okColor:"#4f46e5",
                onOk:()=>{
                  setExps(_data.exps||[]);
                  setCats(_data.cats||CATS_DEF);
                  setMarkets(_data.markets||MKTS_DEF);
                  setFixas(_data.fixas||FIXAS_DEF);
                  if(_data.contas) setContas(_data.contas);
                  if(_data.reservas) setReservas(_data.reservas);
                  if(_data.meta!==undefined) setMeta(_data.meta);
                  if(_data.prodsExtra) saveProdsExtra(_data.prodsExtra);
                  if(_data.precosMkt) savePrecos(_data.precosMkt);
                  showToast("✓ Backup restaurado!");
                }
              });
            }catch(err){showToast("❌ Erro: "+err.message);}
            e.target.value="";
          }}/>
        </label>
        <button style={btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.3)"})} onClick={()=>{
          setConfirmModal({
            msg:"⚠️ Apagar todos os dados?",
            sub:"Esta ação não pode ser desfeita. Todos os lançamentos, configurações e histórico serão removidos.",
            okLabel:"Apagar tudo",okColor:"#ef4444",
            onOk:()=>{
              setExps([]);setCats(CATS_DEF);setMarkets(MKTS_DEF);setFixas(FIXAS_DEF);setContas(CONTAS_DEF);setReservas([]);setMeta(0);
              try{["mf_exps","mf_cats","mf_mkts","mf_fixas","mf_contas","mf_reservas","mf_meta","mf_prods_extra","mf_precos","mf_onboarding_done"].forEach(k=>localStorage.removeItem(k));}catch{}
              showToast("✓ Dados apagados");
              setTab("dashboard");
            }
          });
        }}>🗑️ Apagar todos os dados</button>
        <div style={{textAlign:"center",marginTop:20,padding:"12px 0",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:11,color:"#374151"}}>Granzo v{APP_VERSION}</div>
        </div>
      </div>}
    </div>
  );
}


// ── RESERVAS ───────────────────────────────────────────────
// reserva: { id, nome, emoji, saldo, meta, movs: [{id,tipo,valor,desc,date}] }

export default Config;
