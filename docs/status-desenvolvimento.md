# Status de desenvolvimento — Mandato Digital

Documento vivo para acompanhar o que **já existe**, o que está **parcial** e o que **falta implementar**.

**Última atualização:** 2026-06-30  
**Produção:** https://mandatodigital--madatodigital.us-central1.hosted.app  
**Último deploy:** commit `3f8e502` (branch `staging` → Firebase App Hosting)  
**Branch principal (Git):** `main` (verificar merge de `staging` antes de release formal)

Documentos relacionados:

- [Guia Sentinela](sentinela.md) — parcialmente desatualizado; preferir este doc para status
- [Plano roadmap](plano-roadmap-sentinel-auditor-mvp.md)
- [Parecer técnico Tars](parecer-tars-roadmap.md)
- [Proposta navegação v2 (operação-first + rollback)](proposta-navegacao-v2.md)

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Pronto e em uso (prod ou dev com flags padrão) |
| 🟡 | Código pronto; desligado em prod ou depende de flag/smoke test |
| 🔶 | Parcial — começou, não fecha o pedido original |
| ❌ | Não implementado |
| ⏸ | Bloqueado por decisão externa (produto, jurídico, API key) |

**Flags em produção** (`apphosting.yaml`, 2026-06-30):

| Flag | Prod |
|------|------|
| `SENTINEL_V2_PIPELINES` | `true` |
| `SENTINEL_LLM_EXPANSION` | `true` |
| `SENTINEL_TREND_PROXY` | `true` |
| `SENTINEL_LLM_ENRICH` | `true` |
| `AUDITOR_FACTCHECK_ENABLED` | `true` |
| `NEXT_PUBLIC_PRODUCT_NAV_V2` | `true` |
| `SENTINEL_SOCIAL_ENABLED` | off (requer `APIFY_API_TOKEN` + secret Firebase) |
| `NEXT_PUBLIC_SENTINEL_SOCIAL_ENABLED` | off |

**Migrations Supabase aplicadas:**

- [x] `20260624_sentinel_foundation.sql`
- [x] `20260625_auditor_foundation.sql`

---

## 1. Plataforma e infraestrutura

| Item | Status | Notas |
|------|--------|-------|
| Firebase App Hosting (deploy SSR + API) | ✅ | `npm run deploy:firebase` |
| Firebase Auth (login) | ✅ | |
| Supabase Postgres (perfil, criativos, Sentinela, Auditor) | ✅ | |
| Supabase Storage (vídeos de treino) | ✅ | TUS >6MB via API |
| Persistência local `data/` (dev sem Supabase) | ✅ | |
| Feature flags por env | ✅ | `src/lib/feature-flags.ts` |
| Migrations versionadas + scripts CLI | ✅ | `npm run db:migrate:*` |
| Rate limit refresh Sentinela (30/dia/usuário) | ✅ | `src/lib/rate-limit.ts` |
| Toast global de status (sucesso/erro) | ✅ | `app-status-toast.tsx` + provider |
| Fila de jobs (LLM, social, fact-check async) | ❌ | Fase 3.1 |
| Rate limit vídeos (ex.: 5/dia) | ❌ | Fase 3.1 |
| `minInstances: 1` Cloud Run | ❌ | Fase 3.1 |
| Migração stack → Firestore only | ❌ | Decisão: manter Supabase |
| Cron / ping Supabase free tier | ❌ | Evitar pause do projeto |

---

## 2. MVP original (geração de texto)

| Item | Status | Notas |
|------|--------|-------|
| Onboarding / perfil parlamentar | ✅ | Wizard v2 + redirect checklist |
| Entrada manual de pauta | ✅ | |
| Geração de 3 versões (OpenAI / Anthropic) | ✅ | |
| Fallback sem API key | ✅ | |
| Revisão, aprovação, histórico | ✅ | |
| Feedback editorial | ✅ | |
| Avaliação LLM (juiz shadow / evals) | ✅ | |
| Landing page pública | ✅ | `/` |
| Testes E2E Playwright | ✅ | `npm run test:e2e`, `test:e2e:nav-v2`, `test:e2e:sentinel` |

---

## 3. Curador (identidade + avatar)

