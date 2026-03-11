export function detectBank(text){
  const t=text.toLowerCase();
  const l1=text.split(/\r?\n/)[0].toLowerCase();
  if(t.includes("date")&&t.includes("title")&&t.includes("amount"))return "nubank_card";
  if(t.includes("identificador")||(t.includes("data")&&t.includes("valor")&&(t.includes("descri")||t.includes("desc"))))return "nubank_conta";
  if(t.includes("bradesco")||t.includes("histórico")||t.includes("historico"))return "bradesco";
  if((t.includes("lançamento")||t.includes("lancamento"))&&(t.includes("categoria")||t.includes("tipo")))return "inter";
  if(l1.includes(";")&&t.includes("descri")&&t.includes("valor"))return "inter";
  if(t.includes("c6 bank")||t.includes("banco c6")||(t.includes("estabelecimento")&&t.includes("parcela")))return "c6";
  if(l1.includes(";")&&(t.includes("estabelec")||t.includes("portador")))return "c6";
  return "unknown";
}

export function detectSep(text){const l=text.split(/\r?\n/).find(l=>l.trim());if(!l)return ",";return(l.match(/;/g)||[]).length>(l.match(/,/g)||[]).length?";":",";}

export function parseCSVRows(text){
  const sep=detectSep(text);
  const lines=text.trim().split(/\r?\n/);
  const header=lines[0].split(sep).map(h=>h.trim().replace(/"/g,"").replace(/\r/g,"").toLowerCase());
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const cols=[];let cur="",inQ=false;
    for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===sep&&!inQ){cols.push(cur.trim());cur="";}else if(ch!=="\r")cur+=ch;}
    cols.push(cur.trim());
    return Object.fromEntries(header.map((h,i)=>[h,(cols[i]||"").replace(/"/g,"").replace(/\r/g,"").trim()]));
  });
}

export function parseTxs(rows,tipo){
  if(tipo==="nubank_card")return rows.map(r=>({date:r.date||"",desc:r.title||r.description||"",value:Math.abs(parseFloat((r.amount||"0").replace(",","."))),kind:"exp",source:"Nubank Cartão"})).filter(r=>r.date&&r.value>0);
  if(tipo==="nubank_conta")return rows.map(r=>{
    const keys=Object.keys(r);
    const valorKey=keys.find(k=>/^valor$|^value$|^amount$/i.test(k))||keys.find(k=>k.includes("valor")||k.includes("value"));
    const descKey=keys.find(k=>/descri/i.test(k))||keys.find(k=>k.includes("desc")||k.includes("título")||k.includes("titulo")||k.includes("title"));
    const dateKey=keys.find(k=>/^data$|^date$/i.test(k))||keys.find(k=>k.includes("data")||k.includes("date"));
    const rawVal=(r[valorKey]||"0").replace(/\s/g,"");
    const v=rawVal.includes(",") ? parseFloat(rawVal.replace(/\./g,"").replace(",",".")) : parseFloat(rawVal);
    const desc=r[descKey]||"";
    const dl=desc.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    const isAplicacao=/aplicac|rdb|investimento/.test(dl);
    const isDevolucao=/devolucao|resgate/.test(dl);
    const isFatura=/pagamento.*fatura|fatura.*cartao|cartao.*fatura/.test(dl);
    const isEntrada=isDevolucao||(v>0&&!isFatura);
    return {
      date:r[dateKey]||"",
      desc,
      value:Math.abs(v),
      kind: isFatura?"_skip":(isEntrada?"inc":"exp"),
      incType: isEntrada?(isDevolucao?"investimento_ret":undefined):undefined,
      cat: isAplicacao?"investimento":undefined,
      source:"Nubank Conta"
    };
  }).filter(r=>r.date&&r.value>0&&r.kind!=="_skip");
  if(tipo==="bradesco")return rows.map(r=>{const keys=Object.keys(r);const dK=keys.find(k=>k.includes("data")),descK=keys.find(k=>k.includes("hist")||k.includes("desc")),vK=keys.find(k=>k.includes("valor")||k.includes("créd")||k.includes("déb"));const v=parseFloat((r[vK]||"0").replace(/\./g,"").replace(",","."));return{date:r[dK]||"",desc:r[descK]||"",value:Math.abs(v),kind:v>=0?"inc":"exp",source:"Bradesco"};}).filter(r=>r.date&&r.value>0&&r.desc);

  if(tipo==="inter"){
    return rows.map(r=>{
      const keys=Object.keys(r);
      const dK=keys.find(k=>/data/i.test(k));
      const descK=keys.find(k=>/descri|hist|lançamento|lancamento/i.test(k)&&!/data/i.test(k));
      const vK=keys.find(k=>/valor/i.test(k)&&!/saldo/i.test(k));
      const tipoK=keys.find(k=>/tipo|natureza/i.test(k));
      const raw=(r[vK]||"0").replace(/\s/g,"");
      const v=raw.includes(",")?parseFloat(raw.replace(/\./g,"").replace(",",".")):parseFloat(raw);
      const isEntrada=r[tipoK]&&/créd|entrada|receb|depós/i.test(r[tipoK]);
      const isDebito=r[tipoK]&&/déb|saída|pagam/i.test(r[tipoK]);
      const kind=isEntrada?"inc":isDebito?"exp":(v>=0?"inc":"exp");
      return{date:r[dK]||"",desc:r[descK]||"",value:Math.abs(v),kind,source:"Inter"};
    }).filter(r=>r.date&&r.value>0&&r.desc);
  }

  if(tipo==="c6"){
    return rows.map(r=>{
      const keys=Object.keys(r);
      const dK=keys.find(k=>/data/i.test(k));
      const descK=keys.find(k=>/descri|estabelec|hist|lançamento/i.test(k)&&!/data/i.test(k));
      const vK=keys.find(k=>/valor/i.test(k)&&!/saldo/i.test(k));
      const tipoK=keys.find(k=>/tipo|natureza|operac/i.test(k));
      const raw=(r[vK]||"0").replace(/\s/g,"");
      const v=raw.includes(",")?parseFloat(raw.replace(/\./g,"").replace(",",".")):parseFloat(raw);
      const kind=(r[tipoK]&&/créd|entrada|receb/i.test(r[tipoK]))||v>0?"inc":"exp";
      return{date:r[dK]||"",desc:r[descK]||"",value:Math.abs(v),kind,source:"C6 Bank"};
    }).filter(r=>r.date&&r.value>0&&r.desc);
  }

  return [];
}

// ── PDF Import ──────────────────────────────────────────────────────────────
let _pdfjs=null;
async function loadPdfJs(){
  if(_pdfjs) return _pdfjs;
  return new Promise((res,rej)=>{
    if(window.pdfjsLib){_pdfjs=window.pdfjsLib;return res(_pdfjs);}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{
      window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      _pdfjs=window.pdfjsLib;res(_pdfjs);
    };
    s.onerror=()=>rej(new Error("Falha ao carregar PDF.js"));
    document.head.appendChild(s);
  });
}

export async function extractPdfText(file){
  const pdfjs=await loadPdfJs();
  const ab=await file.arrayBuffer();
  const pdf=await pdfjs.getDocument({data:ab}).promise;
  let full="";
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i);
    const tc=await page.getTextContent();
    full+=tc.items.map(it=>it.str).join(" ")+"\n";
  }
  return full;
}

