# Sentinela — arquitetura e funcionamento (handoff técnico)

Documento para **estudar**, **explicar a outras LLMs** e **pedir mudanças com precisão**.  
Guia de uso do produto: [`docs/sentinela.md`](./sentinela.md).  
Spike de qualidade em curso: [`docs/spike-sentinela-qualidade.md`](./spike-sentinela-qualidade.md).

**Repo:** `mandatodigital` (Next.js / App Hosting Firebase / Supabase)  
**Prod:** `https://mandatodigital--madatodigital.us-central1.hosted.app` (App Hosting)  
**Objetivo de produto:** a partir do **radar** do mandato (temas + geo + adversários), gerar **sinais/pautas** com evidência (links) para o **Criativo** virar conteúdo.

---

## 1. O que é (e o que não é)

| É | Não é |
|---|---|
| Monitoramento de **notícias** + posts de **adversários (Instagram via Apify)** | Crawler social completo (X/TikTok em tempo real) |
| Pipeline **coleta → match → (LLM) → rank → cache → UI** | Busca “mágica” só com LLM |
| Heurísticas + sinônimos + flags LLM opcionais | Garantia de cobertura editorial 24/7 |
| Classificação de esfera (Nacional/Estadual/Municipal/Adversários) **no frontend** | Backend com campo `sphere` nativo |

**Insight importante:** o backend entrega uma lista plana de `suggestions`. A UI do Monitoramento agrupa por esfera com heurística (`sphere-classifier.ts`).

---

## 2. Mapa mental do fluxo

```text
[Usuário]
  │ configura radar (temas federal/estadual, custom, portais, @adversários)
  │ salva perfil (politician_profiles + workflow config)
  ▼
[UI Monitoramento / Sentinela]
  │ GET  /api/sentinel/suggestions   → lê cache (não varre de novo)
  │ POST /api/sentinel/refresh       → forceRefresh, coleta de verdade
  ▼
[getSentinelSuggestions]  src/lib/sentinel-suggestions.ts
  │
  ├─ se cache válido e !forceRefresh → devolve cache (+ hidrata oposição se Apify)
  │
  └─ forceRefresh:
       1) collectSentinelArticles
            ├─ fetchSentinelNewsItems      (queries tema + portais)
            └─ (v2) expansões semânticas + fetchSemanticExpansionNewsItems
       2) buildSuggestions (v1 RSS cluster OU v2 pipelines)
            └─ (opcional) theme verify LLM
       3) social + opposition (paralelo)
       4) filterSuggestionsForProfile
       5) (opcional spike) applySentinelQualityRank  [SENTINEL_LLM_QUALITY_RANK]
       6) persiste cache + meta (rssFetchStats, qualityReport, custo LLM…)
  ▼
[UI] groupSuggestionsBySphere → cards Nacional / Estadual / Municipal / Adversários
  ▼
[Criativo] abre com ?sugestao=<id>&tema=...
```

---

## 3. Conceitos-chave

### 3.1 Radar (input)

Configurado no perfil do mandato:

| Campo (app) | Significado |
|---|---|
| `sentinelThemesFederal` | Temas da esfera nacional |
| `sentinelThemesEstadual` | Temas da esfera estadual |
| `sentinelThemes` | Legacy / união |
| `customRadarThemes` | Termos livres (mais municipais/manuais) |
| `interestSites` / `interestProfiles` | Portais e @ de interesse |
| `oppositionThemes` / `oppositionProfiles` / `oppositionSites` | Adversários |
| `city` / `state` | Geo para queries e score |

**Persistência:** temas **não** ficam só em `politician_profiles` (tabela base é enxuta). O app grava config de workflow (inclui `sentinel_themes_*`, profiles, sites) em tabela/fluxo de workflow — ver `storage.ts` (`workflowPayload`, `mapWorkflowProfileConfigRow`).

