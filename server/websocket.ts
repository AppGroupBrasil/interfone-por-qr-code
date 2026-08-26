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
import { sendPushToUser, sendPushToCondominioRole } from "./pushService.js";
import { JWT_SECRET } from "./config.js";
import { log } from "./logger.js";

const COOKIE_NAME = "session_token";

// Logs verbosos apenas em desenvolvimento (evita vazar origin/identidade em produção)
const IS_PROD_WS = process.env.NODE_ENV === "production";
const dbg = (...args: any[]) => { if (!IS_PROD_WS) console.log(...args); };

/** Parse a specific cookie from the raw Cookie header */
function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/** users.id e funcionarios.id são sequências independentes: o mesmo número
 *  identifica pessoas diferentes. A marca diz de qual tabela o id veio — sem
 *  ela, o porteiro nº 3 tomava o lugar do morador nº 3 no mapa de conexões e
 *  a campainha do morador parava de tocar. */
type WsUser = DbUser & { fromFuncionariosTable?: boolean };

/** Verify JWT from WebSocket upgrade request and return user or null.
 *  Checks: 1) ?token= query param (Capacitor), 2) Cookie header (web)
 *  Handles both regular user tokens ({ userId }) and funcionario tokens ({ funcId }) */
function authenticateWs(req: IncomingMessage): WsUser | null {
  const cookieToken = parseCookie(req.headers.cookie, COOKIE_NAME);

  const resolveUserFromToken = (token: string | null): WsUser | null => {
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
        fromFuncionariosTable: true,
      } as WsUser;
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
  id: string;
  ws: WebSocket;
  type: "visitor" | "morador" | "funcionario";
  moradorId?: number;
  /** Chave namespaced ("u:<id>" ou "f:<id>") — ver keyConn(). */
  connKey?: string;
  callId?: string;
  condominioId?: number;
  userId?: number;
}

/** Alvo de chamada: moradorId/targetUserId vêm sempre da tabela users. */
const keyMorador = (id: number) => `u:${id}`;
/** Chave da própria conexão, separando as duas tabelas de identidade. */
const keyConn = (u: WsUser) => (u.fromFuncionariosTable ? `f:${u.id}` : `u:${u.id}`);

// Active connections indexed by a unique key
const clients = new Map<string, WsClient>();
// Morador connections indexed by connKey for incoming calls
const moradorConnections = new Map<string, WsClient>();
// Funcionario connections indexed by condominioId for portaria calls
const funcionarioConnections = new Map<number, WsClient[]>();
// Pending call handoffs — morador switching from GlobalIncomingCall WS to MoradorInterfone WS
const pendingHandoffs = new Map<string, { callId: string; timestamp: number }>();
// Chamadas já atendidas por morador — se o app recarregar logo depois de atender
// (tocar na notificação, OTA, troca de página), o socket novo reencontra a chamada
// e pede a oferta de novo em vez de deixar o visitante na tela azul.
const answeredCalls = new Map<string, { callId: string; timestamp: number; visitanteNome: string; visitorClientId: string; isInternal: boolean }>();
// Pending push calls — visitor waiting for morador to come online after push notification
type PendingPushCall = {
  callId: string;
  visitorClientId: string;
  moradorId: number;
  visitanteNome: string;
  visitanteEmpresa: string | null;
  visitanteFoto: string | null;
  nivelSeguranca: number;
  bloco: string;
  apartamento: string;
  timestamp: number;
  isInternal?: boolean;
  callerRole?: string;
  // Chamada tocando na portaria: o alvo é o condomínio inteiro, não um morador.
  portariaCondominioId?: number;
  // true = veio de visitante (entrega como incoming-call); false/ausente = morador
  isPortariaCall?: boolean;
};
const pendingPushCalls = new Map<string, PendingPushCall>();

// Silencia a chamada nos demais porteiros quando um deles resolve (atendeu,
// recusou) ou quando o tempo esgota — todos tocaram, só um fica com a chamada.
function cancelarToquePortaria(condominioId: number, callId: string, exceto: string): void {
  for (const f of funcionarioConnections.get(condominioId) || []) {
    if (f.id === exceto || f.ws.readyState !== WebSocket.OPEN) continue;
    f.ws.send(JSON.stringify({ type: "call-cancelled", callId }));
  }
}

