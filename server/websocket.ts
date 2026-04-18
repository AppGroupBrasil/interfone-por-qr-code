/**
 * ═══════════════════════════════════════════════════════════
 * INTERFONE DIGITAL — WebSocket Signaling Server
 * Handles WebRTC signaling (offer/answer/ICE candidates)
 * and call state management between visitor ↔ morador
 * ═══════════════════════════════════════════════════════════
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import db, { type DbUser } from "./db.js";
import { sendPushToUser } from "./pushService.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-32chars!!";
const COOKIE_NAME = "session_token";

/** Parse a specific cookie from the raw Cookie header */
function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/** Verify JWT from WebSocket upgrade request and return user or null.
 *  Checks: 1) ?token= query param (Capacitor), 2) Cookie header (web)
 *  Handles both regular user tokens ({ userId }) and funcionario tokens ({ funcId }) */
function authenticateWs(req: IncomingMessage): DbUser | null {
  const cookieToken = parseCookie(req.headers.cookie, COOKIE_NAME);

  const resolveUserFromToken = (token: string | null): DbUser | null => {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number; funcId?: number };

    if (decoded.userId) {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.userId) as DbUser | undefined;
      return user || null;
    }

    if (decoded.funcId) {
      const func = db.prepare("SELECT * FROM funcionarios WHERE id = ?").get(decoded.funcId) as any;
      if (!func) return null;
      return {
        id: func.id,
        name: `${func.nome} ${func.sobrenome || ""}`.trim(),
        email: func.login,
        password: func.password,
        role: "funcionario",
        perfil: func.cargo || null,
        condominio_id: func.condominio_id,
        parent_administradora_id: null,
        avatar_url: null,
        block: null,
        unit: null,
        phone: null,
        cpf: null,
        created_at: func.created_at || "",
        updated_at: func.updated_at || "",
      } as DbUser;
    }

    return null;
  };

  try {
    // 1) Try token from query string (Capacitor / mobile app)
    let token: string | null = null;
    try {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      token = url.searchParams.get("token");
    } catch {}

    if (token) {
      try {
        return resolveUserFromToken(token);
      } catch {
        token = null;
      }
    }

    // 2) Fall back to cookie (web browser)
    return resolveUserFromToken(cookieToken);
  } catch {
    return null;
  }
}

interface WsClient {
  ws: WebSocket;
  type: "visitor" | "morador" | "funcionario";
  moradorId?: number;
  callId?: string;
  condominioId?: number;
  userId?: number;
}

// Active connections indexed by a unique key
const clients = new Map<string, WsClient>();
// Morador connections indexed by moradorId for incoming calls
const moradorConnections = new Map<number, WsClient>();
// Funcionario connections indexed by condominioId for portaria calls
const funcionarioConnections = new Map<number, WsClient[]>();
// Pending call handoffs — morador switching from GlobalIncomingCall WS to MoradorInterfone WS
const pendingHandoffs = new Map<number, { callId: string; timestamp: number }>();
// Pending push calls — visitor waiting for morador to come online after push notification
const pendingPushCalls = new Map<string, { callId: string; visitorClientId: string; moradorId: number; visitanteNome: string; visitanteEmpresa: string | null; visitanteFoto: string | null; nivelSeguranca: number; bloco: string; apartamento: string; timestamp: number; isInternal?: boolean; callerRole?: string }>();

