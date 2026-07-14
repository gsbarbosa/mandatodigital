# Plano crítico — Sentinela, Validador e MVP (v2)

Documento para alinhamento com **Tars** (avaliação técnica de ferramentas/APIs) e execução incremental **sem quebrar** o que já está em produção.

**Baseline em produção (2026-06-24):**
- Sentinela: RSS Google News + portais + sinônimos estáticos → Criativo
- Curador/Criativo: HeyGen (gêmeo por foto + voz clonada HeyGen)
- Auditor/Distribuidor: UI demo (mock)
- Deploy: Firebase App Hosting + Supabase

---

## Princípios de execução (não negociáveis)

1. **Uma entrega por PR** — cada fase mergeável e revertível isoladamente.
2. **Feature flags** — comportamento novo atrás de env (`SENTINEL_SOCIAL_ENABLED`, `AUDITOR_FACTCHECK_ENABLED`, etc.).
3. **Não remover fluxos que funcionam** — `/criativo/novo`, `saveProfile`, HeyGen train/video, APIs Sentinela atuais permanecem até substituição explícita.
4. **Tipos e contratos estáveis** — estender `MockSentinelSuggestion` / `creative_projects` com campos opcionais; não renomear IDs de sinal (`sentinela-rss-*`).
5. **Economia de tokens** — fact-check sob demanda (top 10 automático; resto por clique), expansão semântica em batch no save (não a cada refresh).
6. **Tars antes de contratar API paga** — toda integração Perplexity/Trends/scraping social passa por spike de 1–2 dias com critérios de aceite.

---

## Mapa do que pedido vs o que existe

| Pedido | Estado atual | Gap principal |
|--------|--------------|---------------|
| 1.1 Expansão semântica (IA) | Sinônimos estáticos em `sentinel-theme-synonyms.ts` | LLM batch + cache persistido |
| 1.2.1 Temas manuais (3) + trends | Custom themes no form; sem trends | Google Trends ou alternativa; score de crescimento |
| 1.2.2 Perfis sociais + engajamento | @ salvos; **não buscados** | API/scraping Instagram (prioridade 30/) |
| 1.2.3 Portais + trends | RSS + clustering **implementado** | Camada trends + ranking explícito “em alta” |
| 1.2.4 Temas expandidos rastreados | Parcial via sinônimos na busca | Pipeline dedicado por termo expandido |
| 2.x Validador / fact-check | Auditor mock; aprovação roteiro no Criativo **sem** fact-check | Novo serviço + UI gate no Criativo |
| 3.1 Escala varejo | Cloud Run max 10 inst.; cache Sentinela in-memory | Cache Supabase, filas, rate limit |
| 3.2 Selo TSE IA | Só marketing (landing) | Overlay vídeo + metadados |
| 3.3 ElevenLabs voz | Só HeyGen clone (+reuso/cap 10) | TTS ElevenLabs → `audio_url` na HeyGen (sai do limite 10) |
| 3.4 Backgrounds | Não existe | HeyGen background / pós-FFmpeg (P4) |

---

## Arquitetura alvo (4 pipelines do Sentinela)

O formulário continua **uma tela**, mas o backend passa a expor **4 scores independentes** que alimentam um ranking unificado:

```
┌─────────────────────────────────────────────────────────────┐
│                    Sentinela (UI)                            │
│  Aba Temas │ Aba Oposição │ (mesmo form, 4 pipelines)       │
└────────────┬────────────────────────────────────────────────┘
             │
   ┌─────────┼─────────┬─────────────┬──────────────────┐
   ▼         ▼         ▼             ▼                  ▼
 P1 Manual  P2 Social P3 Portais   P4 Semântica    (merge)
  themes     @profiles  sites      expanded terms   ranker
   │         │         │             │                  │
   └─────────┴─────────┴─────────────┴──────────────────┘
                              │
                    sentinel_signals (DB)
                              │
                         Criativo / Validador
```

**Entrega de dados unificada:** cada sinal carrega `pipeline: manual | social | portal | semantic` e `evidence` tipada (já parcialmente modelado em `sentinel-mock-suggestions.ts`).

---

# FASE 0 — Fundação (1 semana) · não muda UX visível

**Objetivo:** preparar terreno sem alterar comportamento do usuário.

