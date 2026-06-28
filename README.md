# Mandato Digital

MVP interno para colocar em operacao o fluxo central do Mandato Digital:

- onboarding persistido do parlamentar;
- entrada manual de pauta;
- geracao de 3 versoes por pauta;
- revisao humana e aprovacao;
- historico reutilizavel;
- feedback editorial para calibracao futura.

## Stack atual

- `Next.js` com App Router
- `TypeScript`
- persistencia local em `data/mandato-digital.json`
- adaptador pronto para `Supabase` via `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- integracao com `OpenAI` ou `Anthropic` quando as chaves estiverem configuradas

Sem credenciais externas, o app continua funcional usando persistencia local e um gerador fallback baseado no perfil salvo.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Documentacao

- [Sentinela — guia de uso (passo a passo)](docs/sentinela.md)

## Deploy no Firebase App Hosting

O app usa **Firebase App Hosting** (Next.js com SSR e API routes no Cloud Run).
O projeto Firebase e `madatodigital`.

### Pre-requisitos

1. Upgrade do projeto para plano **Blaze** (pay-as-you-go):
   https://console.firebase.google.com/project/madatodigital/usage/details
2. Firebase CLI logado: `firebase login`

### Primeiro deploy

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

# 4. Deploy
npm run deploy:firebase
```

A URL inicial fica no formato `mandatodigital--madatodigital.us-central1.hosted.app`.
Depois conecte o dominio `madatodigital.web.app` no console (Hosting & Serverless → App Hosting → Domains).

### Deploy automatico via GitHub

No Firebase console: **Hosting & Serverless → App Hosting → Create backend** (se ainda nao existir),
conecte o repositorio GitHub, branch `main`, root directory `/` e habilite rollouts automaticos.

### Firebase Auth — dominios autorizados

Em **Authentication → Settings → Authorized domains**, inclua:

- `localhost`
- `madatodigital.web.app`
- `madatodigital.firebaseapp.com`
- dominio `*.hosted.app` gerado pelo App Hosting (se usar antes do custom domain)

### Migrar variaveis da Vercel

Copie as variaveis de `.env.vercel.production` para secrets (`npm run firebase:secrets:apply`)
ou para o console em **App Hosting → Settings → Environment**.
Atualize `APP_BASE_URL` em `apphosting.yaml` para a URL final do Firebase.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha conforme necessario:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
EVAL_JUDGE_ENABLED=false
EVAL_JUDGE_PROVIDER=
EVAL_JUDGE_MODEL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Banco no Supabase

Se quiser sair do modo local, rode o schema em `supabase/schema.sql` e configure as variaveis.

## Fluxo do MVP

1. Salvar o onboarding do parlamentar.
2. Registrar uma nova pauta com contexto e fatos confirmados.
3. Gerar 3 versoes.
4. Revisar, aprovar e copiar a melhor.
5. Registrar feedback para orientar a proxima rodada.

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

- smoke do MVP: carrega homepage e abre o feedback lateral
- onboarding + geracao de conteudo: valida que a LLM retorna texto utilizavel
- feedback de produto com IA: valida classificacao, criticidade e campo
  `Implementar agora`

### Observacao

Os testes E2E escrevem dados reais no ambiente-alvo com prefixo
`[AUTOTEST]`. Isso ajuda a identificar e limpar registros de automacao no
Supabase quando necessario.

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
