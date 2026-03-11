export const GDrive = {
  CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID",
  SCOPE: "https://www.googleapis.com/auth/drive.appdata",
  FILE_NAME: "granzo_backup.json",
};

export function getGDriveToken(){try{return localStorage.getItem("mf_gdrive_token")||"";}catch{return "";}}
export function setGDriveToken(t){try{localStorage.setItem("mf_gdrive_token",t);}catch{}}
export function getGDriveClientId(){try{return localStorage.getItem("mf_gdrive_client_id")||"";}catch{return "";}}
export function setGDriveClientId(id){try{localStorage.setItem("mf_gdrive_client_id",id);}catch{}}
export function getGDriveLastSync(){try{return localStorage.getItem("mf_gdrive_last_sync")||"";}catch{return "";}}
export function setGDriveLastSync(d){try{localStorage.setItem("mf_gdrive_last_sync",d);}catch{}}
export function getGDriveAutoBackup(){try{return localStorage.getItem("mf_gdrive_auto")==="true";}catch{return false;}}
export function setGDriveAutoBackup(v){try{localStorage.setItem("mf_gdrive_auto",v?"true":"false");}catch{}}

export async function gdriveRequest(method,url,body,token){
  const r=await fetch(url,{method,headers:{"Authorization":`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  if(r.status===401) throw new Error("TOKEN_EXPIRED");
  if(!r.ok) throw new Error(`Drive API: ${r.status}`);
  return r;
}

export async function gdriveUpload(token,jsonStr){
  const q=await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${GDrive.FILE_NAME}'&fields=files(id,name,modifiedTime)`,{headers:{"Authorization":`Bearer ${token}`}});
  if(!q.ok) throw new Error("Erro ao listar arquivos no Drive");
  const {files}=await q.json();
  const blob=new Blob([jsonStr],{type:"application/json"});
  const meta={name:GDrive.FILE_NAME,parents:files.length===0?["appDataFolder"]:undefined};
  const form=new FormData();
  form.append("metadata",new Blob([JSON.stringify(meta)],{type:"application/json"}));
  form.append("file",blob);
  const endpoint=files.length>0
    ?`https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`
    :"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const method=files.length>0?"PATCH":"POST";
  const r=await fetch(endpoint,{method,headers:{"Authorization":`Bearer ${token}`},body:form});
  if(r.status===401) throw new Error("TOKEN_EXPIRED");
  if(!r.ok) throw new Error(`Upload falhou: ${r.status}`);
  return await r.json();
}

export async function gdriveDownload(token){
  const q=await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${GDrive.FILE_NAME}'&fields=files(id,name,modifiedTime)`,{headers:{"Authorization":`Bearer ${token}`}});
  if(!q.ok) throw new Error("Erro ao listar arquivos");
  const {files}=await q.json();
  if(files.length===0) throw new Error("Nenhum backup encontrado no Drive");
  const r=await fetch(`https://www.googleapis.com/drive/v3/files/${files[0].id}?alt=media`,{headers:{"Authorization":`Bearer ${token}`}});
  if(r.status===401) throw new Error("TOKEN_EXPIRED");
  if(!r.ok) throw new Error("Erro ao baixar backup");
  return {text:await r.text(),modifiedTime:files[0].modifiedTime};
}
