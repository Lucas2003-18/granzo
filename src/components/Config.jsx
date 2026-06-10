import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';
import { PRESETS, CATS_DEF, FIXAS_DEF, CONTAS_DEF, APP_VERSION } from '../utils/constants';
import { getGeminiKey, setGeminiKey } from '../utils/gemini';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { AlertBox, ConfirmModal } from './ui';
import Importador from './Importador';
import NotifConfig from './NotifConfig';
import { categorizar } from '../utils/categorizar';

function ChaveIAConfig() {
  const [chave, setChave] = useState(getGeminiKey);
  const [salvo, setSalvo] = useState(false);
  return <div>
    <AlertBox tipo="info" texto="A chave fica salva só no seu celular. Nunca é enviada para nenhum servidor nosso."/>
    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#DDE8DF",marginBottom:8}}>🤖 Chave da API Gemini</div>
      <div style={{fontSize:12,color:"#536057",marginBottom:12,lineHeight:1.6}}>
        Obtenha gratuitamente em <span style={{color:"#3DBA6F"}}>aistudio.google.com</span> → Get API Key. O plano gratuito é suficiente para uso pessoal.
      </div>
      <input style={{...inp(),marginBottom:10,fontFamily:"monospace",fontSize:12}} placeholder="Cole sua chave aqui (AIza...)" value={chave} onChange={e=>setChave(e.target.value)}/>
      <button style={btn("#3DBA6F","#0A0F0D")} onClick={()=>{setGeminiKey(chave.trim());setSalvo(true);setTimeout(()=>setSalvo(false),2000);}}>
        {salvo?"✓ Chave salva!":"Salvar chave"}
      </button>
      {getGeminiKey()&&<button style={{...btn("rgba(224,82,82,0.1)","#E05252",{border:"1px solid rgba(224,82,82,0.2)",marginTop:8})}} onClick={()=>{setGeminiKey("");setChave("");}}>🗑️ Remover chave</button>}
    </div>
    {!getGeminiKey()&&<AlertBox tipo="warn" texto="⚠️ Sem chave configurada — a aba IA ficará desabilitada."/>}
  </div>;
}

