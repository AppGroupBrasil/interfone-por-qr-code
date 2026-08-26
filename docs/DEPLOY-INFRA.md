# Deploy & Infraestrutura — App Interfone

> Documento canônico de operação. Leia antes de mexer em deploy, `docker-compose.yml`, rede ou variáveis de ambiente. Objetivo: não repetir investigações já feitas.

## TL;DR (regras que não podem ser violadas)

1. **NÃO EXCLUIR O COOLIFY.** Ele está ativo e é essencial (ver seção Coolify). Excluí-lo derruba este app **e ~10 outros** do mesmo servidor.
2. **NÃO remover** a rede `coolify` (`networks: coolify: external: true`) nem as labels Traefik do `docker-compose.yml`. É o que dá roteamento + TLS ao app.
3. **Deploy só via `git push` na branch `main`** → GitHub Actions. Não publicar pelo Coolify (webhook foi removido em 2026-05-16).
4. **Variáveis de produção ficam no `/opt/appinterfone/.env`** do servidor — **não** na UI do Coolify. O `git reset --hard` do deploy não apaga o `.env` (é gitignored).
5. **Push é a campainha do celular.** Não enfraquecer prioridade/som/canal (ver seção Push).

## Servidor

- **Host:** Hetzner `46.225.191.114` (root). SSH alias: `simples-manutencao-hetzner` (chave `~/.ssh/hetzner_key`).
- **Path do app:** `/opt/appinterfone/` (`docker-compose.yml`, `.env`, backups `.env.bak.*`).
- **Container:** `appinterfone` — porta interna `3001`, publicada apenas em `127.0.0.1:3002` (acesso externo só pelo Traefik/HTTPS). Healthcheck: `GET /api/health` → `{status:"ok"}`.
- **Volume SQLite:** `appinterfone_appinterfone_data` → `/app/data` no container.

## Fluxo de deploy (GitHub Actions)

`git push` em `main` → `.github/workflows/deploy.yml`:
1. SSH no servidor (secrets `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`).
2. `cd /opt/appinterfone && git fetch origin main && git reset --hard origin/main`.
3. `docker compose up -d --build --remove-orphans` (build pesado ~5-8 min por causa de firebase-admin + bcrypt nativos).
4. Health check.

Repo de produção: `AppGroupBrasil/interfone-por-qr-code` (remote `agb`). O remote `origin` (eddnportugal) é espelho com token expirado — não usar.

## Coolify — está ATIVO e é load-bearing

Apesar do app **não** ser publicado pelo Coolify, em runtime ele depende dele:

- `coolify-proxy` (**Traefik v3.6**) é o proxy reverso que recebe o HTTPS e roteia para `appinterfone.com.br` **e ~10 outros apps** (appavisos, xvistoria, manutencao/VoxIA, voxia-api, auth-central, supabase, appsindico, app-correspondencia, reservas…).
- Todos esses containers, incluindo `appinterfone`, ficam na rede Docker externa **`coolify`**. É por ela que o `coolify-proxy` alcança o app.
- Também rodam: `coolify`, `coolify-db`, `coolify-redis`, `coolify-realtime`, `coolify-sentinel`. `/data/coolify` existe.

**Consequência:** excluir o Coolify, remover a rede `coolify` ou as labels Traefik = todos os sites do servidor caem (sem roteamento e sem TLS). O que saiu do Coolify foi **apenas o deploy** deste app.

## Variáveis de ambiente (produção)

Arquivo: `/opt/appinterfone/.env`. Principais: `JWT_SECRET`, `ALLOWED_ORIGINS`, `DEMO_MODE`, `SAMPLE_ACCOUNTS_ON_REGISTER`, AWS SES (`AWS_*`, `SES_*`, `APP_URL`), Firebase e VAPID (abaixo). Ver `.env.example` para o formato.

## Push / campainha (FUNDAMENTAL)

O push é o **instrumento de toque** do celular do morador (toca como interfone na chegada da chamada). Comportamento "excessivo" (prioridade `high`/`max`, vibração, som `ringtone`, canal `interfone_calls`) é **intencional** — qualquer alteração precisa preservar a entrega do toque ao celular destino. O throttle do WebSocket limita só a **origem** de chamada (anti-spam), nunca a entrega.

### FCM (Android) — ativo em produção

- Credencial colada **inline** em `FIREBASE_SERVICE_ACCOUNT_JSON` no `/opt/appinterfone/.env` (JSON minificado, uma linha, sem aspas em volta). `pushService.ts` tenta o JSON inline primeiro, depois cai para `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Confirmação no boot dos logs: `🔔 Firebase Admin SDK initialized (env JSON, push ready)`.
- JSON local (gitignored): `server/firebase-service-account.json` (project_id `app-interfone`).
- Para aplicar mudança de credencial: editar o `.env` no servidor e `docker compose up -d` (recria o container lendo o novo `.env`; não precisa rebuild).

### Web Push (VAPID) — opcional, hoje desligado

É o push de navegador/PWA (não a campainha do app Android). Para ativar, preencher `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` no `.env` do servidor.

## Troubleshooting

- **Deploy falha com `container name "appinterfone" is already in use`:** sobrou um container renomeado de uma recriação anterior. Limpar o duplicado/stale e rodar `docker compose up -d`. Verificar com `docker ps -a --filter name=appinterfone`.
- **Container "Up X days" mesmo após push:** a Action pode ter buildado a imagem nova mas falhado ao recriar (ex.: conflito de nome). A imagem nova pode já estar em `appinterfone-appinterfone:latest`; nesse caso `docker compose up -d` (sem `--build`) recria rápido com ela.
- **Logs:** `docker logs appinterfone -f --tail 100`.