| # | Tarefa | Arquivos / notas | Risco se pular |
|---|--------|------------------|----------------|
| 0.1 | Tabela `sentinel_signals` + `sentinel_theme_expansions` no Supabase | migration nova | Cache volátil; impossível histórico e Validador |
| 0.2 | Mover cache Sentinela de `Map` in-memory → Supabase (fallback memória local) | `sentinel-suggestions.ts` | Ranking diverge entre instâncias Cloud Run |
| 0.3 | Feature flags em `src/lib/server-runtime.ts` | env App Hosting | Liga feature pela metade em prod |
| 0.4 | Testes de contrato: APIs `/api/sentinel/*` + fluxo Criativo com sinal | e2e smoke | Regressão no deploy |
| 0.5 | **Tars:** documento comparativo Trends (API oficial vs pytrends vs SerpAPI vs Perplexity) | anexo técnico | Escolha errada de API / custo |

**Critério de saída:** deploy igual ao atual para o usuário; testes verdes; Tars entrega recomendação Trends + social.

---

# FASE 1 — Sentinela núcleo (2–3 semanas)

## 1.1 Expansão semântica (pedido 1.1 + base para 1.2.4)

**Comportamento:**
- Ao **Salvar radar**, job assíncrono (ou sync com timeout curto) chama LLM **já configurada** (OpenAI/Anthropic) com prompt fixo: dado tema T, retornar 8–15 termos correlatos (JSON).
- Persistir em `sentinel_theme_expansions` (tema → termos, `profile_id`, `generated_at`).
- **Refresh** usa termos expandidos **além** do dicionário estático (não substituir sinônimos estáticos — complementar).

**Não quebrar:**
- Se LLM falhar → usar só sinônimos estáticos (comportamento atual).
- Flag `SENTINEL_LLM_EXPANSION=false` → desliga expansão.

**UI mínima:** bloco colapsável “Termos monitorados (expansão)” read-only após save.

## 1.2.1 Pipeline — Temas manuais (3 inputs)

**Regras de negócio (conforme pedido):**
- **Sem** expansão semântica nos 3 campos custom (`customRadarThemes`).
- Busca web literal + comparação trend (ferramenta escolhida pelo Tars).
- Score inclui `trendDelta` (% crescimento de busca).

**Implementação:**
- Query RSS/Google News só com string exata do custom theme.
- Endpoint trends abstrato: `src/lib/sentinel-trends.ts` com adapter pattern (`GoogleTrendsAdapter | PerplexityAdapter | NullAdapter`).
- Ranking separado visível como sub-score ou badge “↑ busca”.

## 1.2.3 Pipeline — Portais (evoluir o existente)

**Já temos:** RSS + clustering multi-veículo.

**Adicionar:**
- Cruzar títulos do portal com trend dos temas do radar (não só match keyword).
- Badge “tendência” quando trend tool indicar crescimento **e** matéria no portal.

**Não quebrar:** manter `fetchPortalSites` e scoring atual; trends são **boost**, não filtro exclusivo.

## 1.2.4 Pipeline — Temas expandidos

- Para cada termo em `sentinel_theme_expansions`, rodar busca + trend individualmente (limite: top N termos por perfil, ex. 20).
- Rankear e mergear no ranking global com peso menor que tema pai (configurável).

## 1.2.2 Pipeline — Social (Instagram first, meta 30/)

**Dependência crítica — Tars deve decidir:**

| Opção | Prós | Contras |
|-------|------|---------|
| Instagram Graph API (oficial) | Estável, legal | Business account, app review, key |
| Apify / Bright Data | Rápido MVP | Custo, ToS, key |
| Scraping direto | Sem key inicial | Quebra, bloqueio IP, inviável varejo |

**Escopo fase 1 social (MVP Instagram):**
- Só perfis cadastrados (interest + opposition).
- Últimos N posts (ex. 5); métricas D vs D-1.
- Fórmula pedida: `Eng = likes + 2×comments + 3×shares`; `Growth = ((Atual - Anterior) / Anterior) × 100`.
- Preencher `evidence.byNetwork` / `actors` (hoje vazios) com dados reais.

**Feature flag:** `SENTINEL_SOCIAL_ENABLED` — default `false` até spike aprovar.

**Formulário:** priorizar Instagram no select (X/YouTube/TikTok disabled ou “em breve”) para bater meta 30/.

## Entregáveis Fase 1 (UX)

1. Sentinela: após save, mostrar expansão gerada.
2. Criativo: sinais com badges `manual | portal | semantic | social` e score composto.
3. `docs/sentinela.md` atualizado.

**Critério de saída:** 4 pipelines geram sinais; flags permitem desligar social/trends; fluxo atual RSS continua funcionando com flag tudo-off.

---

# FASE 2 — Validador / Agente 04 (2–3 semanas)

**Problema atual:** `/auditor` é mock; fact-check real deve entrar no **Criativo** (onde há roteiro) + fila opcional no Auditor.

## 2.1 Fact-check das top 10 do Sentinela

