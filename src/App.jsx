import { useState, useRef, useEffect, Component } from "react";
import { LayoutDashboard, ArrowLeftRight, PieChart, Wallet, Sparkles, Eye, EyeOff, Settings, Plus } from "lucide-react";
import { fmt } from "./utils/format";
import { MESES, MESES_CURTO, CATS_DEF, FIXAS_DEF, CONTAS_DEF } from "./utils/constants";
import { useNotifCheck } from "./hooks/useNotifications";
import { syncToBackend } from "./utils/api";
import Dashboard from "./components/Dashboard";
import Graficos from "./components/Graficos";
import Orcamento from "./components/Orcamento";
import Gastos from "./components/Gastos";
import IAChat from "./components/IAChat";
import Reservas from "./components/Reservas";
import Dividas from "./components/Dividas";
import Onboarding from "./components/Onboarding";
import Config from "./components/Config";
import { SegmentToggle } from "./components/ui";

class ErrorBoundary extends Component{
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  render(){
    if(this.state.hasError) return (
      <div style={{background:"#0A0F0D",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Bricolage Grotesque','Outfit',sans-serif"}}>
        <div style={{background:"rgba(224,82,82,0.08)",border:"1px solid rgba(224,82,82,0.25)",borderRadius:18,padding:"32px 24px",maxWidth:360,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,color:"#E05252",marginBottom:8}}>Algo deu errado</div>
          <div style={{fontSize:13,color:"#8FA893",marginBottom:20,lineHeight:1.6}}>{this.state.error?.message||"Erro inesperado no app"}</div>
          <button style={{background:"#3DBA6F",border:"none",color:"#0A0F0D",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>{this.setState({hasError:false,error:null});}}>Tentar novamente</button>
          <div style={{marginTop:12}}>
            <button style={{background:"none",border:"none",color:"#536057",fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}
              onClick={()=>{try{["mf_exps","mf_cats","mf_fixas","mf_contas","mf_reservas","mf_meta","mf_onboarding_done"].forEach(k=>localStorage.removeItem(k));}catch{}window.location.reload();}}>Limpar dados e reiniciar</button>
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
      plugins.StatusBar?.setBackgroundColor?.({color:"#0A0F0D"});
      plugins.StatusBar?.setStyle?.({style:"DARK"});
    }catch{}
    try{ plugins.SplashScreen?.hide?.(); }catch{}
  },[]);

  const [tab,      setTab]     = useState("dashboard");
  const [openWith, setOpenWith]= useState(null);
  const [hideVals, setHideVals]= useState(false);
  const [catModal, setCatModal]= useState(null);
  const [toast,    setToast]   = useState("");
  const [analiseView,setAnaliseView]=useState("graficos");
  const [carteiraView,setCarteiraView]=useState("reservas");

  const [exps,    setExps]    = useState(()=>{ try{const v=localStorage.getItem("mf_exps");return v?JSON.parse(v):[]}catch{return []} });
  const [cats,    setCats]    = useState(()=>{ try{const v=localStorage.getItem("mf_cats");return v?JSON.parse(v):CATS_DEF}catch{return CATS_DEF} });
  const [fixas,   setFixas]   = useState(()=>{ try{const v=localStorage.getItem("mf_fixas");return v?JSON.parse(v):FIXAS_DEF}catch{return FIXAS_DEF} });
  const [contas,  setContas]  = useState(()=>{ try{const v=localStorage.getItem("mf_contas");return v?JSON.parse(v):CONTAS_DEF}catch{return CONTAS_DEF} });
  const [reservas,setReservas]= useState(()=>{ try{const v=localStorage.getItem("mf_reservas");return v?JSON.parse(v):[]}catch{return []} });
  const [meta,    setMeta]    = useState(()=>{ try{const v=localStorage.getItem("mf_meta");return v?JSON.parse(v):0;}catch{return 0;} });
  const [dividas, setDividas] = useState(()=>{ try{const v=localStorage.getItem("mf_dividas");return v?JSON.parse(v):[]}catch{return []} });

  const toastTimer = useRef(null);
  function showToast(msg){
    if(toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current=setTimeout(()=>setToast(""),2000);
  }

  useEffect(()=>{ try{localStorage.setItem("mf_exps",JSON.stringify(exps));}catch{} },[exps]);
  const catsInit=useRef(true);
  useEffect(()=>{ if(catsInit.current){catsInit.current=false;return;} try{localStorage.setItem("mf_cats",JSON.stringify(cats));showToast("✓ Salvo");}catch{} },[cats]);
  const fixasInit=useRef(true);
  useEffect(()=>{ if(fixasInit.current){fixasInit.current=false;return;} try{localStorage.setItem("mf_fixas",JSON.stringify(fixas));showToast("✓ Salvo");}catch{} },[fixas]);
  useEffect(()=>{ try{localStorage.setItem("mf_contas",JSON.stringify(contas))}catch{} },[contas]);
  const reservasInit=useRef(true);
  useEffect(()=>{ if(reservasInit.current){reservasInit.current=false;return;} try{localStorage.setItem("mf_reservas",JSON.stringify(reservas));showToast("✓ Salvo");}catch{} },[reservas]);
  useEffect(()=>{ try{localStorage.setItem("mf_meta",JSON.stringify(meta));}catch{} },[meta]);
  const dividasInit=useRef(true);
  useEffect(()=>{ if(dividasInit.current){dividasInit.current=false;return;} try{localStorage.setItem("mf_dividas",JSON.stringify(dividas));}catch{} },[dividas]);

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

  // Sync debounced ao backend quando dados financeiros mudam
  const syncTimer=useRef(null);
  useEffect(()=>{
    clearTimeout(syncTimer.current);
    syncTimer.current=setTimeout(()=>{
      syncToBackend({exps,cats,reservas,dividas,mesFiltro,meta});
    },5000);
    return ()=>clearTimeout(syncTimer.current);
  },[exps,cats,reservas,dividas,meta,mesFiltro]);

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

  useNotifCheck(cats,exps,fixas,mesFiltro,dividas);

  const TABS=[
    {id:"dashboard", Icon:LayoutDashboard, label:"Início"},
    {id:"gastos",    Icon:ArrowLeftRight,  label:"Gastos"},
    {id:"analise",   Icon:PieChart,        label:"Análise"},
    {id:"carteira",  Icon:Wallet,          label:"Carteira"},
    {id:"ia",        Icon:Sparkles,        label:"IA"},
  ];

  return (
    <>
    {showOnboarding&&<Onboarding onDone={finishOnboarding} setTab={t=>{finishOnboarding();setTab(t);}}/>}
    <div style={{fontFamily:"'Bricolage Grotesque','Outfit',sans-serif",background:"#0A0F0D",minHeight:"100vh",color:"#DDE8DF",display:"flex",flexDirection:"column",maxWidth:"min(600px,100vw)",margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=DM+Mono:wght@400;500&family=Outfit:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;background:#0A0F0D;}
        input,button,select{font-family:'Outfit',sans-serif;}
        select option{background:#181E19;color:#DDE8DF;}
        .dot{display:inline-block;width:7px;height:7px;background:#536057;border-radius:50%;animation:bounce 1.2s ease-in-out infinite;}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#2E3A2F;border-radius:99px;}
      `}</style>

      {toast&&(
        <div style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",background:"rgba(61,186,111,0.15)",border:"1px solid rgba(61,186,111,0.35)",backdropFilter:"blur(12px)",borderRadius:99,padding:"6px 18px",fontSize:12,fontWeight:700,color:"#3DBA6F",zIndex:999,whiteSpace:"nowrap",pointerEvents:"none",transition:"opacity 0.3s"}}>
          {toast}
        </div>
      )}

      <div style={{background:"#111713",borderBottom:"1px solid #232B24",flexShrink:0}}>
        <div style={{padding:"14px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:"#536057",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>Granzo</div>
            <div style={{fontSize:20,fontWeight:800,color:"#DDE8DF",letterSpacing:"-0.02em"}}>
              {mesFiltro==="todos"?"Todos os meses":(()=>{const[ano,mes]=mesFiltro.split("-");return MESES[+mes]+" "+ano;})()}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"#536057",marginBottom:1}}>Saldo {mesFiltro!=="todos"?"do mês":"total"}</div>
              <div style={{fontSize:17,fontWeight:500,fontFamily:"'DM Mono',monospace",color:saldo>=0?"#3DBA6F":"#E05252"}}>{hideVals?"R$ ••••":fmt(saldo)}</div>
            </div>
            <button style={{background:"#181E19",border:"1px solid #2E3A2F",borderRadius:10,color:"#8FA893",display:"flex",alignItems:"center",padding:"6px 8px",cursor:"pointer"}} onClick={()=>setHideVals(v=>!v)}>{hideVals?<EyeOff size={18}/>:<Eye size={18}/>}</button>
            <button style={{background:"#181E19",border:"1px solid #2E3A2F",borderRadius:10,color:"#8FA893",display:"flex",alignItems:"center",padding:"6px 8px",cursor:"pointer"}} onClick={()=>setTab("config")}><Settings size={18}/></button>
          </div>
        </div>
        {mesesDisp.length>0&&(
          <div style={{display:"flex",gap:6,overflowX:"auto",padding:"0 16px 10px",scrollbarWidth:"none"}}>
            <button style={{background:mesFiltro==="todos"?"rgba(61,186,111,0.12)":"#181E19",border:mesFiltro==="todos"?"1px solid rgba(61,186,111,0.35)":"1px solid #232B24",color:mesFiltro==="todos"?"#3DBA6F":"#536057",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro==="todos"?700:400}}
              onClick={()=>setMesFiltro("todos")}>Todos</button>
            {mesesDisp.map(m=>{
              const[ano,mes]=m.split("-");
              const multiAno=mesesDisp.some(x=>x.split("-")[0]!==ano);
              const label=MESES_CURTO[+mes]+(multiAno?" '"+ano.slice(2):"");
              return <button key={m} style={{background:mesFiltro===m?"rgba(61,186,111,0.12)":"#181E19",border:mesFiltro===m?"1px solid rgba(61,186,111,0.35)":"1px solid #232B24",color:mesFiltro===m?"#3DBA6F":"#536057",borderRadius:99,padding:"4px 14px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit",fontWeight:mesFiltro===m?700:400}}
                onClick={()=>setMesFiltro(m)}>{label}</button>;
            })}
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
        {tab==="dashboard"&&<Dashboard exps={expsFiltrados} cats={cats} contas={contas} hide={hideVals} onCatClick={cat=>{setCatModal(cat);setTab("gastos");}} mesFiltro={mesFiltro} allExps={exps} fixas={fixas} setFixas={setFixas} mesAtual={mesAtual} reservas={reservas} meta={meta} showToast={showToast}
          onAddFixa={r=>{setFixas(p=>[...p,{id:"fx"+Date.now(),desc:r.desc,valor:r.value,cat:r.cat||"outros",emoji:r.emoji||"📌",ativo:true}]);showToast("✓ Adicionado às fixas!");}}/>}
        {tab==="gastos"   &&<Gastos    exps={exps} setExps={setExps} cats={cats} contas={contas} openWith={openWith} onOpened={()=>setOpenWith(null)} hide={hideVals} mesFiltro={mesFiltro} catFiltro={catModal} onClearCat={()=>setCatModal(null)}/>}
        {tab==="analise"&&<>
          <SegmentToggle value={analiseView} onChange={setAnaliseView}
            options={[{id:"graficos",label:"Gráficos"},{id:"orcamento",label:"Limites"}]}/>
          {analiseView==="graficos" &&<Graficos  exps={expsFiltrados} cats={cats} hide={hideVals} allExps={exps} mesFiltro={mesFiltro}/>}
          {analiseView==="orcamento"&&<Orcamento exps={expsFiltrados} cats={cats} setCats={setCats} hide={hideVals} mesFiltro={mesFiltro}/>}
        </>}
        {tab==="carteira"&&<>
          <SegmentToggle value={carteiraView} onChange={setCarteiraView}
            options={[{id:"reservas",label:"Reservas"},{id:"dividas",label:"Dívidas"}]}/>
          {carteiraView==="reservas"&&<Reservas reservas={reservas} setReservas={setReservas} hide={hideVals}/>}
          {carteiraView==="dividas" &&<Dividas  dividas={dividas} setDividas={setDividas}/>}
        </>}
        {tab==="ia"       &&<IAChat    exps={expsFiltrados} cats={cats} mesFiltro={mesFiltro}/>}
        {tab==="config"   &&<Config    cats={cats} setCats={setCats} exps={exps} setExps={setExps} fixas={fixas} setFixas={setFixas} contas={contas} setContas={setContas} reservas={reservas} setReservas={setReservas} meta={meta} setMeta={setMeta} setTab={setTab} showToast={showToast} mesFiltro={mesFiltro}/>}
      </div>

      {tab!=="ia"&&tab!=="config"&&(
        <button style={{position:"fixed",bottom:76,right:16,width:52,height:52,borderRadius:"50%",background:"#3DBA6F",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 20px rgba(61,186,111,0.4)",zIndex:49}}
          onClick={()=>{setOpenWith("expense");setTab("gastos");}}><Plus size={24} strokeWidth={2.5} color="#0A0F0D"/></button>
      )}

      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:"min(600px,100vw)",background:"rgba(10,15,13,0.97)",borderTop:"1px solid #232B24",display:"flex",padding:"6px 2px 10px",backdropFilter:"blur(20px)",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 2px"}} onClick={()=>setTab(t.id)}>
            <t.Icon size={20} strokeWidth={1.75} color={tab===t.id?"#3DBA6F":"#536057"}/>
            <span style={{fontSize:9,color:tab===t.id?"#3DBA6F":"#536057",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.03em",fontFamily:"'DM Mono',monospace"}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </>
  );
}
