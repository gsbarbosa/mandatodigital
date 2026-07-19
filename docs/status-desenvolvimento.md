# Status de desenvolvimento — Mandato Digital

Documento vivo para acompanhar o que **já existe**, o que está **parcial** e o que **falta implementar**.

**Última atualização:** 2026-06-24  
**Produção:** https://mandatodigital--madatodigital.us-central1.hosted.app  
**Branch principal:** `main`

Documentos relacionados:

- [Guia Sentinela](sentinela.md)
- [Plano roadmap](plano-roadmap-sentinel-auditor-mvp.md)
- [Parecer técnico Tars](parecer-tars-roadmap.md)

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Pronto e em uso (prod ou dev com flags padrão) |
| 🟡 | Código pronto; desligado em prod ou depende de flag/smoke test |
| 🔶 | Parcial — começou, não fecha o pedido original |
| ❌ | Não implementado |
| ⏸ | Bloqueado por decisão externa (produto, jurídico, API key) |

**Flags em produção** (`apphosting.yaml`, 2026-06-24):

| Flag | Prod |
|------|------|
| `SENTINEL_V2_PIPELINES` | `true` |
| `SENTINEL_LLM_EXPANSION` | `true` |
| `SENTINEL_TREND_PROXY` | `true` |
| `AUDITOR_FACTCHECK_ENABLED` | `true` |
| `SENTINEL_SOCIAL_ENABLED` | off (default) |

**Persistência:** Firestore + Firebase Storage (`npm run db:reset`).

---

## 1. Plataforma e infraestrutura

| Item | Status | Notas |
|------|--------|-------|
| Firebase App Hosting (deploy SSR + API) | ✅ | `npm run deploy:firebase` |
| Firebase Auth (login) | ✅ | |
| Firestore (perfil, criativos, Sentinela, Auditor, jobs) | ✅ | Admin SDK |
| Firebase Storage (treino/vídeo/compliance) | ✅ | Signed URLs |
| Feature flags por env | ✅ | `src/lib/feature-flags.ts` |
| Reset Firestore (`npm run db:reset`) | ✅ | Ambiente zerado |
| Rate limit refresh Sentinela (30/dia/usuário) | ✅ | `src/lib/rate-limit.ts` |
| Fila de jobs (LLM, social, fact-check async) | ❌ | Fase 3.1 |
| Rate limit vídeos (ex.: 5/dia) | ❌ | Fase 3.1 |
| `minInstances: 1` Cloud Run | ❌ | Fase 3.1 |
| Cutover total → Firestore + Storage | ✅ | Sem Postgres/Supabase |

---

## 2. MVP original (geração de texto)

| Item | Status | Notas |
|------|--------|-------|
| Onboarding / perfil parlamentar | ✅ | |
| Entrada manual de pauta | ✅ | |
| Geração de 3 versões (OpenAI / Anthropic) | ✅ | |
| Fallback sem API key | ✅ | |
| Revisão, aprovação, histórico | ✅ | |
| Feedback editorial | ✅ | |
| Avaliação LLM (juiz shadow / evals) | ✅ | |
| Landing page pública | ✅ | `/` |
| Testes E2E Playwright | ✅ | `npm run test:e2e` |

---

## 3. Curador (identidade + avatar)

| Item | Status | Notas |
|------|--------|-------|
| UI v2 (`/curador-v2`) | ✅ | |
| Perfil, tom, arquétipo, glossário | ✅ | |
| Upload áudio / foto / vídeo de treino | ✅ | |
| HeyGen — gêmeo digital (vídeo) | ✅ | |
| HeyGen — avatar foto (`photo_real`) | ✅ | |
| HeyGen — caricatura (OpenAI + HeyGen) | ✅ | |
| Consent HeyGen | ✅ | |
| Clone de voz HeyGen | ✅ | Fallback (`heygen_clone`); reuso + prune limite 10 |
| Curador v1 / Argil (legado) | ❌ | Removido; `/curador-v1` redireciona para `/curador` |
| ElevenLabs como voz default | 🟡 | Código path `audio_url` pronto; stg `HEYGEN_VOICE_PROVIDER=elevenlabs_audio` — requer secret `ELEVENLABS_API_KEY` + smoke |
| Spike A/B HeyGen vs ElevenLabs→audio | 🟡 | Checklist `scripts/voice-ab-smoke.mjs` |
| Deprecar `/curador-v1` + banner | ❌ | Fase 3.1 |