| Item | Status | Notas |
|------|--------|-------|
| UI v2 (`/curador-v2`) | ✅ | Nav v2 aponta para Curador |
| Perfil, tom, arquétipo, glossário | ✅ | Também em `/configuracoes/perfil` |
| Upload áudio / foto / vídeo de treino | ✅ | |
| HeyGen — gêmeo digital (vídeo) | ✅ | |
| HeyGen — avatar foto (`photo_real`) | ✅ | |
| HeyGen — caricatura (OpenAI + HeyGen) | ✅ | |
| Consent HeyGen | ✅ | |
| Clone de voz HeyGen | ✅ | |
| Config avatar dedicada (`/configuracoes/avatar`) | ✅ | Status de setup por seção |
| Curador v1 / Argil (legado) | 🔶 | Rotas existem; fluxo principal é HeyGen v2 |
| ElevenLabs como voz default | ❌ | Fase 3.3 |
| Spike A/B HeyGen vs ElevenLabs | ❌ | Parecer Tars recomenda 1 dia |
| Deprecar `/curador-v1` + banner | ❌ | Fase 3.1 |

---

## 4. Criativo (roteiro + vídeo)

| Item | Status | Notas |
|------|--------|-------|
| UI v2 (`/criativo`, `/criativo/novo`) | ✅ | |
| Lista e persistência `creative_projects` | ✅ | |
| Roteiro via HeyGen transcript + contexto Curador | ✅ | |
| Handoff Sentinela → Criativo (sinal por ID) | ✅ | `?sugestao=` |
| Handoff monitoramento social | ✅ | `?sugestao=&monitoring=1` (sem gate automático) |
| Produção vídeo HeyGen | ✅ | |
| Prompt livre (modo teste) | ✅ | Sem fact-check |
| Badges pipeline + tipo de sinal (oportunidade/monitoramento) | ✅ | Sentinela editorial |
| Metadados TSE em `creative_projects.metadata` | 🟡 | Grava ao salvar criativo |
| Gate fact-check ao aprovar roteiro | ✅ | `AUDITOR_FACTCHECK_ENABLED=true` em prod |
| Loading contextual do Validador ao aprovar | ✅ | Frases rotativas + painel |
| Checkbox consentimento pós-edição do roteiro | ✅ | Ativo com Validador on |
| Backgrounds HeyGen / pós-FFmpeg | ❌ | Fase 3.4 |

---

## 5. Sentinela (radar + sinais)

Referência de uso: [sentinela.md](sentinela.md) (atualizar quando possível)

### 5.1 Base (pré-roadmap + Camada 1–2)

| Item | Status | Notas |
|------|--------|-------|
| UI radar (`/configuracoes/radar`, legado `/sentinela`) | ✅ | Nav v2: radar em Configurações |
| Formulário radar (temas, oposição, @, portais) | ✅ | Abas mandato / oposição |
| Google News RSS + cidade/estado na query | ✅ | `buildSentinelRssQueries` |
| RSS portais cadastrados | ✅ | |
| Sinônimos estáticos por tema | ✅ | `sentinel-theme-synonyms.ts` |
| Match por palavra inteira + strip de hashtags | ✅ | Evita falsos positivos (`iva`, `#vacina`) |
| Clustering multi-veículo | ✅ | |
| APIs `GET/POST /api/sentinel/*` | ✅ | |
| Handoff → Criativo | ✅ | |
| Botões Salvar radar / Atualizar sinais | ✅ | |
| Sanitização temas fantasma no radar | ✅ | `sentinel-radar-themes.ts` |
| Refresh global (provider + toast + pill no header) | ✅ | Busca continua ao trocar de tela |
| Lista Início: oportunidades vs monitoramento social | ✅ | Gate criativo por tipo de sinal |

### 5.2 Geografia e mandato

| Item | Status | Notas |
|------|--------|-------|
| Cidade + UF nas buscas RSS / expansão LLM | ✅ | Ex.: `Vacinação Fortaleza CE` |
| Boost de score se cidade/UF no título | ✅ | +20 cidade, +10 UF |
| Nome completo do estado nas queries (ex. Ceará) | ❌ | Hoje usa sigla `CE` |
| Filtro duro por escopo de mandato (vereador vs estadual vs federal) | ❌ | Prioridade backlog |
| Rejeitar matéria de outro estado/município | ❌ | |
| Badge “Local / Nacional / Fora da base” na UI | ❌ | |
| Portais regionais por UF (curadoria de domínios) | 🔶 | Usuário cadastra manualmente |
| Social com filtro geográfico | ❌ | Instagram é agnóstico de UF |

### 5.3 Fase 0 — Fundação

