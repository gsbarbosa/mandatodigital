# Proposta — Navegação operação-first (v2)

Documento de produto/UX para reorganizar a experiência do usuário **sem remover** a navegação atual de cinco agentes.

**Status:** implementado (flag default off em produção)  
**Última atualização:** 2026-06-24  
**Relacionados:** [status-desenvolvimento.md](status-desenvolvimento.md), [sentinela.md](sentinela.md)

---

## 1. Problema que estamos resolvendo

Hoje a UI trata **Sentinela → Curador → Criativo → Auditor → Distribuidor** como cinco etapas equivalentes num pipeline linear. Isso transmite:

- “Todo dia percorro os cinco passos”
- “Configurar persona pesa o mesmo que publicar um vídeo”

Na prática o uso se divide em:

| Modo | Frequência | O que inclui |
|------|------------|--------------|
| **Setup** | Uma vez + revisões ocasionais | Perfil, avatar HeyGen, radar (temas, portais, oposição), canais |
| **Operação** | Diária / várias vezes por semana | Ver sinais, gerar roteiro, aprovar, produzir vídeo, publicar |

O **Validador** já é middleware (gate no Criativo) — não deveria ser “passo 4” na cabeça do usuário.  
O **Auditor** (UI) é histórico/backoffice quando existir fila real.

---

## 2. Princípios da v2

1. **Operação primeiro** — home do produto = pauta + criar.
2. **Setup agrupado** — um lugar “Configurações” (ou wizard único de onboarding).
3. **Validador invisível** — continua no backend; feedback no fluxo de aprovação do roteiro.
4. **Rotas antigas intactas** — `/sentinela`, `/curador`, etc. continuam funcionando.
5. **Rollback em um toggle** — flag de ambiente; sem redeploy de código para voltar.

---

## 3. Modelo mental proposto (v2)

### 3.1 Navegação principal (2 + 1)

```
┌──────────────────────────────────────────────────────────┐
│  OPERAÇÃO                                                │
│  • Início (/inicio)     — sinais + atalhos + checklist   │
│  • Criar (/criativo)    — roteiro → vídeo → publicar     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  CONFIGURAÇÕES (/configuracoes)                          │
│  • Perfil & identidade    (ex-Curador)                   │
│  • Radar & fontes         (ex-Sentinela config)          │
│  • Canais                 (ex-Distribuidor prefs)        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  OPCIONAL / ADMIN                                        │
│  • Histórico de auditoria (/auditor) — quando fila real  │
│  • Admin / evals           (mantém como hoje)              │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Tela Início (`/inicio`) — operação

Blocos sugeridos:

1. **Sinais de hoje** — top N do cache Sentinela + botão “Atualizar sinais” (mesma API).
2. **Criar conteúdo** — CTA primário → `/criativo/novo` ou lista de projetos.
3. **Checklist de setup** (só se incompleto) — avatar não treinado, radar vazio, cidade faltando.
4. **Projetos recentes** — últimos `creative_projects`.

Não duplica lógica: **reutiliza** componentes de Sentinela (lista de sinais) e Criativo (cards).

### 3.3 Configurações (`/configuracoes`) — setup

Abas ou seções:

| Seção | Origem | Frequência esperada |
|-------|--------|---------------------|
| Perfil & avatar | Curador v2 | Raro |
| Radar & monitoramento | Sentinela (formulário radar) | Ocasional |
| Canais & publicação | Distribuidor | Raro até Distribuidor real |

“Salvar radar” e treino HeyGen ficam aqui — não no fluxo diário.

### 3.4 Criar (`/criativo`) — operação

Mantém fluxo atual, com copy ajustada:

- Handoff `?sugestao=` continua.
- Gate fact-check continua embutido em “Aprovar roteiro”.
- Link discreto: “Ajustar radar” → `/configuracoes#radar`.

---

## 4. Fluxo do usuário na v2

### Primeira vez (onboarding)

```
Login → Wizard único (3 passos)
  1. Quem você é (perfil mínimo: nome, cargo, cidade/estado)
  2. O que monitorar (radar simplificado — temas + 1 portal)
  3. Avatar (opcional “fazer depois”)
→ Redireciona para /inicio
```

Wizard pode ser **só UI** montada em cima das mesmas APIs de profile + sentinel save.

### Dia a dia

```
/inicio → vê sinais → “Criar vídeo” → /criativo/novo?sugestao=
→ gera roteiro → aprova (fact-check automático) → produz vídeo
→ (futuro) publicar no Distribuidor embutido no Criativo ou atalho
```

### Revisitar setup

```
Menu Configurações → editar radar / avatar / canais
(raramente)
```

---

## 5. Garantia da versão atual (rollback)

### 5.1 Regra de ouro

> **Nenhum arquivo da navegação v1 é apagado ou substituído in-place.**  
> A v2 é uma **camada paralela** ligada por feature flag.

### 5.2 Feature flag

| Variável | Default | Efeito |
|----------|---------|--------|
| `NEXT_PUBLIC_PRODUCT_NAV_V2` | `false` | `false` = pipeline 5 agentes (atual); `true` = navegação operação-first |

- Flag **pública** (`NEXT_PUBLIC_*`) porque o shell é client-side.
- Default **off** em prod até smoke test da v2.
- Mesmo padrão de `SENTINEL_V2_PIPELINES` em `src/lib/feature-flags.ts`.

