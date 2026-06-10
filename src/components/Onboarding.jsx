import { useState } from 'react';
import { btn } from '../utils/styles';

const ONBOARDING_STEPS = [
  {
    id:"welcome",
    emoji:"👋",
    titulo:"Bem-vindo ao\nGranzo",
    sub:"Seu controle financeiro pessoal,\nsimples e no seu celular.",
    dica:null,
    cor:"#3DBA6F",
  },
  {
    id:"conta",
    emoji:"🏦",
    titulo:"Cadastre seu banco",
    sub:"Primeiro, adicione a conta do seu banco.\nAssim seus lançamentos ficam organizados por fonte.",
    dica:"⚙️ Config → Contas → + Nova conta",
    cor:"#3DBA6F",
    destaque:"config",
  },
  {
    id:"orcamento",
    emoji:"💰",
    titulo:"Defina seu orçamento",
    sub:"Configure quanto você quer gastar por categoria — alimentação, moradia, lazer...\nO app avisa quando estiver chegando no limite.",
    dica:"Aba Orçamento → toque em cada categoria",
    cor:"#E8A832",
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
    cor:"#3DBA6F",
  },
];

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
      background:"#0A0F0D",
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"space-between",
      padding:"env(safe-area-inset-top,24px) 28px 40px",
      opacity:saindo?0:1,
      transition:"opacity 0.35s ease",
      fontFamily:"'Bricolage Grotesque','Outfit',sans-serif",
    }}>
      {/* Barra de progresso */}
      <div style={{width:"100%",maxWidth:360,paddingTop:20}}>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:32}}>
          {ONBOARDING_STEPS.map((_,i)=>(
            <div key={i} style={{
              height:4,flex:1,borderRadius:99,
              background: i<=step ? s.cor : "#232B24",
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
            fontSize:26,fontWeight:800,color:"#DDE8DF",
            lineHeight:1.3,marginBottom:14,whiteSpace:"pre-line",
          }}>{s.titulo}</div>

          <div style={{
            fontSize:15,color:"#8FA893",
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
            border:"none",color:"#0A0F0D",
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
            ? "#3DBA6F"
            : "#181E19",
          border: isLast ? "none" : "1px solid #2E3A2F",
          color: isLast ? "#0A0F0D" : "#8FA893",
          borderRadius:14,padding:"14px 0",
          fontSize:15,fontWeight:700,cursor:"pointer",
          fontFamily:"'Outfit',sans-serif",
          boxShadow: isLast ? "0 4px 20px rgba(61,186,111,0.4)" : "none",
        }} onClick={avancar}>
          {isLast?"Começar a usar 🚀":"Próximo"}
        </button>

        {!isLast&&!isFirst&&(
          <button style={{
            width:"100%",marginTop:10,
            background:"none",border:"none",
            color:"#536057",fontSize:13,cursor:"pointer",
            fontFamily:"'Outfit',sans-serif",padding:"8px 0",
          }} onClick={concluir}>Pular tutorial</button>
        )}
      </div>
    </div>
  );
}


export default Onboarding;