// Toca em TODA a portaria: cada funcionário online recebe a chamada pelo
// WebSocket e o push acorda quem está com o app fechado. Antes só o primeiro
// socket da lista era chamado — bastava aquele porteiro estar com o app
// dormindo para a chamada morrer em silêncio, sem push e sem aviso.
function ringPortaria(params: {
  condominioId: number;
  callId: string;
  wsMessage: Record<string, unknown>;
  pushTitle: string;
  pushBody: string;
  pending: PendingPushCall;
  callerWs: WebSocket;
  timeoutMs?: number;
}): void {
  const { condominioId, callId, wsMessage, pushTitle, pushBody, pending, callerWs } = params;
  const online = (funcionarioConnections.get(condominioId) || []).filter(
    (f) => f.ws.readyState === WebSocket.OPEN
  );
  const texto = JSON.stringify(wsMessage);
  // O callId NÃO é gravado nos sockets aqui: quem atender primeiro é que fica
  // com a chamada (call-answer grava), senão o roteamento WebRTC ficaria
  // ambíguo entre vários porteiros com o mesmo callId.
  for (const f of online) f.ws.send(texto);

  // Rede de segurança: socket zumbi (app em 2º plano) não toca. O push acorda o
  // aparelho e o pending re-entrega a chamada no register-funcionario.
  pendingPushCalls.set(callId, pending);

  sendPushToCondominioRole(condominioId, ["funcionario", "sindico"], {
    title: pushTitle,
    body: pushBody,
    data: { type: "interfone-call", callId, destino: "portaria" },
    channelId: "interfone_calls_v2",
    sound: "ringtone",
    fullScreen: true,
  })
    .then((enviados) => {
      if (online.length > 0) return;
      if (enviados === 0) {
        // Nenhum porteiro online e nenhum aparelho registrado: portaria fechada.
        pendingPushCalls.delete(callId);
        if (callerWs.readyState === WebSocket.OPEN) {
          callerWs.send(JSON.stringify({ type: "call-unavailable", callId, reason: "portaria_offline" }));
        }
      } else if (callerWs.readyState === WebSocket.OPEN) {
        callerWs.send(JSON.stringify({ type: "call-waiting-push", callId }));
      }
    })
    .catch(() => {});

  // Ninguém atendeu: libera quem chamou em vez de deixá-lo esperando para sempre.
  setTimeout(() => {
    if (!pendingPushCalls.has(callId)) return;
    pendingPushCalls.delete(callId);
    cancelarToquePortaria(condominioId, callId, "");
    if (callerWs.readyState === WebSocket.OPEN) {
      callerWs.send(JSON.stringify({ type: "call-unavailable", callId, reason: "portaria_offline" }));
    }
  }, params.timeoutMs ?? 30_000);
}

