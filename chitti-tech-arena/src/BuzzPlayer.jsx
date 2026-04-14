import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import mqtt from "mqtt";

const COLORS  = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7","#ec4899","#38bdf8"];
const MQTT_URL = "wss://broker.emqx.io:8084/mqtt";

const beep = (f, d, type = "sine", v = 0.4) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
    o.start(); o.stop(ctx.currentTime + d);
  } catch {}
};
const buzzerSound = () => {
  beep(80, 0.55, "sawtooth", 0.6);
  setTimeout(() => beep(60, 0.3, "sawtooth", 0.4), 120);
};
const dingSound = () => {
  [1047,1319,1568].forEach((f,i) => setTimeout(() => beep(f,0.15),i*70));
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#07080f;overflow:hidden;height:100dvh;}
  @keyframes readyGlow{0%,100%{opacity:0.85;transform:scale(1)}50%{opacity:1;transform:scale(1.015)}}
  @keyframes wonPop{0%{transform:scale(0.8)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes scanLine{0%{top:-100%}100%{top:100%}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
`;

export default function BuzzPlayer() {
  const [params] = useSearchParams();
  const team  = params.get("team") || "Player";
  const ci    = parseInt(params.get("ci") || "0", 10);
  const room  = params.get("room") || "";
  const color = COLORS[ci % COLORS.length];

  const [phase,         setPhase]         = useState("idle");
  const [winner,        setWinner]        = useState(null);
  const [buzzTime,      setBuzzTime]      = useState(null);
  const [disabledTeams, setDisabledTeams] = useState([]);
  const [connected,     setConnected]     = useState(false);
  const [awarded,       setAwarded]       = useState(false);
  const [noRoom,        setNoRoom]        = useState(!room);

  const mqttRef    = useRef(null);
  const buzzedRef  = useRef(false);
  const readyAtRef = useRef(null);
  const phaseRef   = useRef("idle");

  useEffect(() => {
    if (!room) return;

    const client = mqtt.connect(MQTT_URL, {
      clientId: `chitti_player_${Math.random().toString(36).substr(2,8)}`,
      clean: true, reconnectPeriod: 2000, connectTimeout: 8000,
    });
    mqttRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      client.subscribe(`chitti/${room}/state`, { qos: 0 });
      buzzedRef.current = false;
    });
    client.on("offline", () => setConnected(false));
    client.on("error",   () => {});

    client.on("message", (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        // Detect transition to ready → reset buzz lock + record timing
        if (msg.phase === "ready" && phaseRef.current !== "ready") {
          readyAtRef.current = Date.now();
          buzzedRef.current  = false;
          dingSound();
        }
        phaseRef.current = msg.phase;
        setPhase(msg.phase);
        setWinner(msg.winner);
        setBuzzTime(msg.buzzTime);
        setDisabledTeams(msg.disabledTeams || []);
        if (msg.phase === "idle") setAwarded(false);
        if (msg.winner === team && msg.phase === "buzzed") {
          setAwarded(true);
          setTimeout(() => setAwarded(false), 3000);
        }
      } catch {}
    });

    return () => client.end(true);
  }, [room, team]);

  function handleBuzz() {
    if (phaseRef.current !== "ready") return;
    if (disabledTeams.includes(team))  return;
    if (buzzedRef.current)             return;
    buzzedRef.current = true;
    const elapsed = readyAtRef.current
      ? ((Date.now() - readyAtRef.current) / 1000).toFixed(2)
      : "?";
    buzzerSound();
    try { navigator.vibrate?.(300); } catch {}
    mqttRef.current?.publish(
      `chitti/${room}/buzz`,
      JSON.stringify({ team, elapsed }),
      { qos: 0 }
    );
  }

  const isDisabled = disabledTeams.includes(team);
  const isWinner   = winner === team;
  const isLoser    = winner && winner !== team && !isDisabled;
  const canBuzz    = phase === "ready" && !isDisabled && !winner && connected;

  if (noRoom) return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", background:"#07080f", fontFamily:"Orbitron,sans-serif",
      color:"#252e60", textAlign:"center", padding:24, gap:16 }}>
      <style>{CSS}</style>
      <div style={{ fontSize:"3rem" }}>🔔</div>
      <div style={{ color:"#ff4060", fontSize:"0.8rem", letterSpacing:"0.1em" }}>NO ROOM CODE</div>
      <div style={{ fontSize:"0.75rem", color:"#1a2040" }}>Scan the QR code from the host screen</div>
    </div>
  );

  return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"space-between", background:"#07080f", padding:"24px 20px",
      userSelect:"none", fontFamily:"Rajdhani,sans-serif" }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"Orbitron", fontSize:"0.52rem", color:"#1a2244", letterSpacing:"0.2em" }}>
            CHITTI TECH ARENA · ROOM {room}
          </div>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.1rem",
            color:color, textShadow:`0 0 14px ${color}` }}>{team}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%",
            background:connected?"#00ff90":"#ffe600",
            boxShadow:connected?"0 0 8px #00ff90":"0 0 8px #ffe60080",
            animation:connected?"none":"blink 1s infinite" }}/>
          <span style={{ fontFamily:"Orbitron", fontSize:"0.5rem",
            color:connected?"#00ff90":"#ffe600" }}>
            {connected?"LIVE":"CONNECTING…"}
          </span>
        </div>
      </div>

      {/* Status message */}
      <div style={{ textAlign:"center", animation:"fadeUp 0.4s ease" }}>
        {!connected && (
          <>
            <div style={{ width:36,height:36,border:`3px solid #1a204040`,borderTopColor:color,
              borderRadius:"50%",animation:"spin 0.9s linear infinite",margin:"0 auto 16px" }}/>
            <div style={{ fontFamily:"Orbitron",color:"#252e60",fontSize:"0.7rem",letterSpacing:"0.15em" }}>
              CONNECTING…
            </div>
          </>
        )}
        {connected && phase==="idle" && !isDisabled && (
          <div style={{ fontFamily:"Orbitron",color:"#252e60",fontSize:"0.75rem",letterSpacing:"0.15em" }}>
            ⏳ WAITING FOR HOST TO START…
          </div>
        )}
        {connected && phase==="ready" && !isDisabled && !winner && (
          <div style={{ fontFamily:"Orbitron",color:"#00ff90",fontSize:"1rem",letterSpacing:"0.2em",
            textShadow:"0 0 14px #00ff90",animation:"blink 0.6s ease-in-out infinite" }}>
            ▶ TAP YOUR BUZZER!
          </div>
        )}
        {isWinner && (
          <div style={{ animation:"wonPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <div style={{ fontSize:"3rem",marginBottom:8 }}>🔔</div>
            <div style={{ fontFamily:"Orbitron",color:"#ffe600",fontSize:"1.1rem",textShadow:"0 0 20px #ffe600" }}>
              YOU BUZZED FIRST!
            </div>
            <div style={{ fontFamily:"Orbitron",color:"#252e60",fontSize:"0.62rem",marginTop:6 }}>
              ⚡ {buzzTime}s reaction
            </div>
            {awarded && (
              <div style={{ fontFamily:"Orbitron",color:"#00ff90",fontSize:"0.85rem",
                textShadow:"0 0 14px #00ff90",marginTop:8,animation:"wonPop 0.4s ease" }}>
                ✅ +100 PTS!
              </div>
            )}
          </div>
        )}
        {isLoser && (
          <div style={{ fontFamily:"Orbitron",color:"#ff4060",fontSize:"0.75rem",letterSpacing:"0.1em" }}>
            🔔 {winner} buzzed first
          </div>
        )}
        {isDisabled && (
          <div style={{ fontFamily:"Orbitron",color:"#252e60",fontSize:"0.75rem",letterSpacing:"0.1em" }}>
            ❌ LOCKED OUT THIS ROUND
          </div>
        )}
      </div>

      {/* THE BIG BUZZER BUTTON */}
      <button
        onPointerDown={handleBuzz}
        disabled={!canBuzz}
        style={{
          width:"min(340px,90vw)", height:"min(340px,90vw)", borderRadius:"50%",
          border:`5px solid ${isDisabled||isLoser?"#1a2040":color}`,
          background: isDisabled||isLoser
            ? "#0a0b12"
            : isWinner
              ? `radial-gradient(circle,${color}30 0%,${color}10 60%,transparent 100%)`
              : canBuzz
                ? `radial-gradient(circle,${color}20 0%,${color}08 60%,transparent 100%)`
                : `radial-gradient(circle,${color}0a 0%,transparent 100%)`,
          color: isDisabled||isLoser?"#1a2040":color,
          fontSize:"4rem", cursor:canBuzz?"pointer":"not-allowed",
          transition:"all 0.2s",
          animation: isWinner?"wonPop 0.5s ease"
            :canBuzz?"readyGlow 1.4s ease-in-out infinite":"none",
          boxShadow: isWinner?`0 0 60px ${color}80,0 0 120px ${color}40`
            :canBuzz?`0 0 30px ${color}40,0 0 70px ${color}20`:"none",
          display:"flex", alignItems:"center", justifyContent:"center",
          flexDirection:"column", gap:12,
          position:"relative", overflow:"hidden",
          WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
        }}>
        {canBuzz && (
          <div style={{ position:"absolute",left:0,right:0,height:"30%",
            background:`linear-gradient(180deg,transparent,${color}15,transparent)`,
            animation:"scanLine 2s linear infinite",pointerEvents:"none" }}/>
        )}
        <span>{isDisabled?"✕":isWinner?"🔔":isLoser?"🔇":"◉"}</span>
        <span style={{ fontFamily:"Orbitron",fontSize:"1rem",fontWeight:900,
          letterSpacing:"0.1em",color:isDisabled||isLoser?"#252e60":color }}>
          {isDisabled?"LOCKED":isWinner?"BUZZED!":isLoser?"TOO SLOW":phase==="idle"?"STANDBY":"BUZZ!"}
        </span>
      </button>

      <div style={{ fontFamily:"Orbitron",fontSize:"0.45rem",color:"#0f1224",letterSpacing:"0.2em",textAlign:"center" }}>
        CHITTI TECH ARENA · BUZZER MODE · ROOM {room}
      </div>
    </div>
  );
}
