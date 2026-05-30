import { MESES } from './constants';

let _jspdfLib=null;
async function loadJsPDF(){
  if(_jspdfLib) return _jspdfLib;
  return new Promise((res,rej)=>{
    if(window.jspdf){_jspdfLib=window.jspdf;return res(_jspdfLib);}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>{_jspdfLib=window.jspdf;res(_jspdfLib);};
    s.onerror=()=>rej(new Error("Falha ao carregar jsPDF"));
    document.head.appendChild(s);
  });
}

export async function gerarRelatorioPDF(exps,cats,fixas,reservas,meta,mesFiltro,showToast){
  showToast("⏳ Gerando PDF...");
  try{
    const lib=await loadJsPDF();
    const doc=new lib.jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    const PW=210,PH=297,ML=18,MR=18;
    const CW=PW-ML-MR;
    let y=18;

    function rgb(hex){return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
    function tc(hex){const[r,g,b]=rgb(hex);doc.setTextColor(r,g,b);}
    function fc(hex){const[r,g,b]=rgb(hex);doc.setFillColor(r,g,b);}
    function dc(hex){const[r,g,b]=rgb(hex);doc.setDrawColor(r,g,b);}
    function checkPage(need){if(y+need>PH-14){doc.addPage();y=22;}}
    function fmtR(v){return"R$ "+Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}

    const [ano,mes]=mesFiltro.split("-");
    const nomeMes=(MESES[+mes]||mes)+" "+ano;
    const gastos=exps.filter(e=>e.kind==="exp"&&e.cat!=="investimento");
    const renda=exps.filter(e=>e.kind==="inc"&&(e.incType==="salario"||e.incType==="extra"||!e.incType));
    const invest=exps.filter(e=>e.cat==="investimento");
    const totalRenda=renda.reduce((s,e)=>s+e.value,0);
    const totalGastos=gastos.reduce((s,e)=>s+e.value,0);
    const totalInvest=invest.reduce((s,e)=>s+e.value,0);
    const saldo=totalRenda-totalGastos;
    const poupPct=totalRenda>0?((saldo/totalRenda)*100):0;

    // ── HEADER ──
    fc("#4f46e5");doc.rect(0,0,PW,26,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(20);tc("#ffffff");
    doc.text("Granzo",ML,13);
    doc.setFontSize(8);doc.setFont("helvetica","normal");tc("#c7d2fe");
    doc.text("Controle Financeiro Pessoal",ML,19);
    doc.setFontSize(14);doc.setFont("helvetica","bold");tc("#ffffff");
    doc.text(nomeMes,PW-MR,12,{align:"right"});
    doc.setFontSize(8);doc.setFont("helvetica","normal");tc("#c7d2fe");
    doc.text("Gerado em "+new Date().toLocaleDateString("pt-BR"),PW-MR,19,{align:"right"});
    y=34;

    // ── RESUMO — 4 cards ──
    doc.setFontSize(10);doc.setFont("helvetica","bold");tc("#1e293b");
    doc.text("Resumo Financeiro",ML,y);y+=6;
    const cardW=(CW-6)/4;
    const cards=[
      {label:"Renda",   value:totalRenda,  color:"#16a34a",bg:"#f0fdf4",brd:"#86efac"},
      {label:"Gastos",  value:totalGastos, color:"#dc2626",bg:"#fef2f2",brd:"#fca5a5"},
      {label:"Saldo",   value:saldo,       color:saldo>=0?"#16a34a":"#dc2626",bg:saldo>=0?"#f0fdf4":"#fef2f2",brd:saldo>=0?"#86efac":"#fca5a5"},
      {label:"Investido",value:totalInvest,color:"#4f46e5",bg:"#eef2ff",brd:"#a5b4fc"},
    ];
    cards.forEach((card,i)=>{
      const cx=ML+i*(cardW+2);
      fc(card.bg);dc(card.brd);doc.setLineWidth(0.3);
      doc.roundedRect(cx,y,cardW,20,2,2,"FD");
      doc.setFontSize(7);doc.setFont("helvetica","normal");tc("#64748b");
      doc.text(card.label,cx+cardW/2,y+7,{align:"center"});
      doc.setFontSize(8);doc.setFont("helvetica","bold");tc(card.color);
      const vs=fmtR(card.value);
      const fw=doc.getTextWidth(vs);
      if(fw>cardW-4){doc.setFontSize(6);}
      doc.text(vs,cx+cardW/2,y+15,{align:"center"});
      doc.setFontSize(8);
    });
    y+=26;

    // ── BARRA DE POUPANÇA ──
    if(totalRenda>0){
      fc("#f8fafc");dc("#e2e8f0");doc.setLineWidth(0.3);
      doc.roundedRect(ML,y,CW,13,2,2,"FD");
      doc.setFontSize(8);doc.setFont("helvetica","bold");tc("#1e293b");
      doc.text("Poupanca do mes:",ML+3,y+5);
      const barX=ML+44,barW=CW-64,barH=4,barY=y+7;
      fc("#e2e8f0");doc.roundedRect(barX,barY,barW,barH,1,1,"F");
      const pct=Math.min(100,Math.max(0,poupPct));
      const bc=pct>=20?"#16a34a":pct>=10?"#d97706":"#dc2626";
      if(pct>0){fc(bc);doc.roundedRect(barX,barY,barW*pct/100,barH,1,1,"F");}
      doc.setFontSize(8);doc.setFont("helvetica","bold");tc(bc);
      doc.text(poupPct.toFixed(1)+"%",barX+barW+3,y+5);
      if(meta>0){
        doc.setFontSize(7);doc.setFont("helvetica","normal");tc("#64748b");
        doc.text("Meta: "+fmtR(meta),PW-MR,y+11,{align:"right"});
      }
      y+=19;
    }

    // ── CATEGORIAS ──
    checkPage(40);
    doc.setFontSize(10);doc.setFont("helvetica","bold");tc("#1e293b");
    doc.text("Gastos por Categoria",ML,y);y+=6;
    const catsGasto=cats
      .map(c=>({...c,spent:gastos.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.value,0)}))
      .filter(c=>c.spent>0).sort((a,b)=>b.spent-a.spent);

    if(catsGasto.length===0){
      doc.setFontSize(9);doc.setFont("helvetica","normal");tc("#64748b");
      doc.text("Nenhum gasto registrado neste mes.",ML,y);y+=10;
    } else {
      catsGasto.forEach((cat,idx2)=>{
        checkPage(12);
        const pct=cat.budget>0?Math.min(100,(cat.spent/cat.budget)*100):0;
        const bc=pct>=100?"#dc2626":pct>=80?"#d97706":"#16a34a";
        if(idx2%2===0){fc("#f8fafc");doc.rect(ML,y,CW,10,"F");}
        doc.setFontSize(8);doc.setFont("helvetica","bold");tc("#1e293b");
        const nm=cat.label;
        doc.text(nm.slice(0,25),ML+2,y+7);
        doc.setFont("helvetica","bold");tc("#dc2626");
        doc.text(fmtR(cat.spent),PW-MR,y+7,{align:"right"});
        if(cat.budget>0){
          const barX=ML+58,barW=CW-80,barH=3,barY=y+5;
          fc("#e2e8f0");doc.roundedRect(barX,barY,barW,barH,0.5,0.5,"F");
          if(pct>0){fc(bc);doc.roundedRect(barX,barY,barW*pct/100,barH,0.5,0.5,"F");}
          doc.setFontSize(7);doc.setFont("helvetica","normal");tc("#64748b");
          doc.text(pct.toFixed(0)+"%",barX+barW+2,y+7);
          tc("#94a3b8");
          doc.text("de "+fmtR(cat.budget),barX+barW+9,y+7);
        }
        dc("#e2e8f0");doc.setLineWidth(0.2);doc.line(ML,y+10,ML+CW,y+10);
        y+=11;
      });
    }

    // ── TOP GASTOS ──
    checkPage(40);y+=4;
    doc.setFontSize(10);doc.setFont("helvetica","bold");tc("#1e293b");
    doc.text("Maiores Gastos do Mes",ML,y);y+=6;
    const top10=[...gastos].sort((a,b)=>b.value-a.value).slice(0,10);
    if(top10.length===0){
      doc.setFontSize(9);doc.setFont("helvetica","normal");tc("#64748b");
      doc.text("Nenhum gasto registrado.",ML,y);y+=10;
    } else {
      fc("#4f46e5");doc.rect(ML,y,CW,7,"F");
      doc.setFontSize(8);doc.setFont("helvetica","bold");tc("#ffffff");
      doc.text("Data",ML+2,y+5);
      doc.text("Descricao",ML+20,y+5);
      doc.text("Categoria",ML+110,y+5);
      doc.text("Valor",PW-MR,y+5,{align:"right"});
      y+=7;
      top10.forEach((e,i)=>{
        checkPage(9);
        if(i%2===0){fc("#f8fafc");doc.rect(ML,y,CW,8,"F");}
        const cat=cats.find(c=>c.id===e.cat);
        doc.setFontSize(8);doc.setFont("helvetica","normal");tc("#475569");
        doc.text(e.date?e.date.slice(0,5):"--",ML+2,y+5);
        tc("#1e293b");
        const desc=(e.desc||"").slice(0,38);
        doc.text(desc,ML+20,y+5);
        tc("#64748b");
        doc.text((cat?.label||e.cat||"").slice(0,18),ML+110,y+5);
        doc.setFont("helvetica","bold");tc("#dc2626");
        doc.text(fmtR(e.value),PW-MR,y+5,{align:"right"});
        dc("#e2e8f0");doc.setLineWidth(0.1);doc.line(ML,y+8,ML+CW,y+8);
        y+=8;
      });
    }

    // ── DESPESAS FIXAS ──
    const fixasAtivas=(fixas||[]).filter(f=>f.ativo&&f.valor>0);
    if(fixasAtivas.length>0){
      checkPage(30);y+=6;
      doc.setFontSize(10);doc.setFont("helvetica","bold");tc("#1e293b");
      doc.text("Despesas Fixas",ML,y);y+=6;
      const hoje=new Date();
      const mesAtualKey=hoje.getFullYear()+"-"+String(hoje.getMonth()+1).padStart(2,"0");
      fixasAtivas.forEach(f=>{
        checkPage(11);
        const jaLancou=mesFiltro===mesAtualKey?exps.some(e=>
          e.kind==="exp"&&e.desc===f.desc&&e.value===f.valor&&
          (e.date||"").slice(3,10)===String(hoje.getMonth()+1).padStart(2,"0")+"/"+hoje.getFullYear()
        ):true;
        fc(jaLancou?"#f0fdf4":"#fef9c3");doc.rect(ML,y,CW,9,"F");
        doc.setFontSize(9);doc.setFont("helvetica","normal");tc("#1e293b");
        doc.text("- "+f.desc.slice(0,30),ML+2,y+6);
        doc.setFont("helvetica","bold");tc(jaLancou?"#16a34a":"#d97706");
        doc.text(fmtR(f.valor),PW-MR-24,y+6);
        doc.text(jaLancou?"OK Lancado":"Pendente",PW-MR,y+6,{align:"right"});
        dc("#e2e8f0");doc.setLineWidth(0.2);doc.line(ML,y+9,ML+CW,y+9);
        y+=10;
      });
    }

    // ── RESERVAS ──
    const reservasAtivas=(reservas||[]).filter(r=>r.saldo>0);
    if(reservasAtivas.length>0){
      checkPage(30);y+=6;
      doc.setFontSize(10);doc.setFont("helvetica","bold");tc("#1e293b");
      doc.text("Reservas / Caixinhas",ML,y);y+=6;
      const totalRes=reservasAtivas.reduce((s,r)=>s+r.saldo,0);
      reservasAtivas.forEach(r=>{
        checkPage(10);
        const pct=r.meta>0?Math.min(100,(r.saldo/r.meta)*100):null;
        fc("#eef2ff");doc.rect(ML,y,CW,9,"F");
        doc.setFontSize(9);doc.setFont("helvetica","normal");tc("#1e293b");
        doc.text("- "+r.nome.slice(0,30),ML+2,y+6);
        if(pct!==null){
          const barX=ML+75,barW=50,barH=3,barY=y+4;
          fc("#e2e8f0");doc.roundedRect(barX,barY,barW,barH,0.5,0.5,"F");
          fc("#818cf8");if(pct>0)doc.roundedRect(barX,barY,barW*pct/100,barH,0.5,0.5,"F");
          doc.setFontSize(7);tc("#64748b");
          doc.text(pct.toFixed(0)+"%",barX+barW+2,y+6);
        }
        doc.setFont("helvetica","bold");tc("#4f46e5");
        doc.text(fmtR(r.saldo),PW-MR,y+6,{align:"right"});
        dc("#e2e8f0");doc.setLineWidth(0.2);doc.line(ML,y+9,ML+CW,y+9);
        y+=10;
      });
      checkPage(10);
      doc.setFontSize(8);doc.setFont("helvetica","bold");tc("#4f46e5");
      doc.text("Total em reservas: "+fmtR(totalRes),PW-MR,y+4,{align:"right"});
      y+=10;
    }

    // ── FOOTER em todas as páginas ──
    const totalPages=doc.internal.getNumberOfPages();
    for(let p=1;p<=totalPages;p++){
      doc.setPage(p);
      fc("#4f46e5");doc.rect(0,PH-10,PW,10,"F");
      doc.setFontSize(7);doc.setFont("helvetica","normal");tc("#c7d2fe");
      doc.text("Granzo - Controle Financeiro Pessoal",ML,PH-4);
      doc.text("Pagina "+p+" de "+totalPages,PW-MR,PH-4,{align:"right"});
    }

    // ── SALVAR / COMPARTILHAR ──
    const filename="Granzo_"+(MESES[+mes]||mes)+"_"+ano+".pdf";
    const blob=doc.output("blob");

    // Converte blob pra base64
    const base64=await new Promise(res=>{
      const reader=new FileReader();
      reader.onload=()=>res(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });

    // 1) Capacitor nativo: Filesystem + Share (melhor experiência)
    const cap=window.Capacitor;
    if(cap?.isNativePlatform?.()){
      const plugins=cap.Plugins||{};
      try{
        // Escreve o PDF no cache do app
        const written=await plugins.Filesystem.writeFile({
          path:filename,
          data:base64,
          directory:"CACHE"
        });
        // Abre o menu de compartilhamento nativo
        await plugins.Share.share({
          title:"Relatório Granzo - "+nomeMes,
          url:written.uri,
          dialogTitle:"Compartilhar PDF"
        });
        showToast("✓ PDF compartilhado!");
        return;
      }catch(e){
        // Se cancelou o share, não é erro
        if(e?.message?.includes?.("cancel")||e?.message?.includes?.("dismiss")) return;
        // Plugins não instalados ou outro erro — tenta fallback web
      }
    }

    // 2) Fallback web: navigator.share com File
    if(navigator.share){
      try{
        const file=new File([blob],filename,{type:"application/pdf"});
        await navigator.share({files:[file],title:"Relatório Granzo - "+nomeMes});
        showToast("✓ PDF compartilhado!");
        return;
      }catch(e){
        if(e.name==="AbortError") return;
      }
    }

    // 3) Último recurso: download via data URI
    const a=document.createElement("a");
    a.href="data:application/pdf;base64,"+base64;
    a.download=filename;
    a.click();
    showToast("✓ PDF gerado!");
  }catch(err){
    showToast("❌ Erro: "+err.message);
  }
}
