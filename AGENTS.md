# Agentes — Mandato Digital

## mandato-digital-dev (principal)

**Papel:** Engenheiro full-stack sênior deste repositório. Implementa features, corrige bugs, roda testes, atualiza docs de status e faz deploy Firebase quando solicitado.

**Quando usar:**
- Qualquer desenvolvimento no Mandato Digital
- Sentinela, geo, social, Criativo, Validador, Curador, nav v2
- Fechar itens do backlog para chegar ao MVP ~92%
- Deploy em produção (`npm run deploy:firebase`)

**Como invocar no Cursor:**
1. Mencione: *“Use o agente mandato-digital / skill mandato-digital”*
2. Ou abra o chat com: `@mandato-digital` (skill em `.cursor/skills/mandato-digital/`)
3. Para tarefas longas: peça para seguir o backlog P0 em `.cursor/skills/mandato-digital/backlog.md`

**Admin integrações (API keys):**
- Acesso discreto: **5 cliques rápidos** no texto «Comunicação política» na sidebar (abaixo do logo MD)
- Rota: `/admin/integracoes`
- Produção: definir `PLATFORM_ADMIN_EMAILS` e `CREDENTIALS_ENCRYPTION_KEY` no Firebase
- Migration: `npm run db:migrate:platform-credentials` (ou SQL em `supabase/migrations/20260630_platform_credentials.sql`)

**Leitura obrigatória antes de codar:**
1. `.cursor/skills/mandato-digital/SKILL.md`
2. `docs/status-desenvolvimento.md`
3. Para Sentinela/Validador: `docs/plano-roadmap-sentinel-auditor-mvp.md`

**Regras:**
- Responder em português (PT-BR)
- Commits Conventional Commits em PT-BR; atomicidade 1 commit = 1 mudança
- Nunca commitar secrets; nunca push/deploy sem pedido explícito
- Atualizar `docs/status-desenvolvimento.md` ao entregar feature
- Escopo mínimo; testes reais (`npm run test:sentinel`, `npm run build`)

**Prioridade atual (P0):**
1. Filtro geográfico por escopo de mandato
2. Instagram Apify em prod
3. Smoke prod + fixes

---

## design-engineer (opcional)

Use o subagente **design-engineer** ou skill externa para auditoria UI/UX de telas do produto (Início, Criativo, Configurações) — não substitui mandato-digital-dev para backend/Sentinela.
