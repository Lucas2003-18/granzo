import { useState } from 'react';
import { fmt } from '../utils/format';
import { GROCERY } from '../utils/constants';
import { inp, btn, CARD, ROW } from '../utils/styles';
import { SecTitle, ConfirmModal } from './ui';
import { loadPrecos, savePrecos, loadProdsExtra, saveProdsExtra } from '../utils/mercadoStorage';

function Mercado({ markets, setMarkets, hide }) {
  // precos: { "Frango (kg)": { "Carrefour": {valor:12.9, data:"15/03"}, ... }, ... }
  const [precos,    setPrecos]   = useState(loadPrecos);
  const [produtos,  setProdutos] = useState(()=>{
    const extras=loadProdsExtra();
    // Também recupera produtos que têm preços mas não estão em nenhuma lista (migração)
    const fromPrecos=Object.keys(loadPrecos()).filter(p=>!GROCERY.includes(p)&&!extras.includes(p));
    return [...GROCERY,...extras,...fromPrecos];
  });
  const [aba,       setAba]      = useState("comparar"); // "comparar" | "registrar" | "gerenciar"
  const [selProd,   setSelProd]  = useState(null); // produto selecionado para registrar preço
  const [selMkt,    setSelMkt]   = useState(null); // mercado selecionado
  const [inputVal,  setInputVal] = useState("");
  const [novoProd,  setNovoProd] = useState("");
  const [filtro,    setFiltro]   = useState(""); // busca rápida

  function salvarPreco(){
    if(!selProd||!selMkt||!inputVal) return;
    const v=parseFloat(inputVal.replace(",","."));
    if(isNaN(v)||v<=0) return;
    const hoje=fmtDate(new Date().toISOString().slice(0,10)).slice(0,5); // DD/MM
    const novo={...precos,[selProd]:{...(precos[selProd]||{}),[selMkt]:{valor:v,data:hoje}}};
    setPrecos(novo);savePrecos(novo);
    setInputVal("");setSelMkt(null);
  }

  function removerPreco(prod,mkt){
    const novo={...precos};
    if(novo[prod]){delete novo[prod][mkt];if(Object.keys(novo[prod]).length===0)delete novo[prod];}
    setPrecos(novo);savePrecos(novo);
  }

  function addProd(){
    const n=novoProd.trim();if(!n||produtos.includes(n))return;
    setProdutos(p=>{
      const nova=[...p,n];
      const extras=nova.filter(x=>!GROCERY.includes(x));
      saveProdsExtra(extras);
      return nova;
    });
    setNovoProd("");setSelProd(n);setAba("registrar");
  }

  function remProd(n){
    setProdutos(p=>{
      const nova=p.filter(x=>x!==n);
      saveProdsExtra(nova.filter(x=>!GROCERY.includes(x)));
      return nova;
    });
    const novo={...precos};delete novo[n];
    setPrecos(novo);savePrecos(novo);
  }

  // Para cada produto, pega o menor preço e qual mercado
  const comparacao=produtos.filter(p=>filtro?p.toLowerCase().includes(filtro.toLowerCase()):true).map(prod=>{
    const mktPrecos=precos[prod]||{};
    const entradas=Object.entries(mktPrecos);
    if(entradas.length===0) return {prod,entradas:[],min:null,minMkt:null};
    const min=Math.min(...entradas.map(([,v])=>v.valor));
    const minMkt=entradas.find(([,v])=>v.valor===min)?.[0];
    return {prod,entradas,min,minMkt};
  });

  // Total estimado por mercado (só produtos que têm preço naquele mercado)
  const totaisMkt={};
  markets.forEach(m=>{
    const total=produtos.reduce((s,p)=>s+(precos[p]?.[m.label]?.valor||0),0);
    if(total>0) totaisMkt[m.label]=total;
  });
  const totSorted=Object.entries(totaisMkt).sort(([,a],[,b])=>a-b);
  const temPrecos=Object.keys(precos).length>0;

  return (
    <div style={{padding:16,paddingBottom:100}}>
      {/* Abas */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["comparar","📊 Comparar"],["registrar","✏️ Registrar"],["gerenciar","⚙️ Produtos"]].map(([id,label])=>(
          <button key={id} style={{flex:1,background:aba===id?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:aba===id?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:aba===id?"#818cf8":"#64748b",borderRadius:10,padding:"8px 4px",fontSize:12,fontWeight:aba===id?700:400,cursor:"pointer",fontFamily:"inherit"}}
            onClick={()=>setAba(id)}>{label}</button>
        ))}
      </div>

      {/* ABA: COMPARAR */}
      {aba==="comparar"&&<>
        {!temPrecos&&(
          <AlertBox tipo="info" texto="Nenhum preço registrado ainda. Vá em ✏️ Registrar para anotar os preços que você viu no mercado — o app compara automaticamente!"/>
        )}
        {temPrecos&&totSorted.length>=2&&(
          <div style={{background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,163,74,0.06))",border:"1px solid rgba(74,222,128,0.25)",borderRadius:16,padding:16,marginBottom:16,textAlign:"center"}}>
            <div style={{fontSize:10,color:"#4ade80",textTransform:"uppercase",marginBottom:4}}>🏆 Mais barato (itens comparáveis)</div>
            <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9",marginBottom:2}}>{totSorted[0][0]}</div>
            <div style={{fontSize:13,color:"#94a3b8"}}>Economia de <strong style={{color:"#4ade80"}}>{fmt(totSorted[totSorted.length-1][1]-totSorted[0][1])}</strong> vs mais caro</div>
          </div>
        )}
        {temPrecos&&totSorted.length>=2&&<>
          <SecTitle t="Total por mercado" sub="Baseado nos preços que você registrou"/>
          {totSorted.map(([m,t],i)=>(
            <div key={m} style={{...ROW,...(i===0?{borderColor:"rgba(74,222,128,0.2)",background:"rgba(74,222,128,0.06)"}:{})}}>
              <span style={{fontSize:16,width:24}}>{["🥇","🥈","🥉","4°","5°"][i]||"·"}</span>
              <span style={{flex:1,fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{m}</span>
              <span style={{fontSize:14,fontWeight:700,color:i===0?"#4ade80":"#e2e8f0"}}>{fmt(t)}</span>
            </div>
          ))}
        </>}
        <SecTitle t="Preços por produto"/>
        <input style={{...inp({marginBottom:12,padding:"9px 13px",fontSize:13})}} placeholder="🔍 Filtrar produto..." value={filtro} onChange={e=>setFiltro(e.target.value)}/>
        {comparacao.map(({prod,entradas,min,minMkt})=>(
          <div key={prod} style={CARD}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:entradas.length>0?10:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{prod}</div>
              {entradas.length===0&&<button style={{fontSize:12,color:"#818cf8",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setSelProd(prod);setAba("registrar");}}>+ Registrar</button>}
              {entradas.length>0&&<span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>🏆 {minMkt}</span>}
            </div>
            {entradas.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {entradas.sort(([,a],[,b])=>a.valor-b.valor).map(([mkt,info])=>(
                  <div key={mkt} style={{flex:"1 0 calc(33% - 6px)",background:info.valor===min?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.03)",borderRadius:8,padding:"7px 6px",textAlign:"center",border:info.valor===min?"1px solid rgba(74,222,128,0.3)":"1px solid rgba(255,255,255,0.06)"}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:2}}>{mkt.split(" ")[0]}</div>
                    <div style={{fontSize:13,fontWeight:700,color:info.valor===min?"#4ade80":"#94a3b8"}}>{fmt(info.valor)}</div>
                    <div style={{fontSize:9,color:"#475569",marginTop:1}}>{info.data}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </>}

      {/* ABA: REGISTRAR */}
      {aba==="registrar"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.6}}>Anote o preço que você viu hoje no mercado. O app guarda o histórico e compara automaticamente.</div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>1. Escolha o produto</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
          {produtos.map(p=>(
            <button key={p} style={{background:selProd===p?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:selProd===p?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:selProd===p?"#818cf8":"#94a3b8",borderRadius:99,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:selProd===p?700:400}}
              onClick={()=>{setSelProd(p);setSelMkt(null);setInputVal("");}}>
              {selProd===p?"✓ ":""}{p}
            </button>
          ))}
        </div>
        {selProd&&<>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>2. Qual mercado?</div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {markets.map(m=>(
              <button key={m.id} style={{background:selMkt===m.label?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:selMkt===m.label?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.08)",color:selMkt===m.label?"#818cf8":"#94a3b8",borderRadius:10,padding:"8px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:selMkt===m.label?700:400}}
                onClick={()=>setSelMkt(m.label)}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </>}
        {selProd&&selMkt&&<>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>3. Preço (R$)</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={{...inp({flex:1}),fontSize:18,fontWeight:700,textAlign:"center"}} type="number" step="0.01" placeholder="0,00" value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&salvarPreco()}/>
            <button style={{...btn("linear-gradient(135deg,#22c55e,#16a34a)"),width:"auto",padding:"11px 20px"}} onClick={salvarPreco}>✓ Salvar</button>
          </div>
          {precos[selProd]?.[selMkt]&&(
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Último registrado: <strong style={{color:"#94a3b8"}}>{fmt(precos[selProd][selMkt].valor)}</strong> em {precos[selProd][selMkt].data}</div>
          )}
        </>}
      </>}

      {/* ABA: GERENCIAR */}
      {aba==="gerenciar"&&<>
        <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>Adicione produtos ou remova os que não usa.</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input style={{...inp({flex:1})}} placeholder="Novo produto (ex: Sabão em pó 1kg)" value={novoProd} onChange={e=>setNovoProd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProd()}/>
          <button style={{...btn("linear-gradient(135deg,#22c55e,#16a34a)"),width:"auto",padding:"11px 16px"}} onClick={addProd}>+</button>
        </div>
        {produtos.map(p=>{
          const nReg=Object.keys(precos[p]||{}).length;
          return <div key={p} style={ROW}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{p}</div>
              <div style={{fontSize:11,color:"#475569"}}>{nReg>0?`${nReg} mercado(s) registrado(s)`:"Sem preços ainda"}</div>
            </div>
            <button style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"3px 8px",cursor:"pointer"}} onClick={()=>remProd(p)}>✕</button>
          </div>;
        })}
      </>}
    </div>
  );
}

// ── IA CHAT ────────────────────────────────────────────────

export default Mercado;