- Após ranking, persistir top 10 com `factCheckStatus: pending | verified | disputed | skipped`.
- **Automático:** fact-check só top 10 (LLM + citações URLs do próprio sinal).
- **Resto:** botão “Verificar fatos” por item (on-demand).

**Serviço:** `src/lib/auditor/fact-check.ts`
- Input: título(s) + URLs + trecho opcional
- Output: `{ verdict, claims[], sources[], confidence }`
- Usar Perplexity **ou** LLM + fetch URL (Tars define custo/qualidade)

**Não quebrar:** Criativo funciona sem fact-check se `AUDITOR_FACTCHECK_ENABLED=false`.

## 2.2 Gate pós-“Aprovar roteiro”

Estender `handleApproveScript` em `criativo-page-v2.tsx`:

```
Aprovar roteiro → fact-check roteiro vs matéria Sentinela (se veio de sinal)
  → ok: scriptApproved = true
  → fail: modal + opção regenerar roteiro (automático 1x)
```

## 2.3 Re-verificação se usuário editou roteiro

- `scriptEdited = true` invalida fact-check anterior.
- Checkbox obrigatório: **“Termo de consentimento e responsabilização por alterações”** (`scriptEditConsentAt`).
- Bloquear “Produzir vídeo” sem checkbox após edição manual.

## 2.4 Edição “ilegítima” (alerta TSE)

- Segundo fact-check compara edição vs claims validados.
- Se `verdict === disputed` → modal com texto legal pedido + checkbox explícito + log em `audit_log` (novo table): userId, projectId, diff hash, timestamp, consent text version.

## 2.5 Prompt livre

- Manter checkbox atual **sem** fact-check (conforme pedido “por hora”).
- Registrar no log que bypass foi usado (`usedFreePrompt: true`).

## UI Auditor

- Substituir mock gradualmente: fila real = `creative_projects` + `sentinel_signals` com status fact-check.
- **Não deletar** `auditor-page-v2.tsx` mock até fila real paridade — usar flag `AUDITOR_V2_REAL_QUEUE`.

**Critério de saída:** fluxo happy-path Sentinela → Criativo → vídeo com fact-check top 10 + gate roteiro; logs de consentimento persistidos.

---

# FASE 3 — MVP escala e compliance (paralelo parcial, 3–4 semanas)

## 3.1 Escala varejo (gêmeo por foto only)

**Decisões alinhadas ao pedido:**
- **Manter:** HeyGen photo avatar (`photo_real` / gêmeo foto) — já no Curador v2.
- **Congelar:** treino por vídeo longo; Argil `/curador-v1` → deprecated (redirect + banner).
- **Infra antes de pico de usuários:**

| Item | Ação |
|------|------|
| Cache Sentinela | Supabase (Fase 0) |
| Jobs pesados | Outbox/fila (Supabase `job_queue` ou Cloud Tasks) — expansão LLM, fact-check, social scrape |
| Rate limit | Middleware por `owner_user_id`: ex. 30 refresh/dia, 10 vídeos/dia free tier |
| HeyGen 10 vozes | Conta por tenant ou pool de vozes pré-treinadas “generic BR politician” |
| Upload | Já TUS >6MB — OK |
| Cold start | `minInstances: 1` em `apphosting.yaml` se latência crítica |

**Spike de carga:** k6 ou Playwright N usuários paralelos salvando radar + refresh — antes de marketing varejo.

## 3.2 Selo Transparência IA (TSE)

**Duas camadas (obrigatório pedido):**

1. **Visual:** overlay no vídeo (FFmpeg ou HeyGen caption burn-in) — texto fixo TSE-compliant + “Conteúdo gerado com IA”.
2. **Metadados:** gravar em `creative_projects.metadata` JSON: `{ aiGenerated: true, sealVersion, model, promptHash, factCheckId }`; se possível tag MP4 (limitado no browser — considerar pós-processamento server-side).

**Ordem:** metadados primeiro (1 semana), overlay segundo (depende pipeline vídeo).

**Não quebrar:** vídeos antigos sem selo continuam reproduzíveis; selo só em novos.

## 3.3 ElevenLabs → áudio → HeyGen (escala de voz)

**Problema:** clone nativo HeyGen (`POST /v3/voices/clone`) tem **limite ~10 por conta da plataforma**. Com key SaaS compartilhada, N usuários retreinando esgotam a cota.

**Caminho canônico (pós spike):**

