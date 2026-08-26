# Portão remoto — desligado na v1

**Decisão (agosto/2026):** a v1 do produto é **interfonia sem fio**. Não há abertura
remota de portão. O risco de um bug deixar um portão aberto em condomínio de alto
padrão é maior do que o ganho comercial da função nesta etapa.

O código foi **preservado**, não apagado. Nada aqui precisa ser reescrito para
religar — precisa ser *endurecido* (ver pré-condições no fim).

## O que foi desligado

| Camada | Situação |
| --- | --- |
| `server/gateRoutes.ts`, `server/ewelinkService.ts`, `server/deviceService.ts` | Intactos no repositório. As rotas só são montadas se `GATE_ENABLED=true` (`server/index.ts`). |
| `case "open-gate"` no WebSocket (`server/websocket.ts`) | **Removido do protocolo.** Era o comando que a tela de chamada enviava; não fazia nada além de responder `gate-opened` ao visitante. |
| Botão "Abrir Portão" na chamada (`MoradorInterfone.tsx`, `FuncionarioInterfone.tsx`) | Removido, junto com o estado `gateOpened` e o toast "Portão Aberto!". |
| Tela do visitante (`InterfoneVisitor.tsx`) | Estado `gate-opened` e o texto "Portão Aberto! Pode entrar. Bem-vindo!" removidos. A chamada agora termina de forma neutra ("Chamada encerrada"). |
| Rotas de UI `/master/portao`, `/sindico/portao`, `/callback` (OAuth eWeLink) | Fora do `App.tsx`. As páginas continuam no repositório. |
| Card "Portão" no dashboard master | Removido. |
| Tabelas `gate_access_points`, `gate_logs` e colunas relacionadas | **Mantidas.** Nada foi apagado do schema. |
| Credenciais eWeLink em `system_config` | Devem ser apagadas: `node scripts/limpar-credenciais-portao.mjs --apply`. Ficavam em texto plano. |

> O botão que existia era **cosmético**: mandava `open-gate` pelo WebSocket, o
> servidor devolvia `gate-opened` ao visitante e **nenhum portão era acionado**.
> Morador e visitante liam "Portão Aberto!" sem que nada tivesse aberto. Essa era
> a falha mais grave do produto em campo.

## Como religar (quando for a hora)

`GATE_ENABLED=true` no `.env` remonta `/api/gate`. **Isso sozinho não é suficiente** —
sem os itens abaixo o acionamento remoto é inseguro:

1. **Sinalização autenticada.** Hoje o WebSocket de interfonia aceita qualquer
   mensagem roteada por `callId`, sem token. Um comando de portão sobre esse
   canal é acionável por terceiros.
2. **`callId` imprevisível.** Os ids atuais derivam de `Date.now()`; precisam ser
   aleatórios (`crypto.randomBytes`).
3. **Autorização validada no servidor**, por condomínio + unidade, no momento do
   comando — nunca confiando no que o cliente mandou.
4. **Pulso com teto em segundos.** O `pulseDevice` aceita duração arbitrária e o
   toggle grava estado `"on"` permanente: é assim que um portão fica aberto.
5. **Cooldown por unidade** e **log imutável** de quem abriu, quando e para quem.
6. **Acionamento por controlador local**, não por nuvem de terceiro. Se a eWeLink
   cair ou mudar a API, o condomínio não pode ficar sem portão.
7. `allow_botoeira_morador` / `allow_botoeira_portaria` precisam ser respeitados
   no servidor (hoje dá para contornar pelo cliente).

## O que continua funcionando

O histórico em `interfone_calls` segue registrando toda chamada — data, hora,
origem, destino, duração e desfecho. É **log de telefone**, não autorização de
acesso, e continua servindo ao síndico.