Implementação prevista:

```ts
// src/lib/feature-flags.ts (futuro)
productNavV2: readEnvFlag("NEXT_PUBLIC_PRODUCT_NAV_V2"),
```

```tsx
// src/components/product/shell.tsx (futuro)
{productNavV2 ? <ProductShellV2 /> : <ProductShellV1 />}
```

### 5.3 O que permanece igual com flag off

| Item | Preservado |
|------|------------|
| Rotas `/sentinela`, `/curador`, `/criativo`, `/auditor`, `/distribuidor` | ✅ |
| `WorkflowPipelineBar` + `mvpPipelineSteps` | ✅ em `ProductShellV1` |
| APIs, storage, fact-check, HeyGen | ✅ sem alteração |
| Testes E2E existentes | ✅ continuam no modo v1 |
| Temas CSS `agent-theme-*` | ✅ |

### 5.4 O que a v2 adiciona (sem quebrar v1)

| Novo | Notas |
|------|-------|
| `ProductShellV2`, `OperationNav`, `SetupNav` | componentes novos |
| `/inicio`, `/configuracoes` | rotas novas; redirecionamento opcional pós-login |
| `OnboardingWizard` | opcional; só com flag on |
| Testes E2E `nav-v2.spec.ts` | paralelos; não substituem os atuais |

### 5.5 Rollback operacional

1. **Produção:** `NEXT_PUBLIC_PRODUCT_NAV_V2=false` em `apphosting.yaml` → redeploy.
2. **Dev local:** `.env.local` sem a flag ou `=false`.
3. **Emergência:** revert do commit que ligou a flag (histórico git intacto).

Tempo de rollback estimado: **um deploy** (~minutos), sem migration de banco.

### 5.6 Branch e commits

```
feat/product-nav-v2     ← implementação isolada
main                    ← só merge após smoke; flag off no merge
```

Commits atômicos sugeridos:

1. `docs: proposta navegação v2 + estratégia rollback`
2. `feat: flag PRODUCT_NAV_V2 e shell v1 renomeado`
3. `feat: rotas /inicio e /configuracoes (flag off default)`
4. `feat: onboarding wizard (flag on only)`
5. `test: e2e nav v2`

---

## 6. Mapa v1 → v2 (referência)

| v1 (agente) | v2 (onde vive) |
|-------------|----------------|
| Sentinela — lista sinais | Início |
| Sentinela — formulário radar | Configurações › Radar |
| Curador | Configurações › Perfil & avatar |
| Criativo | Criar (mesma rota `/criativo`) |
| Auditor — fact-check | Invisível (gate no Criativo) |
| Auditor — UI fila | Opcional / Admin |
| Distribuidor — prefs | Configurações › Canais |
| Distribuidor — publicar | Criar (futuro) ou Início |

URLs v1 **permanecem válidas** na v2 (deep links, bookmarks, docs).

---

## 7. Fases de implementação

### Fase A — Preservação (baixo risco)

- [x] Renomear shell atual → `product-shell-v1.tsx` (re-export mantém import)
- [x] Adicionar flag `NEXT_PUBLIC_PRODUCT_NAV_V2` (default false)
- [x] Documentar em `status-desenvolvimento.md`
- [x] Nenhuma mudança visível em prod (flag off)

### Fase B — Esqueleto v2 (flag on em dev)

- [x] `ProductShellV2` com nav Operação / Configurações
- [x] `/inicio` — sinais + checklist + projetos recentes
- [x] `/configuracoes` — tabs perfil / radar / canais

### Fase C — Polish

- [x] Checklist de setup no Início
- [x] Wizard onboarding (`/onboarding`)
- [x] Redirecionamento pós-login → `/inicio` quando flag on
- [x] E2E nav v2 (`tests/e2e/nav-v2.spec.ts`)

### Fase D — Decisão produto

- [ ] Smoke test interno com flag on em staging
- [ ] Ligar em prod **ou** descartar v2 (flag off para sempre; código v2 pode ficar dormant)

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Duplicação de UI | Reutilizar componentes; v2 só reorganiza layout |
| E2E quebrando | Testes v1 inalterados; flag off no CI |
| Usuários com bookmark v1 | Rotas v1 nunca removidas |
| Flag esquecida ligada | Default false; checklist no deploy |
| “Duas verdades” de navegação | Período curto; decisão explícita na Fase D |

---

## 9. Critérios para adotar ou descartar v2

**Adotar** se, em teste interno:

- Tempo até primeiro vídeo (usuário novo) cair vs. v1
- Usuários acharem Início + Criar suficientes no dia a dia
- Configurações forem visitadas raramente (analytics ou feedback)

**Descartar** se:

- Confusão entre v1/v2 no time
- Reuso de componentes exigir refactor grande
- Produto preferir manter metáfora de “agentes” para demo/vendas

**Descartar ≠ perder trabalho:** flag off; código v1 segue sendo o default; branch v2 arquivada.

---

## 10. Changelog

| Data | Mudança |
|------|---------|
| 2026-06-24 | Proposta inicial + estratégia de rollback via `NEXT_PUBLIC_PRODUCT_NAV_V2` |
