# Spike — Sentinela qualidade (1 semana)

**ID:** `spike/sentinela-qualidade`  
**Início:** 2026-07-11  
**Timebox:** 7 dias  
**Status:** em andamento

## Hipótese

> Rank de 2 estágios (score local → LLM mini só no top N) sobe a **% de cards pautáveis** sem estourar o custo do refresh de convidado. Perplexity fica fora do path default (só experimento B, gated).

## Métricas de sucesso

| Métrica | Como medir | Meta da spike |
|---|---|---|
| **% pautável** | Heurística + amostra humana (20 cards) | ≥ **60%** no top 10 (baseline a medir) |
| **Custo/refresh guest** | Tokens LLM estimados no meta | ≤ **US$ 0,05** |
| **Custo/refresh premium** (com rank LLM) | Idem | ≤ **US$ 0,15** |
| **Latência refresh p95** | Logs Cloud Run | Não piorar > **30%** vs baseline atual |
| **Recall útil** | `articlesScanned > 0` e ≥ 3 cards news | Manter ≥ baseline pós-fix RSS |

### Definição de “pautável” (heurística v0)

Card de notícia é pautável se **score ≥ 0,55**, onde o score combina:

- tema do radar explícito no rótulo
- `relevanceScore` alto
- ≥ 1 matéria com título utilizável
- bônus multi-veículo (`outletCount`)
- penalidade se título genérico / só geo
- oposição conta em bucket separado (não entra no % news)

Amostragem humana: 20 cards ranqueados, label sim/não “eu pautaria no Criativo”.

## Escopo

### Dentro

1. Harness de qualidade + custo no `meta` do refresh  
2. Flag `SENTINEL_LLM_QUALITY_RANK` — reordena/filtra top N com LLM mini + briefing curto  
3. Script `npm run sentinel:quality-eval` sobre cache Supabase  
4. Comparar baseline (flag off) vs tratamento (flag on) em 2–3 contas

### Fora (próxima iteração)

- Perplexity/Sonar em produção  
- Trocar Google News por LLM como crawler  
- Auto-refresh 24h  

## Experimentos

| # | Nome | Flag / mudança | Conta |
|---|---|---|---|
| A0 | Baseline | flags atuais, quality rank off | guest + premium |
| A1 | Top-N LLM rank | `SENTINEL_LLM_QUALITY_RANK=true` | premium primeiro |
| B0 | Perplexity (opcional D+5) | 1 query/esfera, manual | 1 conta premium |

## Decisão no fim da semana

- Se A1 ≥ meta e custo ok → ligar quality rank no **premium** em prod; guest fica baseline  
- Se custo estourar → reduzir N (15→8) ou só briefing sem re-rank  
- Se qualidade não subir → spike de queries/feeds antes de mais LLM  
- Perplexity só se A1 saturar e ainda faltar “ângulo”

## Como rodar

```bash
# testes do harness
npm test -- src/lib/sentinel-quality.test.ts src/lib/sentinel-quality-rank.test.ts

# eval no cache de produção (service role no .env.local)
npm run sentinel:quality-eval
```

Ligar rank em staging/prod (App Hosting):

```yaml
- variable: SENTINEL_LLM_QUALITY_RANK
  value: "true"
```

## Log de resultados

| Data | Conta | Modo | % pautável | Custo est. | Notas |
|---|---|---|---|---|---|
| 2026-07-11 | cache `2d2152bd` | A0 | **71,4%** (10/14 news) | n/a (pré-meta) | baseline heurística |
| 2026-07-11 | cache `188ba77b` | A0 | **100%** (20/20) | n/a | baseline heurística |
| 2026-07-11 | cache `92add5a6` | A0 | **100%** (20/20) | n/a | baseline heurística |
| | | A1 | | | ligar `SENTINEL_LLM_QUALITY_RANK` + refresh |

> Nota: a heurística v0 está otimista em caches já filtrados. Amostragem humana (20 cards) é o gate real da spike.
