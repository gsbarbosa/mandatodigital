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
APP_BASE_URL=https://seu-app.vercel.app npm run test:e2e
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
