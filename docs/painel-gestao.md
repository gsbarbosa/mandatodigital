# Painel de gestão (`/admin`)

Painel interno compartilhado (Guga / Thiago) para operação da plataforma.

## Acesso

- URL: `/admin/login`
- Conta estática (bootstrap): ver `ADMIN_EMAIL` / `ADMIN_PASSWORD` em `.env`  
  Defaults em `src/lib/admin/credentials.ts` (trocar via env assim que possível).
- Sessão: cookie httpOnly `md_admin_session` (HMAC), independente do login Firebase dos candidatos.

## Módulos (MVP)

| Rota | Função |
|------|--------|
| `/admin` | Dashboard (contagens) |
| `/admin/roadmap` | Board do roadmap (estilo Trello) — CRUD |
| `/admin/provedores` | Lista de provedores + status de configuração |
| `/admin/usuarios` | Lista read-only de cadastros |

## Roadmap

- Collection Firestore: `adminRoadmapTasks`
- Na primeira carga vazia, faz seed a partir de `docs/checklist-roadmap-05ago.md`
- Campos: título, status (`todo` / `inprogress` / `done`), validado por Thiago, observação, seção

## Env

```bash
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=   # recomendado em produção
```