export function detectBankPdf(text){
  const t=text.toLowerCase();
  if(t.includes("nubank"))return "nubank_pdf";
  if(t.includes("banco inter")||t.includes("inter s.a")||t.includes("interdigital"))return "inter_pdf";
  if(t.includes("c6 bank")||t.includes("banco c6"))return "c6_pdf";
  if(t.includes("bradesco"))return "bradesco_pdf";
  if(t.includes("itaú")||t.includes("itau"))return "itau_pdf";
  if(t.includes("santander"))return "santander_pdf";
  if(t.includes("banco do brasil")||t.includes("bb s.a"))return "bb_pdf";
  if(t.includes("caixa econômica")||t.includes("caixa economica"))return "caixa_pdf";
  return "pdf_unknown";
}

export function parsePdfGenerico(text, source){
  const txs=[];
  const re=new RegExp("(\\d{2}\\/\\d{2}\\/\\d{2,4})\\s+(.{4,60}?)\\s+([+-]?\\s*R?\\$?\\s*[\\d.]+,\\d{2})","g");
  let m;
  while((m=re.exec(text))!==null){
    const [,date,desc,rawVal]=m;
    const clean=rawVal.replace(/[R$\s]/g,"");
    const v=parseFloat(clean.replace(/\./g,"").replace(",","."));
    if(!isNaN(v)&&Math.abs(v)>0){
      txs.push({date,desc:desc.trim(),value:Math.abs(v),kind:v<0?"exp":"inc",source});
    }
  }
  return txs;
}

