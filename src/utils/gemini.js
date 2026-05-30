import { delay } from './format';

export function getGeminiKey(){try{return localStorage.getItem("mf_gemini_key")||"";}catch{return "";}}
export function setGeminiKey(k){try{localStorage.setItem("mf_gemini_key",k);}catch{}}

export async function askGemini(sys, msg, maxTokens=1000, retries=3) {
  if(!getGeminiKey()) throw new Error("Chave Gemini não configurada. Vá em ⚙️ Config → Chave IA.");
  if(!navigator.onLine) throw new Error("Sem conexão com a internet. Conecte-se e tente novamente.");
  for (let i=0; i<retries; i++) {
    if (i>0) await delay(2000*i);
    let r;
    try{
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiKey()}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ contents:[{parts:[{text:sys+"\n\n"+msg}]}], generationConfig:{temperature:0.3,maxOutputTokens:maxTokens} }) }
      );
    }catch(e){
      if(i<retries-1) continue;
      throw new Error("Falha na conexão. Verifique sua internet e tente novamente.");
    }
    if (r.status===429) { if (i<retries-1) continue; throw new Error("Limite de requisições atingido. Aguarde 1 minuto e tente novamente."); }
    if (r.status===403) throw new Error("Chave Gemini inválida ou expirada. Verifique em ⚙️ Config → Chave IA.");
    if (!r.ok) throw new Error(`Erro na API (${r.status}). Tente novamente.`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}
