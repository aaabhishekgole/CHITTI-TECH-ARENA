import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import mqtt from "mqtt";

/* ═══════════════════════════════════════════════════════════════
   CHITTI TECH ARENA — ULTIMATE AI TECH GAME SHOW
   · Cinematic Intro  · Particle Field  · Spinning Wheel
   · Lifelines 50:50 & Ask Audience  · Circular Timer + Sounds
   · Streak Bonuses  · Typing Responses  · Dramatic Reveal
   · Prompt Battle with Live AI Judge  · Animated Podium Finale
   · Floating Reactions  · Confetti  · Score Counter
═══════════════════════════════════════════════════════════════ */

// ── SOUND ENGINE ──────────────────────────────────────────────
const S = {
  _c: null,
  c() { if (!this._c) this._c = new (window.AudioContext || window.webkitAudioContext)(); return this._c; },
  t(f, d, type = "sine", v = 0.22) {
    try {
      const c = this.c(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = type;
      o.frequency.setValueAtTime(f, c.currentTime);
      g.gain.setValueAtTime(v, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
      o.start(); o.stop(c.currentTime + d);
    } catch {}
  },
  correct() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.t(f, 0.18), i * 110)); },
  wrong()   { this.t(180, 0.4, "sawtooth", 0.3); },
  tick()    { this.t(900, 0.05, "square", 0.07); },
  fanfare() { [523,659,784,1047,1318].forEach((f,i) => setTimeout(() => this.t(f, 0.2), i*90)); },
  swoosh()  { [700,500,300].forEach((f,i) => setTimeout(() => this.t(f, 0.06, "sine", 0.08), i*35)); },
  spin()    { [300,400,500,600,700,800,900,1000,800,600,400].forEach((f,i) => setTimeout(() => this.t(f, 0.05, "sine", 0.07), i*55)); },
  lifeline(){ [440,550,660,770].forEach((f,i) => setTimeout(() => this.t(f, 0.1), i*90)); },
  buzzer()  { this.t(80, 0.55, "sawtooth", 0.55); setTimeout(() => this.t(60, 0.3, "sawtooth", 0.35), 120); },
  ding()    { [1047,1319,1568].forEach((f,i) => setTimeout(() => this.t(f, 0.12, "sine", 0.18), i*70)); },
};

