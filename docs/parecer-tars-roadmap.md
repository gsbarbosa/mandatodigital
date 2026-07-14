# Parecer Tars — roadmap Sentinela, Validador e MVP

Parecer técnico fechado para execução do plano em `plano-roadmap-sentinel-auditor-mvp.md`.

**Data:** 2026-06-24  
**Baseline:** Sentinela RSS em prod; Criativo HeyGen funcional; Auditor mock.

---

## 1. Google Trends / “tema em crescimento”

### Opções avaliadas

| Opção | API key? | Veredito |
|-------|----------|----------|
| RSS + clustering + recência (atual) | Não | **Manter** como camada base |
| Histórico próprio no Supabase (volume D vs D-1) | Não | **Adotar** como “trend proxy” na Fase 1 |
| Sinônimos estáticos + expansão LLM | OpenAI já existe | **Adotar** |
| pytrends / scrapers não oficiais | Não | **Rejeitar** em prod (quebra, stack Python, ToS) |
| Google Trends API oficial | Sim, paga/limitada | Fase 2 se proxy insuficiente |
| SerpAPI (`google_trends`) | Sim (~US$ 50–75/mês leve) | **Opcional** Fase 1.2.1 se budget OK |
| Perplexity só para trends | Sim | **Rejeitar** — caro e impreciso para score numérico |

### Recomendação

**Estratégia em 3 camadas (sem key nova obrigatória):**

1. **Hoje:** recência + multi-veículo (já implementado).
2. **Fase 1:** persistir `sentinel_signals` diariamente → calcular `volumeDeltaPercent` por tema/custom theme (comparar com média 7 dias).
3. **Opcional:** adapter SerpAPI atrás de flag `SENTINEL_SERPAPI_KEY`.

**Custo estimado 1000 usuários/mês** (refresh 2×/dia, 5 temas): SerpAPI ~US$ 50–150 dependendo do plano. Sem SerpAPI: **US$ 0** extra.

---

## 2. Instagram até 30/06

### Opções

| Opção | Prazo realista | Veredito |
|-------|----------------|----------|
| Instagram Graph API | 2–6 semanas (app review Meta) | **Inviável para 30/06** se ainda não iniciado |
| Apify / Bright Data | 2–5 dias integração | **Viável** com key + custo + risco ToS |
| Scraping direto | “Rápido” | **Rejeitar** em varejo |

### Recomendação

**Plano A (deadline 30/06 hard):** integrar **Apify Instagram Profile Scraper** (ou actor equivalente) atrás de `SENTINEL_SOCIAL_ENABLED`, só Instagram, só perfis cadastrados, cache 6h, max 5 perfis/lista.

**Plano B (recomendado se deadline flexível):** entregar **30/06** os pipelines 1.2.1, 1.2.3, 1.2.4 + expansão LLM; **Instagram em 15/07** via Graph API (iniciar cadastro Meta **esta semana**).

**Fórmula de engajamento:** implementar exatamente como pedido:

```
Eng = likes + 2×comments + 3×shares
Growth% = ((Eng_atual - Eng_anterior) / Eng_anterior) × 100
```

Usar último post vs penúltimo **ou** soma dos 5 últimos posts D vs D-1 — documentar qual regra no UI (recomendo **5 posts, janela 24h** para estabilidade).

**UI:** desabilitar X/YouTube/TikTok com tooltip “Em breve” até pipeline existir.

---

## 3. Fact-check — Perplexity vs LLM + URL

### Contexto

O Sentinela **já entrega URLs** das matérias. O Validador não precisa “descobrir” fontes na web.

### Recomendação

**Fase 2 v1: LLM existente (OpenAI/Anthropic) + fetch das URLs do sinal**

- Extrair texto da matéria (fetch + strip HTML, timeout 8s).
- Prompt estruturado: claims, verdict, confidence, citações.
- Top 10 automático; resto on-demand (conforme pedido).

**Perplexity:** adapter opcional `FACTCHECK_PROVIDER=perplexity` se A/B mostrar +15% precisão em amostra de 20 pautas. Não bloquear Fase 2.

**Custo top 10/dia/usuário ativo:** ~10 chamadas LLM médias ≈ US$ 0,05–0,20/usuário/dia (aceitável).

**Crítico:** fact-check **assíncrono** (job + polling UI), nunca bloquear “Aprovar roteiro” >10s.

---

## 4. HeyGen + ElevenLabs

### Veredito: **SIM — e o path certo para produção SaaS é áudio externo**

Há dois modos na API HeyGen:

| Modo | Como | Limite 10 clones HeyGen |
|------|------|-------------------------|
| A — nativo | `script` + `voice_id` (clone HeyGen) | Consome cota da conta plataforma |
| B — áudio | `audio_url` / `audio_asset_id` (TTS feito fora) | **Não consome** clone HeyGen |
| C — bridge | `engine_type: elevenlabs` + voice ElevenLabs na Create Video | Depende do plano; ainda acopla na HeyGen |

