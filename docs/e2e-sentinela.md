# E2E / quality gates — Sentinela

Duas camadas para não depender de clique manual na próxima validação.

## 1. Gate sem browser (rápido / CI-friendly)

Avalia o **último cache** no Firestore (ou força refresh):

```bash
# só cache atual
npm run sentinel:quality-gate

# coleta + quality rank (~2 min, gasta LLM)
REFRESH=1 npm run sentinel:quality-gate

# município pequeno (ex.: Jericoacoara-CE) — temas + região + atualidade
QUERIES_ONLY=1 npm run sentinel:quality-municipal          # shape das queries (sem rede)
npm run sentinel:quality-municipal                         # coleta live (cenário Jeri)
SOFT_CITY=1 npm run sentinel:quality-municipal             # não falha se só houver hit estadual
CITY="Jijoca de Jericoacoara" STATE=CE npm run sentinel:quality-municipal
```

Exit `0` = ok; `1` = regressão (classificados, monotema, rank morto, etc.).

Assertions em `src/lib/sentinel-quality-assertions.ts` e `src/lib/sentinel-quality-municipal.ts`.

## 2. Playwright autenticado (fluxo Sentinela)

### Uma vez — salvar sessão

Com o fluxo atual, **login sozinho não libera o produto**: precisa cadastro completo em `/acesso-antecipado/dados`.

Bootstrap automático (Firebase Admin + sessão + `POST /api/user/registration` → grava storageState):

```bash
npm run test:e2e:bootstrap
```

Gera `playwright/.auth/user.json` e `playwright/.auth/e2e-credentials.json` (gitignored). Contas `e2e.*@example.com` entram na allowlist premium.

Alternativa com conta já existente (já com cadastro completo):

```bash
export E2E_EMAIL='sua@conta.com'
export E2E_PASSWORD='***'
npm run test:e2e:auth
```

### Rodar specs do Sentinela

```bash
# smoke autenticado (página + API + selecionar/salvar temas; sem refresh caro)
npm run test:e2e:sentinel

# fluxo completo: até 8 temas unificados → Salvar radar → Atualizar pautas → quality gates
SENTINEL_E2E_REFRESH=1 npm run test:e2e:sentinel
```

`dev` local pode já estar no ar (`reuseExistingServer`).

### O que o fluxo completo cobre

1. Abre `/monitoramento/temas`
2. Define UF (MG) e seleciona até 8 temas de interesse (pills com `data-testid="theme-tag-pill"`)
3. Clica **Salvar radar** e confere o perfil persistido
4. Vai ao Monitoramento e clica **Atualizar pautas**
5. Valida quality gates (sem classificados, não monotema, rank/briefing) e que `themeLabel` dos cards ∈ radar salvo

## O que os gates cobrem

| Check | Gate script | Municipal | Playwright |
|---|---|---|---|
| Sem classificado de vaga/estágio no topo | sim | sim | sim (fluxo completo) |
| Não monotemático | sim | sim (limiar mais frouxo) | sim |
| Fake news genérica limitada | sim | sim | sim |
| Rank LLM rodou + briefing | com `REFRESH=1` | opcional | com `SENTINEL_E2E_REFRESH=1` |
| Queries município+UF / tema×cidade | — | sim | — |
| Reportagens atuais (≤14d) | — | sim | — |
| Relevância regional (cidade/UF) | — | sim | — |
| Temas alinhados ao radar | — | sim | sim |
| Fallback municipal (sem tema × cidade → notícias locais + aviso) | — | — | UI (`municipalFallback`) |
| Seleção de temas + save | — | — | sim (`SENTINEL_E2E_REFRESH=1`) |
| Cards só com temas do radar | — | — | sim |
| UI monitoramento autenticada | — | — | sim |

Amostragem editorial humana (20 cards) continua sendo o gate fino da spike; estes testes evitam regressão óbvia.
