import { useState, useEffect } from 'react';
import { btn, CARD, ROW } from '../utils/styles';
import { SecTitle, AlertBox } from './ui';
import { getNotifConfig, saveNotifConfig, checkPermission, requestPermission, sendNotif } from '../hooks/useNotifications';

export default function NotifConfig({ showToast }){
  const [cfg,setCfg]=useState(getNotifConfig);
  const [permStatus,setPermStatus]=useState("loading");
  const [testando,setTestando]=useState(false);

  useEffect(()=>{
    checkPermission().then(s=>setPermStatus(s));
  },[]);

  function update(k,v){const novo={...cfg,[k]:v};setCfg(novo);saveNotifConfig(novo);}

  async function ativar(){
    const ok=await requestPermission();
    setPermStatus(ok?"granted":"denied");
    if(ok){update("enabled",true);showToast("✓ Notificações ativadas!");}
    else showToast("❌ Permissão negada — ative nas configurações do Android");
  }

  async function testar(){
    setTestando(true);
    const ok=await requestPermission();
    if(ok){
      await sendNotif(9999,"💸 Granzo","Notificações funcionando! Você vai receber alertas de orçamento aqui.");
      showToast("✅ Notificação enviada!");
    } else showToast("❌ Sem permissão");
    setTimeout(()=>setTestando(false),2000);
  }

  const isEnabled=cfg.enabled&&permStatus==="granted";

  return <div>
    {permStatus==="unsupported"&&<AlertBox tipo="warn" texto="⚠️ Notificações nativas não disponíveis neste dispositivo. Funciona apenas no APK instalado."/>}
    {permStatus==="denied"&&<AlertBox tipo="err" texto="❌ Permissão negada. Vá em Configurações → Apps → Granzo → Notificações para ativar."/>}

    <div style={{...CARD,borderLeft:`3px solid ${isEnabled?"#4ade80":"#f59e0b"}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>🔔 Notificações</div>
          <div style={{fontSize:11,color:isEnabled?"#4ade80":"#64748b"}}>{isEnabled?"Ativas":"Desativadas"}</div>
        </div>
        {permStatus!=="unsupported"&&permStatus!=="loading"&&(
          isEnabled
            ?<button style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",color:"#f87171",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>update("enabled",false)}>Desativar</button>
            :<button style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"white",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={ativar}>Ativar</button>
        )}
      </div>
      {isEnabled&&<button style={{...btn("rgba(99,102,241,0.1)","#818cf8",{border:"1px solid rgba(99,102,241,0.25)",fontSize:12,padding:"8px 0"}),opacity:testando?0.6:1}} onClick={testar}>🔔 Testar notificação</button>}
    </div>

    {isEnabled&&<>
      <SecTitle t="O que notificar"/>
      {[
        {key:"orcamento",label:"⚠️ Alerta de orçamento",sub:"Quando uma categoria chegar em 80% do limite"},
        {key:"fixasPendentes",label:"📌 Despesas fixas pendentes",sub:"Lembrete quando fixas não foram lançadas no mês (após dia 5)"},
      ].map(item=>(
        <div key={item.key} style={{...ROW,justifyContent:"space-between"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{item.label}</div>
            <div style={{fontSize:11,color:"#475569"}}>{item.sub}</div>
          </div>
          <button style={{background:cfg[item.key]?"rgba(74,222,128,0.15)":"rgba(255,255,255,0.06)",border:cfg[item.key]?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.1)",color:cfg[item.key]?"#4ade80":"#64748b",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}
            onClick={()=>update(item.key,!cfg[item.key])}>
            {cfg[item.key]?"✓ On":"Off"}
          </button>
        </div>
      ))}
      <div style={{...CARD,background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.1)",marginTop:8}}>
        <div style={{fontSize:11,color:"#64748b",lineHeight:1.7}}>
          💡 As notificações são verificadas sempre que você abre o app. Alertas de orçamento disparam 1x por dia quando uma categoria passa de 80%.
        </div>
      </div>
    </>}
  </div>;
}