export async function parsePdfViaGemini(text, source){
  const key=localStorage.getItem("mf_gemini_key")||"";
  if(!key) throw new Error("Configure sua chave Gemini em Config > Chave IA para importar PDF deste banco.");
  const prompt="Voce e um extrator de transacoes financeiras de extratos bancarios brasileiros.\n"+
    "Analise o texto abaixo (extrato do "+source+") e extraia TODAS as transacoes.\n"+
    "Retorne APENAS um array JSON valido, sem markdown, sem explicacoes.\n"+
    "Cada item deve ter exatamente estes campos: {date: DD/MM/AAAA, desc: string, value: numero positivo, kind: exp ou inc}\n"+
    "- kind exp = debito/saida/pagamento/compra/saque\n"+
    "- kind inc = credito/entrada/recebimento/deposito/pix recebido/salario\n"+
    "- value sempre positivo (numero sem R$ ou pontos de milhar, use ponto decimal)\n"+
    "- Ignore linhas de saldo, total, cabecalho, rodape\n"+
    "- Se nao encontrar transacoes, retorne []\n\n"+
    "TEXTO DO EXTRATO:\n"+text.slice(0,8000);
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="+key,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1}})
  });
  if(!r.ok) throw new Error("Gemini API erro: "+r.status);
  const data=await r.json();
  const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||"[]";
  const fence=String.fromCharCode(96,96,96);const clean=raw.replace(fence+"json","").replace(fence,"").trim();
  const parsed=JSON.parse(clean);
  if(!Array.isArray(parsed)) throw new Error("Resposta invalida da IA");
  return parsed.map(p=>({...p,source})).filter(p=>p.date&&p.value>0);
}

export async function parsePdf(file, setMsg){
  setMsg("Lendo PDF...");
  const text=await extractPdfText(file);
  if(text.trim().length<50) throw new Error("PDF sem texto selecionavel. Use um extrato em PDF de texto, nao escaneado.");
  const tipo=detectBankPdf(text);
  const source=tipo.replace("_pdf","").replace("nubank","Nubank").replace("inter","Inter")
    .replace("c6","C6 Bank").replace("bradesco","Bradesco").replace("itau","Itaú")
    .replace("santander","Santander").replace("bb","Banco do Brasil").replace("caixa","Caixa").replace("unknown","Banco");

  setMsg("Banco detectado: "+source+". Extraindo transacoes...");

  if(["nubank_pdf","inter_pdf","bradesco_pdf"].includes(tipo)){
    const txs=parsePdfGenerico(text,source);
    if(txs.length>0) return txs;
  }
  setMsg("Usando IA para extrair transacoes do "+source+"...");
  return await parsePdfViaGemini(text, source);
}