export function initSignalingServer(_server?: Server) {
  const isProd = process.env.NODE_ENV === "production";
  let wss: WebSocketServer;

  if (isProd && _server) {
    // Production: attach to main HTTP server (same port, path-based routing)
    wss = new WebSocketServer({ server: _server, path: "/ws/interfone", perMessageDeflate: false });
    dbg(`  📞 Interfone WebSocket attached to main server at /ws/interfone`);
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
      dbg(`  📞 Interfone WebSocket ready at ${hasCerts ? 'wss' : 'ws'}://0.0.0.0:${WS_PORT}/ws/interfone`);
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
    dbg(`  [WS] New connection: ${clientId} from ${req.headers.origin || "no-origin"} url=${req.url?.substring(0,80)}`);

    // Throttle anti-abuso: limita quantas CHAMADAS esta conexão pode INICIAR.
    // Não afeta o push/toque no destino — apenas evita spam de origem (moradorId forjado).
    let callAttempts = 0;
    let callWindowStart = Date.now();
    const allowCallInit = (): boolean => {
      const now = Date.now();
      if (now - callWindowStart > 60_000) { callWindowStart = now; callAttempts = 0; }
      return ++callAttempts <= 20;
    };

    // Mark as alive on connect
    aliveClients.add(ws);
    ws.on("pong", () => { aliveClients.add(ws); });

    // Try to authenticate — visitors won't have credentials
    const authUser = authenticateWs(req);
    dbg(`  [WS] Auth: ${authUser ? `userId=${authUser.id} role=${authUser.role}` : "anonymous"}`);
    const client: WsClient = { id: clientId, ws, type: "visitor", userId: authUser?.id };
    clients.set(clientId, client);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Throttle de ORIGEM para mensagens que iniciam/disparam chamada (anti-spam de push).
        if (["call-request", "portaria-call", "internal-call", "internal-call-portaria", "auth-request"].includes(msg.type) && !allowCallInit()) {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "error", message: "Muitas chamadas em pouco tempo. Aguarde alguns segundos." }));
          return;
        }

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
            client.connKey = keyConn(authUser);
            client.condominioId = authUser.condominio_id ?? undefined;
            const connKey = client.connKey;

            // Um morador = uma conexão viva. Quando o WebView recarrega (abrir o app
            // pela notificação, cold start), o socket antigo fica ZUMBI no servidor
            // por minutos — e roubava o webrtc-offer/ICE da chamada nova, dando a
            // "tela azul sem imagem". Derruba o anterior antes de assumir.
            const previous = moradorConnections.get(connKey);
            console.log(`[AUDIT] register-morador ${authUser.id} novo=${clientId} page=${msg.page ?? "-"} derrubando=${previous && previous !== client ? previous.id : "-"}`);

            // O aviso global (overlay) NUNCA toma o lugar da tela do interfone que
            // está em chamada: se ele reconectar por trás, o socket que negocia o
            // WebRTC morre no meio e o visitante fica na tela azul.
            if (msg.page === "overlay" && previous && previous !== client && previous.callId
                && previous.ws.readyState === WebSocket.OPEN) {
              console.log(`[AUDIT] overlay-ignorado morador=${authUser.id} chamada=${previous.callId}`);
              ws.send(JSON.stringify({ type: "registered", moradorId: authUser.id }));
              break;
            }

            if (previous && previous !== client) {
              previous.callId = undefined; // não deixar o close handler encerrar a chamada nova
              clients.delete(previous.id);
              dbg(`  [WS] Conexão anterior do morador ${authUser.id} derrubada (${previous.id})`);
              try { previous.ws.close(4002, "replaced"); } catch {}
            }
            moradorConnections.set(connKey, client);

            // Check for pending call handoff (GlobalIncomingCall → MoradorInterfone)
            const handoff = pendingHandoffs.get(connKey);
            if (handoff && msg.page === "overlay") {
              // Handoff é pra tela do interfone. Devolver call-resumed pro aviso
              // global fazia ele reenviar call-handoff e fechar o socket — o par
              // ficava trocando isso a cada 2s e a campainha nunca chegava.
              console.log(`[AUDIT] handoff-aguardando morador=${authUser.id} callId=${handoff.callId} (overlay ignorado)`);
              ws.send(JSON.stringify({ type: "registered", moradorId: authUser.id }));
              break;
            }
            if (handoff && (Date.now() - handoff.timestamp < 15000)) {
              client.callId = handoff.callId;
              pendingHandoffs.delete(connKey);
              dbg(`  [WS] Handoff resumed: moradorId=${authUser.id} callId=${handoff.callId}`);
              ws.send(JSON.stringify({ type: "registered", moradorId: authUser.id }));
              ws.send(JSON.stringify({ type: "call-resumed", callId: handoff.callId }));

              // Notify the peer (visitor/portaria) to resend WebRTC offer
              const peer = findPeerByCallId(handoff.callId, clientId);
              console.log(`[AUDIT] handoff-resume morador=${authUser.id} callId=${handoff.callId} peer=${peer?.id ?? "NENHUM"}`);
              if (peer) {
                peer.ws.send(JSON.stringify({ type: "resend-offer", callId: handoff.callId }));
              }
            } else {
              pendingHandoffs.delete(connKey); // clean up expired
              ws.send(JSON.stringify({ type: "registered", moradorId: authUser.id }));

              // App recarregou depois de atender (notificação, OTA, troca de página):
              // reata a chamada em vez de deixar o visitante sem destino pra oferta.
              const answered = answeredCalls.get(connKey);
              const answeredPeer = answered ? findPeerByCallId(answered.callId, clientId) : undefined;
              if (answered && Date.now() - answered.timestamp < 60000 && answeredPeer) {
                client.callId = answered.callId;
                console.log(`[AUDIT] answered-resume morador=${authUser.id} callId=${answered.callId} peer=${answeredPeer.id}`);
                ws.send(JSON.stringify({
                  type: "call-resumed",
                  callId: answered.callId,
                  visitanteNome: answered.visitanteNome,
                  visitorClientId: answered.visitorClientId,
                  isInternal: answered.isInternal,
                }));
                // O aviso global não negocia WebRTC: ele faz handoff pra tela do
                // interfone e a oferta sai lá (senão a primeira se perderia).
                if (msg.page !== "overlay") {
                  answeredPeer.ws.send(JSON.stringify({ type: "resend-offer", callId: answered.callId }));
                }
              } else if (answered && !answeredPeer) {
                answeredCalls.delete(connKey);
              }
            }

            // Chamada que chegou por push enquanto o morador estava offline.
            // Pega sempre a MAIS RECENTE e descarta as mortas (quem chamou saiu):
            // uma entrada velha era entregue no lugar da chamada nova e o morador
            // via a tela de chamada de uma ligação que não existia mais.
            let pending: { callId: string; pc: NonNullable<ReturnType<typeof pendingPushCalls.get>> } | null = null;
            for (const [pcCallId, pc] of pendingPushCalls) {
              if (pc.moradorId !== authUser.id) continue;
              const caller = findClientById(pc.visitorClientId);
              const alive = Date.now() - pc.timestamp < 120000
                && caller !== undefined
                && caller.ws.readyState === WebSocket.OPEN;
              if (!alive) {
                pendingPushCalls.delete(pcCallId);
                continue;
              }
              if (!pending || pc.timestamp > pending.pc.timestamp) pending = { callId: pcCallId, pc };
            }

            if (pending) {
              const pcCallId = pending.callId;
              const pc = pending.pc;
              {
                dbg(`  [WS] Push call found: moradorId=${authUser.id} callId=${pcCallId} internal=${!!pc.isInternal}`);
                client.callId = pcCallId;
                // NÃO apagar aqui: se o app recarregar de novo (cold start pela
                // notificação) a chamada precisa ser re-entregue. É apagada ao
                // atender/recusar/encerrar, ou expira em 120s.
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
            // Só quem trabalha na portaria entra no pool: ringPortaria difunde a
            // chamada do visitante para todos eles, e um morador autenticado que
            // se registrasse aqui passaria a atender a portaria do condomínio.
            if (authUser.role !== "funcionario" && authUser.role !== "sindico") {
              ws.send(JSON.stringify({ type: "error", message: "Sem permissão." }));
              ws.close(4003, "Forbidden");
              return;
            }
            client.type = "funcionario";
            client.moradorId = authUser.id;
            client.connKey = keyConn(authUser);
            client.condominioId = authUser.condominio_id ?? undefined;
            moradorConnections.set(client.connKey, client);
            // Also add to funcionario pool by condominio
            if (authUser.condominio_id && !funcionarioConnections.has(authUser.condominio_id)) {
              funcionarioConnections.set(authUser.condominio_id, []);
            }
            if (authUser.condominio_id) {
              funcionarioConnections.get(authUser.condominio_id)!.push(client);
            }

            // Chamada que chegou por push com o app fechado: re-entrega ao abrir.
            // Mesma rede de segurança do morador — pega a mais recente e descarta
            // as mortas (quem chamou já desistiu).
            if (authUser.condominio_id) {
              let pendPort: { callId: string; pc: PendingPushCall } | null = null;
              for (const [pcId, pc] of pendingPushCalls) {
                if (pc.portariaCondominioId !== authUser.condominio_id) continue;
                const quemChamou = findClientById(pc.visitorClientId);
                const viva = Date.now() - pc.timestamp < 120000
                  && quemChamou !== undefined
                  && quemChamou.ws.readyState === WebSocket.OPEN;
                if (!viva) { pendingPushCalls.delete(pcId); continue; }
                if (!pendPort || pc.timestamp > pendPort.pc.timestamp) pendPort = { callId: pcId, pc };
              }
              if (pendPort) {
                const pc = pendPort.pc;
                // Não apagar: se o app recarregar de novo, a chamada é re-entregue.
                ws.send(JSON.stringify(pc.isPortariaCall
                  ? {
                      type: "incoming-call",
                      callId: pendPort.callId,
                      visitanteNome: pc.visitanteNome,
                      visitanteEmpresa: null,
                      visitanteFoto: null,
                      nivelSeguranca: 0,
                      bloco: pc.bloco,
                      apartamento: pc.apartamento,
                      visitorClientId: pc.visitorClientId,
                      isPortariaCall: true,
                    }
                  : {
                      type: "internal-incoming-call",
                      callId: pendPort.callId,
                      callerName: pc.visitanteNome,
                      callerRole: pc.callerRole || "morador",
                      callerClientId: pc.visitorClientId,
                      bloco: pc.bloco,
                      apartamento: pc.apartamento,
                    }));
              }
            }
            ws.send(JSON.stringify({ type: "registered-funcionario", funcionarioId: authUser.id }));
            break;
          }

          // ─── Visitor calls portaria directly (no security) ───
          case "portaria-call": {
            const { condominioId: cId, callId: pCallId, visitanteNome: pNome, bloco: pBloco } = msg;
            client.callId = pCallId;
            client.type = "visitor";

            // Toca em todos os porteiros online + push para os que estão fora do app.
            ringPortaria({
              condominioId: cId,
              callId: pCallId,
              wsMessage: {
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
              },
              pushTitle: "📞 Chamada na Portaria",
              pushBody: `${pNome || "Visitante"} está chamando a portaria`,
              pending: {
                callId: pCallId, visitorClientId: clientId, moradorId: 0,
                visitanteNome: pNome || "Visitante",
                visitanteEmpresa: null, visitanteFoto: null,
                nivelSeguranca: 0, bloco: pBloco || "", apartamento: "PORTARIA",
                timestamp: Date.now(),
                portariaCondominioId: cId, isPortariaCall: true,
              },
              callerWs: ws,
              timeoutMs: 45_000,
            });
            break;
          }

          // ─── Visitor initiates call to morador ───
          case "call-request": {
            const { moradorId, callId, visitanteNome, visitanteEmpresa, visitanteFoto, nivelSeguranca, bloco, apartamento } = msg;
            client.callId = callId;
            client.type = "visitor";

            // Lista de bloqueados do morador — aplicada no servidor (não só na UI)
            if (visitanteNome && isVisitorBlocked(moradorId, visitanteNome)) {
              ws.send(JSON.stringify({ type: "call-rejected", callId }));
              break;
            }

            const moradorClient = moradorConnections.get(keyMorador(moradorId));
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
              // WS pode ser "zumbi" (app em segundo plano com socket TCP vivo mas JS suspenso):
              // push sempre, pra campainha tocar pela bandeja; app em 1º plano ignora o push.
              sendPushToUser(moradorId, {
                title: "📞 Chamada do Interfone",
                body: `${visitanteNome || "Visitante"} está chamando no interfone`,
                data: { type: "interfone-call", callId, moradorId: String(moradorId) },
                channelId: "interfone_calls_v2",
                sound: "ringtone",
                fullScreen: true,
              }).catch(() => {});
              // Rede de segurança: o socket do morador pode estar ZUMBI (app em 2º plano,
              // TCP vivo mas JS suspenso — o incoming-call acima se perde). Guardar como
              // pending faz o register-morador re-entregar a chamada quando o app voltar
              // (< 120s), mesmo que o push do FCM tenha atrasado ou caído. Limpo ao
              // atender/recusar/encerrar e na desconexão do visitante.
              pendingPushCalls.set(callId, {
                callId, visitorClientId: clientId, moradorId,
                visitanteNome: visitanteNome || "Visitante",
                visitanteEmpresa: visitanteEmpresa || null,
                visitanteFoto: visitanteFoto || null,
                nivelSeguranca: nivelSeguranca || 0,
                bloco: bloco || "", apartamento: apartamento || "",
                timestamp: Date.now(),
              });
            } else {
              // Morador offline — send push notification and keep visitor waiting
              dbg(`  [WS] Morador ${moradorId} offline, sending push notification...`);
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
                channelId: "interfone_calls_v2",
                sound: "ringtone",
                fullScreen: true,
              }).then((sent) => {
                dbg(`  [WS] Push sent to moradorId=${moradorId}: ${sent} device(s)`);
                if (sent === 0) {
                  // No push tokens — morador truly unreachable
                  pendingPushCalls.delete(callId);
                  ws.send(JSON.stringify({ type: "call-unavailable", callId, reason: "morador_offline" }));
                } else {
                  // Tell visitor to keep waiting
                  ws.send(JSON.stringify({ type: "call-waiting-push", callId }));
                  // Expira a espera se o morador não abrir o app (evita visitante preso em "aguardando")
                  setTimeout(() => {
                    if (pendingPushCalls.has(callId)) {
                      pendingPushCalls.delete(callId);
                      dbg(`  [WS] Pending visitor call ${callId} expired (60s timeout)`);
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "call-unavailable", callId, reason: "timeout" }));
                      }
                    }
                  }, 60_000);
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
            const moradorClient2 = moradorConnections.get(keyMorador(msg.moradorId));
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
          case "client-debug": {
            console.log(`[AUDIT] client-debug clientId=${clientId} user=${authUser?.id ?? "anon"} morador=${client.moradorId ?? "-"}: ${JSON.stringify(msg).slice(0, 500)}`);
            break;
          }

          case "call-answer": {
            console.log(`[AUDIT] call-answer clientId=${clientId} user=${authUser?.id ?? "anon"} morador=${client.moradorId ?? "-"} callId=${msg.callId}`);
            const answeredInfo = msg.callId ? pendingPushCalls.get(msg.callId) : undefined;
            if (msg.callId) pendingPushCalls.delete(msg.callId); // chamada resolvida: não re-entregar
            // Chamada da portaria: quem atendeu primeiro fica com ela; os outros param de tocar.
            if (answeredInfo?.portariaCondominioId) {
              cancelarToquePortaria(answeredInfo.portariaCondominioId, msg.callId, clientId);
            }
            // O socket passa a ser o dono desta chamada. Sempre sobrescreve: o
            // porteiro atende varias chamadas no mesmo socket e um callId antigo
            // aqui faz o findPeerByCallId errar o alvo do webrtc-offer.
            if (msg.callId) {
              client.callId = msg.callId;
            }
            if (msg.callId && client.connKey) {
              answeredCalls.set(client.connKey, {
                callId: msg.callId,
                timestamp: Date.now(),
                visitanteNome: answeredInfo?.visitanteNome || "Visitante",
                visitorClientId: answeredInfo?.visitorClientId || findPeerByCallId(msg.callId, clientId)?.id || "",
                isInternal: !!answeredInfo?.isInternal,
              });
            }
            const answerPeer = findPeerByCallId(msg.callId, clientId);
            if (answerPeer) {
              // handoff = quem atendeu foi o aviso global e vai trocar de socket:
              // o peer NÃO deve mandar a oferta agora (ela se perderia e colidiria
              // com a oferta do resend-offer) — espera a conexão definitiva.
              answerPeer.ws.send(JSON.stringify({ type: "call-answered", callId: msg.callId, handoff: !!msg.handoff }));
            }
            break;
          }

          // ─── Call handoff (GlobalIncomingCall → MoradorInterfone page) ───
          case "call-handoff": {
            if (client.connKey && client.callId) {
              dbg(`  [WS] Call handoff: moradorId=${client.moradorId} callId=${client.callId}`);
              pendingPushCalls.delete(client.callId); // handoff = atendida: não re-entregar via pending
              pendingHandoffs.set(client.connKey, { callId: client.callId, timestamp: Date.now() });
              client.callId = undefined; // prevent close handler from ending the call
            }
            break;
          }

          // ─── Reject call (works for external AND internal calls) ───
          case "call-reject": {
            const recusada = msg.callId ? pendingPushCalls.get(msg.callId) : undefined;
            if (msg.callId) pendingPushCalls.delete(msg.callId); // recusada: não re-entregar
            if (recusada?.portariaCondominioId) {
              cancelarToquePortaria(recusada.portariaCondominioId, msg.callId, clientId);
            }
            forgetAnsweredCall(msg.callId);
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
            console.log(`[AUDIT] webrtc-offer de=${clientId} callId=${msg.callId} alvo=${target?.id ?? "PERDIDA"}`);
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
            console.log(`[AUDIT] webrtc-answer de=${clientId} callId=${msg.callId} alvo=${target2?.id ?? "PERDIDA"}`);
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
            const encerrada = msg.callId ? pendingPushCalls.get(msg.callId) : undefined;
            if (msg.callId) pendingPushCalls.delete(msg.callId); // encerrada: não re-entregar
            // Desistiu antes de atenderem: para o toque em toda a portaria.
            if (encerrada?.portariaCondominioId) {
              cancelarToquePortaria(encerrada.portariaCondominioId, msg.callId, clientId);
            }
            forgetAnsweredCall(msg.callId);
            const endPeer = findPeerByCallId(msg.callId, clientId);
            if (endPeer) {
              endPeer.ws.send(JSON.stringify({ type: "call-ended", callId: msg.callId }));
            }
            // Chamada encerrada: o socket fica livre para a proxima.
            if (msg.callId && client.callId === msg.callId) client.callId = undefined;
            break;
          }

          // ─── Internal call: funcionário → morador ───
          case "internal-call": {
            if (!authUser) break;
            const { targetUserId, callId: iCallId, callerName: iCallerName } = msg;
            // Mesmo condomínio: impede tocar o interfone de morador de outro condomínio
            const iTargetUser = db.prepare("SELECT condominio_id FROM users WHERE id = ?").get(targetUserId) as { condominio_id: number | null } | undefined;
            if (!iTargetUser || iTargetUser.condominio_id == null || iTargetUser.condominio_id !== authUser.condominio_id) {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "call-unavailable", callId: iCallId, reason: "not_allowed" }));
              break;
            }
            client.callId = iCallId;
            const iTarget = moradorConnections.get(keyMorador(targetUserId));
            if (iTarget && iTarget.ws.readyState === WebSocket.OPEN) {
              iTarget.callId = iCallId;
              iTarget.ws.send(JSON.stringify({
                type: "internal-incoming-call",
                callId: iCallId,
                callerName: iCallerName || authUser.name,
                callerRole: client.type,
                callerClientId: clientId,
              }));
              // Mesmo raciocínio do call-request: socket pode estar zumbi, push garante o toque
              sendPushToUser(targetUserId, {
                title: "📞 Chamada da Portaria",
                body: `${iCallerName || authUser.name || "Portaria"} está ligando para você`,
                data: { type: "interfone-call", callId: iCallId, moradorId: String(targetUserId) },
                channelId: "interfone_calls_v2",
                sound: "ringtone",
                fullScreen: true,
              }).catch(() => {});
              // Rede de segurança (socket zumbi): re-entrega no retorno do app < 120s.
              pendingPushCalls.set(iCallId, {
                callId: iCallId, visitorClientId: clientId, moradorId: targetUserId,
                visitanteNome: iCallerName || authUser.name || "Portaria",
                visitanteEmpresa: null, visitanteFoto: null,
                nivelSeguranca: 0, bloco: "", apartamento: "",
                timestamp: Date.now(),
                isInternal: true, callerRole: client.type,
              });
            } else {
              // Morador offline — keep pending call for up to 30s
              dbg(`  [WS] Internal call: morador ${targetUserId} offline, sending push...`);
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
                channelId: "interfone_calls_v2",
                sound: "ringtone",
                fullScreen: true,
              }).then((sent) => {
                dbg(`  [WS] Push sent to moradorId=${targetUserId}: ${sent} device(s)`);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "call-waiting-push", callId: iCallId }));
                }
                setTimeout(() => {
                  if (pendingPushCalls.has(iCallId)) {
                    pendingPushCalls.delete(iCallId);
                    dbg(`  [WS] Pending call ${iCallId} expired (30s timeout)`);
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
            const ipCondId = authUser.condominio_id ?? 0;
            if (!ipCondId) {
              ws.send(JSON.stringify({ type: "call-unavailable", callId: ipCallId, reason: "portaria_offline" }));
              break;
            }
            const ipNome = ipCallerName || authUser.name || "Morador";
            const ipBloco = (authUser as any).block || "";
            const ipUnidade = (authUser as any).unit || "";
            ringPortaria({
              condominioId: ipCondId,
              callId: ipCallId,
              wsMessage: {
                type: "internal-incoming-call",
                callId: ipCallId,
                callerName: ipNome,
                callerRole: "morador",
                callerClientId: clientId,
                bloco: ipBloco,
                apartamento: ipUnidade,
              },
              pushTitle: "📞 Chamada do Morador",
              pushBody: ipUnidade ? `${ipNome} (${ipBloco} ${ipUnidade}) está chamando a portaria` : `${ipNome} está chamando a portaria`,
              pending: {
                callId: ipCallId, visitorClientId: clientId, moradorId: 0,
                visitanteNome: ipNome,
                visitanteEmpresa: null, visitanteFoto: null,
                nivelSeguranca: 0, bloco: ipBloco, apartamento: ipUnidade,
                timestamp: Date.now(),
                isInternal: true, callerRole: "morador",
                portariaCondominioId: ipCondId,
              },
              callerWs: ws,
            });
            break;
          }
        }
      } catch (err) {
        log.error("[WS Interfone] Error:", err);
      }
    });

    ws.on("close", (code?: number, reason?: Buffer) => {
      if (client.moradorId) {
        console.log(`[AUDIT] close morador=${client.moradorId} client=${clientId} code=${code ?? "-"} reason=${reason?.toString() || "-"}`);
      }
      // Clean up — only delete from moradorConnections if this client is still the current entry
      if (client.connKey) {
        const current = moradorConnections.get(client.connKey);
        if (current === client) {
          moradorConnections.delete(client.connKey);
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
        const closedCallId = client.callId;
        // Clean up any pending push call
        const pendenteFechada = pendingPushCalls.get(closedCallId);
        pendingPushCalls.delete(closedCallId);
        // Quem chamou a portaria caiu: silencia os porteiros que ainda tocam.
        if (pendenteFechada?.portariaCondominioId) {
          cancelarToquePortaria(pendenteFechada.portariaCondominioId, closedCallId, clientId);
        }
        const notifyEnd = () => {
          const otherType = client.type === "visitor" ? "morador" : "visitor";
          const other = findClientByCallId(closedCallId, otherType);
          if (!other) {
            // Also try funcionario type
            const other2 = findClientByCallId(closedCallId, "funcionario");
            if (other2) other2.ws.send(JSON.stringify({ type: "call-ended", callId: closedCallId, reason: "disconnected" }));
          } else {
            other.ws.send(JSON.stringify({ type: "call-ended", callId: closedCallId, reason: "disconnected" }));
          }
        };
        // Morador que atendeu e perdeu o socket (recarregou pela notificação, OTA,
        // troca de página): dar 8s pra ele voltar antes de matar a chamada.
        const answered = client.connKey ? answeredCalls.get(client.connKey) : undefined;
        if (answered && answered.callId === closedCallId) {
          setTimeout(() => {
            if (findClientByCallId(closedCallId, "morador")) return; // voltou
            answeredCalls.delete(client.connKey!);
            notifyEnd();
          }, 8000);
        } else {
          notifyEnd();
        }
      }
      clients.delete(clientId);
    });

    ws.on("error", () => {
      clients.delete(clientId);
      if (client.connKey) {
        const current = moradorConnections.get(client.connKey);
        if (current === client) {
          moradorConnections.delete(client.connKey);
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

  dbg("  📞 Interfone WebSocket connections active");
}

/** Verifica se o nome do visitante está na lista de bloqueados do morador */
function isVisitorBlocked(moradorId: number, visitanteNome: string): boolean {
  try {
    const cfg = db.prepare("SELECT bloqueados FROM interfone_config WHERE user_id = ?").get(moradorId) as { bloqueados?: string } | undefined;
    if (!cfg?.bloqueados) return false;
    const lista: string[] = JSON.parse(cfg.bloqueados);
    if (!Array.isArray(lista)) return false;
    const nome = visitanteNome.trim().toLowerCase();
    return lista.some(b => typeof b === "string" && b.trim().toLowerCase() === nome);
  } catch {
    return false;
  }
}

function findClientById(id: string): WsClient | undefined {
  return clients.get(id);
}

/**
 * Sempre a conexão MAIS RECENTE que casa (o Map preserva a ordem de inserção).
 * Se sobrou um socket antigo do mesmo aparelho, ele não rouba mais a sinalização.
 */
function findClientByCallId(callId: string, type: "visitor" | "morador" | "funcionario"): WsClient | undefined {
  let found: WsClient | undefined;
  for (const [, c] of clients) {
    if (c.callId === callId && c.type === type && c.ws.readyState === WebSocket.OPEN) {
      found = c;
    }
  }
  return found;
}

/** Chamada acabou: não reatar mais essa chamada em nenhum socket novo do morador */
function forgetAnsweredCall(callId: string | undefined) {
  if (!callId) return;
  for (const [conn, a] of answeredCalls) {
    if (a.callId === callId) answeredCalls.delete(conn);
  }
}

/** Find the OTHER party in a call (by callId), excluding the sender — a mais recente */
function findPeerByCallId(callId: string, excludeClientId: string): WsClient | undefined {
  let found: WsClient | undefined;
  for (const [id, c] of clients) {
    if (c.callId === callId && id !== excludeClientId && c.ws.readyState === WebSocket.OPEN) {
      found = c;
    }
  }
  return found;
}
