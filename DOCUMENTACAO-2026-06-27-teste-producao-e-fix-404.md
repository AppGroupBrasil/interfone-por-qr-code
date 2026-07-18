# Sessão 2026-06-27 — Teste de produção + correção 404 da API

> Cópia na pasta do projeto. Original também em
> `Área de Trabalho\DOCUMENTAÇÃO\Documentação App Interfone\2026-06-27-teste-producao-e-fix-404.md`.

## Resumo
Teste completo contra a produção real (https://appinterfone.com.br) verificando bugs/erros, correção de 1 achado de baixa severidade e deploy. Sistema saudável, push (campainha) ativo, sem regressão. **Nenhuma mudança no app Android** — não foi preciso gerar AAB nem republicar na Play Store.

## Teste realizado (produção real, checagens não-destrutivas)
| Teste | Resultado |
|-------|-----------|
| `GET /api/health` | 200 `{status:ok}` |
| Frontend `/` | 200, title + `#root` |
| Auth gate (`/api/condominios` sem token) | 401 |
| Login credencial inválida | 401 JSON limpo (não 500) |
| HTTP → HTTPS | 302 → https |
| Headers segurança | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| CORS origem maliciosa | bloqueada (sem Access-Control-Allow-Origin) |
| WebSocket `/ws/interfone` (wss via Traefik) | upgrade OK (~777ms) |
| Container | `healthy`, restarts=0 |
| Logs (400 linhas) | zero erros |
| Boot | Firebase push ready, SES ok, HTTP 3001 |
| Build produção (client+server) | exit 0, sem erros TS |

## Achados
1. **Baixo (CORRIGIDO):** rotas `/api/<inexistente>` devolviam 200 + index.html (o catch-all SPA `app.get("*")` capturava `/api/*`).
2. **Cosmético (não alterado):** `www.appinterfone.com.br` serve o app direto (200) em vez de 301 → apex. Os dois domínios funcionam; é só canônico/SEO. Sem impacto funcional.

## Correção aplicada (404 da API)
- Arquivo: `server/index.ts` — adicionado antes do fallback SPA:
  ```ts
  // Unknown API routes → 404 JSON (evita o fallback SPA devolver index.html em /api/*)
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
  });
  ```
- Commit `d50e8e5`: `fix(api): rotas /api desconhecidas retornam 404 JSON em vez do fallback SPA`.
- Deploy via GitHub Actions (push em `main`) → run 28295037902, concluído com sucesso.
- Verificado em produção: `/api/rota-inexistente` → **404 JSON** `{"error":"Rota não encontrada."}`; health 200; rotas SPA do cliente (ex. `/login`) ainda servem HTML; container `healthy`; push ativo. Sem regressão.

## AAB / Play Store — NÃO precisou
O app Android empacota o frontend localmente (`capacitor.config.ts`: `webDir: 'dist'`, sem `server.url`) e chama a API em appinterfone.com.br.
- **Mudança de servidor/API** (como este 404): ativa só com o deploy no servidor; o AAB já publicado continua valendo. **Sem republicar.**
- **Mudança de frontend** (`src/`, React/UI): aí sim exige novo AAB + atualização na Play Store (o JS/HTML vai embutido no app).
Esta correção foi 100% backend → já disponível para quem usa o app agora.

## Push / campainha — intacto
Não foi alterado. Prioridade/som/canal preservados. Boot confirma `🔔 Firebase Admin SDK initialized (env JSON, push ready)`.

## Estado final
- Produção: container `appinterfone` healthy, push ativo, sem erros.
- Código: `main` em `d50e8e5` (servidor e repo de produção sincronizados).
- Nada pendente. Pode desligar com segurança.