**Catálogo de temas:** `src/lib/constants.ts` (`sentinelThemeGroups`) + `src/lib/sphere-theme-catalog.ts` (federal completo / estadual subset). Labels **sem acento** no código (`Seguranca Publica`, `Carga Tributaria`).

**Limites guest vs premium (dev account mode):**

| Gatilho | Premium | Convidado (guest) |
|---|---|---|
| Refresh automático diário (após 08:00 `America/Sao_Paulo`) | grátis | grátis |
| Botão **Atualizar pautas** (`reason: "manual"`) | ilimitado\* | 1 crédito (máx. **5** vitalícios) |
| Save de temas com radar mudando + créditos restantes | refresh grátis | refresh **consome 1 crédito** |
| Save de temas com **0** créditos | refresh normal | **não** refresh; UI avisa próxima atualização pós-8h |
| Save do onboarding (fase temas → avatar, `policy: "onboarding"`) | grátis | refresh **não** consome crédito |

\* Ainda sujeito ao rate limit de plataforma (ex.: 30/dia em `rate-limit.ts`), independente dos créditos guest.

Outros caps guest: ~3 temas por esfera. Premium = allowlist + cookie `mandato-dev-account-mode`.

**Créditos:** Firestore `guestCredits/{ownerUserId}` (`sentinelForceUsed`, `updatedAt`). Limite `GUEST_SENTINEL_FORCE_CREDITS = 5` em `guest-limits.ts`. Helpers: `getGuestSentinelCredits`, `tryConsumeGuestSentinelCredit` (`guest-credits-storage.ts`); ciclo `sentinelDailyCycleKey` / `needsDailySentinelRefresh`.

**Código:** `dev-account-mode*.ts`, `guest-limits.ts`, `guest-credits-storage.ts`, `redefinir-temas-page.tsx`, `onboarding-provider.tsx`, `monitoramento-page.tsx`, `api/sentinel/refresh`, `api/profile`.

### 3.2 Suggestion / sinal (output)

Tipo: `MockSentinelSuggestion` em `sentinel-mock-suggestions.ts`.

Campos críticos:

- `id` — estável (hash do link / post)  
- `themeLabel` — tema do radar usado no card  
- `matchedThemes` — temas que casaram  
- `topic` — texto exibido / pré-preenche Criativo (`Tema · manchete`)  
- `relevanceScore` — 10–99  
- `evidence.articles[]` — matérias (URL, título, fonte)  
- `evidence.actors[]` — posts sociais; `sourceList: "opposition" | "interest"`  
- `pipeline` — `manual | portal | semantic | social | legacy`

### 3.3 Meta do refresh

`SentinelSuggestionsMeta` (`sentinel-types.ts`), gravada no cache:

- `articlesScanned`, `portalsMonitored`, `radarThemesCount`  
- `rssFetchStats` — tentativas/sucessos/erros HTTP da coleta  
- `themeVerificationStats` — verify LLM  
- `qualityReport` / `llmCostEstimate` / `qualityRankStats` — spike qualidade  
- `emptyReason`, `oppositionUnavailableReason`  
- `radarThemesSignature` — invalida cache se o radar mudou  

---

## 4. Coleta de notícias (`sentinel-rss.ts`)

### 4.1 Queries de tema

`buildSentinelRssQueries(profile)`:

- Federal: `"{tema} Brasil"` (até `MAX_THEME_QUERIES = 4`)  
- Estadual: `"{tema} {UF}"` (até 4)  
- Custom municipal: `"{tema} {cidade UF}"`  
- Geo sozinha se houver radar municipal  

### 4.2 Fontes

1. **Google News RSS** — `news.google.com/rss/search?...`  
   - **Problema conhecido:** no Cloud Run costuma responder **HTTP 503**.  
   - Há **circuit breaker**: após N falhas, para de bater no Google.  
