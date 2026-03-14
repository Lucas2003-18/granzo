import { useState, useRef, useEffect, Component } from "react";
import { fmt } from "./utils/format";
import { MESES, MESES_CURTO, CATS_DEF, FIXAS_DEF, MKTS_DEF, CONTAS_DEF } from "./utils/constants";
import { useAutoBackup } from "./hooks/useAutoBackup";
import { useNotifCheck } from "./hooks/useNotifications";
import Dashboard from "./components/Dashboard";
import Graficos from "./components/Graficos";
import Orcamento from "./components/Orcamento";
import Gastos from "./components/Gastos";
import Mercado from "./components/Mercado";
import IAChat from "./components/IAChat";
import Reservas from "./components/Reservas";
import Onboarding from "./components/Onboarding";
import Config from "./components/Config";

class ErrorBoundary extends Component{
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  render(){
    if(this.state.hasError) return (
      <div style={{background:"#080e1d",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Outfit',sans-serif"}}>
        <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:18,padding:"32px 24px",maxWidth:360,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,color:"#f87171",marginBottom:8}}>Algo deu errado</div>
          <div style={{fontSize:13,color:"#94a3b8",marginBottom:20,lineHeight:1.6}}>{this.state.error?.message||"Erro inesperado no app"}</div>
          <button style={{background:"linear-gradient(135deg,#4f46e5,#4338ca)",border:"none",color:"white",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>{this.setState({hasError:false,error:null});}}>Tentar novamente</button>
          <div style={{marginTop:12}}>
            <button style={{background:"none",border:"none",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}
              onClick={()=>{try{["mf_exps","mf_cats","mf_mkts","mf_fixas","mf_contas","mf_reservas","mf_meta","mf_prods_extra","mf_precos","mf_onboarding_done"].forEach(k=>localStorage.removeItem(k));}catch{}window.location.reload();}}>Limpar dados e reiniciar</button>
          </div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {return <ErrorBoundary><AppContent/></ErrorBoundary>;}

function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState(()=>{
    try{ return !localStorage.getItem("mf_onboarding_done"); }catch{ return true; }
  });
  function finishOnboarding(){ try{localStorage.setItem("mf_onboarding_done","1");}catch{} setShowOnboarding(false); }

  // Capacitor: StatusBar + SplashScreen via API global (sem import — não quebra build)
  useEffect(()=>{
    const cap=window.Capacitor;
    if(!cap?.isNativePlatform?.()) return;
    const plugins=cap.Plugins||{};
    try{
      plugins.StatusBar?.setBackgroundColor?.({color:"#080e1d"});
      plugins.StatusBar?.setStyle?.({style:"DARK"});
    }catch{}
    try{ plugins.SplashScreen?.hide?.(); }catch{}
  },[]);

  const [tab,      setTab]     = useState(()=>{
    if(window.location.hash?.includes("access_token")) return "config";
    return "dashboard";
  });
  const [openWith, setOpenWith]= useState(null);
  const [hideVals, setHideVals]= useState(false);
  const [catModal, setCatModal]= useState(null);
  const [toast,    setToast]   = useState("");

  const [exps,    setExps]    = useState(()=>{ try{const v=localStorage.getItem("mf_exps");return v?JSON.parse(v):[]}catch{return []} });
  const [cats,    setCats]    = useState(()=>{ try{const v=localStorage.getItem("mf_cats");return v?JSON.parse(v):CATS_DEF}catch{return CATS_DEF} });
  const [markets, setMarkets] = useState(()=>{ try{const v=localStorage.getItem("mf_mkts");return v?JSON.parse(v):MKTS_DEF}catch{return MKTS_DEF} });
  const [fixas,   setFixas]   = useState(()=>{ try{const v=localStorage.getItem("mf_fixas");return v?JSON.parse(v):FIXAS_DEF}catch{return FIXAS_DEF} });
  const [contas,  setContas]  = useState(()=>{ try{const v=localStorage.getItem("mf_contas");return v?JSON.parse(v):CONTAS_DEF}catch{return CONTAS_DEF} });
  const [reservas,setReservas]= useState(()=>{ try{const v=localStorage.getItem("mf_reservas");return v?JSON.parse(v):[]}catch{return []} });
  const [meta,    setMeta]    = useState(()=>{ try{const v=localStorage.getItem("mf_meta");return v?JSON.parse(v):0;}catch{return 0;} });

  const toastTimer = useRef(null);
  function showToast(msg){
    if(toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current=setTimeout(()=>setToast(""),2000);
  }

  // Captura token do Google OAuth no hash da URL (redirect volta aqui)
  useEffect(()=>{
    const hash=window.location.hash;
    if(hash&&hash.includes("access_token")){
      const p=new URLSearchParams(hash.slice(1));
      const t=p.get("access_token");
      if(t){
        try{localStorage.setItem("mf_gdrive_token",t);}catch{}
        window.history.replaceState(null,"",window.location.pathname);
        showToast("✓ Google Drive conectado!");
      }
    }
  },[]);

  useEffect(()=>{ try{localStorage.setItem("mf_exps",JSON.stringify(exps));}catch{} },[exps]);
  const catsInit=useRef(true);
  useEffect(()=>{ if(catsInit.current){catsInit.current=false;return;} try{localStorage.setItem("mf_cats",JSON.stringify(cats));showToast("✓ Salvo");}catch{} },[cats]);
  useEffect(()=>{ try{localStorage.setItem("mf_mkts",JSON.stringify(markets))}catch{} },[markets]);
  const fixasInit=useRef(true);
  useEffect(()=>{ if(fixasInit.current){fixasInit.current=false;return;} try{localStorage.setItem("mf_fixas",JSON.stringify(fixas));showToast("✓ Salvo");}catch{} },[fixas]);
  useEffect(()=>{ try{localStorage.setItem("mf_contas",JSON.stringify(contas))}catch{} },[contas]);
  const reservasInit=useRef(true);
  useEffect(()=>{ if(reservasInit.current){reservasInit.current=false;return;} try{localStorage.setItem("mf_reservas",JSON.stringify(reservas));showToast("✓ Salvo");}catch{} },[reservas]);
  useEffect(()=>{ try{localStorage.setItem("mf_meta",JSON.stringify(meta));}catch{} },[meta]);

  const mesesDisp=[...new Set(exps.map(e=>{
    const p=e.date?.split("/");
    if(p?.length>=3) return `${p[2]}-${p[1]}`;
    if(p?.length>=2) return `${new Date().getFullYear()}-${p[1]}`;
    return null;
  }).filter(Boolean))].sort();
  const [mesFiltro,setMesFiltro]=useState(()=>{
    const m=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
    return m;
  });

  useEffect(()=>{
    if(mesFiltro!=="todos"&&mesesDisp.length>0&&!mesesDisp.includes(mesFiltro)){
      setMesFiltro(mesesDisp[mesesDisp.length-1]||"todos");
    }
  },[mesesDisp.length]);

  useEffect(()=>{ setCatModal(null); },[mesFiltro]);

  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const expsFiltrados=mesFiltro==="todos"?exps:exps.filter(e=>{
    const p=e.date?.split("/");
    if(!p||p.length<2) return false;
    const anoMes=p.length>=3?`${p[2]}-${p[1]}`:`${new Date().getFullYear()}-${p[1]}`;
    return anoMes===mesFiltro;
  });

  const totalInc=expsFiltrados.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType)).reduce((s,e)=>s+e.value,0);
  const totalExp=expsFiltrados.filter(e=>e.kind==="exp"&&e.cat!=="investimento").reduce((s,e)=>s+e.value,0);
  const saldo=totalInc-totalExp;

  useAutoBackup(exps,cats,markets,fixas,contas,reservas,meta,showToast);
  useNotifCheck(cats,exps,fixas,mesFiltro);

  const TABS=[
    {id:"dashboard",emoji:"📊",label:"Início"},
    {id:"graficos", emoji:"📈",label:"Gráficos"},
    {id:"orcamento",emoji:"💰",label:"Orçamento"},
    {id:"gastos",   emoji:"💸",label:"Gastos"},
    {id:"reservas", emoji:"🏦",label:"Reservas"},
    {id:"mercado",  emoji:"🛒",label:"Mercado"},
    {id:"ia",       emoji:"🤖",label:"IA"},
  ];

  return (
    <>
    {showOnboarding&&<Onboarding onDone={finishOnboarding} setTab={t=>{finishOnboarding();setTab(t);}}/>}
    <div style={{fontFamily:"'Outfit',sans-serif",background:"#080e1d",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",maxWidth:"min(600px,100vw)",margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;background:#080e1d;}
        input,button,select{font-family:'Outfit',sans-serif;}
        select option{background:#1e293b;color:#e2e8f0;}
        .dot{display:inline-block;width:7px;height:7px;background:#64748b;border-radius:50%;animation:bounce 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px;}
      `}</style>

      {toast&&(
        <div style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.35)",backdropFilter:"blur(12px)",borderRadius:99,padding:"6px 18px",fontSize:12,fontWeight:700,color:"#4ade80",zIndex:999,whiteSpace:"nowrap",pointerEvents:"none",transition:"opacity 0.3s"}}>
          {toast}
        </div>
      )}

      <div style={{background:"linear-gradient(135deg,#0d1b3e,#162547)",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        <div style={{padding:"14px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>Granzo</div>
            <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9"}}>
              {mesFiltro==="todos"?"Todos os meses":(()=>{const[ano,mes]=mesFiltro.split("-");return MESES[+mes]+" "+ano;})()}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:1}}>Saldo {mesFiltro!=="todos"?"do mês":"total"}</div>
              <div style={{fontSize:17,fontWeight:800,color:saldo>=0?"#4ade80":"#f87171"}}>{hideVals?"R$ ••••":fmt(saldo)}</div>
            </div>
            <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#94a3b8",fontSize:18,padding:"6px 8px",cursor:"pointer"}} onClick={()=>setHideVals(v=>!v)}>{hideVals?"🙈":"👁️"}</button>
            <button style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#94a3b8",fontSize:18,padding:"6px 8px",cursor:"pointer"}} onClick={()=>setTab("config")}>⚙️</button>
          </div>
        </div>
        {mesesDisp.length>0&&(
          <div style={{display:"flex",gap:6,overflowX:"auto",padding:"0 16px 10px",scrollbarWidth:"none"}}>
            <button style={{background:mesFiltro==="todos"?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:mesFiltro==="todos"?"1px solid rgba(99,102,241,0.6)":"1px solid rgba(255,255,255,0.1)",color:mesFiltro==="todos"?"#818cf8":"#64748b",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro==="todos"?700:400}}
              onClick={()=>setMesFiltro("todos")}>Todos</button>
            {mesesDisp.map(m=>{
              const[ano,mes]=m.split("-");
              const multiAno=mesesDisp.some(x=>x.split("-")[0]!==ano);
              const label=MESES_CURTO[+mes]+(multiAno?" '"+ano.slice(2):"");
              return <button key={m} style={{background:mesFiltro===m?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",border:mesFiltro===m?"1px solid rgba(99,102,241,0.6)":"1px solid rgba(255,255,255,0.1)",color:mesFiltro===m?"#818cf8":"#64748b",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro===m?700:400}}
                onClick={()=>setMesFiltro(m)}>{label}</button>;
            })}
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
        {tab==="dashboard"&&<Dashboard exps={expsFiltrados} cats={cats} contas={contas} hide={hideVals} onCatClick={cat=>{setCatModal(cat);setTab("gastos");}} mesFiltro={mesFiltro} allExps={exps} fixas={fixas} setFixas={setFixas} mesAtual={mesAtual} reservas={reservas} meta={meta} showToast={showToast}
          onAddFixa={r=>{setFixas(p=>[...p,{id:"fx"+Date.now(),desc:r.desc,valor:r.value,cat:r.cat||"outros",emoji:r.emoji||"📌",ativo:true}]);showToast("✓ Adicionado às fixas!");}}/>}
        {tab==="graficos" &&<Graficos  exps={expsFiltrados} cats={cats} hide={hideVals} allExps={exps} mesFiltro={mesFiltro}/>}
        {tab==="orcamento"&&<Orcamento exps={expsFiltrados} cats={cats} setCats={setCats} hide={hideVals} mesFiltro={mesFiltro}/>}
        {tab==="gastos"   &&<Gastos    exps={exps} setExps={setExps} cats={cats} contas={contas} openWith={openWith} onOpened={()=>setOpenWith(null)} hide={hideVals} mesFiltro={mesFiltro} catFiltro={catModal} onClearCat={()=>setCatModal(null)}/>}
        {tab==="reservas" &&<Reservas  reservas={reservas} setReservas={setReservas} hide={hideVals}/>}
        {tab==="mercado"  &&<Mercado   markets={markets} setMarkets={setMarkets} hide={hideVals}/>}
        {tab==="ia"       &&<IAChat    exps={expsFiltrados} cats={cats} mesFiltro={mesFiltro}/>}
        {tab==="config"   &&<Config    cats={cats} setCats={setCats} markets={markets} setMarkets={setMarkets} exps={exps} setExps={setExps} fixas={fixas} setFixas={setFixas} contas={contas} setContas={setContas} reservas={reservas} setReservas={setReservas} meta={meta} setMeta={setMeta} setTab={setTab} showToast={showToast} mesFiltro={mesFiltro}/>}
      </div>

      {tab!=="ia"&&tab!=="config"&&(
        <div style={{position:"fixed",bottom:76,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:49}}>
          <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(34,197,94,0.4)",fontWeight:700}} onClick={()=>{setOpenWith("income");setTab("gastos");}}>+💰</button>
          <button style={{width:46,height:46,borderRadius:"50%",background:"linear-gradient(135deg,#ef4444,#dc2626)",border:"none",color:"white",fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.4)",fontWeight:700}} onClick={()=>{setOpenWith("expense");setTab("gastos");}}>+💸</button>
        </div>
      )}

      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"min(600px,100vw)",background:"rgba(8,14,29,0.97)",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",overflowX:"auto",padding:"6px 2px 10px",backdropFilter:"blur(20px)",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} style={{flex:"0 0 auto",minWidth:60,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 2px",opacity:tab===t.id?1:0.38,transition:"opacity 0.15s"}} onClick={()=>setTab(t.id)}>
            <span style={{fontSize:18}}>{t.emoji}</span>
            <span style={{fontSize:9,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.03em"}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </>
  );
}
