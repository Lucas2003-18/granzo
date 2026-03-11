import { useState } from 'react';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { CATS_DEF, FIXAS_DEF, MKTS_DEF } from '../utils/constants';
import { SecTitle, AlertBox, ConfirmModal } from './ui';
import { getGDriveToken, setGDriveToken, getGDriveClientId, setGDriveClientId, getGDriveLastSync, setGDriveLastSync, getGDriveAutoBackup, setGDriveAutoBackup, gdriveUpload, gdriveDownload } from '../utils/gdrive';
import { loadPrecos, savePrecos, loadProdsExtra, saveProdsExtra } from '../utils/mercadoStorage';

function GoogleDriveBackup({exps,cats,markets,fixas,contas,reservas,meta,setExps,setCats,setMarkets,setFixas,setContas,setReservas,setMeta,showToast,setConfirmModal}){
  const [clientId, setClientId]=useState(getGDriveClientId);
  const [token,    setToken]   =useState(getGDriveToken);
  const [status,   setStatus]  =useState("idle"); // idle|loading|ok|err
  const [msg,      setMsgDrive]=useState("");
  const [lastSync, setLastSync]=useState(getGDriveLastSync);
  const [editId,   setEditId]  =useState(false);
  const [autoBackup,setAutoBackupUI]=useState(getGDriveAutoBackup);
  function toggleAuto(v){setAutoBackupUI(v);setGDriveAutoBackup(v);if(v&&token) showToast("☁️ Backup automático ativado!");}

  const isConnected=!!token;
  const hasClientId=!!clientId;

  function handleToken(t){setToken(t);setGDriveToken(t);}

  // OAuth2 implicit flow — abre popup do Google
  function conectar(){
    const id=getGDriveClientId();
    if(!id){setEditId(true);return;}
    const params=new URLSearchParams({
      client_id:id,
      redirect_uri:window.location.origin+window.location.pathname,
      response_type:"token",
      scope:GDrive.SCOPE,
      include_granted_scopes:"true",
      state:"gdrive_auth",
    });
    const w=window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`,"_blank","width=500,height=600");
    // Escuta o token via postMessage ou polling da URL
    const poll=setInterval(()=>{
      try{
        if(w&&w.closed){clearInterval(poll);return;}
        const url=w?.location?.href||"";
        if(url.includes("access_token")){
          const hash=url.split("#")[1]||"";
          const p=new URLSearchParams(hash);
          const t=p.get("access_token");
          if(t){handleToken(t);clearInterval(poll);w.close();showToast("✓ Google conectado!");}
        }
      }catch{/*cross-origin — normal enquanto na página do Google*/}
    },500);
  }

  async function salvarDrive(){
    if(!token){showToast("❌ Conecte sua conta Google primeiro");return;}
    setStatus("loading");setMsgDrive("Salvando no Drive...");
    try{
      const prodsExtra=loadProdsExtra();const precosMkt=loadPrecos();
      const json=JSON.stringify({exps,cats,markets,fixas,contas,reservas,meta,prodsExtra,precosMkt,_version:2,_savedAt:new Date().toISOString()},null,2);
      await gdriveUpload(token,json);
      const agora=new Date().toLocaleString("pt-BR");
      setLastSync(agora);setGDriveLastSync(agora);
      setStatus("ok");setMsgDrive("✓ Backup salvo no Google Drive!");
      showToast("✓ Backup salvo no Drive!");
    }catch(e){
      if(e.message==="TOKEN_EXPIRED"){handleToken("");setMsgDrive("⚠️ Sessão expirada — reconecte sua conta.");}
      else setMsgDrive("❌ "+e.message);
      setStatus("err");
    }
  }

  async function restaurarDrive(){
    if(!token){showToast("❌ Conecte sua conta Google primeiro");return;}
    setStatus("loading");setMsgDrive("Buscando backup...");
    try{
      const {text,modifiedTime}=await gdriveDownload(token);
      const data=JSON.parse(text);
      if(!data.exps||!Array.isArray(data.exps)) throw new Error("Arquivo inválido");
      const dtStr=modifiedTime?new Date(modifiedTime).toLocaleString("pt-BR"):"";
      setStatus("idle");setMsgDrive("");
      setConfirmModal({
        msg:"Restaurar do Google Drive?",
        sub:`Backup de ${dtStr}\n${data.exps.length} lançamentos · ${(data.cats||[]).length} categorias\n\nIsso VAI SUBSTITUIR todos os dados atuais.`,
        okLabel:"Restaurar",okColor:"#4f46e5",
        onOk:()=>{
          setExps(data.exps||[]);
          setCats(data.cats||CATS_DEF);
          setMarkets(data.markets||MKTS_DEF);
          setFixas(data.fixas||FIXAS_DEF);
          if(data.contas) setContas(data.contas);
          if(data.reservas) setReservas(data.reservas);
          if(data.meta!==undefined) setMeta(data.meta);
          if(data.prodsExtra) saveProdsExtra(data.prodsExtra);
          if(data.precosMkt) savePrecos(data.precosMkt);
          showToast("✓ Backup do Drive restaurado!");
        }
      });
    }catch(e){
      if(e.message==="TOKEN_EXPIRED"){handleToken("");setMsgDrive("⚠️ Sessão expirada — reconecte sua conta.");}
      else{setMsgDrive("❌ "+e.message);}
      setStatus("err");
    }
  }

  return <div>
    {/* Status conexão */}
    <div style={{...CARD,borderLeft:`3px solid ${isConnected?"#4ade80":"#f59e0b"}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:isConnected?4:12}}>
        <span style={{fontSize:24}}>☁️</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>Google Drive</div>
          <div style={{fontSize:11,color:isConnected?"#4ade80":"#64748b"}}>{isConnected?"✓ Conectado":"Não conectado"}</div>
        </div>
        {isConnected&&<button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,padding:"4px 10px",cursor:"pointer"}} onClick={()=>{handleToken("");showToast("Desconectado");}}>Desconectar</button>}
      </div>
      {lastSync&&<div style={{fontSize:11,color:"#475569"}}>Último sync: {lastSync}</div>}
    </div>

    {/* Setup Client ID */}
    {(!hasClientId||editId)&&<div style={{...CARD,background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:6}}>🔑 Configure seu Client ID</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:10,lineHeight:1.6}}>
        1. Acesse <span style={{color:"#818cf8"}}>console.cloud.google.com</span><br/>
        2. Crie um projeto → APIs → Drive API → Credenciais<br/>
        3. Crie um "OAuth 2.0 Client ID" (Tipo: Aplicativo da Web)<br/>
        4. Adicione sua URL em "Origens autorizadas"<br/>
        5. Cole o Client ID abaixo
      </div>
      <input style={{...inp(),marginBottom:8,fontFamily:"monospace",fontSize:12}} placeholder="xxx.apps.googleusercontent.com" value={clientId} onChange={e=>setClientId(e.target.value)}/>
      <button style={btn("linear-gradient(135deg,#f59e0b,#d97706)")} onClick={()=>{setGDriveClientId(clientId.trim());setEditId(false);showToast("✓ Client ID salvo!");}}>Salvar Client ID</button>
    </div>}

    {/* Ações */}
    {hasClientId&&!editId&&<>
      {!isConnected&&<button style={btn("linear-gradient(135deg,#4285f4,#1967d2)",undefined,{marginBottom:10})} onClick={conectar}>
        🔐 Conectar Google Drive
      </button>}
      {isConnected&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button style={{...btn("linear-gradient(135deg,#22c55e,#16a34a)"),opacity:status==="loading"?0.6:1}} onClick={salvarDrive} disabled={status==="loading"}>
          {status==="loading"?"⏳ Salvando...":"☁️ Salvar backup agora"}
        </button>
        <button style={{...btn("rgba(99,102,241,0.15)","#818cf8",{border:"1px solid rgba(99,102,241,0.3)"}),opacity:status==="loading"?0.6:1}} onClick={restaurarDrive} disabled={status==="loading"}>
          {status==="loading"?"⏳ Buscando...":"⬇️ Restaurar do Drive"}
        </button>
        {/* Toggle backup automático */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"12px 14px",marginTop:4}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>Backup automático</div>
            <div style={{fontSize:11,color:"#475569",marginTop:2}}>Salva ao minimizar o app</div>
          </div>
          <div onClick={()=>toggleAuto(!autoBackup)} style={{width:44,height:24,borderRadius:99,background:autoBackup?"#22c55e":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background .25s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:autoBackup?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .25s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
          </div>
        </div>
      </div>}
      {hasClientId&&<button style={{...btn("rgba(255,255,255,0.04)","#475569",{border:"1px solid rgba(255,255,255,0.06)",marginTop:4,fontSize:11})}} onClick={()=>setEditId(true)}>✏️ Trocar Client ID</button>}
    </>}

    {msg&&<div style={{marginTop:10}}>
      <AlertBox tipo={status==="ok"?"ok":status==="err"?"err":"info"} texto={msg}/>
    </div>}

    <div style={{...CARD,background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.1)",marginTop:12}}>
      <div style={{fontSize:11,color:"#64748b",lineHeight:1.7}}>
        💡 O backup fica na pasta privada do app no seu Drive (<span style={{color:"#818cf8"}}>appDataFolder</span>) — não aparece na listagem normal de arquivos, só o Granzo pode acessar.
      </div>
    </div>
  </div>;
}


export default GoogleDriveBackup;
