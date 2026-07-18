# Documentação — 2026-07-18

Robustez de produção (correções deployadas) + estudo de capacidade do servidor.
Commit: `fix: robustez de produção — deleção FK-safe, timezone BR, hardening e backup`.

---

## 1. Correções aplicadas e deployadas

Todas visando **simplicidade sem alterar funcionalidade**. Deploy via `git push main`
→ GitHub Actions → `/opt/appinterfone` (container `appinterfone`, porta interna 3001 / host 3002).

### 1.1 Deleção de usuário FK-safe (`server/db.ts` → `deleteUserCascade`)
- Descobre dinamicamente as FKs que apontam para `users` via `PRAGMA foreign_key_list` + `PRAGMA table_info`.
- Coluna FK **anulável** → `SET NULL` (preserva histórico: visitantes, entregas, logs do condomínio).
- Coluna FK **NOT NULL** → `DELETE` (linha não pode ficar órfã).
- Tudo numa transação. Evita o erro `FOREIGN KEY constraint failed` que acontecia ao excluir usuário.
- **Aplicado em todos os fluxos de exclusão**: `auth.ts` (DELETE /account), `users.ts`
  (administradora/síndico), `moradores.ts` (DELETE + rejeitar), `master.ts`, `condominios.ts`
  (por-usuário antes de apagar o condomínio), `provisioning.ts` (por e-mail), e
  `cleanupDemoAccounts` (contas demo > 30 dias).
- Observação: `condominios.admin_user_id` e `administradora_id` são INTEGER simples (NÃO são FK
  declaradas), então o cascade não apaga condomínio por engano.

### 1.2 Autenticação — 3 formatos de token sem colisão de ID (`server/middleware.ts`, `auth.ts`)
- Tokens possíveis: `{userId}` (users), `{funcId}` (funcionarios), central `{sub, apps[]}` (APP_SLUG `interfone-qr`).
- `authenticate()` seta `req.isFuncionario = true` para tokens `{funcId}`; `/me` responde
  corretamente para os 3 tipos. Corrige colisão em que um `funcId` batia com um `users.id` diferente.

### 1.3 Timezone Brasil (`Dockerfile`, `docker-compose.yml`, `server/db.ts`)
- Container agora roda `TZ=America/Sao_Paulo` (+ pacote `tzdata` no Alpine).
- Auto-expiração e auto-cancelamento usam **data local BR** (`date('now','localtime')` /
  `toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})`) em vez de UTC — evitava
  expirar/cancelar com até 1 dia de diferença perto da virada de meia-noite.

### 1.4 Hardening anti-enumeração (`server/interfone.ts`)
- `PUT /calls/:id` agora casa **apenas por `call_id`** (removido o branch por id inteiro), impedindo
  enumeração sequencial de chamadas.

### 1.5 Ordem de rotas (`server/index.ts`)
- `/api/ready` registrada **antes** do catch-all `/api` 404 (antes caía no 404 e era rota morta).

### 1.6 Reset de senha — normalização de e-mail (`server/auth.ts`)
- Os 3 endpoints (request/verify/reset) usam `email.toLowerCase().trim()` em todas as queries
  contra `password_reset_codes` e `users`. Cadastro grava e login compara case-insensitive.

### 1.7 Backup e infra (`server/db.ts`, `Dockerfile`, `docker-compose.yml`)
- Volume dedicado `appinterfone_backups:/app/backups`; retenção `BACKUP_KEEP` (padrão 28).
- `mkdir -p /app/data /app/backups` com chown no Dockerfile.

> **NÃO mexer**: rede/labels do Coolify (Traefik v3.6) — derruba ~10 sites. Push FCM via
> `FIREBASE_SERVICE_ACCOUNT_JSON` no `.env` do servidor = a campainha; nunca enfraquecer.

---

## 2. Estudo de capacidade (servidor Hetzner `46.225.191.114`)

Medido via SSH (`~/.ssh/hetzner_key`, alias `simples-manutencao-hetzner`) em 2026-07-18.

### Hardware real
- **4 vCPU**, **7,9 GB RAM** (`MemTotal 7932252 kB`), swap = `/swapfile` de **4 GB** (já ~3,7 GB usados).
- Disco: `/` = 38 GB (57%) + **`sdb` 120 GB em `/mnt/docker-data`** — isso é **armazenamento, não RAM**.
- **Host compartilhado: 78 contêineres** (Coolify). O container `appinterfone` usa só ~85 MB / 0% CPU idle.

### Modelo de concorrência
- Node **single-thread** + SQLite (`better-sqlite3`) **síncrono** — consultas indexadas são sub-ms.
- WebSocket de sinalização: cada usuário online = 1 conexão persistente + ping a cada 25s (barato).
- **Mídia das chamadas é P2P (WebRTC)** — NÃO passa pelo servidor; ele só repassa sinalização (JSON pequeno).
- Login com senha usa **`bcryptjs` (JS puro)** → bloqueia a única thread ~100ms por hash.

### Capacidade estimada (config atual)
| Dimensão | Sem lentidão | Gargalo |
|---|---|---|
| Usuários **online ociosos** (WS registrado) | ~2.000 confortável / teto ~4.000–5.000 | RAM disputada com os 78 contêineres |
| **Chamadas simultâneas em andamento** | centenas | não é gargalo (mídia P2P) |
| **Pico de login com senha** | ~8–12/seg | `bcryptjs` na thread única |

- Amortecedor: JWT dura 24h → reabrir o app reusa token (só reconexão WS, sem bcrypt). O teto de
  login só é atingido se muita gente digitar PIN no mesmo instante.

### Conclusões práticas
- **Pico previsto de ~1.000 online**: a config atual segura com folga. Sem necessidade de infra nova.
- Pontos de atenção para manter 1.000 liso: **swap do host** (vizinhos) e rajada de login.
- **Dobrar RAM p/ 16 GB**: sobe teto de online (~5.000 confortável / ~10.000 limite) e tira do swap,
  mas **não** melhora login (bcryptjs) nem latência (thread única) — esses dependem de CPU/código.
- **120 GB não ajudam concorrência** (é disco): servem para crescimento do banco, backups e fotos.

### Alavancas se um dia mirar vários milhares simultâneos (opcional, não feito)
1. Trocar `bcryptjs` → `bcrypt` nativo (threadpool): login de ~10 para ~50–60/seg.
2. Limite de memória no container (protege de OOM causado por vizinho no host lotado).
3. Sair do host compartilhado (78 contêineres) para instância dedicada com mais vCPU.
