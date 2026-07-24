# E2E / quality gates — Sentinela

Duas camadas para não depender de clique manual na próxima validação.

## 1. Gate sem browser (rápido / CI-friendly)

Avalia o **último cache** no Firestore (ou força refresh):

```bash
# só cache atual
npm run sentinel:quality-gate

# coleta + quality rank (~2 min, gasta LLM)
REFRESH=1 npm run sentinel:quality-gate
```

Exit `0` = ok; `1` = regressão (classificados, monotema, rank morto, etc.).

Assertions em `src/lib/sentinel-quality-assertions.ts`.

## 2. Playwright autenticado

### Uma vez — salvar sessão

```bash
export E2E_EMAIL='sua@conta.com'
export E2E_PASSWORD='***'
npm run test:e2e:auth
```

Gera `playwright/.auth/user.json` (gitignored).

Alternativa sem senha no shell:

```bash
npx playwright codegen --save-storage=playwright/.auth/user.json http://localhost:3000/login
# faça login na janela, feche o codegen
```

**Pré-requisito:** conta com cadastro completo (não pode cair em `/acesso-antecipado/dados`).

### Rodar specs do Sentinela

```bash
# smoke autenticado (API + página; sem refresh caro)
npm run test:e2e:sentinel

# inclui refresh + quality rank
SENTINEL_E2E_REFRESH=1 npm run test:e2e:sentinel
```

`dev` local pode já estar no ar (`reuseExistingServer`).

## O que os gates cobrem

| Check | Gate script | Playwright |
|---|---|---|
| Sem classificado de vaga/estágio no topo | sim | sim (se houver cards) |
| Não monotemático | sim | sim |
| Fake news genérica limitada | sim | sim |
| Rank LLM rodou + briefing | com `REFRESH=1` / `EXPECT_RANK=1` | com `SENTINEL_E2E_REFRESH=1` |
| UI monitoramento autenticada | — | sim |

Amostragem editorial humana (20 cards) continua sendo o gate fino da spike; estes testes evitam regressão óbvia.