1. Secret `ELEVENLABS_API_KEY` no App Hosting.
2. Curador: áudio de amostra → **clone Instant Voice / IVC no ElevenLabs** (cota deles).
3. Criativo: TTS do roteiro no ElevenLabs → URL pública do MP3.
4. HeyGen: gerar vídeo com **`audio_url` / `audio_asset_id`** (lipsync), **sem** `voice_id` de clone HeyGen.
5. Flag `HEYGEN_VOICE_PROVIDER=elevenlabs_audio | heygen_clone` — default `heygen_clone` até o spike passar; depois `elevenlabs_audio`.

**Alternativa API (secundária):** `voice_id` ElevenLabs + `engine_type: elevenlabs` na Create Video da HeyGen (se o plano/API da conta permitir sem atrito). Preferir **áudio pronto** — desacopla 100% do limite 10.

**Fallback:** manter reuso agressivo do clone HeyGen (já no código: `heygen-voice-resolve`) + `DELETE /v3/voices/{id}` para liberar órfãos quando a cota chega a 10.

**Modelo comercial (decisão pendente):** conta ElevenLabs única da plataforma vs BYOK por campanha paga.

**Spike 1 dia:** A/B lip-sync no mesmo avatar foto — (A) clone HeyGen + script vs (B) ElevenLabs TTS + `audio_url`. Critério: naturalidade + latência + custo/minuto.

## 3.4 Backgrounds (P4 — se sobrar tempo)

- Presets HeyGen: gabinete, newsroom, blur bandeira, cores campanha (`profile.campaignColors` futuro).
- UI: select no Criativo antes de produzir.
- Sem refator grande — param extra em `POST /api/heygen/videos`.

---

# Cronograma sugerido (sequência segura)

```
Semana 1      Fase 0 (fundação + Tars spikes Trends/Social/ElevenLabs)
Semana 2–3    Fase 1.1 + 1.2.1 + 1.2.3 (LLM expansion, manual, portais+trends)
Semana 4      Fase 1.2.4 (semantic track) + início 1.2.2 se Tars aprovar Instagram
Semana 5–6    Fase 2 Validador (2.1–2.4)
Semana 6–7    Fase 3.2 selo metadados + 3.1 rate limit
Semana 8      Fase 3.3 spike A/B + ElevenLabs TTS → audio_url HeyGen (default pós-OK)
Backlog       3.4 backgrounds
```

**Meta voz SaaS:** após spike, clone HeyGen deixa de ser default — só fallback via flag.
**Meta 30/:** Instagram pipeline (1.2.2) pode ser branch dedicada paralela à Fase 2 se spike fechar na semana 1.

---

# O que NÃO fazer (anti-padrões)

1. Reescrever `criativo-page-v2.tsx` monolito de uma vez — extrair hooks (`useScriptApproval`, `useFactCheck`) primeiro.
2. Trocar tipo `MockSentinelSuggestion` sem alias — renomear para `SentinelSignal` com re-export.
3. Fact-check síncrono no request de “Aprovar roteiro” >15s — usar loading state + job async.
4. Scraping Instagram em produção sem proxy/rate limit — risco legal e operacional.
5. Remover RSS/Google News atual ao adicionar Perplexity — manter como fallback gratuito.
6. Deploy Argil purge ou mudanças HeyGen train sem feature flag — afeta usuários com gêmeo ativo.

---

# Pacote para o Tars avaliar (checklist)

> **Atualização:** Tars = assistente técnico do projeto. Parecer abaixo incorporado em `docs/parecer-tars-roadmap.md`.

Enviar junto:
- [x] `docs/sentinela.md` — comportamento atual
- [x] Este plano
- [x] Formulário Sentinela em prod: `/sentinela`
- [x] Parecer técnico: `docs/parecer-tars-roadmap.md`

---

# Próximo passo imediato (recomendado)

1. ~~**Tars** responde checklist~~ → **Concluído** (ver `docs/parecer-tars-roadmap.md`)
2. **Dev** executa **Fase 0** (migration + cache + flags) — zero mudança de UX.
3. **Product** valida copy do formulário Sentinela alinhado aos 4 monitoramentos (pode ser só labels/help text antes do backend).

Só então iniciar Fase 1.1 (expansão LLM).

---

# Definição de pronto por épico

| Épico | Pronto quando |
|-------|----------------|
| Sentinela 4 pipelines | Ranking unificado; cada sinal tem `pipeline`; docs atualizados; flags off = comportamento jun/2026 |
| Validador | Top 10 auto-check; gate roteiro; consent + log TSE; prompt livre exempt |
| Escala | Rate limits; cache Supabase; spike 50 usuários simulados OK |
| Selo TSE | 100% novos vídeos com metadados + overlay visível |
| ElevenLabs | Áudio A/B aprovado (clone HeyGen vs TTS→`audio_url`) **e** default Flag 3.3; OU decisão documentada de manter HeyGen clone |