| Item | Status | Notas |
|------|--------|-------|
| Tabela `sentinel_suggestion_cache` | ✅ | Migration aplicada |
| Tabela `sentinel_signals` (histórico) | ✅ | |
| Tabela `sentinel_theme_expansions` | ✅ | |
| Cache L1 memória + L2 Supabase | ✅ | Fallback JSON local em dev |
| Feature flags Sentinela | ✅ | |
| Testes unitários / integração | ✅ | `npm run test:sentinel` (~60 casos) |
| Fixtures RSS offline (`SENTINEL_RSS_FIXTURES`) | ✅ | E2E e dev sem rede |

### 5.4 Fase 1 — Núcleo Sentinela

| Item | Status | Flag prod | Notas |
|------|--------|-----------|-------|
| **1.1** Expansão semântica LLM ao salvar radar | ✅ | on | OpenAI |
| UI “Termos monitorados (expansão)” | ✅ | on | |
| `GET /api/sentinel/expansions` | ✅ | on | |
| **1.2.1** Pipeline temas manuais (match literal) | ✅ | on | 3 temas custom |
| **1.2.3** Pipeline portais + trend boost | ✅ | on | RSS + clustering |
| **1.2.4** Pipeline semântico (termos expandidos) | ✅ | on | |
| Trend proxy (volume D vs D-7) | ✅ | on | Histórico em `sentinel_signals` |
| Badge pipeline + “↑ volume” | ✅ | on | |
| Ranking unificado com pesos por pipeline | ✅ | on | `sentinel-pipeline.ts` |
| **1.2.2** Pipeline social / Instagram (Apify) | 🟡 | off | Código pronto; secret `apify-api-token` |
| Engajamento social (likes/comments/shares) | 🟡 | off | Score viral separado da relevância editorial |
| Curadoria editorial (gate oportunidade vs monitoramento) | ✅ | on | Heurística sempre; LLM se enrich on |
| Enriquecimento LLM de sinais (`sentinel-enrich`) | ✅ | on | Resumo factual, ângulo, `creativeWorthy` |
| Correlação social + imprensa (promoção de sinal) | ✅ | on | `sentinel-social-cross-match.ts` |
| X / TikTok / YouTube nos perfis @ | ❌ | | UI “em breve” |
| Google Trends / SerpAPI | ❌ | | ⏸ Budget ~US$ 75/mo |
| Refresh automático periódico (cron, sem clique) | ❌ | | |
| Fact-check status nos cards de sinal (UI) | ❌ | | Background roda; badge no card ❌ |

---

## 6. Validador / Auditor (Fase 2)

| Item | Status | Flag prod | Notas |
|------|--------|-----------|-------|
| UI Auditor v2 (`/auditor`) | 🔶 | | Mock/demo — prefs de fontes |
| `POST /api/auditor/fact-check` | ✅ | on | LLM + fetch URLs do sinal |
| Fact-check top 10 após refresh Sentinela | ✅ | on | Background |
| Gate no Criativo ao aprovar roteiro | ✅ | on | Bloqueia se `disputed` |
| UX de loading ao validar (frases rotativas) | ✅ | on | `auditor-fact-check-loading.tsx` |
| Re-validação + consent se editou roteiro | ✅ | on | |
| Tabela `sentinel_fact_checks` | ✅ | | Migration aplicada |
| Tabela `audit_log` | ✅ | | |
| Botão “Verificar fatos” por sinal (on-demand) | ❌ | | Pedido 2.1 |
| Fila real no Auditor | ❌ | off | `AUDITOR_V2_REAL_QUEUE` |
| Perplexity como provider alternativo | ❌ | | Backlog |
| Modal alerta TSE + log edição “ilegítima” | 🔶 | | `audit_log` parcial; UI legal ❌ |
| Prompt livre exempt de fact-check | ✅ | on | Registrado em audit |

**Produção:** Validador embutido no fluxo do Criativo (aprovar roteiro). API: `POST /api/auditor/fact-check`.

---

## 7. Distribuidor

| Item | Status | Notas |
|------|--------|-------|
| UI v2 (`/distribuidor`) | 🔶 | Mock — salva prefs no perfil |
| Publicação real (WhatsApp, redes, email) | ❌ | |
| Janelas de publicação automatizadas | ❌ | |
| Blackout eleitoral (72h antes / 24h depois) | ❌ | Fase 3.2 / compliance |