// ── CLAUDE API ────────────────────────────────────────────────
async function ai(sys, usr) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys, messages: [{ role: "user", content: usr }] }),
  });
  const d = await r.json();
  return d.content?.[0]?.text || "";
}

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#07080f;overflow-x:hidden;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes pop{0%{transform:scale(0.4);opacity:0}65%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-9px)}75%{transform:translateX(9px)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-230px) scale(0.3);opacity:0}}
@keyframes ticker{0%{transform:translateX(100vw)}100%{transform:translateX(-100%)}}
@keyframes introIn{0%{transform:scale(0.2) rotateX(60deg);opacity:0}100%{transform:scale(1) rotateX(0deg);opacity:1}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 8px #ffe60040}50%{box-shadow:0 0 28px #ffe600,0 0 55px #ffe60040}}
@keyframes winGlow{0%,100%{box-shadow:0 0 12px #ffe60040}50%{box-shadow:0 0 36px #ffe600,0 0 72px #ffe60060}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes podiumRise{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes scanMove{0%{top:-100%}100%{top:100%}}
.scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px);}
.ticker-wrap{overflow:hidden;white-space:nowrap;background:#090b18;border-top:1px solid #1a2040;border-bottom:1px solid #1a2040;padding:5px 0;}
.ticker-text{display:inline-block;animation:ticker 24s linear infinite;font-family:Orbitron,sans-serif;font-size:0.56rem;letter-spacing:0.2em;color:#1e2848;}
@keyframes buzzerFlash{0%,100%{opacity:1;transform:scale(1)}25%{opacity:0.4;transform:scale(0.97)}50%{opacity:1;transform:scale(1.04)}75%{opacity:0.4;transform:scale(0.97)}}
@keyframes readyPulse{0%,100%{box-shadow:0 0 10px currentColor,0 0 0px currentColor}50%{box-shadow:0 0 28px currentColor,0 0 55px currentColor}}
@keyframes buzzWin{0%{transform:scale(1)}15%{transform:scale(1.07)}30%{transform:scale(0.96)}45%{transform:scale(1.05)}60%{transform:scale(0.98)}100%{transform:scale(1)}}
@keyframes countdownPop{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
`;

// ── HELPERS ───────────────────────────────────────────────────
const btn = (c, sm) => ({
  fontFamily:"Orbitron,sans-serif", fontSize: sm?"0.62rem":"0.7rem", letterSpacing:"0.1em", fontWeight:700,
  padding: sm?"8px 16px":"12px 26px", borderRadius:5, border:`2px solid ${c}`, cursor:"pointer",
  textTransform:"uppercase", color:c, background:`${c}18`, transition:"all 0.16s", outline:"none",
});
const tag = c => ({
  fontFamily:"Orbitron,sans-serif", fontSize:"0.55rem", letterSpacing:"0.12em", padding:"3px 9px",
  borderRadius:3, background:`${c}18`, color:c, border:`1px solid ${c}40`,
});
const card = (bc="#1a2040", bg="#0d1020") => ({
  background:bg, border:`1px solid ${bc}`, borderRadius:8, padding:"18px 20px",
});

// ── CONFETTI ──────────────────────────────────────────────────
function Confetti({ on }) {
  const ref = useRef(); const raf = useRef();
  useEffect(() => {
    if (!on || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext("2d");
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    const cols = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#fff"];
    let ps = Array.from({length:180}, () => ({
      x:Math.random()*cv.width, y:-20, r:Math.random()*8+3,
      c:cols[~~(Math.random()*cols.length)],
      vx:(Math.random()-0.5)*5, vy:Math.random()*5+2,
      a:Math.random()*Math.PI*2, sp:(Math.random()-0.5)*0.3,
    }));
    (function draw() {
      ctx.clearRect(0,0,cv.width,cv.height);
      ps.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.a+=p.sp; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle=p.c; ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r); ctx.restore(); });
      ps = ps.filter(p=>p.y<cv.height+20);
      if (ps.length) raf.current = requestAnimationFrame(draw);
    })();
    return () => cancelAnimationFrame(raf.current);
  }, [on]);
  if (!on) return null;
  return <canvas ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9998}} />;
}

// ── PARTICLES ────────────────────────────────────────────────
function Particles() {
  const ref = useRef(); const raf = useRef();
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    resize(); window.addEventListener("resize", resize);
    const ps = Array.from({length:55}, () => ({
      x:Math.random()*cv.width, y:Math.random()*cv.height,
      vx:(Math.random()-0.5)*0.35, vy:(Math.random()-0.5)*0.35, r:Math.random()*1.5+0.5,
    }));
    (function draw() {
      ctx.clearRect(0,0,cv.width,cv.height);
      ps.forEach(p => {
        p.x=(p.x+p.vx+cv.width)%cv.width; p.y=(p.y+p.vy+cv.height)%cv.height;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle="rgba(0,245,255,0.22)"; ctx.fill();
      });
      ps.forEach((a,i) => ps.slice(i+1).forEach(b => {
        const d = Math.hypot(a.x-b.x,a.y-b.y);
        if (d<90) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.strokeStyle=`rgba(0,245,255,${0.07*(1-d/90)})`; ctx.lineWidth=0.7; ctx.stroke(); }
      }));
      raf.current = requestAnimationFrame(draw);
    })();
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,width:"100%",height:"100%"}} />;
}

// ── WHEEL ─────────────────────────────────────────────────────
const TOPICS = ["JavaScript","Python","AI & ML","Cloud","React","Databases","Cyber Security","Git & DevOps"];
const TCOLORS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7","#ec4899","#38bdf8"];

function SpinWheel({ onResult }) {
  const ref = useRef(); const [spin, setSpin] = useState(false); const [res, setRes] = useState(null);
  const ang = useRef(0);

  function draw(r) {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"), W=cv.width, cx=W/2, cy=W/2, R=W/2-10;
    ctx.clearRect(0,0,W,W);
    const n=TOPICS.length, sl=(2*Math.PI)/n;
    TOPICS.forEach((t,i) => {
      const a = r+i*sl;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a,a+sl); ctx.closePath();
      ctx.fillStyle=TCOLORS[i]+"2a"; ctx.fill(); ctx.strokeStyle=TCOLORS[i]; ctx.lineWidth=2; ctx.stroke();
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a+sl/2);
      ctx.fillStyle=TCOLORS[i]; ctx.font=`bold 10px Orbitron,sans-serif`; ctx.textAlign="right";
      ctx.shadowColor=TCOLORS[i]; ctx.shadowBlur=6; ctx.fillText(t,R-14,4); ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.fillStyle="#07080f"; ctx.fill();
    ctx.strokeStyle="#00f5ff"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#00f5ff"; ctx.font="bold 9px Orbitron,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.shadowColor="#00f5ff"; ctx.shadowBlur=8; ctx.fillText("SPIN",cx,cy);
    ctx.beginPath(); ctx.moveTo(W-6,cy-13); ctx.lineTo(W-6,cy+13); ctx.lineTo(W-24,cy);
    ctx.closePath(); ctx.fillStyle="#ffe600"; ctx.shadowColor="#ffe600"; ctx.shadowBlur=10; ctx.fill();
  }
  useEffect(()=>{ draw(0); },[]);

  function doSpin() {
    if (spin) return; S.spin(); setSpin(true); setRes(null);
    let vel = Math.random()*0.35+0.28, raf;
    (function loop() {
      ang.current += vel; vel *= 0.984; draw(ang.current);
      if (vel > 0.005) { raf = requestAnimationFrame(loop); }
      else {
        setSpin(false);
        const n=TOPICS.length, sl=(2*Math.PI)/n;
        const norm = ((2*Math.PI)-(ang.current%(2*Math.PI)))%(2*Math.PI);
        const idx = ~~(norm/sl)%n;
        setRes(TOPICS[idx]); S.fanfare();
        setTimeout(() => onResult(TOPICS[idx]), 1100);
      }
    })();
  }

  return (
    <div style={{textAlign:"center"}}>
      <div style={{display:"inline-block",cursor:spin?"wait":"pointer",filter:"drop-shadow(0 0 24px #00f5ff30)"}} onClick={doSpin}>
        <canvas ref={ref} width={260} height={260} />
      </div>
      {res && <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"1rem",marginTop:10,textShadow:"0 0 12px #ffe600",animation:"pop 0.4s ease"}}>🎯 {res}</div>}
      {!spin&&!res&&<div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem",marginTop:10,letterSpacing:"0.1em"}}>CLICK WHEEL TO SPIN CATEGORY</div>}
      {spin&&<div style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.62rem",marginTop:10,letterSpacing:"0.1em",animation:"blink 0.5s infinite"}}>SPINNING…</div>}
    </div>
  );
}

// ── TYPING TEXT ───────────────────────────────────────────────
function Type({ text, speed=20, style }) {
  const [s, setS] = useState("");
  useEffect(()=>{ setS(""); let i=0; const t=setInterval(()=>{ i++; setS(text.slice(0,i)); if(i>=text.length)clearInterval(t); },speed); return()=>clearInterval(t); },[text]);
  return <span style={style}>{s}<span style={{animation:"blink 0.7s infinite",opacity:0.5}}>|</span></span>;
}

// ── SCORE COUNTER ─────────────────────────────────────────────
function Count({ to, dur=1200 }) {
  const [v,setV]=useState(0);
  useEffect(()=>{
    let t0=null;
    (function step(ts){ if(!t0)t0=ts; const p=Math.min((ts-t0)/dur,1); setV(~~(p*to)); if(p<1)requestAnimationFrame(step); })(performance.now());
  },[to]);
  return <>{v}</>;
}

// ── CIRCLE TIMER ──────────────────────────────────────────────
function CTimer({ v, max=20 }) {
  const r=26, c=2*Math.PI*r, col=v<=5?"#ff4060":v<=10?"#ffe600":"#00f5ff";
  return (
    <div style={{position:"relative",width:64,height:64,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width="64" height="64" style={{position:"absolute",transform:"rotate(-90deg)"}}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1a2040" strokeWidth="4"/>
        <circle cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={c*(1-v/max)}
          style={{transition:"stroke-dashoffset 1s linear,stroke 0.5s",filter:`drop-shadow(0 0 5px ${col})`}}/>
      </svg>
      <div style={{fontFamily:"Orbitron",fontSize:"1.25rem",fontWeight:900,color:col,
        textShadow:`0 0 10px ${col}`,animation:v<=5?"pulse 0.5s infinite":"none"}}>{v}</div>
    </div>
  );
}

// ── PODIUM ────────────────────────────────────────────────────
function Podium({ players }) {
  const [show,setShow]=useState(false);
  useEffect(()=>{setTimeout(()=>setShow(true),300);S.fanfare();},[]);
  const sorted=[...players].sort((a,b)=>b.score-a.score).slice(0,3);
  const order=[sorted[1],sorted[0],sorted[2]];
  const hs=[100,144,72], medals=["🥈","🥇","🥉"], cols=["#aaa","#ffe600","#cd7f32"], labels=["2ND","1ST","3RD"];
  return (
    <div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1.6rem",
        color:"#ffe600",textShadow:"0 0 24px #ffe600,0 0 60px #ffe60050",
        marginBottom:6,animation:"float 2s ease-in-out infinite"}}>🏆 FINAL RESULTS</div>
      <div style={{fontFamily:"Orbitron",color:"#1e2848",fontSize:"0.6rem",letterSpacing:"0.2em",marginBottom:36}}>CHITTI TECH ARENA · AI GAME SHOW</div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:14,marginBottom:28}}>
        {order.map((p,i) => !p ? <div key={i} style={{width:100}}/> : (
          <div key={p.id} style={{width:100,textAlign:"center",opacity:show?1:0,
            transform:show?"translateY(0)":"translateY(50px)",
            transition:`all 0.7s cubic-bezier(0.34,1.56,0.64,1) ${i*0.18}s`}}>
            <div style={{fontSize:"2.2rem",marginBottom:5,animation:`float ${2.2+i*0.2}s ease-in-out infinite`}}>{medals[i]}</div>
            <div style={{fontWeight:700,fontSize:"0.9rem",marginBottom:4,color:"#d0e0ff"}}>{p.name}</div>
            <div style={{fontFamily:"Orbitron",color:cols[i],fontSize:"1.1rem",marginBottom:10,textShadow:`0 0 10px ${cols[i]}`}}>
              <Count to={p.score}/>
            </div>
            <div style={{height:hs[i],borderRadius:"6px 6px 0 0",
              background:`linear-gradient(180deg,${cols[i]}35,${cols[i]}10)`,
              border:`2px solid ${cols[i]}`,borderBottom:"none",
              boxShadow:`0 0 22px ${cols[i]}45`,
              display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:10,
              fontFamily:"Orbitron",fontSize:"0.6rem",color:cols[i],letterSpacing:"0.1em"}}>{labels[i]}</div>
          </div>
        ))}
      </div>
      {sorted.slice(3).map((p,i)=>(
        <div key={p.id} style={{display:"inline-flex",gap:8,margin:"4px 10px",fontFamily:"Orbitron",fontSize:"0.6rem",color:"#252e60"}}>
          #{i+4} {p.name} — {p.score}pts
        </div>
      ))}
    </div>
  );
}

// ── QUIZ GAME ─────────────────────────────────────────────────
const HUMAN_QUESTIONS = {
  "JavaScript": {question:"What does typeof null return in JavaScript?",options:["A. null","B. undefined","C. object","D. string"],correct:2,explanation:"typeof null returns 'object' — a famous JS bug kept for compatibility.",fun_fact:"Brendan Eich created JavaScript in just 10 days in 1995!"},
};

function QuizGame({ onAddScore, onDone }) {
  const [phase,setPhase]=useState("wheel");
  const [topic,setTopic]=useState(null);
  const [qData,setQData]=useState(null);
  const [sel,setSel]=useState(null);
  const [timer,setTimer]=useState(20);
  const [qNum,setQNum]=useState(1);
  const [streak,setStreak]=useState(0);
  const [confetti,setConfetti]=useState(false);
  const [elim,setElim]=useState([]);
  const [ll,setLL]=useState({fifty:true,audience:true});
  const [audData,setAudData]=useState(null);
  const [commentary,setCommentary]=useState("");
  const [cd,setCd]=useState(3);
  const tref=useRef(); const TOTAL=5;

  async function loadQ(top){
    setPhase("loading"); setSel(null); setElim([]); setAudData(null); setCommentary("");
    const diff=qNum<=2?"easy":qNum<=4?"medium":"hard";
    const raw=await ai("Tech quiz master. Return ONLY valid JSON no markdown.",
      `Create a ${diff} tech question about ${top}.
Return exactly: {"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"one line","fun_fact":"one surprising fact"}`);
    try{ setQData(JSON.parse(raw.replace(/```json|```/g,"").trim())); }
    catch{ setQData({question:`Which of these is NOT a feature of ${top}?`,options:["A. Scalability","B. Flexibility","C. Immutability (always)","D. Community support"],correct:2,explanation:`${top} can be used in many flexible ways.`,fun_fact:`${top} is used by millions of developers worldwide.`}); }
    setPhase("countdown"); setCd(3);
    let c=3;
    const ct=setInterval(()=>{ c--; setCd(c); S.tick(); if(c<=0){clearInterval(ct);setPhase("question");setTimer(20);} },1000);
  }

  useEffect(()=>{
    if(phase!=="question") return;
    tref.current=setInterval(()=>{
      setTimer(t=>{ if(t<=5)S.tick(); if(t<=1){clearInterval(tref.current);setPhase("reveal");S.wrong();return 0;} return t-1; });
    },1000);
    return()=>clearInterval(tref.current);
  },[phase]);

  async function pick(i){
    if(sel!==null||phase!=="question") return;
    clearInterval(tref.current); setSel(i); setPhase("reveal");
    const ok=i===qData.correct;
    if(ok){S.correct();const pts=Math.max(50,timer*10)+(streak>=2?50:0);onAddScore(pts);setStreak(s=>s+1);setConfetti(true);setTimeout(()=>setConfetti(false),2500);}
    else{S.wrong();setStreak(0);}
    const c=await ai("Excited game show host. ONE punchy sentence, max 12 words.",`Player ${ok?"correctly":"wrongly"} answered about ${topic}.`);
    setCommentary(c.replace(/"/g,""));
  }

  function lifeline(type){
    S.lifeline();
    if(type==="fifty"&&ll.fifty){
      const wrong=qData.options.map((_,i)=>i).filter(i=>i!==qData.correct);
      setElim(wrong.sort(()=>Math.random()-0.5).slice(0,2)); setLL(l=>({...l,fifty:false}));
    }
    if(type==="audience"&&ll.audience&&!audData){
      const cp=~~(Math.random()*25)+45;
      const oth=[~~(Math.random()*20),~~(Math.random()*15),~~(Math.random()*10)];
      const adj=100-cp-oth.reduce((a,b)=>a+b,0);
      const d=[0,0,0,0]; d[qData.correct]=cp;
      let j=0; d.forEach((_,i)=>{ if(i!==qData.correct){d[i]=oth[j]+(j===oth.length-1?adj:0);j++;} });
      setAudData(d); setLL(l=>({...l,audience:false}));
    }
  }

  if(phase==="done") return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:"3rem",animation:"float 2s ease-in-out infinite",marginBottom:12}}>🎯</div>
      <div style={{fontFamily:"Orbitron",color:"#00ff90",fontSize:"1.5rem",textShadow:"0 0 14px #00ff90",marginBottom:8}}>Quiz Complete!</div>
      <div style={{color:"#3040a0",fontFamily:"Rajdhani",marginBottom:24}}>All {TOTAL} {topic} questions answered</div>
      <button style={btn("#00f5ff")} onClick={onDone}>VIEW FINAL RESULTS →</button>
    </div>
  );

  return(
    <div>
      <Confetti on={confetti}/>
      {phase==="wheel"&&(
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.75rem",letterSpacing:"0.15em",marginBottom:20}}>SPIN TO SELECT YOUR CATEGORY</div>
          <SpinWheel onResult={t=>{setTopic(t);loadQ(t);}}/>
        </div>
      )}
      {phase==="loading"&&(
        <div style={{textAlign:"center",padding:"64px 0"}}>
          <div style={{width:44,height:44,border:"3px solid #1a2040",borderTopColor:"#00f5ff",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 18px"}}></div>
          <div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.68rem",letterSpacing:"0.14em"}}>AI CRAFTING QUESTION {qNum}/{TOTAL}…</div>
        </div>
      )}
      {phase==="countdown"&&(
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"7rem",fontWeight:900,textShadow:"0 0 50px #ffe600",animation:"pop 0.3s ease"}}>{cd||"GO!"}</div>
          <div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.65rem",letterSpacing:"0.2em",marginTop:10}}>GET READY…</div>
        </div>
      )}
      {(phase==="question"||phase==="reveal")&&qData&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <span style={tag("#00f5ff")}>{topic}</span>
              <span style={tag(qNum<=2?"#00ff90":qNum<=4?"#ffe600":"#ff4060")}>{qNum<=2?"EASY":qNum<=4?"MEDIUM":"HARD"}</span>
              {streak>=2&&<span style={{...tag("#ffe600"),animation:"glowPulse 1s ease infinite"}}>🔥 ×{streak} STREAK</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem"}}>Q{qNum}/{TOTAL}</span>
              {phase==="question"&&<CTimer v={timer}/>}
            </div>
          </div>
          {/* Lifelines */}
          {phase==="question"&&(
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>lifeline("fifty")} disabled={!ll.fifty||elim.length>0}
                style={{...btn("#ffe600",true),opacity:ll.fifty?1:0.3,fontSize:"0.58rem"}}>50 : 50</button>
              <button onClick={()=>lifeline("audience")} disabled={!ll.audience||!!audData}
                style={{...btn("#ff00c8",true),opacity:ll.audience?1:0.3,fontSize:"0.58rem"}}>📊 ASK AUDIENCE</button>
              <span style={{marginLeft:"auto",fontFamily:"Orbitron",color:"#1a2040",fontSize:"0.55rem",alignSelf:"center"}}>LIFELINES</span>
            </div>
          )}
          {/* Question card */}
          <div style={{...card("#00f5ff22"),marginBottom:16,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at top left,#00f5ff06,transparent 65%)",pointerEvents:"none"}}/>
            <div style={{fontSize:"1.1rem",fontWeight:600,lineHeight:1.65,fontFamily:"Rajdhani"}}>{qData.question}</div>
          </div>
          {/* Options */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
            {qData.options?.map((opt,i)=>{
              const isE=elim.includes(i);
              let bc="#1a2040",bg="#0d1020",col="#8090b0";
              if(phase==="reveal"){ if(i===qData.correct){bc="#00ff90";bg="#00ff9018";col="#00ff90";} else if(i===sel){bc="#ff4060";bg="#ff406015";col="#ff4060";} }
              return(
                <div key={i}>
                  <button onClick={()=>pick(i)} disabled={phase!=="question"||isE}
                    style={{width:"100%",padding:"15px 16px",borderRadius:6,border:`2px solid ${isE?"#1a2040":bc}`,
                      background:isE?"#070910":bg,color:isE?"#1a2040":col,
                      fontFamily:"Rajdhani",fontSize:"1rem",fontWeight:600,
                      cursor:isE||phase!=="question"?"default":"pointer",textAlign:"left",transition:"all 0.18s",
                      boxShadow:phase==="reveal"&&i===qData.correct?"0 0 22px #00ff9050":"none",
                      animation:phase==="reveal"&&i===sel&&i!==qData.correct?"shake 0.4s ease":"none"}}>
                    <span style={{opacity:0.38,marginRight:8,fontFamily:"Orbitron",fontSize:"0.6rem"}}>{"ABCD"[i]}</span>
                    {isE?"✗":opt.replace(/^[A-D]\.\s*/,"")}
                  </button>
                  {audData&&!isE&&(
                    <div>
                      <div style={{height:5,borderRadius:3,background:"#1a2040",overflow:"hidden",marginTop:4}}>
                        <div style={{height:"100%",borderRadius:3,background:i===qData.correct?"#00ff90":"#3a4060",width:audData[i]+"%",transition:"width 1s ease"}}/>
                      </div>
                      <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#252e60",marginTop:2}}>{audData[i]}% voted</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Reveal box */}
          {phase==="reveal"&&(
            <div style={{marginTop:16,...card(sel===qData.correct?"#00ff9050":"#ff406050",sel===qData.correct?"#00ff9010":"#ff406010")}}>
              <div style={{color:sel===qData.correct?"#00ff90":"#ff4060",fontWeight:700,fontSize:"1rem",marginBottom:6}}>
                {sel===qData.correct?`✓ Correct! +${Math.max(50,timer*10)+(streak>2?50:0)} pts${streak>2?" 🔥":""}`:
                  `✗ Answer: ${qData.options?.[qData.correct]?.replace(/^[A-D]\.\s*/,"")}`}
              </div>
              {commentary&&<div style={{color:"#4a5080",fontSize:"0.88rem",fontStyle:"italic",marginBottom:8}}>"<Type text={commentary} speed={28}/>"</div>}
              <div style={{color:"#3040a0",fontSize:"0.85rem",marginBottom:8}}>{qData.explanation}</div>
              {qData.fun_fact&&<div style={{color:"#3a4570",fontSize:"0.82rem",borderTop:"1px solid #1a2040",paddingTop:10}}>💡 {qData.fun_fact}</div>}
              <div style={{textAlign:"right",marginTop:14}}>
                <button style={btn("#00f5ff",true)} onClick={()=>{ if(qNum>=TOTAL)setPhase("done"); else{setQNum(n=>n+1);loadQ(topic);} }}>
                  {qNum>=TOTAL?"🎉 Finish":"Next →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI OR HUMAN ───────────────────────────────────────────────
const HUMAN_BANK = {
  "What's one thing you love about coding?":"Honestly? When something finally works after 3 hours of debugging. That dopamine hit is unreal lol",
  "Describe AI in one sentence":"It's autocomplete on steroids that somehow got a job, a personality, and opinions about everything.",
  "Best advice for a junior developer?":"Google everything. No seriously, even seniors google basic stuff daily. The skill is knowing WHAT to search.",
  "Your hot take on JavaScript?":"It's chaotic and weird and I hate it but I also use it for literally everything so here we are.",
};

function AiOrHuman({ onAddScore, onDone }) {
  const [phase,setPhase]=useState("loading");
  const [sample,setSample]=useState(null);
  const [choice,setChoice]=useState(null);
  const [round,setRound]=useState(1);
  const [score,setScore]=useState(0);
  const [confetti,setConfetti]=useState(false);
  const [rcd,setRcd]=useState(null);
  const TOTAL=4, prompts=Object.keys(HUMAN_BANK);

  async function load(){
    setPhase("loading"); setChoice(null); setRcd(null);
    const isAI=Math.random()>0.5, p=prompts[(round-1)%prompts.length];
    if(isAI){const t=await ai("Answer casually under 55 words. Sound natural but slightly polished.",p);setSample({text:t.trim(),isAI:true,prompt:p});}
    else setSample({text:HUMAN_BANK[p],isAI:false,prompt:p});
    setPhase("question");
  }
  useEffect(()=>{load();},[round]);

  function vote(g){
    setChoice(g); S.tick();
    let c=3; setRcd(c);
    const t=setInterval(()=>{ c--; setRcd(c); S.tick(); if(c<=0){
      clearInterval(t); setRcd(null); setPhase("reveal");
      if(g===sample.isAI){onAddScore(80);setScore(s=>s+80);S.correct();setConfetti(true);setTimeout(()=>setConfetti(false),2500);}
      else S.wrong();
    }},1000);
  }

  if(phase==="done") return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:"3rem",marginBottom:12}}>🤖</div>
      <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"1.5rem",textShadow:"0 0 14px #ff00c8",marginBottom:8}}>Round Over!</div>
      <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"1.8rem",marginBottom:24}}><Count to={score}/> pts</div>
      <button style={btn("#ff00c8")} onClick={onDone}>VIEW FINAL RESULTS →</button>
    </div>
  );

  return(
    <div>
      <Confetti on={confetti}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:"Orbitron",color:"#ff00c8",fontSize:"0.9rem",textShadow:"0 0 10px #ff00c8"}}>🤖 AI or Human?</div>
        <div style={{display:"flex",gap:12}}>
          <span style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.8rem"}}>{score}pts</span>
          <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.65rem"}}>Round {round}/{TOTAL}</span>
        </div>
      </div>
      {phase==="loading"&&<div style={{textAlign:"center",padding:"60px 0"}}>
        <div style={{width:40,height:40,border:"3px solid #1a2040",borderTopColor:"#ff00c8",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.68rem",letterSpacing:"0.14em"}}>GENERATING SAMPLE…</div>
      </div>}
      {(phase==="question"||phase==="reveal")&&sample&&(
        <>
          <div style={{...card("#ff00c822"),marginBottom:18}}>
            <div style={{color:"#252e60",fontSize:"0.58rem",fontFamily:"Orbitron",letterSpacing:"0.12em",marginBottom:8}}>QUESTION:</div>
            <div style={{color:"#5060a0",fontSize:"0.95rem",marginBottom:14,fontStyle:"italic"}}>"{sample.prompt}"</div>
            <div style={{color:"#252e60",fontSize:"0.58rem",fontFamily:"Orbitron",letterSpacing:"0.12em",marginBottom:10}}>RESPONSE:</div>
            <div style={{fontSize:"1.08rem",lineHeight:1.75,color:"#d0deff",fontStyle:"italic",borderLeft:"3px solid #ff00c840",paddingLeft:16}}>
              {phase==="question"?<Type text={`"${sample.text}"`} speed={18}/>:`"${sample.text}"`}
            </div>
          </div>
          {rcd!==null&&(
            <div style={{textAlign:"center",padding:"18px 0"}}>
              <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"6rem",fontWeight:900,textShadow:"0 0 40px #ffe600",animation:"pop 0.3s ease"}}>{rcd||"REVEAL!"}</div>
            </div>
          )}
          {phase==="question"&&rcd===null&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[{label:"🤖 Written by AI",c:"#00f5ff",v:true},{label:"👤 Written by Human",c:"#ff00c8",v:false}].map(x=>(
                <button key={x.label} onClick={()=>vote(x.v)}
                  style={{...btn(x.c),width:"100%",padding:"22px 0",fontSize:"0.95rem",display:"block",lineHeight:1.6}}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
          {phase==="reveal"&&(
            <div style={{textAlign:"center",animation:"pop 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>
              <div style={{...card(choice===sample.isAI?"#00ff9060":"#ff406060",choice===sample.isAI?"#00ff9015":"#ff406015"),
                padding:"28px 20px",marginBottom:16}}>
                <div style={{fontSize:"3.5rem",marginBottom:10}}>{choice===sample.isAI?"✅":"❌"}</div>
                <div style={{fontFamily:"Orbitron",color:choice===sample.isAI?"#00ff90":"#ff4060",fontSize:"1.2rem",marginBottom:10}}>
                  {choice===sample.isAI?"CORRECT! +80 pts 🎉":"WRONG!"}
                </div>
                <div style={{color:"#4050a0",fontSize:"0.95rem",fontFamily:"Rajdhani"}}>
                  Written by <strong style={{color:sample.isAI?"#00f5ff":"#ff00c8"}}>{sample.isAI?"🤖 Claude AI":"👤 a Human"}</strong>
                </div>
              </div>
              <button style={btn(choice===sample.isAI?"#00ff90":"#ff00c8")} onClick={()=>{if(round>=TOTAL)setPhase("done");else setRound(r=>r+1);}}>
                {round>=TOTAL?"🎉 Finish":"Next Round →"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PROMPT BATTLE ─────────────────────────────────────────────
const BATTLES=[
  {task:"Get the most creative AI startup name in ONE sentence",icon:"🚀"},
  {task:"Get Claude to explain Machine Learning using ONLY a food analogy",icon:"🍕"},
  {task:"Get the funniest one-liner about debugging code",icon:"😂"},
  {task:"Get Claude to hype CHITTI TECH ARENA annual function in under 20 words",icon:"🎉"},
];

function PromptBattle({ players, onAddScore, onDone }) {
  const PCOLS=["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];
  const pList=players&&players.length>=2?players:[{id:1,name:"Player 1"},{id:2,name:"Player 2"}];
  const [phase,setPhase]=useState("submit");
  const [prompts,setPrompts]=useState(()=>pList.map(()=>""));
  const [res,setRes]=useState(null); const [round,setRound]=useState(0);
  const [confetti,setConfetti]=useState(false);
  const ch=BATTLES[round%BATTLES.length];

  function setPrompt(i,v){setPrompts(ps=>{const n=[...ps];n[i]=v;return n;});}

  async function battle(){
    if(prompts.some(p=>!p.trim()))return;
    setPhase("judging");
    const responses=await Promise.all(prompts.map(p=>ai("Respond creatively and concisely in under 28 words.",p)));
    const entries=pList.map((p,i)=>`P${i+1}(${p.name}):"${prompts[i]}"→"${responses[i]}"`).join(" ");
    const raw=await ai("Competition judge. Return ONLY JSON no markdown.",
      `Task:"${ch.task}" ${entries}
Return:{"winner":1,"scores":[7,5,6],"reasoning":"one punchy sentence why winner is better","badges":["Bold","Creative","Sharp"]}`);
    try{
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setRes({...parsed,responses});
      onAddScore(parsed.winner-1);
      S.fanfare();setConfetti(true);setTimeout(()=>setConfetti(false),2800);
    }catch{
      setRes({winner:1,scores:pList.map(()=>7),reasoning:"All were creative!",responses,badges:pList.map(()=>"Creative")});
      onAddScore(0);
    }
    setPhase("result");
  }

  return(
    <div>
      <Confetti on={confetti}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.9rem",textShadow:"0 0 10px #ffe600"}}>⚔️ Prompt Battle</div>
        <span style={{fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem"}}>Round {round+1}</span>
      </div>
      <div style={{...card("#ffe60030","#ffe60008"),marginBottom:20,textAlign:"center",padding:"18px 20px"}}>
        <div style={{fontSize:"2rem",marginBottom:8}}>{ch.icon}</div>
        <div style={{fontFamily:"Orbitron",color:"#4050a0",fontSize:"0.58rem",letterSpacing:"0.12em",marginBottom:6}}>⚡ CHALLENGE</div>
        <div style={{fontSize:"1.05rem",fontWeight:600,color:"#e0d080",fontFamily:"Rajdhani"}}>{ch.task}</div>
      </div>

      {phase==="submit"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(pList.length,3)},1fr)`,gap:12,marginBottom:20}}>
            {pList.map((p,i)=>(
              <div key={p.id}>
                <div style={{fontFamily:"Orbitron",color:PCOLS[i%PCOLS.length],fontSize:"0.6rem",marginBottom:8,letterSpacing:"0.1em"}}>👤 {p.name}</div>
                <textarea placeholder={`Craft your prompt for Claude…\n\nBe specific & creative!`}
                  value={prompts[i]||""} onChange={e=>setPrompt(i,e.target.value)}
                  style={{background:"#070910",border:`1.5px solid ${(prompts[i]||"").length>5?PCOLS[i%PCOLS.length]+"60":"#1a2040"}`,borderRadius:6,
                    color:"#c0d8f8",fontFamily:"Rajdhani",fontSize:"1rem",padding:"11px 14px",width:"100%",
                    outline:"none",resize:"vertical",minHeight:90,transition:"border-color 0.2s"}}/>
                <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:(prompts[i]||"").length>5?"#2a3560":"#1a2040",marginTop:3}}>{(prompts[i]||"").length} chars</div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center"}}>
            <button style={{...btn("#ffe600"),fontSize:"1rem",padding:"16px 52px",opacity:prompts.every(p=>p.trim())?1:0.35}}
              onClick={battle} disabled={!prompts.every(p=>p.trim())}>
              ⚡ BATTLE!
            </button>
          </div>
        </>
      )}

      {phase==="judging"&&(
        <div style={{textAlign:"center",padding:"50px 0"}}>
          <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:20,flexWrap:"wrap"}}>
            {pList.map((p,i)=>(
              <div key={p.id} style={{textAlign:"center"}}>
                <div style={{width:44,height:44,border:`3px solid ${PCOLS[i%PCOLS.length]}40`,borderTopColor:PCOLS[i%PCOLS.length],borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 10px"}}/>
                <div style={{fontFamily:"Orbitron",color:PCOLS[i%PCOLS.length],fontSize:"0.56rem"}}>{p.name}</div>
              </div>
            ))}
          </div>
          <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.78rem",letterSpacing:"0.15em"}}>CLAUDE IS JUDGING…</div>
          <div style={{color:"#252e60",fontSize:"0.8rem",marginTop:8,fontFamily:"Rajdhani"}}>Evaluating all prompts + responses</div>
        </div>
      )}

      {phase==="result"&&res&&(
        <div style={{animation:"fadeUp 0.4s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(pList.length,3)},1fr)`,gap:10,marginBottom:16}}>
            {pList.map((p,i)=>{
              const isWin=res.winner===(i+1);
              const col=PCOLS[i%PCOLS.length];
              return(
                <div key={p.id} style={{...card(isWin?"#ffe60080":"#1a2040"),animation:isWin?"winGlow 2s ease infinite":"none"}}>
                  {isWin&&<div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.58rem",marginBottom:8}}>🏆 WINNER!</div>}
                  <div style={{fontFamily:"Orbitron",color:col,fontSize:"0.58rem",marginBottom:6}}>{p.name}</div>
                  <div style={{color:"#3a4060",fontSize:"0.8rem",marginBottom:8,fontStyle:"italic"}}>"{prompts[i]}"</div>
                  <div style={{fontSize:"0.93rem",lineHeight:1.6,color:"#c0d0f0",marginBottom:10}}>
                    <Type text={`"${res.responses?.[i]??""}`} speed={24}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"1.2rem",fontWeight:900}}>{res.scores?.[i]??7}</span>
                    <span style={{fontFamily:"Orbitron",color:"#1a2040",fontSize:"0.56rem"}}>/10</span>
                    <span style={{marginLeft:8,background:"#ffffff08",borderRadius:3,padding:"2px 8px",fontSize:"0.72rem",color:"#3a4560",fontStyle:"italic"}}>
                      {res.badges?.[i]??"Creative"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{...card("#ffe60028"),marginBottom:18}}>
            <div style={{fontFamily:"Orbitron",color:"#3a4060",fontSize:"0.56rem",marginBottom:6,letterSpacing:"0.1em"}}>🧑‍⚖️ JUDGE'S VERDICT</div>
            <div style={{color:"#d0c080",fontSize:"1rem",fontFamily:"Rajdhani"}}>{res.reasoning}</div>
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center"}}>
            <button style={btn("#ffe600",true)} onClick={()=>{setPhase("submit");setPrompts(pList.map(()=>""));setRes(null);setRound(r=>r+1);}}>↺ Next Challenge</button>
            <button style={btn("#00f5ff",true)} onClick={onDone}>VIEW RESULTS →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BUZZER MODE ───────────────────────────────────────────────
const BUZZER_COLORS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7","#ec4899","#38bdf8"];
const MQTT_URL = "wss://broker.emqx.io:8084/mqtt"; // free public broker, no sign-up needed

function BuzzerMode({ players, onAddScore }) {
  // ── Room code — unique per session, shared via QR ─────────────
  const [roomCode] = useState(() => Math.random().toString(36).substr(2,6).toUpperCase());

  // ── MQTT connection ───────────────────────────────────────────
  const [mqttConn, setMqttConn] = useState(false);
  const mqttRef    = useRef(null);

  // ── Game state (MQTT-driven or local fallback) ────────────────
  const [phase,    setPhase]    = useState("idle");
  const [winner,   setWinner]   = useState(null);
  const [buzzTime, setBuzzTime] = useState(null);
  const [disabled, setDisabled] = useState([]);

  // Refs keep closure-safe copies for MQTT message handlers
  const phaseRef    = useRef("idle");
  const winnerRef   = useRef(null);
  const disabledRef = useRef([]);

  // ── Local countdown + single-screen timing ────────────────────
  const [cdPhase, setCdPhase] = useState(false);
  const [cd,      setCd]      = useState(3);
  const [showQR,  setShowQR]  = useState(true);
  const cdRef      = useRef(null);
  const lStartRef  = useRef(null);

  // ── Scores ────────────────────────────────────────────────────
  const [scores, setScores] = useState(() =>
    Object.fromEntries(players.map(p => [p.id, p.score]))
  );
  useEffect(() => {
    setScores(Object.fromEntries(players.map(p => [p.id, p.score])));
  }, [players]);

  // ── Keep refs in sync ─────────────────────────────────────────
  useEffect(() => { phaseRef.current    = phase;    }, [phase]);
  useEffect(() => { winnerRef.current   = winner;   }, [winner]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  // ── MQTT: connect once on mount ───────────────────────────────
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: `chitti_host_${Math.random().toString(36).substr(2,8)}`,
      clean: true, reconnectPeriod: 3000, connectTimeout: 8000,
    });
    mqttRef.current = client;

    client.on("connect", () => {
      setMqttConn(true);
      client.subscribe(`chitti/${roomCode}/buzz`, { qos: 0 });
      // Publish current state so any late-connecting phones get it
      pubState("idle", null, null, []);
    });
    client.on("offline",    () => setMqttConn(false));
    client.on("error",      () => {});  // suppress

    client.on("message", (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        // Only accept first buzz when in ready phase
        if (
          phaseRef.current === "ready" &&
          !winnerRef.current &&
          !disabledRef.current.includes(msg.team)
        ) {
          winnerRef.current = msg.team;
          phaseRef.current  = "buzzed";
          setWinner(msg.team);
          setBuzzTime(msg.elapsed);
          setPhase("buzzed");
          S.buzzer();
          pubState("buzzed", msg.team, msg.elapsed, disabledRef.current);
        }
      } catch {}
    });

    return () => { client.end(true); clearInterval(cdRef.current); };
  }, [roomCode]);

  // ── Publish state to all phones ───────────────────────────────
  function pubState(p, w, bt, dis) {
    mqttRef.current?.publish(
      `chitti/${roomCode}/state`,
      JSON.stringify({ phase:p, winner:w, buzzTime:bt, disabledTeams:dis }),
      { retain: true, qos: 0 }
    );
  }

  // ── Host actions ──────────────────────────────────────────────
  function startRound() {
    S.swoosh();
    setWinner(null); setBuzzTime(null); setDisabled([]);
    winnerRef.current = null; disabledRef.current = [];
    setCdPhase(true); setCd(3);
    let c = 3;
    cdRef.current = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(cdRef.current); setCdPhase(false); S.ding();
        phaseRef.current = "ready";
        setPhase("ready");
        lStartRef.current = performance.now();
        pubState("ready", null, null, disabledRef.current);
      } else { S.tick(); setCd(c); }
    }, 1000);
  }

  // Local buzz — used in single-screen mode (MQTT offline)
  function localBuzz(p) {
    if (phaseRef.current !== "ready" || winnerRef.current || disabledRef.current.includes(p.name)) return;
    const elapsed = ((performance.now() - lStartRef.current) / 1000).toFixed(2);
    S.buzzer();
    winnerRef.current = p.name; phaseRef.current = "buzzed";
    setWinner(p.name); setBuzzTime(elapsed); setPhase("buzzed");
  }

  function awardCorrect() {
    if (!winner) return; S.correct();
    const p = players.find(x => x.name === winner);
    if (p) { onAddScore(100, p.id); setScores(s => ({...s,[p.id]:(s[p.id]||0)+100})); }
    phaseRef.current = "idle"; winnerRef.current = null; disabledRef.current = [];
    setPhase("idle"); setWinner(null); setBuzzTime(null); setDisabled([]);
    pubState("idle", null, null, []);
  }

  function penaliseWrong() {
    if (!winner) return; S.wrong();
    const next = [...disabledRef.current, winner];
    disabledRef.current = next; winnerRef.current = null;
    setDisabled(next); setWinner(null); setBuzzTime(null);
    const remaining = players.filter(p => !next.includes(p.name));
    if (remaining.length === 0) {
      phaseRef.current = "idle"; setPhase("idle");
      pubState("idle", null, null, next);
    } else {
      phaseRef.current = "ready"; setPhase("ready");
      lStartRef.current = performance.now();
      pubState("ready", null, null, next);
    }
  }

  function resetAll() {
    clearInterval(cdRef.current); setCdPhase(false);
    phaseRef.current = "idle"; winnerRef.current = null; disabledRef.current = [];
    setPhase("idle"); setWinner(null); setBuzzTime(null); setDisabled([]);
    pubState("idle", null, null, []);
  }

  // ── Derived ───────────────────────────────────────────────────
  const displayPhase = cdPhase ? "countdown" : phase;
  const winPlayer    = players.find(p => p.name === winner);
  const playerUrl    = (p, i) =>
    `${window.location.origin}/buzz?team=${encodeURIComponent(p.name)}&ci=${i}&room=${roomCode}`;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.1rem" }}>
            <span style={{ color:"#ffe600", textShadow:"0 0 14px #ffe600" }}>🔔 BUZZER </span>
            <span style={{ color:"#00f5ff",  textShadow:"0 0 14px #00f5ff"  }}>MODE</span>
          </div>
          <div style={{ fontFamily:"Orbitron", fontSize:"0.47rem", color:"#1a2244", letterSpacing:"0.15em", marginTop:3 }}>
            {mqttConn ? "MULTI-DEVICE · PHONES CONNECTED VIA INTERNET" : "SINGLE SCREEN · CONNECTING…"}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:"50%",
              background: mqttConn?"#00ff90":"#ffe600",
              boxShadow: mqttConn?"0 0 8px #00ff90":"0 0 8px #ffe60080",
              animation: mqttConn?"none":"pulse 1s infinite",
            }}/>
            <span style={{ fontFamily:"Orbitron", fontSize:"0.48rem", color:mqttConn?"#00ff90":"#ffe600" }}>
              {mqttConn ? "LIVE" : "CONNECTING"}
            </span>
          </div>
          <button onClick={()=>setShowQR(q=>!q)}
            style={{ ...btn("#ffe600",true), fontSize:"0.55rem" }}>
            {showQR?"HIDE QR":"📱 QR CODES"}
          </button>
        </div>
      </div>

      {/* Room code + QR panel */}
      {showQR && (
        <div style={{ ...card("#ffe60030"), marginBottom:16, padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontFamily:"Orbitron", color:"#ffe600", fontSize:"0.6rem", letterSpacing:"0.1em" }}>
              📱 SCAN TO BUZZ FROM PHONE
            </div>
            <div style={{ fontFamily:"Orbitron", fontSize:"0.55rem", letterSpacing:"0.18em",
              color:"#00f5ff", textShadow:"0 0 10px #00f5ff",
              background:"#00f5ff14", border:"1px solid #00f5ff40", borderRadius:4, padding:"3px 10px" }}>
              ROOM: {roomCode}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:14 }}>
            {players.map((p, i) => {
              const col = BUZZER_COLORS[i % BUZZER_COLORS.length];
              return (
                <div key={p.id} style={{ textAlign:"center" }}>
                  <div style={{ display:"inline-block", padding:8, background:"#fff", borderRadius:6,
                    border:`3px solid ${col}`, boxShadow:`0 0 14px ${col}40` }}>
                    <QRCodeSVG value={playerUrl(p,i)} size={100} bgColor="#ffffff" fgColor="#07080f" level="M"/>
                  </div>
                  <div style={{ fontFamily:"Orbitron", color:col, fontSize:"0.6rem", marginTop:6, fontWeight:700 }}>{p.name}</div>
                  <div style={{ color:"#252e60", fontSize:"0.55rem", marginTop:2, wordBreak:"break-all" }}>
                    {window.location.hostname}/buzz
                  </div>
                </div>
              );
            })}
          </div>
          {!mqttConn && (
            <div style={{ fontFamily:"Orbitron", color:"#3a3010", fontSize:"0.52rem", marginTop:10, letterSpacing:"0.08em" }}>
              ⚡ CONNECTING TO BROKER… QR CODES WORK ONCE CONNECTED
            </div>
          )}
        </div>
      )}

      {/* Winner banner */}
      {displayPhase === "buzzed" && winPlayer && (
        <div style={{ background:"linear-gradient(135deg,#ffe60018,#00f5ff18)", border:"2px solid #ffe600",
          borderRadius:10, padding:"18px 20px", marginBottom:20, textAlign:"center",
          animation:"pop 0.4s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:"0 0 40px #ffe60050" }}>
          <div style={{ fontSize:"2.2rem", marginBottom:6 }}>🔔</div>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.4rem", color:"#ffe600",
            textShadow:"0 0 20px #ffe600", marginBottom:4 }}>{winPlayer.name}</div>
          <div style={{ fontFamily:"Orbitron", color:"#00f5ff", fontSize:"0.65rem", letterSpacing:"0.15em", marginBottom:8 }}>BUZZED IN FIRST!</div>
          <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.58rem" }}>⚡ {buzzTime}s reaction time</div>
        </div>
      )}

      {/* Countdown */}
      {displayPhase === "countdown" && (
        <div style={{ textAlign:"center", padding:"28px 0", marginBottom:20 }}>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"6rem", color:"#ffe600",
            textShadow:"0 0 50px #ffe600", animation:"countdownPop 0.35s ease" }}>{cd}</div>
          <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.65rem", letterSpacing:"0.2em", marginTop:8 }}>GET READY…</div>
        </div>
      )}

      {/* Ready banner */}
      {displayPhase === "ready" && (
        <div style={{ textAlign:"center", marginBottom:16, padding:"10px 0",
          fontFamily:"Orbitron", color:"#00ff90", fontSize:"0.85rem",
          letterSpacing:"0.25em", animation:"pulse 0.7s ease-in-out infinite",
          textShadow:"0 0 14px #00ff90" }}>
          {mqttConn ? "▶ BUZZ ON PHONE OR TAP BUTTON!" : "▶ TAP YOUR TEAM'S BUTTON!"}
        </div>
      )}

      {/* Buzzer buttons */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
        {players.map((p, i) => {
          const col      = BUZZER_COLORS[i % BUZZER_COLORS.length];
          const isWinner = winner === p.name;
          const isElim   = disabled.includes(p.name);
          const inactive = isElim || (winner && !isWinner) || displayPhase==="countdown" || displayPhase==="idle";
          const clickable = displayPhase==="ready" && !isElim && !winner;

          return (
            <button key={p.id}
              onClick={() => localBuzz(p)}
              disabled={!clickable && !isWinner}
              style={{
                width:"100%", minHeight:90, borderRadius:10,
                border:`3px solid ${isElim?"#1a2040":isWinner?col:col+"80"}`,
                background: isElim?"#07080f":isWinner?`${col}22`:displayPhase==="ready"?`${col}12`:`${col}08`,
                color: isElim?"#1a2040":isWinner?col:inactive?col+"40":col,
                fontFamily:"Orbitron", fontWeight:900, fontSize:"1.2rem", letterSpacing:"0.07em",
                cursor: clickable?"pointer":"default",
                textShadow: isWinner?`0 0 20px ${col}`:"none",
                boxShadow: isWinner?`0 0 30px ${col}60,0 0 70px ${col}30,inset 0 0 30px ${col}20`
                  : displayPhase==="ready"&&!inactive?`0 0 14px ${col}40`:"none",
                animation: isWinner?"buzzWin 0.5s ease,buzzerFlash 0.3s ease 0.5s 3"
                  : displayPhase==="ready"&&!inactive?"readyPulse 1.4s ease-in-out infinite":"none",
                display:"flex", alignItems:"center", gap:16, padding:"0 20px",
                position:"relative", overflow:"hidden", transition:"all 0.18s",
              }}>
              {isWinner && (
                <div style={{ position:"absolute",inset:0,pointerEvents:"none",
                  background:`linear-gradient(180deg,transparent 30%,${col}18 50%,transparent 70%)`,
                  animation:"scanMove 1.2s linear infinite" }}/>
              )}
              <span style={{ fontSize:"1.5rem" }}>{isElim?"✕":isWinner?"🔔":"◉"}</span>
              <div style={{ flex:1, textAlign:"left" }}>
                <div>{p.name}</div>
                <div style={{ fontFamily:"Rajdhani", fontSize:"0.82rem", fontWeight:600, opacity:0.55, marginTop:2 }}>
                  {isElim?"LOCKED OUT THIS ROUND"
                    :isWinner?"BUZZED FIRST!"
                    :displayPhase==="ready"?"TAP TO BUZZ!"
                    :"STANDBY"}
                </div>
              </div>
              <div style={{ fontFamily:"Orbitron", fontSize:"1rem", color:isElim?"#1a2040":col, opacity:isElim?0.3:1 }}>
                {scores[p.id]||0}
              </div>
            </button>
          );
        })}
      </div>

      {/* Host controls */}
      <div style={{ ...card("#1a2040"), marginBottom:18 }}>
        <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.58rem", letterSpacing:"0.12em", marginBottom:14 }}>🎙 HOST CONTROLS</div>
        {displayPhase==="idle" && (
          <button onClick={startRound}
            style={{ ...btn("#ffe600"), width:"100%", fontSize:"0.9rem", padding:"18px 0" }}>
            ▶ START ROUND
          </button>
        )}
        {displayPhase==="countdown" && (
          <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.7rem", textAlign:"center", padding:"12px 0", letterSpacing:"0.15em" }}>
            COUNTDOWN IN PROGRESS…
          </div>
        )}
        {displayPhase==="ready" && (
          <button onClick={resetAll} style={{ ...btn("#ff4060",true), width:"100%" }}>🔄 ABORT ROUND</button>
        )}
        {displayPhase==="buzzed" && (
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={awardCorrect} style={{ ...btn("#00ff90"), flex:1, fontSize:"0.7rem" }}>✅ CORRECT — +100 pts</button>
            <button onClick={penaliseWrong} style={{ ...btn("#ff4060"), flex:1, fontSize:"0.7rem" }}>❌ WRONG — NEXT TEAM</button>
            <button onClick={resetAll} style={{ ...btn("#252e60",true), width:"100%", fontSize:"0.62rem", marginTop:2 }}>🔄 RESET BUZZERS</button>
          </div>
        )}
      </div>

      {/* Live scores */}
      <div style={{ ...card("#ffe60020"), padding:"12px 16px" }}>
        <div style={{ fontFamily:"Orbitron", color:"#3a4060", fontSize:"0.56rem", letterSpacing:"0.12em", marginBottom:10 }}>LIVE SCORES</div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {[...players].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=>{
            const col  = BUZZER_COLORS[players.indexOf(p)%BUZZER_COLORS.length];
            const maxS = Math.max(1,...players.map(x=>scores[x.id]||0));
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.6rem", width:18 }}>#{i+1}</span>
                <span style={{ flex:1, fontWeight:600, color:"#c0d0f0" }}>{p.name}</span>
                <div style={{ background:"#070a12", borderRadius:4, padding:"3px 0", width:130, overflow:"hidden" }}>
                  <div style={{ height:6, borderRadius:4, background:col,
                    width:`${Math.min(100,((scores[p.id]||0)/maxS)*100)}%`,
                    transition:"width 0.6s ease", boxShadow:`0 0 8px ${col}60` }}/>
                </div>
                <span style={{ fontFamily:"Orbitron", color:col, fontSize:"0.75rem", minWidth:36, textAlign:"right" }}>{scores[p.id]||0}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
const EMOJIS=["🔥","👏","😮","🤯","💯","⚡","🚀","🎯","😂","❤️"];

export default function App() {
  const [screen,setScreen]=useState("intro");
  const [players,setPlayers]=useState([{id:1,name:"Team Alpha",score:0},{id:2,name:"Team Beta",score:0},{id:3,name:"Team Gamma",score:0}]);
  const [newName,setNewName]=useState("");
  const [reactions,setReactions]=useState([]);
  const [toast,setToast]=useState(null);
  const [confetti,setConfetti]=useState(false);
  const [iStep,setIStep]=useState(0);

  useEffect(()=>{ if(screen!=="intro") return; let i=0; const t=setInterval(()=>{i++;setIStep(i);if(i>=4)clearInterval(t);},700); return()=>clearInterval(t); },[screen]);

  function toast_(m,d=1600){setToast(m);setTimeout(()=>setToast(null),d);}
  function addS1(pts){setPlayers(ps=>ps.map((p,i)=>i===0?{...p,score:p.score+pts}:p));if(pts>0)toast_(`+${pts} pts! 🎉`);}
  function addS2(winnerIdx){setPlayers(ps=>ps.map((p,i)=>i===winnerIdx?{...p,score:p.score+100}:p));toast_("🏆 +100 pts! 🎉");}
  function addSB(pts,playerId){setPlayers(ps=>ps.map(p=>p.id===playerId?{...p,score:p.score+pts}:p));}
  function addPlayer(){if(!newName.trim())return;setPlayers(ps=>[...ps,{id:Date.now(),name:newName.trim(),score:0}]);setNewName("");toast_("Added! ✓");}
  function doReact(e){const id=Date.now(),x=Math.random()*80+5;setReactions(r=>[...r,{id,e,x}]);setTimeout(()=>setReactions(r=>r.filter(rx=>rx.id!==id)),2400);}
  function go(s){S.swoosh();setScreen(s);}
  function finale(){S.fanfare();setConfetti(true);setTimeout(()=>setConfetti(false),3500);setScreen("podium");}

  const GameCards=[
    {id:"quiz",icon:"🧠",title:"AI Quiz",sub:"Spin wheel · Lifelines · Streaks",c:"#00f5ff"},
    {id:"aiorhuman",icon:"🤖",title:"AI or Human?",sub:"Dramatic countdown reveal",c:"#ff00c8"},
    {id:"battle",icon:"⚔️",title:"Prompt Battle",sub:"Live typing · AI judges",c:"#ffe600"},
    {id:"buzzer",icon:"🔔",title:"Buzzer Mode",sub:"First to buzz · Host controls",c:"#00ff90"},
  ];

  return(
    <>
      <style>{CSS}</style>
      <div className="scanlines"/>
      <Particles/>
      <Confetti on={confetti}/>

      {/* Floating reactions */}
      {reactions.map(r=>(
        <div key={r.id} style={{position:"fixed",left:r.x+"%",bottom:"55px",fontSize:"2.2rem",
          pointerEvents:"none",zIndex:9990,animation:"floatUp 2.2s ease-out both"}}>{r.e}</div>
      ))}

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:20,right:20,zIndex:99999,
        background:"#00ff9020",border:"2px solid #00ff90",borderRadius:8,
        padding:"12px 24px",fontFamily:"Orbitron",color:"#00ff90",
        fontSize:"0.9rem",fontWeight:700,letterSpacing:"0.1em",
        boxShadow:"0 0 20px #00ff9040",animation:"pop 0.3s ease"}}>{toast}</div>}

      <div style={{maxWidth:760,margin:"0 auto",background:"rgba(7,8,15,0.88)",minHeight:"100vh",
        fontFamily:"Rajdhani,sans-serif",color:"#d0e0ff",position:"relative",zIndex:1}}>

        {/* ── INTRO ── */}
        {screen==="intro"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",textAlign:"center",padding:"24px"}}>
            {iStep>=1&&<div style={{fontFamily:"Orbitron",fontSize:"0.65rem",letterSpacing:"0.4em",color:"#1a2244",marginBottom:28,animation:"fadeUp 0.5s ease"}}>✦ WELCOME TO ✦</div>}
            {iStep>=2&&(
              <div style={{animation:"introIn 0.7s cubic-bezier(0.34,1.56,0.64,1)",marginBottom:20}}>
                <div style={{fontFamily:"Orbitron",fontWeight:900}}>
                  <div style={{fontSize:"3.2rem",color:"#00f5ff",textShadow:"0 0 50px #00f5ff,0 0 100px #00f5ff30",lineHeight:1}}>CHITTI</div>
                  <div style={{fontSize:"2.4rem",color:"#ff00c8",textShadow:"0 0 40px #ff00c8,0 0 80px #ff00c830",marginTop:2}}>TECH ARENA</div>
                </div>
                <div style={{fontFamily:"Orbitron",color:"#ffe600",fontSize:"0.85rem",letterSpacing:"0.35em",marginTop:14,textShadow:"0 0 12px #ffe600"}}>TECH GAME SHOW</div>
              </div>
            )}
            {iStep>=3&&<div style={{animation:"fadeUp 0.5s ease",color:"#1a2244",fontFamily:"Orbitron",fontSize:"0.62rem",letterSpacing:"0.15em",marginBottom:36}}>ANNUAL FUNCTION · POWERED BY CLAUDE AI</div>}
            {iStep>=4&&(
              <div style={{animation:"pop 0.6s cubic-bezier(0.34,1.56,0.64,1)"}}>
                <button onClick={()=>{S.fanfare();setConfetti(true);setTimeout(()=>{setConfetti(false);setScreen("hub");},400);}}
                  style={{...btn("#00f5ff"),fontSize:"1rem",padding:"18px 58px",animation:"glowPulse 2s ease infinite",letterSpacing:"0.2em"}}>
                  ▶ START THE SHOW
                </button>
                <div style={{color:"#1a2244",fontFamily:"Orbitron",fontSize:"0.55rem",marginTop:18,letterSpacing:"0.1em"}}>3 games · AI-powered · live audience</div>
              </div>
            )}
          </div>
        )}

        {/* ── HUB ── */}
        {screen==="hub"&&(
          <div>
            <div className="ticker-wrap">
              <div className="ticker-text">★ CHITTI TECH ARENA — AI GAME SHOW ★ POWERED BY CLAUDE AI ★ SPIN THE WHEEL · LIFELINES · PROMPT BATTLES · GRAND FINALE ★ MAY THE BEST TEAM WIN ★ ANNUAL FUNCTION {new Date().getFullYear()} ★</div>
            </div>
            <div style={{padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
                <div>
                  <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1.2rem"}}>
                    <span style={{color:"#00f5ff",textShadow:"0 0 14px #00f5ff"}}>CHITTI </span>
                    <span style={{color:"#ff00c8",textShadow:"0 0 14px #ff00c8"}}>TECH ARENA</span>
                  </div>
                  <div style={{fontFamily:"Orbitron",fontSize:"0.5rem",color:"#1a2244",letterSpacing:"0.15em"}}>ANNUAL FUNCTION · AI GAME SHOW</div>
                </div>
                <button style={{...btn("#ffe600",true),fontSize:"0.58rem"}} onClick={finale}>🏆 FINALE</button>
              </div>

              {/* Live score */}
              {players.some(p=>p.score>0)&&(
                <div style={{...card("#ffe60020"),marginBottom:16,padding:"12px 16px"}}>
                  <div style={{fontFamily:"Orbitron",color:"#3a4060",fontSize:"0.58rem",marginBottom:8,letterSpacing:"0.1em"}}>LIVE SCORES</div>
                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    {[...players].sort((a,b)=>b.score-a.score).map((p,i)=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:6}}>
                        <span>{"🥇🥈🥉"[i]||"·"}</span>
                        <span style={{fontWeight:600}}>{p.name}</span>
                        <span style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.75rem"}}>{p.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Game cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
                {GameCards.map(g=>(
                  <div key={g.id} onClick={()=>go(g.id)}
                    style={{background:"#0d1020",border:"2px solid #1a2040",borderRadius:10,padding:"20px 14px",
                      cursor:"pointer",transition:"all 0.22s",textAlign:"center"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=g.c;e.currentTarget.style.transform="translateY(-6px) scale(1.02)";e.currentTarget.style.boxShadow=`0 12px 32px ${g.c}28`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="#1a2040";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{fontSize:"2.2rem",marginBottom:10,animation:"float 3s ease-in-out infinite"}}>{g.icon}</div>
                    <div style={{fontFamily:"Orbitron",color:g.c,fontSize:"0.72rem",marginBottom:7}}>{g.title}</div>
                    <div style={{color:"#252e60",fontSize:"0.82rem",lineHeight:1.5,marginBottom:14}}>{g.sub}</div>
                    <div style={{fontFamily:"Orbitron",fontSize:"0.54rem",letterSpacing:"0.1em",padding:"5px 12px",border:`1px solid ${g.c}`,borderRadius:4,color:g.c,background:`${g.c}15`,display:"inline-block"}}>PLAY →</div>
                  </div>
                ))}
              </div>

              {/* Players */}
              <div style={{...card(),marginBottom:18}}>
                <div style={{fontFamily:"Orbitron",color:"#00ff90",fontSize:"0.65rem",marginBottom:14,letterSpacing:"0.1em"}}>👥 TEAMS & PLAYERS</div>
                <div style={{display:"flex",gap:10,marginBottom:12}}>
                  <input type="text" placeholder="Add team or player name…" value={newName}
                    onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()}
                    style={{background:"#070a12",border:"1.5px solid #1a2040",borderRadius:6,color:"#c0d8f8",
                      fontFamily:"Rajdhani",fontSize:"1rem",padding:"10px 14px",flex:1,outline:"none",transition:"border-color 0.2s"}}
                    onFocus={e=>e.target.style.borderColor="#00f5ff"} onBlur={e=>e.target.style.borderColor="#1a2040"}/>
                  <button style={{...btn("#00ff90",true),whiteSpace:"nowrap"}} onClick={addPlayer}>+ Add</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {players.map(p=>(
                    <div key={p.id} style={{padding:"5px 12px",borderRadius:20,border:"1px solid #1a2040",
                      background:"#070a12",fontSize:"0.9rem",display:"flex",alignItems:"center",gap:8}}>
                      <span>{p.name}</span>
                      <span style={{fontFamily:"Orbitron",color:"#00f5ff",fontSize:"0.65rem"}}>{p.score}</span>
                      <span style={{cursor:"pointer",color:"#1a2040",fontSize:"0.8rem"}} onClick={()=>setPlayers(ps=>ps.filter(x=>x.id!==p.id))}>✕</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reactions */}
              <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>
                {EMOJIS.map(e=>(
                  <button key={e} onClick={()=>doReact(e)}
                    style={{fontSize:"1.5rem",background:"none",border:"1.5px solid #1a2040",borderRadius:8,
                      padding:"7px 10px",cursor:"pointer",transition:"all 0.15s"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.3)";ev.currentTarget.style.background="#ffffff10";ev.currentTarget.style.borderColor="#ffffff20";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.transform="none";ev.currentTarget.style.background="none";ev.currentTarget.style.borderColor="#1a2040";}}>
                    {e}
                  </button>
                ))}
              </div>
              <div style={{textAlign:"center",marginTop:20,fontFamily:"Orbitron",fontSize:"0.48rem",letterSpacing:"0.18em",color:"#0f1224"}}>
                CHITTI TECH ARENA · POWERED BY CLAUDE AI · {new Date().getFullYear()}
              </div>
            </div>
          </div>
        )}

        {/* ── GAME SCREENS ── */}
        {["quiz","aiorhuman","battle","buzzer"].includes(screen)&&(
          <div>
            <div className="ticker-wrap">
              <div className="ticker-text">★ CHITTI TECH ARENA — AI GAME SHOW ★ ANNUAL FUNCTION {new Date().getFullYear()} ★ POWERED BY CLAUDE AI ★</div>
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div style={{fontFamily:"Orbitron",fontWeight:900,fontSize:"1rem"}}>
                  <span style={{color:"#00f5ff"}}>CHITTI </span><span style={{color:"#ff00c8"}}>TECH ARENA</span>
                </div>
                <button onClick={()=>go("hub")} style={{...btn("#00f5ff",true),fontSize:"0.58rem"}}>← HUB</button>
              </div>
              {screen==="quiz"&&<QuizGame onAddScore={addS1} onDone={finale}/>}
              {screen==="aiorhuman"&&<AiOrHuman onAddScore={addS1} onDone={finale}/>}
              {screen==="battle"&&<PromptBattle players={players} onAddScore={addS2} onDone={finale}/>}
              {screen==="buzzer"&&<BuzzerMode players={players} onAddScore={addSB} onDone={()=>go("hub")}/>}
              {/* Reaction bar */}
              <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:20,flexWrap:"wrap",borderTop:"1px solid #1a2040",paddingTop:14}}>
                {EMOJIS.slice(0,8).map(e=>(
                  <button key={e} onClick={()=>doReact(e)}
                    style={{fontSize:"1.4rem",background:"none",border:"1.5px solid #1a2040",borderRadius:8,padding:"6px 10px",cursor:"pointer",transition:"all 0.15s"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.28)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.transform="none";}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PODIUM ── */}
        {screen==="podium"&&(
          <div style={{padding:"20px 16px"}}>
            <Confetti on={confetti}/>
            <Podium players={players}/>
            <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28,flexWrap:"wrap"}}>
              <button style={btn("#00f5ff")} onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,score:0})));go("hub");toast_("New game! Scores reset ↺");}}>↺ NEW GAME</button>
              <button style={btn("#ffe600",true)} onClick={()=>go("hub")}>← BACK TO HUB</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
