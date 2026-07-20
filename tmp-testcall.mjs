import WebSocket from "ws";

const ws = new WebSocket("wss://appinterfone.com.br/ws/interfone");
const callId = `test-${Date.now()}`;

ws.on("open", () => {
  console.log("visitor open", new Date().toISOString());
  ws.send(JSON.stringify({
    type: "call-request",
    moradorId: 48,
    callId,
    visitanteNome: "Teste Claude",
    visitanteEmpresa: null,
    visitanteFoto: null,
    nivelSeguranca: 0,
    bloco: "",
    apartamento: "101",
  }));
});

ws.on("message", (d) => console.log("<-", new Date().toISOString(), d.toString().slice(0, 200)));
ws.on("close", (c) => console.log("closed", c));
setTimeout(() => { ws.close(); process.exit(0); }, 90000);