---

## 4. Criativo (roteiro + vídeo)

| Item | Status | Notas |
|------|--------|-------|
| UI v2 (`/criativo`, `/criativo/novo`) | ✅ | |
| Lista e persistência `creative_projects` | ✅ | |
| Roteiro via HeyGen transcript + contexto Curador | ✅ | |
| Handoff Sentinela → Criativo (sinal por ID) | ✅ | `?sugestao=` |
| Produção vídeo HeyGen | ✅ | |
| Prompt livre (modo teste) | ✅ | Sem fact-check |
| Badges pipeline nos sinais (manual/portal/semântico) | ✅ | Requer flags Sentinela |
| Metadados TSE em `creative_projects.metadata` | 🟡 | Grava ao salvar criativo |
| Gate fact-check ao aprovar roteiro | ✅ | `AUDITOR_FACTCHECK_ENABLED=true` em prod |
| Checkbox consentimento pós-edição do roteiro | ✅ | Ativo com Validador on |
| Backgrounds HeyGen / pós-FFmpeg | ❌ | Fase 3.4 |

---

## 5. Sentinela (radar + sinais)

Referência detalhada: [sentinela.md](sentinela.md)

### 5.1 Base (pré-roadmap + Camada 1–2)

| Item | Status | Notas |
|------|--------|-------|
| UI v2 (`/sentinela`) | ✅ | |
| Formulário radar (temas, oposição, @, portais) | ✅ | |
| Google News RSS + cidade/estado | ✅ | |
| RSS portais cadastrados | ✅ | |
| Sinônimos estáticos por tema | ✅ | `sentinel-theme-synonyms.ts` |
| Clustering multi-veículo | ✅ | |
| APIs `GET/POST /api/sentinel/*` | ✅ | |
| Handoff → Criativo | ✅ | |
| Botões Salvar radar / Atualizar sinais (UI alinhada) | ✅ | Commit `2bffdce` |

### 5.2 Fase 0 — Fundação

| Item | Status | Notas |
|------|--------|-------|
| Tabela `sentinel_suggestion_cache` | ✅ | Migration aplicada |
| Tabela `sentinel_signals` (histórico) | ✅ | |
| Tabela `sentinel_theme_expansions` | ✅ | |
| Cache L1 memória + L2 Firestore | ✅ | |
| Feature flags Sentinela | ✅ | |
| Testes de contrato / unitários | ✅ | 80+ testes no repo |

### 5.3 Fase 1 — Núcleo Sentinela

| Item | Status | Flag prod | Notas |
|------|--------|-----------|-------|
| **1.1** Expansão semântica LLM ao salvar radar | ✅ | on | OpenAI existente |
| UI “Termos monitorados (expansão)” | ✅ | on | |
| `GET /api/sentinel/expansions` | ✅ | on | |
| **1.2.1** Pipeline temas manuais (match literal) | ✅ | on | Sem sinônimos nos 3 custom |
| **1.2.3** Pipeline portais + trend boost | ✅ | on | RSS + clustering |
| **1.2.4** Pipeline semântico (termos expandidos) | ✅ | on | |
| **1.2.1/1.2.3** Trend proxy (volume D vs D-7) | ✅ | on | Precisa histórico em `sentinel_signals` |
| Badge pipeline + “↑ volume” no Criativo | ✅ | on | |
| Ranking unificado com pesos por pipeline | ✅ | on | `sentinel-pipeline.ts` |
| **1.2.2** Pipeline social / Instagram | ❌ | off | ⏸ Apify vs Graph API |
| Busca real de perfis @ + engajamento | ❌ | | Fórmula Eng/Growth definida no parecer |
| X / TikTok / YouTube nos perfis @ | ❌ | | UI “em breve” |
| Google Trends / SerpAPI | ❌ | | ⏸ Budget ~US$ 75/mo |
| Refresh automático periódico (sem clique) | ❌ | | |
| Fact-check status nos sinais (UI) | ❌ | | Fase 2 |

---

