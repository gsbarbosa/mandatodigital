# Painel de gestão (`/admin`)

Painel interno compartilhado (Guga / Thiago) para operação da plataforma.

## Acesso

Único caminho, em [`getAdminSession()`](../src/lib/admin/session.ts): **flag de admin** — login normal do app (Firebase Auth, mesma conta de candidato) + campo `isAdmin: true` no cadastro (`userRegistrations/{ownerUserId}`). Sem tela de login separada: se a sessão Firebase já está ativa e a flag está ligada, `/admin` abre direto. Reavaliado a cada request — desligar a flag revoga o acesso na hora. Sem sessão Firebase, `/admin` redireciona para `/login`; com sessão mas sem a flag, redireciona para `/`.

- Ativar/desativar: `npm run admin:set-flag -- email@exemplo.com [off]` (requer `FIREBASE_SERVICE_ACCOUNT_JSON` local; busca o uid via Firebase Auth e grava a flag no Firestore). Ver [`scripts/set-admin-flag.mjs`](../scripts/set-admin-flag.mjs).
- Pré-requisito: a conta precisa já ter feito login no app pelo menos uma vez (usuário existente no Firebase Auth).

Não há mais login estático por senha compartilhada — foi removido. `ADMIN_SESSION_SECRET` continua existindo só como chave de criptografia do cofre de provider secrets (`src/lib/admin/provider-secrets.ts`), não como credencial de acesso.

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
ADMIN_SESSION_SECRET=   # chave do cofre de provider secrets — recomendado em produção
```
