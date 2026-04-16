import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import mqtt from "mqtt";

const MQTT_URL = "wss://broker.emqx.io:8084/mqtt";
const COLORS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7"];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#07080f;overflow:hidden;height:100dvh;}
  @keyframes pop{0%{transform:scale(0.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

export default function VotePlayer() {
  const [params] = useSearchParams();
  const room  = params.get("room") || "";
  const teams = (params.get("teams") || "").split("|").filter(Boolean).map(decodeURIComponent);

  const [voted,     setVoted]     = useState(null);
  const [connected, setConnected] = useState(false);
  const mqttRef = useRef(null);

  useEffect(() => {
    if (!room) return;
    const client = mqtt.connect(MQTT_URL, {
      clientId: `chitti_voter_${Math.random().toString(36).substr(2,8)}`,
      clean: true, reconnectPeriod: 2000, connectTimeout: 8000,
    });
    mqttRef.current = client;
    client.on("connect", () => setConnected(true));
    client.on("offline", () => setConnected(false));
    return () => client.end(true);
  }, [room]);

  function vote(team) {
    if (voted || !connected) return;
    setVoted(team);
    mqttRef.current?.publish(
      `chitti/${room}/audvote`,
      JSON.stringify({ team }),
      { qos: 0 }
    );
  }

  if (!room || teams.length === 0) return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", background:"#07080f", fontFamily:"Orbitron,sans-serif",
      color:"#252e60", textAlign:"center", padding:24, gap:16 }}>
      <style>{CSS}</style>
      <div style={{ fontSize:"3rem" }}>🗳️</div>
      <div style={{ color:"#ff4060", fontSize:"0.8rem", letterSpacing:"0.1em" }}>INVALID VOTE LINK</div>
      <div style={{ fontSize:"0.7rem", color:"#1a2040" }}>Scan the QR code from the Prompt Battle screen</div>
    </div>
  );

  return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"space-between", background:"#07080f", padding:"28px 20px",
      fontFamily:"Rajdhani,sans-serif", userSelect:"none" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"0.75rem" }}>
            <span style={{ color:"#00f5ff" }}>CHITTI </span>
            <span style={{ color:"#ff00c8" }}>TECH ARENA</span>
          </div>
          <div style={{ fontFamily:"Orbitron", fontSize:"0.45rem", color:"#1a2244", letterSpacing:"0.15em", marginTop:2 }}>
            ⚔️ PROMPT BATTLE · AUDIENCE VOTE
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:"50%",
            background: connected ? "#00ff90" : "#ffe600",
            boxShadow: connected ? "0 0 8px #00ff90" : "0 0 8px #ffe60080" }}/>
          <span style={{ fontFamily:"Orbitron", fontSize:"0.46rem", color: connected ? "#00ff90" : "#ffe600" }}>
            {connected ? "LIVE" : "CONNECTING…"}
          </span>
        </div>
      </div>

      {/* Vote area */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", width:"100%", gap:16, animation:"fadeUp 0.4s ease" }}>

        {!voted ? (
          <>
            <div style={{ fontFamily:"Orbitron", color:"#ffe600", fontSize:"0.85rem",
              letterSpacing:"0.15em", textShadow:"0 0 14px #ffe600", marginBottom:8 }}>
              🗳️ VOTE FOR BEST!
            </div>
            <div style={{ fontFamily:"Rajdhani", color:"#3040a0", fontSize:"0.95rem", marginBottom:16 }}>
              Who had the best response?
            </div>
            {teams.map((team, i) => {
              const col = COLORS[i % COLORS.length];
              return (
                <button key={team} onClick={() => vote(team)}
                  disabled={!connected}
                  style={{
                    width: "min(360px,90vw)", padding:"22px 20px", borderRadius:12,
                    border: `2px solid ${col}`, background: `${col}12`,
                    color: col, fontFamily:"Orbitron", fontWeight:900, fontSize:"1.1rem",
                    letterSpacing:"0.05em", cursor: connected ? "pointer" : "not-allowed",
                    textShadow: `0 0 12px ${col}80`,
                    boxShadow: `0 0 20px ${col}30`,
                    transition:"all 0.18s",
                  }}
                  onPointerDown={e => { e.currentTarget.style.transform="scale(0.96)"; }}
                  onPointerUp={e => { e.currentTarget.style.transform="scale(1)"; }}>
                  {team}
                </button>
              );
            })}
            {!connected && (
              <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.55rem",
                letterSpacing:"0.1em", marginTop:8 }}>
                Connecting to server…
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign:"center", animation:"pop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <div style={{ fontSize:"4rem", marginBottom:16, animation:"float 2s ease-in-out infinite" }}>✅</div>
            <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.2rem",
              color:"#00ff90", textShadow:"0 0 20px #00ff90", marginBottom:10 }}>
              VOTE CAST!
            </div>
            <div style={{ fontFamily:"Orbitron", color:"#252e60", fontSize:"0.65rem", letterSpacing:"0.1em", marginBottom:6 }}>
              YOU VOTED FOR
            </div>
            <div style={{ fontFamily:"Orbitron", fontWeight:900, fontSize:"1.1rem",
              color: COLORS[teams.indexOf(voted) % COLORS.length],
              textShadow: `0 0 14px ${COLORS[teams.indexOf(voted) % COLORS.length]}` }}>
              {voted}
            </div>
          </div>
        )}
      </div>

      <div style={{ fontFamily:"Orbitron", fontSize:"0.42rem", color:"#0f1224",
        letterSpacing:"0.18em", textAlign:"center" }}>
        CHITTI TECH ARENA · AUDIENCE VOTE · ROOM {room}
      </div>
    </div>
  );
}