Docs: [Image to Video / audio](https://developers.heygen.com/image-to-video-1), [Create Video](https://developers.heygen.com/reference/create-video), [3rd-party voices](https://help.heygen.com/en/articles/8310663-how-to-integrate-elevenlabs-other-third-party-voices).

### Implementação recomendada no Mandato Digital (Fase 3.3)

1. Secret `ELEVENLABS_API_KEY` no Firebase App Hosting.
2. Curador: amostra de voz → clone no **ElevenLabs**.
3. Criativo: TTS do roteiro no ElevenLabs → URL → HeyGen com **`audio_url`** (lipsync only).
4. Clone HeyGen (`POST /v3/voices/clone`) vira **fallback** via flag — default desligado após spike OK.
5. Até lá: reuso agressivo + cap no limite 10 (já em `heygen-voice-resolve`).

**Limite 10 vozes HeyGen:** deixa de ser gargalo no path B.

**Spike 1 dia:** A/B lip-sync qualidade + custo no mesmo avatar foto (HeyGen-native vs ElevenLabs→audio_url).

---

## 5. Selo TSE (Res. 23.610/2019, art. 9º-B; alt. 23.732/2024, 23.755/2026)

### Mínimo legal (não é “ou metadados ou visual” — é **ambos** na prática)

**Obrigatório para vídeo sintético:**

1. **Aviso explícito, destacado e acessível** na peça: conteúdo fabricado/manipulado + **qual tecnologia** (ex.: “Vídeo gerado com IA · HeyGen + ElevenLabs”).
2. **Metadados + log de produção** — essencial porque o TSE pode inverter ônus da prova; o produto deve guardar trilha (`creative_projects.metadata`, `audit_log`).
3. **Blackout eleitoral:** bloquear publicação/download de **novos** conteúdos sintéticos na janela **72h antes → 24h depois** do pleito (configurar `electionDate` no perfil).

### Implementação recomendada (ordem)

| Prioridade | Entrega |
|------------|---------|
| P0 | Overlay queimado no vídeo (FFmpeg pós-HeyGen ou caption HeyGen full-length) |
| P0 | Metadados JSON em `creative_projects` |
| P0 | Log Validador (edições + consentimentos) |
| P1 | Preview do selo antes de “Produzir vídeo” |
| P2 | C2PA / EXIF (nice-to-have) |

Texto sugerido overlay (validar com jurídico):

> **Conteúdo produzido com inteligência artificial**  
> Tecnologia: HeyGen · Voz: ElevenLabs

---

## 6. Escala varejo (3.1)

| Item | Decisão Tars |
|------|----------------|
| Gêmeo | **Só foto** (HeyGen photo avatar) — congelar treino vídeo/Argil |
| Cache Sentinela | Supabase (Fase 0) — obrigatório antes de marketing |
| Jobs | Fila Supabase ou Cloud Tasks para LLM expansion, fact-check, social |
| Rate limit | 30 refresh Sentinela/dia/user; 5 vídeos/dia/user free tier |
| Cloud Run | `minInstances: 1` se cold start >3s; revisar após spike |
| Multi-tenant | Já OK via `owner_user_id` |

---

## 7. Ordem de execução revisada (com vereditos)

```
Semana 1     Fase 0 + spike ElevenLabs A/B (1 dia)
Semana 2     Fase 1.1 expansão LLM + 1.2.4 semantic track
Semana 3     Fase 1.2.1 manual + trend proxy Supabase + 1.2.3 portal+trend boost
Semana 4     Fase 2 Validador (2.1–2.4) — LLM+URL fact-check
Semana 5     Fase 3.2 selo P0 + 3.3 ElevenLabs default voice
Paralelo     Instagram: Plano A (Apify) se 30/06 fixo, senão Plano B Graph API
Backlog      3.4 backgrounds, SerpAPI trends, Perplexity fact-check
```

---

## 8. Decisões que precisam do Gugão (produto/negócio)

1. **30/06:** Instagram via Apify (rápido, pago, risco) **ou** slip para julho?
2. **Budget:** SerpAPI (~US$ 75/mês) vale na v1 **ou** só trend proxy gratuito?
3. **ElevenLabs:** ~~conta única vs BYOK?~~ → **conta única da plataforma** (demo/guest); BYOK backlog. Path canônico: TTS → `audio_url` (não bridge nativa UI).
4. **Texto selo TSE:** revisão jurídica antes de implementar overlay.

---

## 9. O que executar primeiro (segunda-feira)

1. **Fase 0** — migration `sentinel_signals`, cache Supabase, feature flags.
2. **Spike ElevenLabs** — 1 vídeo A/B no staging.
3. **Copy Sentinela** — rotular 4 monitoramentos no form (sem mudar backend ainda).

Nada de Instagram ou Validador até Fase 0 mergeada e testes de regressão do fluxo Criativo atual passando.
