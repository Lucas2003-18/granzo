import { useRef, useEffect } from 'react';
import { getGDriveToken, setGDriveToken, getGDriveAutoBackup, setGDriveLastSync, gdriveUpload } from '../utils/gdrive';
import { loadProdsExtra, loadPrecos } from '../utils/mercadoStorage';

export function useAutoBackup(exps,cats,markets,fixas,contas,reservas,meta,showToast){
  const dataRef=useRef({exps,cats,markets,fixas,contas,reservas,meta});
  const timerRef=useRef(null);
  const runningRef=useRef(false);

  useEffect(()=>{dataRef.current={exps,cats,markets,fixas,contas,reservas,meta};},[exps,cats,markets,fixas,contas,reservas,meta]);

  useEffect(()=>{
    async function doBackup(){
      if(runningRef.current) return;
      const token=getGDriveToken();
      const autoOn=getGDriveAutoBackup();
      if(!token||!autoOn) return;
      runningRef.current=true;
      try{
        const {exps,cats,markets,fixas,contas,reservas,meta}=dataRef.current;
        const prodsExtra=loadProdsExtra();const precosMkt=loadPrecos();
        const json=JSON.stringify({exps,cats,markets,fixas,contas,reservas,meta,prodsExtra,precosMkt,_version:2,_savedAt:new Date().toISOString()},null,2);
        await gdriveUpload(token,json);
        const agora=new Date().toLocaleString("pt-BR");
        setGDriveLastSync(agora);
        if(document.visibilityState==="visible") showToast("☁️ Backup automático salvo!");
      }catch(e){
        if(e.message==="TOKEN_EXPIRED") setGDriveToken("");
      }finally{runningRef.current=false;}
    }

    function onVisibility(){
      if(document.visibilityState==="hidden"){
        clearTimeout(timerRef.current);
        timerRef.current=setTimeout(doBackup,1000);
      }
    }
    function onUnload(){doBackup();}

    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("beforeunload",onUnload);
    return ()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("beforeunload",onUnload);
      clearTimeout(timerRef.current);
    };
  },[]);
}
