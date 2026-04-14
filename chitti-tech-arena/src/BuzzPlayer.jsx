import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

const COLORS = ["#00f5ff","#ff00c8","#ffe600","#00ff90","#ff6b35","#a855f7","#ec4899","#38bdf8"];

// Minimal sound — works on mobile with user gesture
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
  [1047, 1319, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 70));
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #07080f; overflow: hidden; height: 100dvh; }
  @keyframes buzzPulse { 0%,100% { box-shadow: 0 0 30px currentColor, 0 0 80px currentColor; } 50% { box-shadow: 0 0 60px currentColor, 0 0 160px currentColor, 0 0 0px currentColor inset; } }
  @keyframes readyGlow { 0%,100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.015); } }
  @keyframes wonPop { 0% { transform: scale(0.8); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
  @keyframes fadeUp { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes scanLine { 0% { top: -100%; } 100% { top: 100%; } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
`;

export default function BuzzPlayer() {
  const [params] = useSearchParams();
  const team  = params.get("team") || "Player";
  const ci    = parseInt(params.get("ci") || "0", 10);
  const color = COLORS[ci % COLORS.length];

  // State driven entirely by WS messages from server
  const [phase,         setPhase]         = useState("idle");
  const [winner,        setWinner]        = useState(null);
  const [buzzTime,      setBuzzTime]      = useState(null);
  const [disabledTeams, setDisabledTeams] = useState([]);
  const [connected,     setConnected]     = useState(false);
  const [awarded,       setAwarded]       = useState(false);
  const wsRef    = useRef(null);
  const buzzedRef = useRef(false); // prevent double-fire

  // ── WebSocket connection ──────────────────────────────────────
  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connect() {
      const url = `ws://${window.location.hostname}:3001`;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen  = () => { setConnected(true); buzzedRef.current = false; };
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if (msg.type === "STATE") {
          setPhase(msg.phase);
          setWinner(msg.winner);
          setBuzzTime(msg.buzzTime);
          setDisabledTeams(msg.disabledTeams || []);
          setAwarded(false);
          if (msg.phase === "ready") buzzedRef.current = false;
        }
        if (msg.type === "AWARDED") {
          if (msg.team === team) { setAwarded(true); dingSound(); }
          setTimeout(() => setAwarded(false), 3000);
        }
      };
    }

    connect();
    return () => { ws?.close(); clearTimeout(reconnectTimer); };
  }, [team]);

  // ── Buzz action ──────────────────────────────────────────────
  function handleBuzz() {
    if (phase !== "ready") return;
    if (disabledTeams.includes(team)) return;
    if (buzzedRef.current) return;
    buzzedRef.current = true;
    buzzerSound();
    try { navigator.vibrate?.(300); } catch {}
    wsRef.current?.send(JSON.stringify({ type: "BUZZ", team }));
  }

  // ── Derived display state ─────────────────────────────────────
  const isDisabled  = disabledTeams.includes(team);
  const isWinner    = winner === team;
  const isLoser     = winner && winner !== team && !isDisabled;
  const canBuzz     = phase === "ready" && !isDisabled && !winner && connected;

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      background: "#07080f", padding: "24px 20px", userSelect: "none",
      fontFamily: "Rajdhani, sans-serif",
    }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "Orbitron", fontSize: "0.55rem", color: "#1a2244", letterSpacing: "0.2em" }}>CHITTI TECH ARENA</div>
          <div style={{ fontFamily: "Orbitron", fontWeight: 900, fontSize: "1.1rem", color: color, textShadow: `0 0 14px ${color}` }}>{team}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "#00ff90" : "#ff4060",
            boxShadow: connected ? "0 0 8px #00ff90" : "0 0 8px #ff4060",
            animation: connected ? "none" : "blink 1s infinite",
          }}/>
          <span style={{ fontFamily: "Orbitron", fontSize: "0.5rem", color: connected ? "#00ff90" : "#ff4060" }}>
            {connected ? "LIVE" : "CONNECTING…"}
          </span>
        </div>
      </div>

      {/* Status message */}
      <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease" }}>
        {!connected && (
          <>
            <div style={{ width: 36, height: 36, border: `3px solid #1a204040`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 16px" }}/>
            <div style={{ fontFamily: "Orbitron", color: "#252e60", fontSize: "0.7rem", letterSpacing: "0.15em" }}>CONNECTING TO GAME…</div>
          </>
        )}
        {connected && phase === "idle" && !isDisabled && (
          <div style={{ fontFamily: "Orbitron", color: "#252e60", fontSize: "0.75rem", letterSpacing: "0.15em" }}>⏳ WAITING FOR HOST TO START…</div>
        )}
        {connected && phase === "ready" && !isDisabled && !winner && (
          <div style={{ fontFamily: "Orbitron", color: "#00ff90", fontSize: "1rem", letterSpacing: "0.2em", textShadow: "0 0 14px #00ff90", animation: "blink 0.6s ease-in-out infinite" }}>▶ TAP YOUR BUZZER!</div>
        )}
        {isWinner && (
          <div style={{ animation: "wonPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>🔔</div>
            <div style={{ fontFamily: "Orbitron", color: "#ffe600", fontSize: "1.1rem", textShadow: "0 0 20px #ffe600" }}>YOU BUZZED FIRST!</div>
            <div style={{ fontFamily: "Orbitron", color: "#252e60", fontSize: "0.62rem", marginTop: 6 }}>⚡ {buzzTime}s reaction</div>
          </div>
        )}
        {isLoser && (
          <div style={{ fontFamily: "Orbitron", color: "#ff4060", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            🔔 {winner} buzzed first
          </div>
        )}
        {isDisabled && (
          <div style={{ fontFamily: "Orbitron", color: "#252e60", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            ❌ YOUR TEAM IS LOCKED OUT
          </div>
        )}
        {awarded && (
          <div style={{ fontFamily: "Orbitron", color: "#00ff90", fontSize: "1rem", textShadow: "0 0 14px #00ff90", animation: "wonPop 0.4s ease" }}>
            ✅ +100 PTS AWARDED!
          </div>
        )}
      </div>

      {/* THE BIG BUZZER BUTTON */}
      <button
        onPointerDown={handleBuzz}
        disabled={!canBuzz}
        style={{
          width: "min(340px, 90vw)",
          height: "min(340px, 90vw)",
          borderRadius: "50%",
          border: `5px solid ${isDisabled || isLoser ? "#1a2040" : color}`,
          background: isDisabled || isLoser
            ? "#0a0b12"
            : isWinner
              ? `radial-gradient(circle, ${color}30 0%, ${color}10 60%, transparent 100%)`
              : canBuzz
                ? `radial-gradient(circle, ${color}20 0%, ${color}08 60%, transparent 100%)`
                : `radial-gradient(circle, ${color}0a 0%, transparent 100%)`,
          color: isDisabled || isLoser ? "#1a2040" : color,
          fontSize: "4rem",
          cursor: canBuzz ? "pointer" : "not-allowed",
          transition: "all 0.2s",
          animation: isWinner
            ? "wonPop 0.5s ease"
            : canBuzz
              ? "readyGlow 1.4s ease-in-out infinite"
              : "none",
          boxShadow: isWinner
            ? `0 0 60px ${color}80, 0 0 120px ${color}40`
            : canBuzz
              ? `0 0 30px ${color}40, 0 0 70px ${color}20`
              : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 12,
          position: "relative", overflow: "hidden",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {/* Scan line when active */}
        {canBuzz && (
          <div style={{
            position: "absolute", left: 0, right: 0, height: "30%",
            background: `linear-gradient(180deg, transparent, ${color}15, transparent)`,
            animation: "scanLine 2s linear infinite", pointerEvents: "none",
          }}/>
        )}
        <span>{isDisabled ? "✕" : isWinner ? "🔔" : isLoser ? "🔇" : "◉"}</span>
        <span style={{
          fontFamily: "Orbitron", fontSize: "1rem", fontWeight: 900,
          letterSpacing: "0.1em", color: isDisabled || isLoser ? "#252e60" : color,
        }}>
          {isDisabled ? "LOCKED" : isWinner ? "BUZZED!" : isLoser ? "TOO SLOW" : phase === "idle" ? "STANDBY" : "BUZZ!"}
        </span>
      </button>

      {/* Bottom tip */}
      <div style={{ fontFamily: "Orbitron", fontSize: "0.45rem", color: "#0f1224", letterSpacing: "0.2em", textAlign: "center" }}>
        CHITTI TECH ARENA · BUZZER MODE
      </div>
    </div>
  );
}