## 6. Validador / Auditor (Fase 2)

| Item | Status | Flag prod | Notas |
|------|--------|-----------|-------|
| UI Auditor v2 (`/auditor`) | 🔶 | | Mock/demo |
| `POST /api/auditor/fact-check` | ✅ | on | LLM + fetch URLs |
| Fact-check top 10 após refresh Sentinela | ✅ | on | Background |
| Gate no Criativo ao aprovar roteiro | ✅ | on | |
| Re-validação + consent se editou roteiro | ✅ | on | |
| Tabela `sentinel_fact_checks` | ✅ | | Migration aplicada |
| Tabela `audit_log` | ✅ | | |
| Botão “Verificar fatos” por sinal (on-demand) | ❌ | | Pedido 2.1 |
| Fila real no Auditor | ❌ | | Backlog (flag removida do código) |
| Perplexity como provider alternativo | ❌ | | Backlog |
| Modal alerta TSE + log edição “ilegítima” | 🔶 | | `audit_log` parcial; UI legal ❌ |
| Prompt livre exempt de fact-check | ✅ | on | Registrado em audit |

**Produção:** Validador ligado (LLM OpenAI + URLs do Sentinela). Ver fluxo em [Validador](validador.md) se existir; API: `POST /api/auditor/fact-check`.

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
| Selo TSE — overlay queimado no vídeo | 🟡 | FFmpeg + fail-closed; guest: `VERSÃO DE TESTE` |
| Texto selo validado juridicamente | ⏸ | |
| ElevenLabs → áudio → HeyGen (sai limite 10) | 🟡 | Código + flag stg; smoke + secret ELEVENLABS_API_KEY |
| Backgrounds HeyGen | ❌ | P4 backlog |
| Spike carga (50 usuários simulados) | ❌ | Fase 3.1 |
| Congelar treino vídeo longo / escala varejo foto-only | ❌ | Decisão Tars documentada |

---

## 9. Decisões de produto pendentes

| # | Decisão | Impacto | Status |
|---|---------|---------|--------|
| 1 | Instagram: Apify (rápido) vs julho + Graph API | Pipeline social 1.2.2 | ⏸ |
| 2 | SerpAPI (~US$ 75/mo) vs só trend proxy grátis | Precisão “em alta” | ⏸ |
| 3 | ~~ElevenLabs: conta única vs BYOK; path default~~ | Conta **única da plataforma** (demo); BYOK backlog. Default stg `elevenlabs_audio` | ✅ |
| 4 | Texto selo TSE — revisão jurídica | Overlay legal | ⏸ |
| 5 | Emulator suite Firestore (dev offline) | DX local | ⏸ |

---

## 10. Ordem sugerida de execução

```
[x] Fase 0 — Firestore + cache + flags
[x] Fase 1 — Sentinela v2 (exceto Instagram)
[x] Deploy prod com flags Sentinela
[x] Ligar Validador em prod (AUDITOR_FACTCHECK_ENABLED)
[ ] Smoke test Sentinela + Validador em prod
[ ] Decidir Instagram → implementar 1.2.2
[ ] Auditor UI fila real (AUDITOR_V2_REAL_QUEUE)
[ ] Selo TSE overlay + jurídico
[x] ElevenLabs → `audio_url` HeyGen (Fase 3.3 código + flag)
[ ] Smoke A/B stg + confirmar secret ELEVENLABS_API_KEY
```

## 11. Changelog deste documento

| Data | Mudança |
|------|---------|
| 2026-07-13 | Fase 3.3 implementada: path `elevenlabs_audio` (IVC+TTS→`audio_url`); conta única EL; fallback `heygen_clone`; BYOK backlog |
| 2026-06-24 | Criação inicial pós deploy Fase 0+1 e migration Auditor |
| | Sentinela v2 + LLM + trend proxy **on** em prod |
| 2026-06-24 | Validador ligado em prod (`AUDITOR_FACTCHECK_ENABLED=true`) |

---

## Como atualizar

1. Ao mergear feature: mudar status na tabela correspondente.
2. Ao ligar flag em prod: atualizar seção **Flags em produção**.
3. Ao alterar indexes: `npm run firebase:indexes:deploy`.
4. Registrar mudança na seção **Changelog**.
