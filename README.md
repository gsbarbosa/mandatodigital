# Mandato Digital

MVP interno para colocar em operacao o fluxo central do Mandato Digital:

- onboarding persistido do parlamentar;
- entrada manual de pauta;
- geracao de 3 versoes por pauta;
- revisao humana e aprovacao;
- historico reutilizavel.

## Stack atual

- `Next.js` com App Router
- `TypeScript`
- `Firebase Auth` + `Firestore` + `Firebase Storage` (Admin SDK no server)
- integracao com `OpenAI` ou `Anthropic` quando as chaves estiverem configuradas

Dev e producao exigem Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_JSON` localmente; ADC no App Hosting).

## Rodando localmente

```bash
npm install
# copie .env.example → .env.local e preencha Firebase + chaves LLM
npm run dev
```

Abra `http://localhost:3000`.

## Documentacao

- [Status de desenvolvimento (acompanhamento)](docs/status-desenvolvimento.md)
- [Runbook sobreaviso DEMO (~180 pessoas)](docs/runbook-sobreaviso-demo.md)
- [SPEC — Remodelagem UI/UX e navegacao](docs/spec-remodelagem-ui-navegacao.md)
- [Sentinela — guia de uso (passo a passo)](docs/sentinela.md)
- [Plano roadmap Sentinela / Validador / MVP](docs/plano-roadmap-sentinel-auditor-mvp.md)

## Deploy no Firebase App Hosting

O app usa **Firebase App Hosting** (Next.js com SSR e API routes no Cloud Run).
O projeto Firebase e `madatodigital`.

### Pre-requisitos

1. Upgrade do projeto para plano **Blaze** (pay-as-you-go):
   https://console.firebase.google.com/project/madatodigital/usage/details
2. Firebase CLI logado: `firebase login` (so para secrets/rules/indexes locais)

### Bootstrap do backend (uma vez)

```bash
# 1. Criar backend (regiao proxima ao Brasil)
firebase apphosting:backends:create \
  --project madatodigital \
  --primary-region us-central1 \
  --backend mandatodigital \
  --app 1:1075554159914:web:4566a2948db6df56f52253 \
  --root-dir .

# 2. Cadastrar secrets a partir do .env.local
npm run firebase:secrets:guide
# ou aplicar automaticamente:
npm run firebase:secrets:apply

# 3. Liberar secrets para o backend
firebase apphosting:secrets:grantaccess \
  --backend mandatodigital \
  --project madatodigital
```

A URL inicial fica no formato `mandatodigital--madatodigital.us-central1.hosted.app`.
Depois conecte o dominio `madatodigital.web.app` no console (Hosting & Serverless → App Hosting → Domains).

### Deploy (somente via pipe)

Deploy do App Hosting e **apenas** pela integracao GitHub do Firebase App Hosting
(ou CI equivalente). Fluxo normal: `commit` → `push` na branch conectada.

**Nunca** rode `firebase deploy --only apphosting` nem `npm run deploy:firebase`
(o script foi removido). Deploy manual por source upload esta desabilitado
(`alwaysDeployFromSource` removido do `firebase.json`).

Scripts que **continuam** validos (nao sao App Hosting):

- `npm run firebase:rules:deploy` — Firestore/Storage rules
- `npm run firebase:indexes:deploy` — indexes Firestore
- `npm run firebase:secrets:guide` / `--apply` — secrets do backend

### Firebase Auth — dominios autorizados

Em **Authentication → Settings → Authorized domains**, inclua:

- `localhost`
- `madatodigital.web.app`
- `madatodigital.firebaseapp.com`
- dominio `*.hosted.app` gerado pelo App Hosting (se usar antes do custom domain)

### Variaveis e secrets no App Hosting

Cadastre secrets a partir do `.env.local` (`npm run firebase:secrets:guide` / `--apply`)
e mantenha as vars não-secretas em `apphosting.yaml`.
Para puxar o remoto de volta para a máquina: `npm run env:pull -- --env stg|prod`.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha conforme necessario:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
EVAL_JUDGE_ENABLED=false
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

## Firestore

Persistencia 100% no Firestore (collections da app). Blobs em Firebase Storage (`training/…`, `compliance/…`).

```bash
# Dry-run: lista collections que seriam apagadas
npm run db:reset

# Apaga docs das collections da app (ambiente zerado)
npm run db:reset:confirm

# Rules + indexes
npm run firebase:rules:deploy
npm run firebase:indexes:deploy
```

Ver tambem [docs/firebase-storage-fase1.md](docs/firebase-storage-fase1.md).

## Fluxo do MVP

1. Salvar o onboarding do parlamentar.
2. Registrar uma nova pauta com contexto e fatos confirmados.
3. Gerar 3 versoes.
4. Revisar, aprovar e copiar a melhor.
5. Registrar aprovacao/revisao para orientar a proxima rodada.

## Testes automatizados com Playwright

O projeto agora tem cenarios E2E com `Playwright` para validar o MVP localmente
ou contra a URL publicada.

### Instalar o navegador do Playwright

```bash
npm run playwright:install
```

### Rodar localmente

Sem `APP_BASE_URL`, o Playwright sobe o app local automaticamente e usa
`http://127.0.0.1:3000`.

```bash
npm run test:e2e
```

### Rodar contra a URL publicada

```bash
APP_BASE_URL=https://madatodigital.web.app npm run test:e2e
```

### Cenarios cobertos

- smoke do MVP: carrega homepage e abre login
- onboarding + geracao de conteudo: valida que a LLM retorna texto utilizavel

### Observacao

Os testes E2E escrevem dados reais no ambiente-alvo com prefixo
`[AUTOTEST]`. Isso ajuda a identificar e limpar registros de automacao no
Firestore quando necessario.

## Avaliacao do core da LLM

O projeto agora suporta uma camada simples de avaliacao do core da LLM:
`1 geracao principal + 1 juiz LLM`, sem impactar a resposta principal entregue
ao usuario.

### Como funciona

- a rota `POST /api/generate` continua respondendo normalmente para o usuario;
- se `EVAL_JUDGE_ENABLED=true`, o sistema avalia a geracao principal apos a
  resposta;
- a geracao e pontuada por um juiz LLM e persistida em:
  - `evaluation_runs`
  - `evaluation_candidates`
  - `evaluation_scores`

### Variaveis de ambiente

- `EVAL_JUDGE_ENABLED=true`: liga a avaliacao automatica apos a geracao principal
- `EVAL_JUDGE_PROVIDER`: provider do juiz editorial (`openai` ou `anthropic`)
- `EVAL_JUDGE_MODEL`: modelo do juiz editorial

Se `EVAL_JUDGE_PROVIDER` nao for informado, o sistema tenta resolver um juiz com
os providers ja configurados no ambiente.

### Rotas de avaliacao

- `POST /api/evals/judge`: dispara uma avaliacao manual para um
  `contentRequestId`
- `GET /api/evals/runs`: lista relatorios recentes
- `GET /api/evals/runs/:id`: retorna um relatorio detalhado de um run
