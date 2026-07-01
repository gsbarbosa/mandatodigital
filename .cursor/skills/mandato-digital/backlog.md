# Backlog priorizado — Mandato Digital

Meta: **MVP A/B ~92%** (fluxo gabinete + Sentinela maduro + Validador visível).

Estimativas são para 1 dev focado, incluindo testes.

---

## P0 — Alto valor, baixo esforço

### B1. Geo por escopo de mandato (~3–5 dias)

**Problema:** Vereador/estadual vê pauta de outra cidade/UF (ex.: vacinação Campinas para candidato CE).

**Entregáveis:**
- `src/lib/sentinel-geo-scope.ts` — deriva escopo de `profile.role` + city/state
- Mapa UF → nome (`CE` → `Ceará`) para queries e match
- Filtro pós-match: rejeitar artigo/post fora da base (ou marcar `geoScope: out_of_base`)
- Badge UI: Local · Estadual · Nacional · Fora da base
- Testes com perfis vereador Campinas vs deputado CE

**Aceite:** Matéria “Campinas + vacinação” não vira oportunidade editorial para perfil CE.

---

### B2. Instagram em produção (~0,5 dia)

**Entregáveis:**
- Secret `apify-api-token` no Firebase App Hosting
- Descomentar flags em `apphosting.yaml`
- Smoke: perfil @ oposição → monitoramento social no Início

**Aceite:** Post correlacionado com RSS promove para “Imprensa + social”.

---

### B3. Smoke prod documentado (~1 dia)

**Entregáveis:**
- `docs/smoke-prod.md` — checklist 15 min (login, radar, refresh, criativo, validador)
- Corrigir bugs encontrados

---

## P1 — MVP redondo

### B4. Validador on-demand por sinal (~2–3 dias)

**Entregáveis:**
- Botão “Verificar fatos” no card do Sentinela
- Reusa `POST /api/auditor/fact-check`
- Badge resultado no card (`verified` / `disputed` / `inconclusive`)

---

### B5. LLM enrich — prompt geo (~0,5 dia)

**Entregáveis:**
- Instrução explícita em `sentinel-enrich.ts`: penalizar sinal fora de `{city}/{state}`
- Teste de prompt com fixture

---

### B6. Merge staging → main + alinhar docs (~0,5 dia)

- `sentinela.md` atualizado
- `status-desenvolvimento.md` flags pós-B2

---

## P2 — Pós-MVP (não priorizar sem pedido)

| ID | Item | Esforço |
|----|------|---------|
| B7 | Refresh Sentinela cron (6h) | 2–3 d |
| B8 | Auditor UI fila real | 3–5 d |
| B9 | SerpAPI / Trends pago | spike + 2 d |
| B10 | X/TikTok social | 5+ d |
| B11 | Distribuidor publicação real | 2–4 sem |
| B12 | Selo TSE overlay FFmpeg | 1 sem + jurídico |
| B13 | Fila jobs / escala Cloud Run | 1–2 sem |

---

## Percentuais-alvo

| Marco | Itens | ~% produto MVP A/B |
|-------|-------|---------------------|
| Hoje | — | **~82–85%** |
| P0 completo (B1–B3) | geo + social prod + smoke | **~88–90%** |
| P1 completo (+ B4–B6) | validador UI + docs | **~90–92%** |
| P2 | distribuidor, TSE, escala | **100% visão completa** |