---

## 8. Compliance e escala (Fase 3)

| Item | Status | Notas |
|------|--------|-------|
| Selo TSE — metadados JSON | 🔶 | `creative-ai-metadata.ts` |
| Selo TSE — overlay queimado no vídeo | ❌ | FFmpeg pós-HeyGen |
| Texto selo validado juridicamente | ⏸ | |
| ElevenLabs via HeyGen API | ❌ | Spike pendente |
| Backgrounds HeyGen | ❌ | P4 backlog |
| Spike carga (50 usuários simulados) | ❌ | Fase 3.1 |
| Congelar treino vídeo longo / escala varejo foto-only | ❌ | Decisão Tars documentada |

---

## 9. Decisões de produto pendentes

| # | Decisão | Impacto | Status |
|---|---------|---------|--------|
| 1 | Instagram em prod: cadastrar secret Apify + ligar flags | Pipeline social 1.2.2 | ⏸ Código pronto |
| 2 | SerpAPI (~US$ 75/mo) vs só trend proxy grátis | Precisão “em alta” | ⏸ |
| 3 | Filtro geográfico por escopo de mandato | Relevância estadual/municipal | 📋 Prioridade alta |
| 4 | ElevenLabs: conta única vs BYOK por cliente | Fase 3.3 | ⏸ |
| 5 | Texto selo TSE — revisão jurídica | Overlay legal | ⏸ |
| 6 | Supabase Pro vs manter free + cron | Infra estável | ⏸ |
| 7 | Merge `staging` → `main` pós-deploy | Git / releases | 📋 Pendente |

---

## 10. Navegação v2 (operação-first)

Documentação: [proposta-navegacao-v2.md](proposta-navegacao-v2.md)

| Item | Status | Flag prod |
|------|--------|-----------|
| Shell v1 preservado (`ProductShellV1`) | ✅ | rollback: flag `false` |
| Shell v2 sidebar + header | ✅ | on |
| `/inicio` — sinais + projetos + checklist setup | ✅ | on |
| `/configuracoes` — hub por seção | ✅ | on |
| `/configuracoes/perfil`, `/avatar`, `/radar` | ✅ | on |
| `/onboarding` wizard | ✅ | on |
| Refresh Sentinela global (toast + pill) | ✅ | on |
| E2E `tests/e2e/nav-v2.spec.ts` | ✅ | |
| E2E `tests/e2e/sentinel-radar.spec.ts` | ✅ | `SENTINEL_RSS_FIXTURES` |

---

## 11. Ordem sugerida de execução

```
[x] Fase 0 — migrations + cache Supabase + flags
[x] Fase 1 — Sentinela v2 (exceto Instagram em prod)
[x] Deploy prod com flags Sentinela + Validador + nav v2 + LLM enrich
[x] Curadoria editorial + refresh global Sentinela
[ ] Smoke test manual em prod (Início, radar, Criativo, Validador)
[ ] Filtro geográfico por escopo de mandato (estadual/municipal)
[ ] Cadastrar Apify em prod → ligar Instagram
[ ] Atualizar sentinela.md alinhado a este doc
[ ] Merge staging → main
[ ] Auditor UI fila real (AUDITOR_V2_REAL_QUEUE)
[ ] Selo TSE overlay + jurídico
[ ] ElevenLabs / Distribuidor / escala (Fase 3)
```

---

## 12. Changelog deste documento

| Data | Mudança |
|------|---------|
| 2026-06-24 | Criação inicial pós deploy Fase 0+1 e migration Auditor |
| 2026-06-24 | Sentinela v2 + LLM + trend proxy **on** em prod |
| 2026-06-24 | Validador ligado em prod; proposta e implementação nav v2 (flag off) |
| 2026-06-30 | Deploy `3f8e502`: nav v2 **on**, `SENTINEL_LLM_ENRICH` **on** |
| 2026-06-30 | Curadoria editorial Sentinela, refresh global, Validador loading |
| 2026-06-30 | Seção **5.2 Geografia e mandato** (lacunas explícitas) |
| 2026-06-30 | Configurações por seção, checklist Início, testes Sentinela E2E |

---

## Como atualizar

1. Ao mergear feature: mudar status na tabela correspondente.
2. Ao ligar flag em prod: atualizar seção **Flags em produção**.
3. Ao rodar migration: marcar checkbox em **Migrations Supabase**.
4. Registrar mudança na seção **Changelog**.