export function initSignalingServer(_server?: Server) {
  const isProd = process.env.NODE_ENV === "production";
  let wss: WebSocketServer;

  if (isProd && _server) {
    // Production: attach to main HTTP server (same port, path-based routing)
    wss = new WebSocketServer({ server: _server, path: "/ws/interfone", perMessageDeflate: false });
    console.log(`  📞 Interfone WebSocket attached to main server at /ws/interfone`);
  } else {
    // Dev: standalone server on dedicated port to avoid Vite proxy frame corruption
    const certsDir = path.resolve(process.cwd(), "certs");
    const hasCerts = fs.existsSync(path.join(certsDir, "key.pem")) && fs.existsSync(path.join(certsDir, "cert.pem"));

    const wsHttpServer = hasCerts
      ? https.createServer({
          key: fs.readFileSync(path.join(certsDir, "key.pem")),
          cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
        }, (_req, res) => {
          res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
          res.end("WSS server");
        })
      : http.createServer((_req, res) => {
          res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
          res.end("WS server");
        });

    wss = new WebSocketServer({ server: wsHttpServer, path: "/ws/interfone", perMessageDeflate: false });

    const WS_PORT = parseInt(process.env.WS_PORT || "3002");
    wsHttpServer.listen(WS_PORT, "0.0.0.0", () => {
      console.log(`  📞 Interfone WebSocket ready at ${hasCerts ? 'wss' : 'ws'}://0.0.0.0:${WS_PORT}/ws/interfone`);
    });
  }

  // ─── Ping/Pong keepalive — prevents idle timeout from Traefik/proxies ───
  const PING_INTERVAL = 25_000; // 25 seconds
  const PONG_TIMEOUT = 10_000;  // 10 seconds grace to respond
  const aliveClients = new Set<WebSocket>();

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!aliveClients.has(ws)) {
        // Didn't respond to previous ping — terminate
        ws.terminate();
        return;
      }
      aliveClients.delete(ws);
      try { ws.ping(); } catch {}
    });
  }, PING_INTERVAL);

  wss.on("close", () => clearInterval(pingInterval));

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    let clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`  [WS] New connection: ${clientId} from ${req.headers.origin || "no-origin"} url=${req.url?.substring(0,80)}`);

    // Mark as alive on connect
    aliveClients.add(ws);
    ws.on("pong", () => { aliveClients.add(ws); });

    // Try to authenticate — visitors won't have credentials
    const authUser = authenticateWs(req);
    console.log(`  [WS] Auth: ${authUser ? `userId=${authUser.id} role=${authUser.role}` : "anonymous"}`);
    const client: WsClient = { ws, type: "visitor", userId: authUser?.id };
    clients.set(clientId, client);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          // ─── Application-level heartbeat (keeps Traefik/proxy alive) ───
          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }

          // ─── Morador registers for incoming calls ───
          case "register-morador": {
            // Require authentication — moradorId must match the authenticated user
            if (!authUser || authUser.id !== msg.moradorId) {
              ws.send(JSON.stringify({ type: "error", message: "Não autenticado." }));
              ws.close(4001, "Unauthorized");
              return;
            }
            client.type = "morador";
            client.moradorId = authUser.id;
            client.condominioId = authUser.condominio_id ?? undefined;
            moradorConnections.set(authUser.id, client);

            // Check for pending call handoff (GlobalIncomingCall → MoradorInterfone)
            const handoff = pendingHandoffs.get(authUser.id);
            if (handoff && (Date.now() - handoff.timestamp < 15000)) {
              client.callId = handoff.callId;
              pendingHandoffs.delete(authUser.id);
              console.log(`  [WS] Handoff resumed: moradorId=${authUser.id} callId=${handoff.callId}`);
              ws.send(JSON.stringify({ type: "registered", moradorId: authUser.id }));
              ws.send(JSON.stringify({ type: "call-resumed", callId: handoff.callId }));

              // Notify the peer (visitor/portaria) to resend WebRTC offer
              const peer = findPeerByCallId(handoff.callId, clientId);
              if (peer) {
                console.log(`  [WS] Asking peer to resend offer for callId=${handoff.callId}`);
                peer.ws.send(JSON.stringify({ type: "resend-offer", callId: handoff.callId }));
              }
            } else {
              pendingHandoffs.delete(authUser.id); // clean up expired
              ws.send(JSON.stringify({ type: "registered", moradorId: authUser.id }));
            }

            // Check for pending push call (visitor or portaria called while morador was offline)
            for (const [pcCallId, pc] of pendingPushCalls) {
              if (pc.moradorId === authUser.id && (Date.now() - pc.timestamp < 120000)) {
                console.log(`  [WS] Push call found: moradorId=${authUser.id} callId=${pcCallId} internal=${!!pc.isInternal}`);
                client.callId = pcCallId;
                pendingPushCalls.delete(pcCallId);
                if (pc.isInternal) {
                  // Internal call from portaria — deliver as internal-incoming-call
                  ws.send(JSON.stringify({
                    type: "internal-incoming-call",
                    callId: pcCallId,
                    callerName: pc.visitanteNome,
                    callerRole: pc.callerRole || "funcionario",
                    callerClientId: pc.visitorClientId,
                  }));
                } else {
                  // Visitor call — deliver as incoming-call
                  ws.send(JSON.stringify({
                    type: "incoming-call",
                    callId: pcCallId,
                    visitanteNome: pc.visitanteNome,
                    visitanteEmpresa: pc.visitanteEmpresa,
                    visitanteFoto: pc.visitanteFoto,
                    nivelSeguranca: pc.nivelSeguranca,
                    bloco: pc.bloco,
                    apartamento: pc.apartamento,
                    visitorClientId: pc.visitorClientId,
                  }));
                }
                break;
              }
            }
            break;
          }

          // ─── Funcionário registers for portaria calls ───
          case "register-funcionario": {
            // Require authentication — funcionarioId must match the authenticated user
            if (!authUser || authUser.id !== msg.funcionarioId) {
              ws.send(JSON.stringify({ type: "error", message: "Não autenticado." }));
              ws.close(4001, "Unauthorized");
              return;
            }
            client.type = "funcionario";
            client.moradorId = authUser.id;
            client.condominioId = authUser.condominio_id ?? undefined;
            moradorConnections.set(authUser.id, client);
            // Also add to funcionario pool by condominio
            if (authUser.condominio_id && !funcionarioConnections.has(authUser.condominio_id)) {
              funcionarioConnections.set(authUser.condominio_id, []);
            }
            if (authUser.condominio_id) {
              funcionarioConnections.get(authUser.condominio_id)!.push(client);
            }
            ws.send(JSON.stringify({ type: "registered-funcionario", funcionarioId: authUser.id }));
            break;
          }

          // ─── Visitor calls portaria directly (no security) ───
          case "portaria-call": {
            const { condominioId: cId, callId: pCallId, visitanteNome: pNome, bloco: pBloco } = msg;
            client.callId = pCallId;
            client.type = "visitor";

            // Find any online funcionario for this condominium
            const funcPool = funcionarioConnections.get(cId) || [];
            const onlineFunc = funcPool.find(f => f.ws.readyState === WebSocket.OPEN);
            if (onlineFunc) {
              onlineFunc.callId = pCallId;
              onlineFunc.ws.send(JSON.stringify({
                type: "incoming-call",
                callId: pCallId,
                visitanteNome: pNome || "Visitante",
                visitanteEmpresa: null,
                visitanteFoto: null,
                nivelSeguranca: 0,
                bloco: pBloco,
                apartamento: "PORTARIA",
                visitorClientId: clientId,
                isPortariaCall: true,
              }));
            } else {
              ws.send(JSON.stringify({ type: "call-unavailable", callId: pCallId, reason: "portaria_offline" }));
            }
            break;
          }

          // ─── Visitor initiates call to morador ───
          case "call-request": {
            const { moradorId, callId, visitanteNome, visitanteEmpresa, visitanteFoto, nivelSeguranca, bloco, apartamento } = msg;
            client.callId = callId;
            client.type = "visitor";

            const moradorClient = moradorConnections.get(moradorId);
            if (moradorClient && moradorClient.ws.readyState === WebSocket.OPEN) {
              moradorClient.callId = callId;
              moradorClient.ws.send(JSON.stringify({
                type: "incoming-call",
                callId,
                visitanteNome,
                visitanteEmpresa,
                visitanteFoto,
                nivelSeguranca,
                bloco,
                apartamento,
                visitorClientId: clientId,
              }));
            } else {
              // Morador offline — send push notification and keep visitor waiting
              console.log(`  [WS] Morador ${moradorId} offline, sending push notification...`);
              pendingPushCalls.set(callId, {
                callId, visitorClientId: clientId, moradorId,
                visitanteNome: visitanteNome || "Visitante",
                visitanteEmpresa: visitanteEmpresa || null,
                visitanteFoto: visitanteFoto || null,
                nivelSeguranca: nivelSeguranca || 0,
                bloco: bloco || "", apartamento: apartamento || "",
                timestamp: Date.now(),
              });
              // Send push via FCM
              sendPushToUser(moradorId, {
                title: "\uD83D\uDCDE Chamada do Interfone",
                body: `${visitanteNome || "Visitante"} está chamando no interfone`,
                data: { type: "interfone-call", callId, moradorId: String(moradorId) },
                channelId: "interfone_calls",
                sound: "ringtone",
              }).then((sent) => {
                console.log(`  [WS] Push sent to moradorId=${moradorId}: ${sent} device(s)`);
                if (sent === 0) {
                  // No push tokens — morador truly unreachable
                  pendingPushCalls.delete(callId);
                  ws.send(JSON.stringify({ type: "call-unavailable", callId, reason: "morador_offline" }));
                } else {
                  // Tell visitor to keep waiting
                  ws.send(JSON.stringify({ type: "call-waiting-push", callId }));
                }
              }).catch(() => {
                pendingPushCalls.delete(callId);
                ws.send(JSON.stringify({ type: "call-unavailable", callId, reason: "morador_offline" }));
              });
            }
            break;
          }

          // ─── Authorization request (Level 3) ───
          case "auth-request": {
            const moradorClient2 = moradorConnections.get(msg.moradorId);
            if (moradorClient2 && moradorClient2.ws.readyState === WebSocket.OPEN) {
              moradorClient2.ws.send(JSON.stringify({
                type: "auth-request",
                callId: msg.callId,
                visitanteNome: msg.visitanteNome,
                visitanteEmpresa: msg.visitanteEmpresa,
                visitanteFoto: msg.visitanteFoto,
                visitorClientId: clientId,
              }));
            } else {
              ws.send(JSON.stringify({ type: "auth-rejected", callId: msg.callId, reason: "morador_offline" }));
            }
            break;
          }

          // ─── Morador accepts authorization (Level 3) ───
          case "auth-accepted": {
            const visitorClient = findClientById(msg.visitorClientId);
            if (visitorClient) {
              visitorClient.ws.send(JSON.stringify({ type: "auth-accepted", callId: msg.callId }));
            }
            break;
          }

          // ─── Morador rejects authorization ───
          case "auth-rejected": {
            const visitorClient2 = findClientById(msg.visitorClientId);
            if (visitorClient2) {
              visitorClient2.ws.send(JSON.stringify({ type: "auth-rejected", callId: msg.callId, reason: "rejected" }));
            }
            break;
          }

          // ─── Answer call (works for external AND internal calls) ───
          case "call-answer": {
            // Ensure this client has the callId set (for handoff scenarios)
            if (msg.callId && !client.callId) {
              client.callId = msg.callId;
            }
            const answerPeer = findPeerByCallId(msg.callId, clientId);
            if (answerPeer) {
              answerPeer.ws.send(JSON.stringify({ type: "call-answered", callId: msg.callId }));
            }
            break;
          }

          // ─── Call handoff (GlobalIncomingCall → MoradorInterfone page) ───
          case "call-handoff": {
            if (client.moradorId && client.callId) {
              console.log(`  [WS] Call handoff: moradorId=${client.moradorId} callId=${client.callId}`);
              pendingHandoffs.set(client.moradorId, { callId: client.callId, timestamp: Date.now() });
              client.callId = undefined; // prevent close handler from ending the call
            }
            break;
          }

          // ─── Reject call (works for external AND internal calls) ───
          case "call-reject": {
            const rejectPeer = findPeerByCallId(msg.callId, clientId);
            if (rejectPeer) {
              rejectPeer.ws.send(JSON.stringify({ type: "call-rejected", callId: msg.callId }));
            }
            break;
          }

          // ─── WebRTC Offer ───
          case "webrtc-offer": {
            let target: WsClient | undefined;
            if (msg.targetType === "morador") {
              target = findClientByCallId(msg.callId, "morador");
            } else if (msg.targetType === "funcionario") {
              target = findClientByCallId(msg.callId, "funcionario");
            } else {
              target = findClientByCallId(msg.callId, "visitor");
            }
            if (!target) target = findPeerByCallId(msg.callId, clientId);
            if (target) {
              target.ws.send(JSON.stringify({ type: "webrtc-offer", callId: msg.callId, offer: msg.offer }));
            }
            break;
          }

          // ─── WebRTC Answer ───
          case "webrtc-answer": {
            let target2: WsClient | undefined;
            if (msg.targetType === "visitor") {
              target2 = findClientByCallId(msg.callId, "visitor");
            } else if (msg.targetType === "funcionario") {
              target2 = findClientByCallId(msg.callId, "funcionario");
            } else if (msg.targetType === "morador") {
              target2 = findClientByCallId(msg.callId, "morador");
            }
            if (!target2) target2 = findPeerByCallId(msg.callId, clientId);
            if (target2) {
              target2.ws.send(JSON.stringify({ type: "webrtc-answer", callId: msg.callId, answer: msg.answer }));
            }
            break;
          }

          // ─── ICE Candidate ───
          case "ice-candidate": {
            let target3: WsClient | undefined;
            if (msg.targetType === "morador") {
              target3 = findClientByCallId(msg.callId, "morador");
            } else if (msg.targetType === "funcionario") {
              target3 = findClientByCallId(msg.callId, "funcionario");
            } else {
              target3 = findClientByCallId(msg.callId, "visitor");
            }
            if (!target3) target3 = findPeerByCallId(msg.callId, clientId);
            if (target3) {
              target3.ws.send(JSON.stringify({ type: "ice-candidate", callId: msg.callId, candidate: msg.candidate }));
            }
            break;
          }

          // ─── End call (generic — finds peer by callId) ───
          case "call-end": {
            const endPeer = findPeerByCallId(msg.callId, clientId);
            if (endPeer) {
              endPeer.ws.send(JSON.stringify({ type: "call-ended", callId: msg.callId }));
            }
            break;
          }

          // ─── Open gate command ───
          case "open-gate": {
            const visitorGate = findClientByCallId(msg.callId, "visitor");
            if (visitorGate) {
              visitorGate.ws.send(JSON.stringify({ type: "gate-opened", callId: msg.callId }));
            }
            break;
          }

          // ─── Internal call: funcionário → morador ───
          case "internal-call": {
            if (!authUser) break;
            const { targetUserId, callId: iCallId, callerName: iCallerName } = msg;
            client.callId = iCallId;
            const iTarget = moradorConnections.get(targetUserId);
            if (iTarget && iTarget.ws.readyState === WebSocket.OPEN) {
              iTarget.callId = iCallId;
              iTarget.ws.send(JSON.stringify({
                type: "internal-incoming-call",
                callId: iCallId,
                callerName: iCallerName || authUser.name,
                callerRole: client.type,
                callerClientId: clientId,
              }));
            } else {
              // Morador offline — keep pending call for up to 30s
              console.log(`  [WS] Internal call: morador ${targetUserId} offline, sending push...`);
              pendingPushCalls.set(iCallId, {
                callId: iCallId, visitorClientId: clientId, moradorId: targetUserId,
                visitanteNome: iCallerName || authUser.name || "Portaria",
                visitanteEmpresa: null, visitanteFoto: null,
                nivelSeguranca: 0, bloco: "", apartamento: "",
                timestamp: Date.now(),
                isInternal: true, callerRole: client.type,
              });
              sendPushToUser(targetUserId, {
                title: "\uD83D\uDCDE Chamada da Portaria",
                body: `${iCallerName || authUser.name || "Portaria"} está ligando para você`,
                data: { type: "interfone-call", callId: iCallId, moradorId: String(targetUserId) },
                channelId: "interfone_calls",
                sound: "ringtone",
              }).then((sent) => {
                console.log(`  [WS] Push sent to moradorId=${targetUserId}: ${sent} device(s)`);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "call-waiting-push", callId: iCallId }));
                }
                setTimeout(() => {
                  if (pendingPushCalls.has(iCallId)) {
                    pendingPushCalls.delete(iCallId);
                    console.log(`  [WS] Pending call ${iCallId} expired (30s timeout)`);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: "call-unavailable", callId: iCallId, reason: "offline" }));
                    }
                  }
                }, 30_000);
              }).catch(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "call-waiting-push", callId: iCallId }));
                }
                setTimeout(() => {
                  if (pendingPushCalls.has(iCallId)) {
                    pendingPushCalls.delete(iCallId);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: "call-unavailable", callId: iCallId, reason: "offline" }));
                    }
                  }
                }, 30_000);
              });
            }
            break;
          }

          // ─── Internal call: morador → portaria ───
          case "internal-call-portaria": {
            if (!authUser) break;
            const { callId: ipCallId, callerName: ipCallerName } = msg;
            client.callId = ipCallId;
            const funcPool2 = funcionarioConnections.get(authUser.condominio_id ?? 0) || [];
            const onlineFunc2 = funcPool2.find(f => f.ws.readyState === WebSocket.OPEN);
            if (onlineFunc2) {
              onlineFunc2.callId = ipCallId;
              onlineFunc2.ws.send(JSON.stringify({
                type: "internal-incoming-call",
                callId: ipCallId,
                callerName: ipCallerName || authUser.name,
                callerRole: "morador",
                callerClientId: clientId,
                bloco: (authUser as any).block || "",
                apartamento: (authUser as any).unit || "",
              }));
            } else {
              ws.send(JSON.stringify({ type: "call-unavailable", callId: ipCallId, reason: "portaria_offline" }));
            }
            break;
          }
        }
      } catch (err) {
        console.error("[WS Interfone] Error:", err);
      }
    });

    ws.on("close", () => {
      // Clean up — only delete from moradorConnections if this client is still the current entry
      if (client.moradorId) {
        const current = moradorConnections.get(client.moradorId);
        if (current === client) {
          moradorConnections.delete(client.moradorId);
        }
      }
      // Clean up funcionario pool
      if (client.type === "funcionario" && client.condominioId) {
        const pool = funcionarioConnections.get(client.condominioId);
        if (pool) {
          const idx = pool.indexOf(client);
          if (idx >= 0) pool.splice(idx, 1);
          if (pool.length === 0) funcionarioConnections.delete(client.condominioId);
        }
      }
      // Notify other party if in call
      if (client.callId) {
        // Clean up any pending push call
        pendingPushCalls.delete(client.callId);
        const otherType = client.type === "visitor" ? "morador" : "visitor";
        const other = findClientByCallId(client.callId, otherType);
        if (!other) {
          // Also try funcionario type
          const other2 = findClientByCallId(client.callId, "funcionario");
          if (other2) other2.ws.send(JSON.stringify({ type: "call-ended", callId: client.callId, reason: "disconnected" }));
        } else {
          other.ws.send(JSON.stringify({ type: "call-ended", callId: client.callId, reason: "disconnected" }));
        }
      }
      clients.delete(clientId);
    });

    ws.on("error", () => {
      clients.delete(clientId);
      if (client.moradorId) {
        const current = moradorConnections.get(client.moradorId);
        if (current === client) {
          moradorConnections.delete(client.moradorId);
        }
      }
      if (client.type === "funcionario" && client.condominioId) {
        const pool = funcionarioConnections.get(client.condominioId);
        if (pool) {
          const idx = pool.indexOf(client);
          if (idx >= 0) pool.splice(idx, 1);
          if (pool.length === 0) funcionarioConnections.delete(client.condominioId);
        }
      }
    });
  });

  console.log("  📞 Interfone WebSocket connections active");
}

function findClientById(id: string): WsClient | undefined {
  return clients.get(id);
}

function findClientByCallId(callId: string, type: "visitor" | "morador" | "funcionario"): WsClient | undefined {
  for (const [, c] of clients) {
    if (c.callId === callId && c.type === type && c.ws.readyState === WebSocket.OPEN) {
      return c;
    }
  }
  return undefined;
}

/** Find the OTHER party in a call (by callId), excluding the sender */
function findPeerByCallId(callId: string, excludeClientId: string): WsClient | undefined {
  for (const [id, c] of clients) {
    if (c.callId === callId && id !== excludeClientId && c.ws.readyState === WebSocket.OPEN) {
      return c;
    }
  }
  return undefined;
}
