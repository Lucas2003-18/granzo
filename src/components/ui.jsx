import { useState, useRef, useEffect } from 'react';

export function Bar({pct,color="#3DBA6F"}) {
  return <div style={{background:"#232B24",borderRadius:99,height:6,overflow:"hidden",margin:"6px 0 3px"}}>
    <div style={{width:`${Math.min(100,Math.max(0,pct))}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.4s ease"}}/>
  </div>;
}

export function SecTitle({t,sub}) {
  return <div style={{margin:"18px 0 10px"}}>
    <div style={{fontSize:11,fontWeight:700,color:"#536057",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t}</div>
    {sub&&<div style={{fontSize:11,color:"#536057",marginTop:2}}>{sub}</div>}
  </div>;
}

export function AlertBox({tipo,texto}) {
  const cfg={
    info:{bg:"rgba(61,186,111,0.06)",border:"rgba(61,186,111,0.15)",color:"#8FA893"},
    warn:{bg:"rgba(232,168,50,0.1)",border:"rgba(232,168,50,0.25)",color:"#E8A832"},
    err :{bg:"rgba(224,82,82,0.1)",border:"rgba(224,82,82,0.25)",color:"#E05252"},
    ok  :{bg:"rgba(61,186,111,0.1)",border:"rgba(61,186,111,0.25)",color:"#3DBA6F"},
  };
  const s=cfg[tipo]||cfg.info;
  return <div style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,padding:"10px 14px",color:s.color,fontSize:13,marginBottom:12,lineHeight:1.5}}>{texto}</div>;
}

export function ConfirmModal({msg,sub,onOk,onCancel,okLabel="Confirmar",okColor="#E05252",cancelLabel="Cancelar"}){
  const okText=(okColor==="#3DBA6F"||okColor==="#E8A832")?"#0A0F0D":"#fff";
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
    onClick={onCancel}>
    <div style={{background:"#111713",borderRadius:18,padding:"24px 20px",maxWidth:340,width:"100%",border:"1px solid #232B24",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:16,fontWeight:700,color:"#DDE8DF",marginBottom:sub?8:20,textAlign:"center"}}>{msg}</div>
      {sub&&<div style={{fontSize:13,color:"#536057",marginBottom:20,textAlign:"center",lineHeight:1.6}}>{sub}</div>}
      <div style={{display:"flex",gap:10}}>
        <button style={{flex:1,background:"#181E19",border:"1px solid #2E3A2F",color:"#8FA893",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onCancel}>{cancelLabel}</button>
        <button style={{flex:1,background:okColor,border:"none",color:okText,borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onOk}>{okLabel}</button>
      </div>
    </div>
  </div>;
}

export function MdText({ text }) {
  const html = (text||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/\n/g,"<br/>");
  return <span dangerouslySetInnerHTML={{__html:html}}/>;
}

export function SwipeRow({ children, onDelete, disabled, swipeId, activeSwipe, setActiveSwipe }) {
  const startX  = useRef(null);
  const threshold = 80;
  const isOpen = activeSwipe === swipeId;
  const innerRef = useRef(null);

  useEffect(()=>{
    if(!innerRef.current) return;
    innerRef.current.style.transform = isOpen ? `translateX(-${threshold}px)` : "translateX(0px)";
    innerRef.current.style.transition = "transform 0.22s ease";
  },[isOpen]);

  if(disabled) return <>{children}</>;

  function onTouchStart(e){
    startX.current = e.touches[0].clientX;
    if(activeSwipe && activeSwipe !== swipeId) setActiveSwipe(null);
  }
  function onTouchMove(e){
    if(startX.current===null||!innerRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if(dx < 0) {
      innerRef.current.style.transform = `translateX(${Math.max(dx,-threshold)}px)`;
      innerRef.current.style.transition = "none";
    } else if(isOpen && dx > 0) {
      innerRef.current.style.transform = `translateX(${Math.min(0, -threshold+dx)}px)`;
      innerRef.current.style.transition = "none";
    }
  }
  function onTouchEnd(e){
    if(startX.current===null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if(dx < -(threshold * 0.5)){
      setActiveSwipe(swipeId);
    } else {
      setActiveSwipe(prev => prev===swipeId ? null : prev);
      if(innerRef.current){
        innerRef.current.style.transform = "translateX(0px)";
        innerRef.current.style.transition = "transform 0.22s ease";
      }
    }
    startX.current = null;
  }

  return (
    <div style={{position:"relative",borderRadius:12,marginBottom:8,overflow:"hidden",background:"#181E19"}}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:threshold,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"#E05252",cursor:"pointer",zIndex:0}}
        onClick={()=>{setActiveSwipe(null);onDelete();}}>
        <span style={{fontSize:20}}>🗑️</span>
        <span style={{fontSize:10,color:"white",fontWeight:700}}>Deletar</span>
      </div>
      <div ref={innerRef} style={{transform:"translateX(0px)",position:"relative",zIndex:1,background:"#181E19",borderRadius:12}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </div>
  );
}
