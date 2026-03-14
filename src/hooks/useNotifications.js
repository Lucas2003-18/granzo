import { useEffect } from 'react';
import { fmt } from '../utils/format';

// ── Config no localStorage ──
function getNotifConfig(){
  try{
    const v=localStorage.getItem("mf_notif");
    return v?JSON.parse(v):{enabled:false,orcamento:true,fixasPendentes:true};
  }catch{return {enabled:false,orcamento:true,fixasPendentes:true};}
}
export { getNotifConfig };
export function saveNotifConfig(c){try{localStorage.setItem("mf_notif",JSON.stringify(c));}catch{}}

// ── Helpers ──
function getPlugins(){
  const cap=window.Capacitor;
  if(!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.LocalNotifications||null;
}

export async function checkPermission(){
  const ln=getPlugins();
  if(!ln) return "unsupported";
  try{
    const r=await ln.checkPermissions();
    return r.display; // "granted" | "denied" | "prompt"
  }catch{return "unsupported";}
}

export async function requestPermission(){
  const ln=getPlugins();
  if(!ln) return false;
  try{
    const r=await ln.requestPermissions();
    return r.display==="granted";
  }catch{return false;}
}

export async function sendNotif(id,title,body){
  const ln=getPlugins();
  if(!ln) return;
  try{
    await ln.schedule({notifications:[{
      id,
      title,
      body,
      smallIcon:"ic_launcher",
      largeIcon:"ic_launcher",
      sound:null,
      channelId:"granzo_alerts"
    }]});
  }catch{}
}

// ── Hook: dispara notificações ao abrir o app ──
export function useNotifCheck(cats,exps,fixas,mesFiltro){
  useEffect(()=>{
    const cfg=getNotifConfig();
    if(!cfg.enabled) return;

    (async()=>{
      const perm=await checkPermission();
      if(perm!=="granted") return;

      // Criar canal (Android exige)
      const ln=getPlugins();
      if(!ln) return;
      try{
        await ln.createChannel({
          id:"granzo_alerts",
          name:"Alertas Granzo",
          importance:3,
          sound:null,
          vibration:true
        });
      }catch{}

      const agora=new Date();
      const mesAtualKey=`${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,"0")}`;
      const expsDoMes=exps.filter(e=>{
        const p=e.date?.split("/");if(!p||p.length<2) return false;
        const anoMes=p.length>=3?`${p[2]}-${p[1]}`:`${agora.getFullYear()}-${p[1]}`;
        return anoMes===mesAtualKey;
      });
      const gastos=expsDoMes.filter(e=>e.kind==="exp"&&e.cat!=="investimento");

      // ── Alertas de orçamento ──
      if(cfg.orcamento){
        const lastCheck=localStorage.getItem("mf_notif_last_orc")||"";
        const today=agora.toISOString().slice(0,10);
        if(lastCheck!==today){
          let notifId=1000;
          cats.filter(c=>c.budget>0&&c.id!=="investimento").forEach(cat=>{
            const spent=gastos.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.value,0);
            const pct=(spent/cat.budget)*100;
            if(pct>=100){
              sendNotif(notifId++,`🚨 ${cat.label} estourou!`,`Gastou ${fmt(spent)} de ${fmt(cat.budget)} orçados.`);
            }else if(pct>=80){
              sendNotif(notifId++,`⚠️ ${cat.label} em ${pct.toFixed(0)}%`,`${fmt(cat.budget-spent)} restando no orçamento.`);
            }
          });
          localStorage.setItem("mf_notif_last_orc",today);
        }
      }

      // ── Fixas pendentes (após dia 5) ──
      if(cfg.fixasPendentes&&agora.getDate()>=5){
        const lastFixaCheck=localStorage.getItem("mf_notif_last_fixa")||"";
        if(lastFixaCheck!==agora.toISOString().slice(0,7)){
          const pendentes=(fixas||[]).filter(f=>{
            if(!f.ativo||!f.valor) return false;
            const descMatch=new RegExp(f.desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(" ")[0],"i");
            return !expsDoMes.some(e=>e.kind==="exp"&&descMatch.test((e.desc||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")));
          });
          if(pendentes.length>0){
            sendNotif(2000,
              `📌 ${pendentes.length} fixa${pendentes.length>1?"s":""} pendente${pendentes.length>1?"s":""}`,
              `${pendentes.map(f=>f.desc).join(", ")} ainda não lançadas este mês.`
            );
            localStorage.setItem("mf_notif_last_fixa",agora.toISOString().slice(0,7));
          }
        }
      }
    })();
  },[]);
}
