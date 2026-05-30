import { useState } from 'react';
import { btn } from '../utils/styles';

function Onboarding({ onDone, setTab }) {
  const [step, setStep] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const isFirst = step === 0;

  function avancar() {
    if(isLast){ concluir(); return; }
    setStep(p=>p+1);
  }
  function concluir(){
    setSaindo(true);
    setTimeout(()=>{ onDone(); }, 350);
  }
  function irPara(){
    if(s.destaque){ concluir(); setTimeout(()=>setTab(s.destaque==="config"?"config":s.destaque),400); }
  }

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:1000,
      background:"#080e1d",
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"space-between",
      padding:"env(safe-area-inset-top,24px) 28px 40px",
      opacity:saindo?0:1,
      transition:"opacity 0.35s ease",
      fontFamily:"'Outfit',sans-serif",
    }}>
      {/* Barra de progresso */}
      <div style={{width:"100%",maxWidth:360,paddingTop:20}}>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:32}}>
          {ONBOARDING_STEPS.map((_,i)=>(
            <div key={i} style={{
              height:4,flex:1,borderRadius:99,
              background: i<=step ? s.cor : "rgba(255,255,255,0.08)",
              transition:"background 0.4s ease",
            }}/>
          ))}
        </div>

        {/* Conteúdo central */}
        <div style={{textAlign:"center",paddingBottom:24}}>
          <div style={{
            fontSize:72,marginBottom:28,
            filter:`drop-shadow(0 0 24px ${s.cor}55)`,
            lineHeight:1,
          }}>{s.emoji}</div>

          <div style={{
            fontSize:26,fontWeight:800,color:"#f1f5f9",
            lineHeight:1.3,marginBottom:14,whiteSpace:"pre-line",
          }}>{s.titulo}</div>

          <div style={{
            fontSize:15,color:"#94a3b8",
            lineHeight:1.7,marginBottom:s.dica?24:0,
            whiteSpace:"pre-line",
          }}>{s.sub}</div>

          {s.dica&&(
            <div style={{
              display:"inline-flex",alignItems:"center",gap:8,
              background:`${s.cor}15`,
              border:`1px solid ${s.cor}40`,
              borderRadius:12,padding:"10px 16px",
              fontSize:13,color:s.cor,fontWeight:600,
              marginTop:4,
            }}>
              <span style={{fontSize:16}}>💡</span>
              {s.dica}
            </div>
          )}
        </div>
      </div>

      {/* Botões */}
      <div style={{width:"100%",maxWidth:360}}>
        {/* Botão de ação contextual */}
        {s.destaque&&(
          <button style={{
            width:"100%",marginBottom:12,
            background:`linear-gradient(135deg,${s.cor}CC,${s.cor}99)`,
            border:"none",color:"#fff",
            borderRadius:14,padding:"14px 0",
            fontSize:15,fontWeight:700,cursor:"pointer",
            fontFamily:"'Outfit',sans-serif",
            boxShadow:`0 4px 20px ${s.cor}44`,
          }} onClick={irPara}>
            Configurar agora →
          </button>
        )}

        <button style={{
          width:"100%",
          background: isLast
            ? `linear-gradient(135deg,#818cf8,#6366f1)`
            : "rgba(255,255,255,0.06)",
          border: isLast ? "none" : "1px solid rgba(255,255,255,0.1)",
          color: isLast ? "#fff" : "#94a3b8",
          borderRadius:14,padding:"14px 0",
          fontSize:15,fontWeight:700,cursor:"pointer",
          fontFamily:"'Outfit',sans-serif",
          boxShadow: isLast ? "0 4px 20px rgba(99,102,241,0.4)" : "none",
        }} onClick={avancar}>
          {isLast?"Começar a usar 🚀":"Próximo"}
        </button>

        {!isLast&&!isFirst&&(
          <button style={{
            width:"100%",marginTop:10,
            background:"none",border:"none",
            color:"#475569",fontSize:13,cursor:"pointer",
            fontFamily:"'Outfit',sans-serif",padding:"8px 0",
          }} onClick={concluir}>Pular tutorial</button>
        )}
      </div>
    </div>
  );
}


export default Onboarding;
