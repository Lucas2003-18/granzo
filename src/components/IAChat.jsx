import { useState, useRef, useEffect } from 'react';
import { fmt } from '../utils/format';
import { MESES } from '../utils/constants';
import { askGemini, getGeminiKey } from '../utils/gemini';
import { inp, btn, CARD } from '../utils/styles';
import { MdText, AlertBox } from './ui';

function IAChat({ exps, cats, mesFiltro }) {
  const [msgs,    setMsgs]    = useState([]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const gastos   = exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
  const totalInc = exps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
  const totalTransf = exps.filter(e=>e.kind==="inc"&&(e.incType==="transferencia"||e.incType==="investimento_ret")).reduce((s,e)=>s+e.value,0);
  const totalExp = gastos.reduce((s,e)=>s+e.value,0);
  const totalInv = exps.filter(e=>e.cat==="investimento").reduce((s,e)=>s+e.value,0);
  const txPoup   = totalInc>0?((totalInc-totalExp)/totalInc*100).toFixed(1)+"%":"N/A";

  async function send(){
    const msg=input.trim();if(!msg||loading)return;
    setInput("");setLoading(true);
    setMsgs(p=>[...p,{role:"user",text:msg}]);
    if(!getGeminiKey()){setMsgs(p=>[...p,{role:"ai",text:"⚠️ Configure sua chave do Gemini em ⚙️ Config → Chave IA."}]);setLoading(false);return;}
    const catRes=cats.map(c=>{const s=gastos.filter(e=>e.cat===c.id).reduce((a,e)=>a+e.value,0);return `${c.label}: ${fmt(s)}/${fmt(c.budget)}`;}).join("; ");
    const top3=[...gastos].sort((a,b)=>b.value-a.value).slice(0,3).map(e=>e.desc+" "+fmt(e.value)).join(", ");
    const periodoLabel=mesFiltro&&mesFiltro!=="todos"?(()=>{const[a,m]=mesFiltro.split("-");return `${MESES[+m]}/${a}`;})():"todos os meses";
    const sys=`Você é um consultor financeiro pessoal brasileiro, empático e direto.
Período analisado: ${periodoLabel}
Dados do usuário:
- Salário/Renda real: ${fmt(totalInc)} (excluindo transferências e retornos)
- Gastos: ${fmt(totalExp)} | Saldo: ${fmt(totalInc-totalExp)}
- Investimentos aportados: ${fmt(totalInv)} | Taxa de poupança: ${typeof txPoup==="number"?txPoup.toFixed(1)+"%":txPoup}
${totalTransf>0?"- Transferências/retornos recebidos (não contam como renda): "+fmt(totalTransf):""}
- Categorias: ${catRes}
- Maiores gastos: ${top3}
Responda em português. Seja específico com os números. Escreva a resposta COMPLETA — nunca corte no meio. Use entre 2 e 4 parágrafos.`;
    try{const txt=await askGemini(sys,msg,3000);setMsgs(p=>[...p,{role:"ai",text:txt||"Não consegui responder."}]);}
    catch(e){setMsgs(p=>[...p,{role:"ai",text:`Erro: ${e.message}`}]);}
    setLoading(false);
    setTimeout(()=>ref.current?.scrollTo({top:99999,behavior:"smooth"}),100);
  }

  const suggs=["Onde estou gastando mais?","Como economizar este mês?","Minha taxa de poupança está boa?","Quais gastos posso cortar?","Diagnóstico das minhas finanças","Estou investindo o suficiente?"];
  // Limpa conversa quando mês muda para o resumo ficar sempre atualizado
  const [lastMes,setLastMes]=useState(mesFiltro);
  useEffect(()=>{
    if(mesFiltro!==lastMes){setMsgs([]);setLastMes(mesFiltro);}
  },[mesFiltro]);

  // Resumo automático ao abrir a aba com dados
  useEffect(()=>{
    if(loading) setLoading(false);
    if(msgs.length>0||exps.length===0||!getGeminiKey()) return;
    const catRes=cats.map(c=>{const s=gastos.filter(e=>e.cat===c.id).reduce((a,e)=>a+e.value,0);return `${c.label}: ${fmt(s)}`;}).filter(s=>!s.includes("R$ 0")).join("; ");
    const periodoLabelAuto=mesFiltro&&mesFiltro!=="todos"?(()=>{const[a,m]=mesFiltro.split("-");return `${MESES[+m]}/${a}`;})():"período geral";
    const sys=`Você é um consultor financeiro pessoal brasileiro, empático e direto. Faça um diagnóstico financeiro completo (entre 80 e 150 palavras) dos dados de ${periodoLabelAuto}. Comece com um emoji e uma frase de diagnóstico. Cite 2-3 pontos específicos com números. Conclua com 1 sugestão prática. Escreva até o fim — nunca corte no meio de uma frase.
Dados: Renda ${fmt(totalInc)} | Gastos ${fmt(totalExp)} | Saldo ${fmt(totalInc-totalExp)} | Poupança ${typeof txPoup==="number"?txPoup.toFixed(1)+"%":txPoup} | Categorias: ${catRes}`;
    setLoading(true);
    askGemini(sys,"Resumo do período",1200).then(txt=>{
      if(txt) setMsgs([{role:"ai",text:"📊 "+txt}]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 116px)"}}>
      {!getGeminiKey()&&<div style={{padding:"10px 16px"}}>
        <AlertBox tipo="warn" texto="⚠️ Chave Gemini não configurada. Vá em ⚙️ Config → Chave IA para ativar o assistente."/>
      </div>}
      <div style={{display:"flex",gap:12,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{fontSize:24,background:"rgba(99,102,241,0.2)",borderRadius:12,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center"}}>🤖</div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>Consultor Financeiro IA</div>
          <div style={{fontSize:11,color:"#64748b"}}>Baseado nos seus dados · {exps.length} lançamentos</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}} ref={ref}>
        {msgs.length===0&&!loading&&(
          <div style={{textAlign:"center",marginTop:12}}>
            <div style={{fontSize:36,marginBottom:8}}>💬</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Pergunte qualquer coisa sobre suas finanças!</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {suggs.map(s=>(
                <button key={s} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8",borderRadius:10,padding:"10px 12px",fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",lineHeight:1.4}}
                  onClick={()=>setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{padding:"12px 14px",borderRadius:14,maxWidth:"85%",fontSize:14,lineHeight:1.6,
            ...(m.role==="user"?{alignSelf:"flex-end",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"white",borderBottomRightRadius:4}:{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",color:"#e2e8f0",border:"1px solid rgba(255,255,255,0.08)",borderBottomLeftRadius:4})}}>
            <MdText text={m.text}/>
          </div>
        ))}
        {loading&&<div style={{alignSelf:"flex-start",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"12px 14px",display:"flex",gap:5}}><span className="dot"/><span className="dot"/><span className="dot"/></div>}
      </div>
      <div style={{display:"flex",gap:8,padding:"10px 14px",background:"rgba(8,14,29,0.98)",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <input style={{...inp(),flex:1}} placeholder="Pergunte algo..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button style={{background:"linear-gradient(135deg,#4f46e5,#4338ca)",border:"none",color:"white",borderRadius:12,width:44,height:44,fontSize:16,cursor:"pointer"}} onClick={send}>➤</button>
      </div>
    </div>
  );
}


export default IAChat;
