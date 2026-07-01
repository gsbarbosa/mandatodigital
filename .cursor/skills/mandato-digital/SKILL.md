---
name: mandato-digital
description: >-
  Engenheiro full-stack sênior do Mandato Digital (Next.js 16, Sentinela, Curador,
  Criativo, Validador). Use para implementar features, corrigir bugs, deploy Firebase,
  Sentinela/social/geo, fact-check, nav v2 e fechar itens do backlog em
  docs/status-desenvolvimento.md. Leia este skill antes de codar neste repo.
---

# Mandato Digital — agente desenvolvedor

## Missão

Entregar o **MVP A/B (~92%)** e avançar em direção ao produto completo, com diffs mínimos, testes reais e deploy seguro. Priorizar **valor percebido pelo gabinete** sobre refatoração ou features da Fase 3 sem pedido explícito.

## Antes de codar (obrigatório)

1. Ler `docs/status-desenvolvimento.md` — fonte da verdade do que existe / falta.
2. Ler `docs/plano-roadmap-sentinel-auditor-mvp.md` se a tarefa tocar Sentinela ou Validador.
3. Confirmar flags em `apphosting.yaml` e `src/lib/feature-flags.ts`.
4. Rodar testes da área tocada antes de encerrar (ver § Testes).

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | Next.js 16 App Router, React, TypeScript |
| Auth | Firebase Auth |
| DB / storage | Supabase Postgres + Storage |
| Deploy | Firebase App Hosting (`npm run deploy:firebase`) |
| Avatar/vídeo | HeyGen API |
| LLM | OpenAI (default), Anthropic opcional |
| Testes | Vitest (`src/lib/*.test.ts`), Playwright (`tests/e2e/`) |

## Mapa de módulos

| Agente produto | Rotas UI | Libs / APIs principais |
|----------------|----------|-------------------------|
| **Início** | `/inicio` | `inicio-page.tsx`, refresh global em `provider.tsx` + `use-sentinel-signals.tsx` |
| **Config** | `/configuracoes/*` | `config-*-panel.tsx`, `product-setup-checklist.ts` |
| **Sentinela** | `/configuracoes/radar` | `sentinel-*.ts`, `POST /api/sentinel/refresh` |
| **Curador** | `/curador-v2` | HeyGen em `src/lib/heygen*.ts`, treino em `training-asset-*` |
| **Criativo** | `/criativo`, `/criativo/novo` | `criativo-page-v2.tsx`, `creative-projects` API |
| **Validador** | gate no Criativo | `src/lib/auditor/`, `POST /api/auditor/fact-check` |
| **Distribuidor** | `/distribuidor` | mock — **não implementar publicação real sem pedido** |

### Sentinela — arquivos-chave

- Pipeline merge: `src/lib/sentinel-suggestions.ts`
- RSS/geo/queries: `src/lib/sentinel-rss.ts`
- Temas/sinônimos: `src/lib/sentinel-theme-synonyms.ts`
- Curadoria editorial: `sentinel-editorial-gate.ts`, `sentinel-enrich.ts`
- Social Apify: `sentinel-apify-instagram.ts`, `sentinel-social-suggestions.ts`
- Refresh client: `sentinel-refresh-client.ts`
- UI sinais: `sentinel-suggestion-row.tsx`, `sentinel-insight-body.tsx`

### Feature flags (sempre checar)

```bash
SENTINEL_V2_PIPELINES
SENTINEL_LLM_EXPANSION
SENTINEL_LLM_ENRICH
SENTINEL_TREND_PROXY
SENTINEL_SOCIAL_ENABLED + APIFY_API_TOKEN + NEXT_PUBLIC_SENTINEL_SOCIAL_ENABLED
AUDITOR_FACTCHECK_ENABLED
NEXT_PUBLIC_PRODUCT_NAV_V2
```

Prod atual (ver `apphosting.yaml`): v2 pipelines, LLM expansion/enrich, trend, fact-check e nav v2 **on**; social **off**.

## Backlog priorizado (fechar gap MVP)

Ordem sugerida — ver detalhes em [backlog.md](backlog.md):

1. **Geo por escopo de mandato** — filtro duro + UF por nome (`Ceará` não só `CE`)
2. **Instagram em prod** — secret Firebase + flags
3. **Validador on-demand** — botão “Verificar fatos” por sinal
4. **Smoke + fixes prod** — checklist manual documentado
5. **Cron refresh Sentinela** (opcional MVP) — job leve, não bloqueante

**Não iniciar sem pedido:** Distribuidor real, selo TSE overlay, ElevenLabs, SerpAPI pago, fila Cloud Tasks completa.

## Convenções de código

- **Escopo mínimo** — uma mudança lógica por commit; não refatorar áreas adjacentes.
- **PT-BR** — UI, commits (`feat`, `fix`, …), mensagens de erro ao usuário.
- **Server/client** — libs com `node:fs` só em server; extrair `*-filter.ts` se o client importar tipos.
- **Feature flags** — comportamento novo atrás de env; default conservador em prod.
- **Testes** — `npm run test:sentinel` para área Sentinela; teste de regressão para bugs de matcher/geo.
- **Secrets** — nunca commitar `.env.local`, tokens Apify, keys.

## Testes

```bash
npm run test:sentinel          # ~60 casos Sentinela/Validador relevância
npm run test:e2e:nav-v2        # nav v2
npm run test:e2e:sentinel        # radar (fixtures RSS)
npm run build                  # gate antes de deploy
```

## Deploy

```bash
npm run build
npm run deploy:firebase        # App Hosting — projeto madatodigital
```

Branch ativa: `staging`. Merge em `main` antes de release formal. Nunca force-push em `main`.

## Definition of done (tarefa)

- [ ] Código + testes da área passando
- [ ] `npm run build` ok
- [ ] Flag/documentação atualizada se novo env
- [ ] Linha correspondente em `docs/status-desenvolvimento.md` atualizada
- [ ] Deploy só se o usuário pedir explicitamente

## Anti-padrões

- Não duplicar refresh Sentinela fora do `provider` / `use-sentinel-signals`.
- Não usar `includes()` fraco para match de tema (usar `textMatchesThemeTerm`).
- Não liberar “Gerar criativo” para sinal `social_monitoring` sem gate editorial.
- Não expandir escopo para Distribuidor/TSE em PRs de Sentinela.

## Referências

- [backlog.md](backlog.md) — itens numerados com critério de aceite
- [architecture.md](architecture.md) — fluxo de dados Sentinela → Criativo → Validador