// ── META CONFIG ────────────────────────────────────────────
function MetaConfig({ meta, setMeta }) {
  const metaVal=meta||0;
  function salvarMeta(v){const n=Math.max(0,+v||0);setMeta(n);}
  return <div>
    <div style={{fontSize:13,color:"#536057",marginBottom:16,lineHeight:1.6}}>
      Defina quanto quer poupar por mês. O Dashboard vai mostrar o progresso em relação à sua renda menos gastos.
    </div>
    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#DDE8DF",marginBottom:12}}>🎯 Meta mensal de economia</div>
      <div style={{fontSize:11,color:"#536057",marginBottom:6}}>Valor alvo (R$)</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input style={{...inp({flex:1}),fontSize:18,fontWeight:700,textAlign:"center"}} type="number" step="50" value={metaVal||""} placeholder="0" onChange={e=>salvarMeta(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[200,300,500,800,1000,1500].map(v=>(
          <button key={v} style={{background:metaVal===v?"rgba(61,186,111,0.12)":"#181E19",border:metaVal===v?"1px solid rgba(61,186,111,0.35)":"1px solid #2E3A2F",color:metaVal===v?"#3DBA6F":"#536057",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>salvarMeta(v)}>{fmt(v)}</button>
        ))}
      </div>
      {metaVal>0&&<div style={{marginTop:12,fontSize:12,color:"#536057",padding:"8px 12px",background:"rgba(61,186,111,0.06)",borderRadius:8}}>
        💡 Meta de {fmt(metaVal)}/mês — o progresso aparece no Dashboard quando você filtra um mês específico.
      </div>}
    </div>
  </div>;
}

// ── CONFIG ─────────────────────────────────────────────────

function Config({ cats, setCats, exps, setExps, fixas, setFixas, contas, setContas, reservas, setReservas, dividas, setDividas, meta, setMeta, setTab, showToast, mesFiltro }){
  const [sec,setsec]=useState("importar");
  const [showNC,setShowNC]=useState(false);
  const [newCat,setNewCat]=useState({label:"",emoji:"📁",budget:200,color:"#60a5fa"});
  const [novaFixa,setNovaFixa]=useState({desc:"",valor:"",cat:"moradia",emoji:"📌"});
  const [confirmModal, setConfirmModal] = useState(null);
  // Render ConfirmModal se ativo
  if(confirmModal) return <ConfirmModal
    msg={confirmModal.msg} sub={confirmModal.sub}
    okLabel={confirmModal.okLabel||"Confirmar"} okColor={confirmModal.okColor||"#E05252"}
    onOk={()=>{confirmModal.onOk();setConfirmModal(null);}}
    onCancel={()=>setConfirmModal(null)}/>;

  const SECS=[{id:"importar",l:"📥 Importar"},{id:"fixas",l:"📌 Fixas"},{id:"meta",l:"🎯 Meta"},{id:"contas",l:"🏦 Contas"},{id:"categorias",l:"🏷️ Categ."},{id:"chaveIA",l:"🤖 Chave IA"},{id:"notif",l:"🔔 Notif."},{id:"dados",l:"🗄️ Dados"}];

  return (
    <div style={{padding:16,paddingBottom:100}}>
      <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>
        {SECS.map(s=>(
          <button key={s.id} style={{background:sec===s.id?"rgba(61,186,111,0.12)":"#181E19",border:sec===s.id?"1px solid rgba(61,186,111,0.35)":"1px solid #2E3A2F",color:sec===s.id?"#3DBA6F":"#536057",borderRadius:99,padding:"7px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:sec===s.id?700:400}}
            onClick={()=>setsec(s.id)}>{s.l}</button>
        ))}
      </div>
      {sec==="fixas"&&<>
        <div style={{fontSize:13,color:"#536057",marginBottom:14,lineHeight:1.6}}>
          Despesas que aparecem todo mês (aluguel, internet...). Aparecem no Resumo como referência — não são lançadas automaticamente.
        </div>
        {/* Nova fixa */}
        <div style={{...CARD,background:"rgba(61,186,111,0.07)",border:"1px solid rgba(61,186,111,0.2)",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#3DBA6F",marginBottom:12}}>+ Nova despesa fixa</div>
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
          <button style={btn("#3DBA6F","#0A0F0D")} onClick={()=>{
            if(!novaFixa.desc||!novaFixa.valor) return;
            setFixas(p=>[...p,{id:`fx${Date.now()}`,desc:novaFixa.desc,valor:+novaFixa.valor,cat:novaFixa.cat,emoji:novaFixa.emoji||"📌",ativo:true}]);
            setNovaFixa({desc:"",valor:"",cat:"moradia",emoji:"📌"});
          }}>Adicionar</button>
        </div>
        {/* Lista fixas */}
        {fixas.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#536057",fontSize:13}}>Nenhuma despesa fixa cadastrada</div>}
        {fixas.map((f,i)=>(
          <div key={f.id} style={{...CARD,borderLeft:`3px solid ${f.ativo?"#3DBA6F":"#2E3A2F"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>{f.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF"}}>{f.desc}</div>
                <div style={{fontSize:11,color:"#536057"}}>{cats.find(c=>c.id===f.cat)?.label||"Outros"} · {fmt(f.valor)}/mês</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {/* Toggle ativo */}
                <button style={{background:f.ativo?"rgba(61,186,111,0.2)":"#232B24",border:f.ativo?"1px solid rgba(61,186,111,0.4)":"1px solid #2E3A2F",color:f.ativo?"#3DBA6F":"#536057",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer"}}
                  onClick={()=>setFixas(p=>p.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x))}>
                  {f.ativo?"✓ Ativa":"Pausada"}
                </button>
                <button style={{fontSize:11,color:"#E05252",background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setFixas(p=>p.filter((_,j)=>j!==i))}>✕</button>
              </div>
            </div>
            {/* Editar valor inline */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
              <span style={{fontSize:12,color:"#536057",flexShrink:0}}>Valor R$</span>
              <input style={inp({flex:1,padding:"7px 12px",fontSize:14,fontWeight:700})} type="number" value={f.valor}
                onChange={e=>setFixas(p=>p.map((x,j)=>j===i?{...x,valor:+e.target.value}:x))}/>
            </div>
            {/* Lançar este mês */}
            {f.ativo&&f.valor>0&&(()=>{
              const hoje=new Date();
              const mesAtualKey=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
              const jaLancou=exps.some(e=>e.kind==="exp"&&e.desc===f.desc&&e.value===f.valor&&(e.date||"").slice(3,10)===`${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`);
              return <button
                style={{...btn(jaLancou?"rgba(61,186,111,0.08)":"rgba(61,186,111,0.12)",jaLancou?"#3DBA6F":"#3DBA6F",{border:`1px solid ${jaLancou?"rgba(61,186,111,0.25)":"rgba(61,186,111,0.12)"}`,marginTop:8,padding:"8px 0",fontSize:12,fontWeight:600})}}
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
          <div style={{...CARD,background:"rgba(61,186,111,0.06)",border:"1px solid rgba(61,186,111,0.15)",textAlign:"center"}}>
            <div style={{fontSize:12,color:"#536057"}}>Total fixas ativas</div>
            <div style={{fontSize:20,fontWeight:800,color:"#3DBA6F"}}>{fmt(fixas.filter(f=>f.ativo).reduce((s,f)=>s+f.valor,0))}<span style={{fontSize:12,fontWeight:400}}>/mês</span></div>
          </div>
        )}
      </>}
      {sec==="importar"&&<Importador exps={exps} setExps={setExps} cats={cats} setCats={setCats} contas={contas} setContas={setContas} setTab={setTab} showToast={showToast}/>}
      {sec==="categorias"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:"#DDE8DF"}}>Categorias</div>
          <button style={{fontSize:11,background:"rgba(61,186,111,0.15)",color:"#3DBA6F",border:"1px solid rgba(61,186,111,0.12)",borderRadius:8,padding:"4px 12px",cursor:"pointer"}} onClick={()=>setShowNC(!showNC)}>+ Nova</button>
        </div>
        {showNC&&<div style={{...CARD,background:"rgba(61,186,111,0.08)",border:"1px solid rgba(61,186,111,0.2)"}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={inp({width:52,textAlign:"center",fontSize:20,padding:8})} placeholder="📁" value={newCat.emoji} onChange={e=>setNewCat(p=>({...p,emoji:e.target.value}))}/>
            <input style={inp({flex:1})} placeholder="Nome da categoria" value={newCat.label} onChange={e=>setNewCat(p=>({...p,label:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {PRESETS.map(c=><button key={c} style={{width:28,height:28,borderRadius:6,background:c,border:newCat.color===c?"2px solid white":"2px solid transparent",cursor:"pointer"}} onClick={()=>setNewCat(p=>({...p,color:c}))}/>)}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={btn("#232B24","#8FA893",{border:"1px solid #2E3A2F"})} onClick={()=>setShowNC(false)}>Cancelar</button>
            <button style={btn("#3DBA6F","#0A0F0D")} onClick={()=>{if(newCat.label){setCats(p=>[...p,{...newCat,id:`c${Date.now()}`}]);setShowNC(false);setNewCat({label:"",emoji:"📁",budget:200,color:"#60a5fa"});}}}>Criar</button>
          </div>
        </div>}
        {cats.map(cat=>(
          <div key={cat.id} style={ROW}>
            <div style={{width:34,height:34,borderRadius:8,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cat.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF"}}>{cat.label}</div>
              <div style={{fontSize:11,color:"#536057"}}>Limite: {fmt(cat.budget)} <span style={{color:cat.color}}>●</span></div>
            </div>
            <button style={{fontSize:11,color:"#E05252",background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>cats.length>1&&setCats(p=>p.filter(c=>c.id!==cat.id))}>✕</button>
          </div>
        ))}
      </>}
      {sec==="meta"&&<MetaConfig meta={meta} setMeta={setMeta}/>}
      {sec==="contas"&&<>
        <div style={{fontSize:13,color:"#536057",marginBottom:14,lineHeight:1.6}}>
          Gerencie suas contas. Transferências entre contas próprias são marcadas como neutras — não inflam renda nem gastos.
        </div>
        {contas.map((c,i)=>(
          <div key={c.id} style={{...CARD,borderLeft:`3px solid ${c.color}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${c.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.emoji}</div>
              <input style={{...inp({padding:"6px 10px",fontSize:13,fontWeight:600,background:"transparent",border:"none",color:"#DDE8DF",flex:1})}} value={c.label}
                onChange={e=>setContas(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
              {c.id!=="geral"&&<button style={{fontSize:11,color:"#E05252",background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setContas(p=>p.filter((_,j)=>j!==i))}>✕</button>}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"#536057",marginRight:4}}>Emoji:</span>
              {["🏦","💜","🟠","🔴","⚫","💛","🔵","🟢","💰","🏧"].map(em=>(
                <button key={em} style={{fontSize:16,padding:"2px 4px",background:c.emoji===em?"rgba(61,186,111,0.2)":"transparent",border:c.emoji===em?"1px solid rgba(61,186,111,0.35)":"1px solid transparent",borderRadius:6,cursor:"pointer"}}
                  onClick={()=>setContas(p=>p.map((x,j)=>j===i?{...x,emoji:em}:x))}>{em}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center",marginTop:6}}>
              <span style={{fontSize:10,color:"#536057",marginRight:4}}>Cor:</span>
              {["#8b5cf6","#f97316","#E05252","#374151","#E8A832","#3b82f6","#22c55e","#ec4899","#8FA893","#06b6d4"].map(cor=>(
                <button key={cor} style={{width:20,height:20,borderRadius:6,background:cor,border:c.color===cor?"2px solid #fff":"2px solid transparent",cursor:"pointer"}}
                  onClick={()=>setContas(p=>p.map((x,j)=>j===i?{...x,color:cor}:x))}/>
              ))}
            </div>
          </div>
        ))}
        <button style={{...btn("rgba(61,186,111,0.15)","#3DBA6F",{border:"1px solid rgba(61,186,111,0.12)",marginTop:8})}} onClick={()=>{
          const nome=prompt("Nome da nova conta:");
          if(nome?.trim()) setContas(p=>[...p,{id:`c${Date.now()}`,label:nome.trim(),emoji:"🏦",color:"#8FA893"}]);
        }}>+ Nova conta</button>
        <div style={{...CARD,background:"rgba(61,186,111,0.06)",border:"1px solid rgba(61,186,111,0.15)",marginTop:16}}>
          <div style={{fontSize:12,color:"#536057",marginBottom:6}}>💡 Como registrar transferência interna</div>
          <div style={{fontSize:12,color:"#536057",lineHeight:1.7}}>
            Quando transferir dinheiro entre suas contas (ex: Bradesco → Nubank):<br/>
            1. Lance como <strong style={{color:"#8FA893"}}>Entrada</strong> na conta destino<br/>
            2. Selecione tipo <strong style={{color:"#8FA893"}}>↔️ Transferência entre contas</strong><br/>
            3. O valor aparece no extrato mas não conta como renda
          </div>
        </div>
      </>}
       {sec==="chaveIA"&&<ChaveIAConfig/>}
      {sec==="notif"&&<NotifConfig showToast={showToast}/>}
      {sec==="dados"&&<div style={CARD}>
        <button style={{...btn("rgba(61,186,111,0.1)","#3DBA6F",{border:"1px solid rgba(61,186,111,0.2)",marginBottom:10})}} onClick={()=>{
          try{localStorage.removeItem("mf_onboarding_done");}catch{}
          window.location.reload();
        }}>🎓 Ver tutorial novamente</button>
        <button style={{...btn("rgba(232,168,50,0.1)","#E8A832",{border:"1px solid rgba(232,168,50,0.2)",marginBottom:10})}} onClick={()=>{
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
        <div style={{fontSize:14,fontWeight:700,color:"#DDE8DF",marginBottom:8}}>🗄️ Dados</div>
        <div style={{fontSize:13,color:"#536057",marginBottom:16,lineHeight:1.6}}>
          💾 Salvamento automático ativo<br/>
          {exps.length} lançamentos · {cats.length} categorias · {fixas.length} fixas · {(contas||[]).filter(c=>c.id!=="geral").length} contas
        </div>
        <button style={btn("#3DBA6F","#0A0F0D",{marginBottom:10})} onClick={async()=>{
          const json=JSON.stringify({exps,cats,fixas,contas,reservas,dividas,meta,_version:2,_savedAt:new Date().toISOString()},null,2);
          const filename="granzo_backup_"+new Date().toISOString().slice(0,10)+".json";
          const blob=new Blob([json],{type:"application/json"});

          // 1) Capacitor nativo: Filesystem + Share
          const cap=window.Capacitor;
          if(cap?.isNativePlatform?.()){
            const plugins=cap.Plugins||{};
            try{
              // Converte JSON pra base64 de forma segura
              const base64=await new Promise(res=>{
                const reader=new FileReader();
                reader.onload=()=>res(reader.result.split(",")[1]);
                reader.readAsDataURL(blob);
              });
              const written=await plugins.Filesystem.writeFile({
                path:filename,
                data:base64,
                directory:"CACHE"
              });
              await plugins.Share.share({
                title:"Backup Granzo",
                url:written.uri,
                dialogTitle:"Compartilhar backup"
              });
              try{ localStorage.setItem("mf_last_export", new Date().toISOString()); }catch{}
              showToast("✓ Backup exportado!");
              return;
            }catch(e){
              if(e?.message?.includes?.("cancel")||e?.message?.includes?.("dismiss")) return;
            }
          }

          // 2) Fallback web: navigator.share com File
          if(navigator.share){
            try{
              const file=new File([blob],filename,{type:"application/json"});
              await navigator.share({files:[file],title:"Backup Granzo"});
              try{ localStorage.setItem("mf_last_export", new Date().toISOString()); }catch{}
              showToast("✓ Backup exportado!");
              return;
            }catch(e){
              if(e.name==="AbortError") return;
            }
          }

          // 3) Último recurso: data URI download
          const base64=await new Promise(res=>{
            const reader=new FileReader();
            reader.onload=()=>res(reader.result);
            reader.readAsDataURL(blob);
          });
          const a=document.createElement("a");
          a.href=base64;a.download=filename;a.click();
          try{ localStorage.setItem("mf_last_export", new Date().toISOString()); }catch{}
          showToast("✓ Backup baixado!");
        }}>📤 Exportar backup JSON</button>
        <label style={{display:"block",width:"100%",background:"rgba(61,186,111,0.12)",border:"1px solid rgba(61,186,111,0.12)",color:"#3DBA6F",borderRadius:12,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box"}}>
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
                okLabel:"Restaurar",okColor:"#3DBA6F",
                onOk:()=>{
                  setExps(_data.exps||[]);
                  setCats(_data.cats||CATS_DEF);
                  setFixas(_data.fixas||FIXAS_DEF);
                  if(_data.contas) setContas(_data.contas);
                  if(_data.reservas) setReservas(_data.reservas);
                  if(_data.dividas) setDividas(_data.dividas);
                  if(_data.meta!==undefined) setMeta(_data.meta);
                  showToast("✓ Backup restaurado!");
                }
              });
            }catch(err){showToast("❌ Erro: "+err.message);}
            e.target.value="";
          }}/>
        </label>
        <button style={btn("rgba(224,82,82,0.1)","#E05252",{border:"1px solid rgba(224,82,82,0.3)"})} onClick={()=>{
          setConfirmModal({
            msg:"⚠️ Apagar todos os dados?",
            sub:"Esta ação não pode ser desfeita. Todos os lançamentos, configurações e histórico serão removidos.",
            okLabel:"Apagar tudo",okColor:"#E05252",
            onOk:()=>{
              setExps([]);setCats(CATS_DEF);setFixas(FIXAS_DEF);setContas(CONTAS_DEF);setReservas([]);setMeta(0);
              try{["mf_exps","mf_cats","mf_fixas","mf_contas","mf_reservas","mf_meta","mf_onboarding_done"].forEach(k=>localStorage.removeItem(k));}catch{}
              showToast("✓ Dados apagados");
              setTab("dashboard");
            }
          });
        }}>🗑️ Apagar todos os dados</button>
        <div style={{textAlign:"center",marginTop:20,padding:"12px 0",borderTop:"1px solid #232B24"}}>
          <div style={{fontSize:11,color:"#536057"}}>Granzo v{APP_VERSION}</div>
        </div>
      </div>}
    </div>
  );
}

// ── RESERVAS ───────────────────────────────────────────────
// reserva: { id, nome, emoji, saldo, meta, movs: [{id,tipo,valor,desc,date}] }

export default Config;
