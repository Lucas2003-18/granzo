export const delay = ms => new Promise(r => setTimeout(r, ms));
export const fmt   = v  => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
export const fmtPct= v  => (v>=0?"+":"")+v.toFixed(1)+"%";

export function dateKey(d){
  if(!d) return "00000000";
  const p=d.split("/");
  if(p.length>=3) return p[2].padStart(4,"0")+p[1].padStart(2,"0")+p[0].padStart(2,"0");
  const y=String(new Date().getFullYear());
  return y+( p[1]?.padStart(2,"0")||"00")+(p[0]?.padStart(2,"0")||"00");
}

export function fmtDate(iso){
  if(!iso) return "";
  const[y,m,d]=(iso+"").split("-");
  return `${(d||"??").padStart(2,"0")}/${(m||"??").padStart(2,"0")}/${y||"????"}`;
}

export function parseData(str){
  if(!str) return null;
  const [d,m,y]=str.split("/");
  if(!d||!m||!y) return null;
  return new Date(+y,+m-1,+d);
}

export function diasAteVencer(vencimento){
  const dt=parseData(vencimento);
  if(!dt) return null;
  const hoje=new Date();
  hoje.setHours(0,0,0,0);
  dt.setHours(0,0,0,0);
  return Math.round((dt-hoje)/86400000);
}

export function urgencyColor(dias){
  if(dias===null) return null;
  if(dias<0) return "#E05252";
  if(dias<=3) return "#E8A832";
  return null;
}