2. **Bing News RSS** — fallback das queries de tema (`buildBingNewsRssUrl`)  
3. **Portais do catálogo** — `sentinel-portal-catalog.ts`  
   - Nacionais: g1, cnnbrasil, estadao, folha, uol  
   - Estaduais: 5 hosts por UF  
   - **RSS direto primeiro** (URLs conhecidas + paths `/feed`, `/rss/g1/`, …)  
   - Google `site:host` só se portal falhar e circuit Google aberto não bloquear  
4. **Expansão semântica (v2)** — termos gerados por LLM por tema → mais queries Bing/Google  

Fetch: `cache: "no-store"`, retry limitado, UA browser-like, `looksLikeRssFeed` para rejeitar HTML/consent.

### 4.3 Match de tema

- Sinônimos estáticos: `sentinel-theme-synonyms.ts`  
- Normalização: `normalizeSentinelText` (sem acento, lower)  
- Artigo só vira candidato se o **título/fonte** casar com tema ou termo expandido  

---

## 5. Pipelines de sugestão

### 5.1 Flag V2

`SENTINEL_V2_PIPELINES=true` → `buildV2SuggestionsFromArticles` (`sentinel-suggestions-v2.ts`)  
Senão → `buildSuggestionsFromArticles` (cluster RSS clássico).

V2 classifica pipeline (`portal` / `semantic` / `manual`), usa expansões, score e cluster.

### 5.2 Theme verify (LLM)

Flag: `SENTINEL_LLM_THEME_VERIFY`  
Arquivo: `sentinel-theme-verify.ts`  
Aprova/rejeita se a matéria **trata de fato** do tema (não menção lateral).  
Cache de vereditos em Supabase (`sentinel_article_theme_verdicts`).  
**Custo:** pode chamar LLM em muitos artigos se o match for frouxo.

### 5.3 Social + oposição

- `sentinel-social.ts` — Google/Bing por handle (fraco)  
- `sentinel-opposition-posts.ts` + `sentinel-instagram-posts.ts` — **Apify** Instagram  
  - Precisa `SENTINEL_SOCIAL_ENABLED` + `APIFY_TOKEN` / `APIFY_API_TOKEN`  
  - Sem Apify: `oppositionUnavailableReason` na meta  

### 5.4 Filtro final

`filterSuggestionsForProfile`:  
- Oposição passa  
- News: `themeLabel` deve estar nos temas ativos do radar (evita expansão órfã rotular tema errado)

### 5.5 Quality rank (spike)

Flag: `SENTINEL_LLM_QUALITY_RANK` (default **false**)  
Arquivo: `sentinel-quality-rank.ts`  
Pega top N news por heurística, LLM mini decide `pautavel` + briefing/ângulo, reordena/dropa.  
Heurística e custo: `sentinel-quality.ts`.  
Eval offline: `npm run sentinel:quality-eval`.

---

## 6. Cache e refresh

| Peça | Onde |
|---|---|
| Memória processo | `Map` em `sentinel-suggestions.ts` (TTL ~15 min) |
| Persistido | Supabase `sentinel_suggestion_cache` (`sentinel-storage.ts`) |
| Expansões | `sentinel_theme_expansions` |
| Histórico sinais | append em storage (quando habilitado) |

**GET `/api/sentinel/suggestions`**  
→ `getSentinelSuggestions` **sem** `forceRefresh` → só cache (ou empty pedindo “Atualizar pautas”). Para guest, a resposta pode incluir `credits` (`used` / `limit` / `remaining`).

**POST `/api/sentinel/refresh`** (`maxDuration = 300`)

Body: `{ reason?: "daily" | "manual" }` (default `"manual"`).

1. **`daily`:** se o cache já cobre o ciclo diário vigente (pós-8h BRT), responde `skipped: true` sem coletar e **sem** consumir crédito. Se precisa, `forceRefresh` grátis.  
2. **`manual`:** guest sem crédito restante → **429** com mensagem (*“Você usou seus 5 créditos. A próxima atualização… hoje/amanhã após as 8h.”*), salvo retry livre após falha de fonte.  
3. **Não apaga** cache persistido antes (só memória) — se falhar, não zera o último bom resultado.  
4. `forceRefresh: true`.  
5. Consome **1 crédito** guest só em `manual` **após sucesso** e **não** for falha total de fonte.  
6. Dispara fact-check auditor em background (não bloqueia).

