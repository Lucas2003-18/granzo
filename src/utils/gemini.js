import { delay } from './format';

export function getGeminiKey(){try{return localStorage.getItem("mf_gemini_key")||"";}catch{return "";}}
export function setGeminiKey(k){try{localStorage.setItem("mf_gemini_key",k);}catch{}}

export async function askGemini(sys, msg, maxTokens=1000, retries=3) {
  for (let i=0; i<retries; i++) {
    if (i>0) await delay(2000*i);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getGeminiKey()}`,
      { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ contents:[{parts:[{text:sys+"\n\n"+msg}]}], generationConfig:{temperature:0.3,maxOutputTokens:maxTokens} }) }
    );
    if (r.status===429) { if (i<retries-1) continue; throw new Error("Limite atingido. Aguarde e tente novamente."); }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}
