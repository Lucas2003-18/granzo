import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';
import { categorizar, detectIncType } from '../utils/categorizar';
import { INC_TIPOS } from '../utils/constants';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { SecTitle, AlertBox, ConfirmModal } from './ui';
import { detectBank, parseCSVRows, parseTxs, parsePdf } from '../utils/parsers';

function Importador({ exps, setExps, cats, setCats, contas, setContas, setTab, showToast }){
  const [step,setStep]=useState("upload");
  const [preview,setPreview]=useState([]);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const [editing,setEditing]=useState(null);
  const [resumoImport,setResumoImport]=useState(null);

  async function handleFile(e){
    const file=e.target.files?.[0];if(!file)return;
    setLoading(true);setMsg("Lendo arquivo...");
    try{
      const isPdf=file.name.toLowerCase().endsWith(".pdf")||file.type==="application/pdf";
      let parsed=[];
      if(isPdf){
        parsed=await parsePdf(file,setMsg);
        if(parsed.length===0){setMsg("ℹ️ Nenhuma transação encontrada no PDF. Verifique se o arquivo é um extrato bancário.");setLoading(false);return;}
      } else {
        const text=await file.text();
        const tipo=detectBank(text);
        if(tipo==="unknown"){setMsg("❌ Formato não reconhecido. Bancos suportados: Nubank, Bradesco, Inter, C6 Bank (CSV) ou qualquer banco (PDF).");setLoading(false);return;}
        const rows=parseCSVRows(text);
        parsed=parseTxs(rows,tipo);
      }
      const semDup=parsed.filter(n=>!exps.some(e=>e.value===n.value&&e.date===n.date&&(e.desc||"").slice(0,10)===(n.desc||"").slice(0,10)));
      const dupCount=parsed.length-semDup.length;
      const catted=semDup.map(p=>({
        ...p,
        cat: p.kind==="inc" ? undefined : (p.cat || categorizar(p.desc,p.kind) || "outros"),
        incType: p.kind==="inc" ? (p.incType || detectIncType(p.desc) || "outro") : undefined,
      })).filter(p=>!(p.cat==="_ignorar" && p.kind==="exp"));
      if(catted.length===0){
        setMsg(dupCount>0?`ℹ️ Todos os ${dupCount} lançamentos já estão cadastrados. Nada novo para importar.`:"ℹ️ Nenhum lançamento encontrado no arquivo.");
        setLoading(false);return;
      }
      setPreview(catted);
      setMsg(dupCount>0?`ℹ️ ${dupCount} duplicata${dupCount>1?"s":""} ignorada${dupCount>1?"s":""}. ${catted.length} lançamento${catted.length>1?"s":""} novo${catted.length>1?"s":""}:`:"");
      setStep("preview");
    }catch(err){setMsg(`❌ ${err.message}`);}
    setLoading(false);
  }

  function confirmar(){
    const ano=new Date().getFullYear();
    // ── Auto-cadastrar banco se não existir ──
    const contasAtuais=[...(contas||[])];
    const BANCO_MAP={
      "Nubank Conta":  {id:"nubank",   label:"Nubank",   emoji:"💜",color:"#8b5cf6"},
      "Nubank Cartão": {id:"nubank",   label:"Nubank",   emoji:"💜",color:"#8b5cf6"},
      "Bradesco":      {id:"bradesco", label:"Bradesco", emoji:"🔴",color:"#ef4444"},
      "Inter":         {id:"inter",    label:"Inter",    emoji:"🟠",color:"#f97316"},
      "C6 Bank":       {id:"c6",       label:"C6 Bank",  emoji:"⚫",color:"#374151"},
    };
    const bancosNoImport=[...new Set(preview.map(p=>p.source))];
    const novasCont=[];
    bancosNoImport.forEach(src=>{
      const def=BANCO_MAP[src];
      if(def&&!contasAtuais.find(c=>c.id===def.id)){
        contasAtuais.push(def);
        novasCont.push(def.label);
      }
    });
    if(novasCont.length>0) setContas(contasAtuais);

    // ── Auto-cadastrar categorias desconhecidas ──
    const catsAtuais=[...cats];
    const novasCats=[];
    const CAT_COLORS=["#60a5fa","#f59e0b","#34d399","#f472b6","#a78bfa","#fb923c"];
    preview.filter(p=>p.kind==="exp"&&p.cat&&p.cat!=="outros").forEach(p=>{
      if(!catsAtuais.find(c=>c.id===p.cat)){
        const novaCat={id:p.cat,label:p.cat.charAt(0).toUpperCase()+p.cat.slice(1),emoji:"📦",budget:300,color:CAT_COLORS[catsAtuais.length%CAT_COLORS.length]};
        catsAtuais.push(novaCat);
        novasCats.push(novaCat.label);
      }
    });
    if(novasCats.length>0) setCats(catsAtuais);

    const novos=preview.map(p=>{
      const pts=p.date.split(/[-\/]/);
      const dateStr=pts.length===3&&pts[0].length===4?`${pts[2]}/${pts[1]}/${pts[0]}`:pts.length===3?`${pts[0]}/${pts[1]}/${pts[2]}`:`${pts[0]}/${pts[1]}/${ano}`;
      const cat=catsAtuais.find(c=>c.id===p.cat);
      const def=BANCO_MAP[p.source];
      const contaId=def?def.id:"geral";
      return {id:`imp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,desc:p.desc,kind:p.kind,cat:p.cat,incType:p.incType,type:p.kind==="inc"?p.source:undefined,emoji:p.kind==="inc"?(INC_TIPOS.find(t=>t.id===p.incType)?.emoji||"🏦"):(cat?.emoji||"📦"),value:p.value,date:dateStr,source:p.source,conta:contaId};
    });
    const nGastos=novos.filter(n=>n.kind==="exp").length;
    const nEntradas=novos.filter(n=>n.kind==="inc").length;
    const totalImp=novos.filter(n=>n.kind==="exp").reduce((s,n)=>s+n.value,0);
    setExps(prev=>[...novos,...prev]);
    setResumoImport({gastos:nGastos,entradas:nEntradas,total:totalImp,n:novos.length,novasCont,novasCats});
    setStep("done");
  }

  return (
    <div>
      {step==="upload"&&<>
        <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:20,marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:10}}>🏦</div>
          <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>Importar extrato bancário</div>
          <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:12}}>CSV ou PDF do seu banco. Seus dados ficam só no celular.</div>
          {/* Bancos suportados */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:16}}>
            {[["💜","Nubank","CSV"],["🔴","Bradesco","CSV"],["🟠","Inter","CSV"],["⚫","C6","CSV"],["🏦","Qualquer banco","PDF+IA"]].map(([e,n,t])=>(
              <span key={n} style={{fontSize:11,padding:"3px 9px",borderRadius:99,background:"rgba(255,255,255,0.06)",color:"#94a3b8",border:"1px solid rgba(255,255,255,0.08)"}}>{e} {n} <span style={{color:"#475569",fontSize:10}}>{t}</span></span>
            ))}
          </div>
          <label style={{display:"block",width:"100%",background:"linear-gradient(135deg,#4f46e5,#4338ca)",borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center",color:"white",fontFamily:"inherit",opacity:loading?0.6:1,boxSizing:"border-box"}}>
            {loading?"⏳ Processando...":"📂 Selecionar CSV ou PDF"}
            <input type="file" accept=".csv,.CSV,.pdf,.PDF" style={{display:"none"}} onChange={handleFile} disabled={loading}/>
          </label>
        </div>
        {loading&&<div style={{textAlign:"center",padding:16}}><div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:8}}><span className="dot"/><span className="dot"/><span className="dot"/></div></div>}
        {msg&&!loading&&<AlertBox tipo={msg.startsWith("❌")?"err":"info"} texto={msg}/>}
        <SecTitle t="Como exportar" sub="CSV ou PDF direto do app do banco"/>
        <div style={CARD}>
          <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.9}}>
            <div style={{marginBottom:10}}><strong style={{color:"#e2e8f0"}}>📊 CSV (recomendado):</strong> Nubank, Bradesco, Inter e C6 exportam CSV direto no app. Procure <em>Exportar extrato</em> ou <em>Baixar CSV</em> na seção de histórico.</div>
            <div><strong style={{color:"#e2e8f0"}}>📄 PDF (qualquer banco):</strong> Baixe o extrato em PDF pelo app ou internet banking. O Granzo usa IA para ler e extrair as transações automaticamente — requer chave Gemini configurada em ⚙️ Config → Chave IA.</div>
          </div>
        </div>
      </>}

      {step==="preview"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{preview.length} lançamentos encontrados</div>
            <div style={{fontSize:12,color:"#64748b"}}>Toque para editar categoria ou tipo</div>
          </div>
          <button style={{fontSize:11,color:"#64748b",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 10px",cursor:"pointer"}} onClick={()=>{setStep("upload");setPreview([]);setMsg("");}}>← Voltar</button>
        </div>
        {msg&&<AlertBox tipo="info" texto={msg}/>}
        {preview.map((p,i)=>(
          <div key={i} style={CARD}>
            {editing===i?<>
              {p.kind==="inc"&&(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Tipo de entrada</div>
                  <select style={inp()} value={p.incType||"outro"} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,incType:e.target.value}:x))}>
                    {INC_TIPOS.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
              )}
              {p.kind==="exp"&&<select style={{...inp(),marginBottom:8}} value={p.cat||"outros"} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,cat:e.target.value}:x))}>
                {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>}
              <select style={{...inp(),marginBottom:8}} value={p.kind} onChange={e=>setPreview(prev=>prev.map((x,j)=>j===i?{...x,kind:e.target.value,incType:e.target.value==="inc"?"outro":undefined}:x))}>
                <option value="exp">💸 Gasto</option>
                <option value="inc">💰 Entrada</option>
              </select>
              <div style={{display:"flex",gap:8}}>
                <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>setEditing(null)}>✓ Feito</button>
                <button style={btn("rgba(248,113,113,0.1)","#f87171",{border:"1px solid rgba(248,113,113,0.2)"})} onClick={()=>{setPreview(prev=>prev.filter((_,j)=>j!==i));setEditing(null);}}>Remover</button>
              </div>
            </>:(
              <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setEditing(i)}>
                <div style={{fontSize:11,color:"#475569",width:36,flexShrink:0}}>{p.date?.slice(0,5)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.desc}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>
                    {p.kind==="inc"
                      ? (INC_TIPOS.find(t=>t.id===p.incType)?.label||"Entrada")
                      : (cats.find(c=>c.id===p.cat)?.label||p.cat)
                    } · {p.source}
                  </div>
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700,color:p.kind==="inc"?"#4ade80":"#f87171"}}>{p.kind==="inc"?"+":"-"}{fmt(p.value)}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>✏️ editar</div>
                </div>
              </div>
            )}
          </div>
        ))}
        <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)",undefined,{marginTop:8})} onClick={confirmar}>✓ Confirmar {preview.length} lançamentos</button>
      </>}

      {step==="done"&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:52,marginBottom:12}}>✅</div>
          <div style={{fontSize:16,fontWeight:700,color:"#4ade80",marginBottom:16}}>Importação concluída!</div>
          {resumoImport&&<div style={{...CARD,textAlign:"left",marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:resumoImport.novasCont?.length||resumoImport.novasCats?.length?8:0}}>
              <div style={{background:"rgba(248,113,113,0.08)",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",marginBottom:2}}>Gastos</div>
                <div style={{fontSize:22,fontWeight:800,color:"#f87171"}}>{resumoImport.gastos}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{fmt(resumoImport.total)}</div>
              </div>
              <div style={{background:"rgba(74,222,128,0.08)",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",marginBottom:2}}>Entradas</div>
                <div style={{fontSize:22,fontWeight:800,color:"#4ade80"}}>{resumoImport.entradas}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{resumoImport.n} lançamentos</div>
              </div>
            </div>
            {resumoImport.novasCont?.length>0&&<AlertBox tipo="info" texto={`🏦 Conta cadastrada automaticamente: ${resumoImport.novasCont.join(", ")}`}/>}
            {resumoImport.novasCats?.length>0&&<AlertBox tipo="info" texto={`🏷️ Categoria(s) nova(s) cadastrada(s): ${resumoImport.novasCats.join(", ")}`}/>}
          </div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button style={btn("linear-gradient(135deg,#4f46e5,#4338ca)")} onClick={()=>setTab&&setTab("dashboard")}>📊 Ver Dashboard</button>
            <button style={btn("rgba(255,255,255,0.06)","#94a3b8",{border:"1px solid rgba(255,255,255,0.1)"})} onClick={()=>{setStep("upload");setPreview([]);setMsg("");setResumoImport(null);}}>📂 Importar outro arquivo</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Importador;
