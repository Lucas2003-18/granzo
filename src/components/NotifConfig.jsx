import { useState, useEffect } from 'react';
import { btn, inp, CARD, ROW } from '../utils/styles';
import { SecTitle, AlertBox } from './ui';
import { getNotifConfig, saveNotifConfig, checkPermission, requestPermission, sendNotif } from '../hooks/useNotifications';

export default function NotifConfig({ showToast }){
  const [cfg,setCfg]=useState(getNotifConfig);
  const [permStatus,setPermStatus]=useState("loading");
  const [testando,setTestando]=useState(false);
  const [webhookUrl,setWebhookUrl]=useState(()=>{ try{return localStorage.getItem("mf_discord_webhook")||"";}catch{return "";} });

  function salvarWebhook() {
    try { localStorage.setItem("mf_discord_webhook", webhookUrl.trim()); showToast("✓ Webhook salvo"); } catch {}
  }

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
    // Debug: verifica se plugin existe
    const cap=window.Capacitor;
    if(!cap?.isNativePlatform?.()){
      showToast("⚠️ Não está rodando em plataforma nativa");
      setTestando(false);return;
    }
    const ln=cap.Plugins?.LocalNotifications;
    if(!ln){
      showToast("❌ Plugin LocalNotifications não encontrado");
      setTestando(false);return;
    }
    const ok=await requestPermission();
    if(!ok){
      showToast("❌ Sem permissão de notificação");
      setTestando(false);return;
    }
    const sent=await sendNotif(9999,"Granzo","Notificacoes funcionando! Alertas de orcamento aparecerao aqui.");
    if(sent) showToast("✅ Notificação agendada! Aparece em ~1 segundo.");
    else showToast("❌ Falha ao agendar notificação");
    setTimeout(()=>setTestando(false),3000);
  }

  const isEnabled=cfg.enabled&&permStatus==="granted";

  return <div>
    {permStatus==="unsupported"&&<AlertBox tipo="warn" texto="⚠️ Notificações nativas não disponíveis neste dispositivo. Funciona apenas no APK instalado."/>}
    {permStatus==="denied"&&<AlertBox tipo="err" texto="❌ Permissão negada. Vá em Configurações → Apps → Granzo → Notificações para ativar."/>}

    <div style={{...CARD,borderLeft:`3px solid ${isEnabled?"#3DBA6F":"#E8A832"}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#DDE8DF"}}>🔔 Notificações</div>
          <div style={{fontSize:11,color:isEnabled?"#3DBA6F":"#536057"}}>{isEnabled?"Ativas":"Desativadas"}</div>
        </div>
        {permStatus!=="unsupported"&&permStatus!=="loading"&&(
          isEnabled
            ?<button style={{background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.2)",color:"#E05252",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>update("enabled",false)}>Desativar</button>
            :<button style={{background:"#3DBA6F",border:"none",color:"#0A0F0D",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={ativar}>Ativar</button>
        )}
      </div>
      {isEnabled&&<button style={{...btn("rgba(61,186,111,0.1)","#3DBA6F",{border:"1px solid rgba(61,186,111,0.12)",fontSize:12,padding:"8px 0"}),opacity:testando?0.6:1}} onClick={testar}>🔔 Testar notificação</button>}
    </div>

    {isEnabled&&<>
      <SecTitle t="O que notificar"/>
      {[
        {key:"orcamento",label:"⚠️ Alerta de orçamento",sub:"Quando uma categoria chegar em 80% do limite"},
        {key:"fixasPendentes",label:"📌 Despesas fixas pendentes",sub:"Lembrete quando fixas não foram lançadas no mês (após dia 5)"},
      ].map(item=>(
        <div key={item.key} style={{...ROW,justifyContent:"space-between"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#DDE8DF"}}>{item.label}</div>
            <div style={{fontSize:11,color:"#536057"}}>{item.sub}</div>
          </div>
          <button style={{background:cfg[item.key]?"rgba(61,186,111,0.15)":"#232B24",border:cfg[item.key]?"1px solid rgba(61,186,111,0.3)":"1px solid #2E3A2F",color:cfg[item.key]?"#3DBA6F":"#536057",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}
            onClick={()=>update(item.key,!cfg[item.key])}>
            {cfg[item.key]?"✓ On":"Off"}
          </button>
        </div>
      ))}
      <div style={{...CARD,background:"rgba(61,186,111,0.04)",border:"1px solid rgba(61,186,111,0.1)",marginTop:8}}>
        <div style={{fontSize:11,color:"#536057",lineHeight:1.7}}>
          💡 As notificações são verificadas sempre que você abre o app. Alertas de orçamento disparam 1x por dia quando uma categoria passa de 80%.
        </div>
      </div>
    </>}

    <div style={CARD}>
      <div style={{fontSize:13,fontWeight:700,color:"#DDE8DF",marginBottom:4}}>🎮 Discord Webhook</div>
      <div style={{fontSize:12,color:"#536057",marginBottom:10,lineHeight:1.5}}>
        Alternativa às notificações nativas — o app envia alertas direto para um canal Discord via webhook.
      </div>
      <div style={{fontSize:11,color:"#536057",marginBottom:4}}>URL do webhook</div>
      <input style={{...inp({fontSize:12}),marginBottom:10}} placeholder="https://discord.com/api/webhooks/..." value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)}/>
      <button style={btn("#3DBA6F","#0A0F0D")} onClick={salvarWebhook}>Salvar webhook</button>
    </div>
  </div>;
}