**Cliente (auto diário):** `monitoramento-page.tsx` no mount + `visibilitychange`/`focus` chama `reason: "daily"` quando `needsDailySentinelRefresh`.

**Falha de fonte:** `articlesScanned === 0` + `rssFetchStats.succeeded === 0` → guest **pode retry** (não consome crédito).

**Save de perfil / radar** (`PUT /api/profile`):

- Flag `sentinelRefreshPolicy`: `"onboarding" | "themes" | "skip"` (default `"themes"` quando o radar muda).  
- `onboarding` → refresh em background **sem** consumir crédito.  
- `themes` + guest com crédito → refresh e consome 1 após sucesso.  
- `themes` + guest sem crédito → **não** chama coleta; resposta `sentinelRefreshSkipped` + `sentinelRefreshMessage`.  
- `skip` → não dispara refresh.

---

## 7. UI e esferas

| Superfície | Path / componente |
|---|---|
| Monitoramento | `monitoramento-page.tsx` + `RefreshPautasButton` |
| Redefinir temas | `redefinir-temas-page.tsx` |
| Sentinela (legado) | `/sentinela` → redirect `/monitoramento` |
| Card | `monitor-signal-card.tsx` |
| Criativo | deep-link `buildCriativoNovoHref` |

**Esferas (frontend):** `sphere-classifier.ts`

Prioridade aproximada:

1. Actor `opposition` → Adversários  
2. Actor `interest` / tema custom → Municipal  
3. Tema no radar federal vs estadual do perfil  
4. Catálogo estático do tema  
5. Domínio do veículo (G1/CNN/… → federal; portais UF → estadual)  
6. Fallback estadual  

Chips na UI vêm do **perfil** (temas escolhidos), não das suggestions. Por isso dá para ver muitas tags e zero cards.

---

## 8. APIs

| Método | Rota | Função |
|---|---|---|
| GET | `/api/sentinel/suggestions` | Lista cache (+ `credits` guest) |
| POST | `/api/sentinel/refresh` | Varredura forçada (`reason: daily \| manual`) |
| PUT | `/api/profile` | Salva perfil; se radar muda, refresh conforme `sentinelRefreshPolicy` |
| GET | `/api/sentinel/suggestions/[id]` | Um sinal |
| GET | `/api/sentinel/expansions` | Termos de expansão do perfil |

Auth: Firebase session cookie → `owner_user_id` derivado (`toDatabaseOwnerUserId` em `owner-user-id.ts`).

---

## 9. Feature flags (env)

| Flag | Efeito |
|---|---|
| `SENTINEL_V2_PIPELINES` | Pipeline v2 |
| `SENTINEL_LLM_EXPANSION` | Gera/usa termos semânticos |
| `SENTINEL_LLM_THEME_VERIFY` | LLM aprova match tema↔matéria |
| `SENTINEL_LLM_QUALITY_RANK` | Spike: rank top-N + briefing |
| `SENTINEL_SOCIAL_ENABLED` | Social/Apify |
| `SENTINEL_TREND_PROXY` | Trends (quando usado) |
| `SENTINEL_PERSIST_CACHE` | Força on/off cache persistido |
| `APIFY_*` | Instagram adversários |

Definidas em `feature-flags.ts` e `apphosting.yaml`.

---

## 10. Arquivos para abrir primeiro

