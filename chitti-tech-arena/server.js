// ── CHITTI TECH ARENA — BUZZER WEBSOCKET SERVER ──────────────
import { WebSocketServer } from "ws";
import os from "os";

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

// ── Get local network IP so phones can connect ────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}
const SERVER_IP = getLocalIP();

// ── Game state ────────────────────────────────────────────────
let state = {
  phase: "idle",       // "idle" | "ready" | "buzzed"
  winner: null,        // team name string
  buzzTime: null,      // reaction time string e.g. "0.42"
  disabledTeams: [],   // teams locked out this round
  startTime: null,     // epoch ms when phase became "ready"
};

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(data); });
}

function sendState(ws) {
  ws.send(JSON.stringify({ type: "STATE", ...state, serverIp: SERVER_IP }));
}

// ── Connection handler ────────────────────────────────────────
wss.on("connection", ws => {
  sendState(ws); // new client gets current state immediately

  ws.on("message", raw => {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {

        case "BUZZ": {
          // Only accept first buzz when in ready phase
          if (state.phase !== "ready") break;
          if (state.winner) break;
          if (state.disabledTeams.includes(msg.team)) break;
          const elapsed = state.startTime
            ? ((Date.now() - state.startTime) / 1000).toFixed(2)
            : "?";
          state = { ...state, phase: "buzzed", winner: msg.team, buzzTime: elapsed };
          broadcast({ type: "STATE", ...state, serverIp: SERVER_IP });
          break;
        }

        case "SET_READY": {
          // Host started round (after countdown)
          state = { ...state, phase: "ready", winner: null, buzzTime: null, startTime: Date.now() };
          broadcast({ type: "STATE", ...state, serverIp: SERVER_IP });
          break;
        }

        case "DISABLE_TEAM": {
          // Wrong answer — disable this team, let others buzz
          const disabled = [...state.disabledTeams, msg.team];
          state = { ...state, phase: "ready", winner: null, buzzTime: null,
                    disabledTeams: disabled, startTime: Date.now() };
          broadcast({ type: "STATE", ...state, serverIp: SERVER_IP });
          break;
        }

        case "AWARD": {
          // Correct answer — reset round fully
          state = { phase: "idle", winner: null, buzzTime: null, disabledTeams: [], startTime: null };
          broadcast({ type: "AWARDED", team: msg.team, points: msg.points });
          broadcast({ type: "STATE", ...state, serverIp: SERVER_IP });
          break;
        }

        case "RESET": {
          state = { phase: "idle", winner: null, buzzTime: null, disabledTeams: [], startTime: null };
          broadcast({ type: "STATE", ...state, serverIp: SERVER_IP });
          break;
        }
      }
    } catch (e) {
      console.error("WS error:", e.message);
    }
  });
});

console.log(`\n🔔 Buzzer WS server → ws://localhost:${PORT}`);
console.log(`📱 Phone QR URL base → http://${SERVER_IP}:5173/buzz\n`);