```text
src/lib/sentinel-suggestions.ts      # orquestrador
src/lib/sentinel-rss.ts              # coleta
src/lib/sentinel-suggestions-v2.ts   # build v2
src/lib/sentinel-theme-synonyms.ts   # dicionário
src/lib/sentinel-theme-expansion.ts  # LLM expansão
src/lib/sentinel-theme-verify.ts     # LLM verify
src/lib/sentinel-quality*.ts         # spike qualidade
src/lib/sphere-classifier.ts         # UI esferas
src/lib/sentinel-storage.ts          # Supabase cache
src/lib/guest-limits.ts              # créditos + ciclo 8h BRT
src/lib/guest-credits-storage.ts     # Firestore guestCredits
src/app/api/sentinel/refresh/route.ts
src/app/api/profile/route.ts         # policy onboarding/themes/skip
src/components/product/monitoramento-page.tsx
src/components/product/redefinir-temas-page.tsx
src/components/product/onboarding-provider.tsx
```

Testes: `src/lib/sentinel-*.test.ts`, `src/lib/guest-limits.test.ts`  
Eval qualidade: `npm run sentinel:quality-eval`

---

## 11. Problemas conhecidos (contexto 2026-07)

1. **Google News 503 no Cloud Run** → circuit breaker + Bing + RSS direto de portais.  
2. **Refresh longo** (1–3 min) com muitos temas/portais/verify/Apify.  
3. **Guest:** 5 créditos vitalícios (manual + save de temas); refresh diário pós-8h BRT grátis; falha de fonte não consome crédito.  
4. **Temas no DB base:** colunas de radar estão no workflow config, não em todas as colunas de `politician_profiles`.  
5. **Qualidade:** match por título é barato e ruidoso; verify/quality-rank melhoram mas custam tokens.  
6. **Esfera:** classificação frontend pode divergir da “intenção” do radar se portal/tema forem ambíguos.

---

## 12. Como pedir mudanças a uma LLM (template)

Copie e adapte:

```text
Contexto: Mandato Digital / Sentinela (ver docs/sentinela-arquitetura.md).

Objetivo: <ex.: melhorar qualidade dos cards Nacional/Estadual sem estourar custo guest>

Restrições:
- Não usar LLM como crawler principal
- Guest: custo/refresh alvo ≤ US$0,05
- Manter forceRefresh + cache; GET só lê cache
- Flags novas default OFF

Arquivos prováveis: <listar 2–5 paths da seção 10>

Critério de aceite:
- Testes em src/lib/sentinel-*.test.ts
- Meta qualityReport / llmCostEstimate no refresh (se aplicável)
- npm run sentinel:quality-eval (baseline vs tratamento)

NÃO fazer: <ex.: Perplexity em prod, apagar cache antes do fetch, force push>
```

---

## 13. Glossário rápido

| Termo | Significado |
|---|---|
| Radar | Config de temas/portais/@ do mandato |
| Sinal / suggestion | Card de pauta com evidência |
| forceRefresh | Ignora cache e coleta de novo |
| Ciclo diário 8h BRT | Janela automática grátis após 08:00 `America/Sao_Paulo` |
| Crédito guest | Unidade vitalícia (máx. 5) para force-refresh manual / save de temas |
| Expansão | Termos correlatos gerados por LLM por tema |
| Verify | LLM diz se matéria é substancialmente do tema |
| Quality rank | Spike: LLM mini no top N para pautável + ângulo |
| Circuit breaker | Para de chamar Google News após falhas seguidas |
| Pautável | Heurística/spike: card bom o bastante para o Criativo |

---

## 14. Diagrama de custo (camadas LLM)

```text
Sempre (barato):     RSS/Bing/portais + sinônimos + score
Às vezes (médio):    expansão (cacheada por tema) + verify (por artigo)
Spike (médio):       quality rank top N
Evitar no default:   Perplexity/Sonar em massa, LLM como busca principal
```

---

*Última atualização alinhada ao código pós-fix RSS (Bing/portais/circuit breaker), créditos guest vitalícios + refresh diário pós-8h BRT, falha de fonte sem consumir crédito, e spike `SENTINEL_LLM_QUALITY_RANK` (default off).*
