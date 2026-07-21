# Checklist roadmap — sistema (até 05/Ago)

Acompanhamento das tarefas **de produto/sistema** extraídas de `RoadMapAte_05_Ago.txt`.  
Itens burocráticos (CoWork, Santander, Meta BM, LinkedIn, ofício comercial, etc.) ficam de fora.

**Fonte:** `RoadMapAte_05_Ago.txt`  
**Última atualização:** 2026-07-20 (painel `/admin` MVP)  
**Relacionados:** [status-desenvolvimento.md](status-desenvolvimento.md) · [Compliance_Prioridades.txt](Compliance_Prioridades.txt)

### Legenda — Status

| Valor | Significado |
|-------|-------------|
| `todo` | Não iniciado |
| `inprogress` | Parcial / em andamento |
| `done` | Implementado no código (pode faltar validação humana) |

### Legenda — Validado por Thiago

| Valor | Significado |
|-------|-------------|
| `pendente` | Ainda não validou em produto |
| `sim` | Validou / marcou como ok |
| `n/a` | Não aplica (infra interna, sem UX de produto) |

---

## 1. Experiência e produto atual

| Task | Status | Validado por Thiago | Observação |
|------|--------|---------------------|------------|
| Onboarding ao chegar no sistema | done | pendente | Checklist + coachmarks + fases; ver `onboarding-provider` |
| Ajustes de fluxo e navegação | done | pendente | Home `/monitoramento`, sidebar, redirects pós-login (spec 08/jul) |
| Sentinela — melhorias (foco entrega 25/) | inprogress | pendente | Pipelines v2 + LLM + trend em prod; falta social/Instagram, refresh auto |
| Revisar textos de Compliance no sistema | done | sim | Marcado `x` no roadmap; confirmar se copy atual ainda bate |
| Revisar dossiê do site de preços | done | sim | Marcado `x` no roadmap; templates/PDF legais existem |
| Cruzar sistema × arquivo compliance-tSE | done | sim | Marcado `x` no roadmap; selo, export-accept, fact-check e contrato cobrem parte |
| Testar ambiente guest vs premium (limites) | inprogress | pendente | Modo conta + créditos guest (5 vitalícios / ciclo 8h BRT); falta QA formal |
| Filtro CNPJ eleitoral + teto vagas partido/UF + lista de reserva | inprogress | pendente | Natureza jurídica via BrasilAPI no aceite; teto 03/partido só no copy — sem enforcement nem e-mail de fila |
| URL canônica → `mandatodigital.ia.br` | inprogress | pendente | Prod em App Hosting / `web.app`; alinhar DNS + `NEXT_PUBLIC_APP_BASE_URL` |

---

## 2. Atividades sistema — agora

| Task | Status | Validado por Thiago | Observação |
|------|--------|---------------------|------------|
| Migração de banco de dados | done | n/a | Cutover Firestore + Storage concluído |
| Centralização de contas (APIs/serviços) + painel adm de créditos/alarmes | todo | pendente | Aguardando painel do Guga |
| Suporte via IA (N1 Sonnet / N2 Opus / N3 humano) | todo | pendente | Não existe |
| Painel de gestão com suporte | inprogress | pendente | MVP em `/admin` (dashboard, usuários, provedores, roadmap editável) |
| Roteiro.gif — UX de progresso do Sentinela | todo | pendente | Loading genérico existe; animação narrada do roadmap não |
| Métricas para aperfeiçoamento semi-automático | inprogress | pendente | `/auditoria` (acessos, volumes, agentes, logs); falta loop de melhoria automática |
| Obter/estruturar contatos TSE (dados/crawler) | todo | pendente | Fora do produto hoje |

---

## 3. Pós 25/ — pagamentos, distribuição e materialidade

| Task | Status | Validado por Thiago | Observação |
|------|--------|---------------------|------------|
| Preencher contrato/dossiê + e-mail no aceite | inprogress | pendente | `POST /api/contract/accept` gera PDFs + e-mail; NF ainda não |
| Emitir 3 boletos (3 parcelas) de uma vez no aceite | todo | pendente | Só copy na UI |
| Conciliação bancária → bloquear plataforma se inadimplente | todo | pendente | Só texto contratual |
| Menu “Meus pagamentos” + alerta 5 dias antes do vencimento | todo | pendente | Fora do nav |
| Travas/cadeados por ausência de pagamento / data | todo | pendente | Não existe |
| Teste de volumetria HeyGen (+ provedor alternativo) | todo | pendente | Não documentado |
| Agente Distribuidor | inprogress | pendente | UI mock; sem publicação real |
| Materialidade — dados salvos e estruturados (agora) | inprogress | pendente | `audit_log` + `/auditoria` (user, IP, timestamp, ações) |
| Materialidade self-service (relatórios + prints + export) | todo | pendente | Meta sugerida ≥ 10/Set |

---

## 4. Features novas — resultado para o cliente

| Task | Status | Validado por Thiago | Observação |
|------|--------|---------------------|------------|
| Multiplicador de cidades (N vídeos localizados) | todo | pendente | Spec no roadmap; botão nos avatares ainda não existe |
| Controles de avatar (expressão, gestos, postura, imobilidade, olhar) | todo | pendente | Só defaults internos HeyGen |
| Alterar background do avatar | todo | pendente | Backlog Fase 3.4 |

---

## Como atualizar

1. Mudar **Status** quando o código avançar (`todo` → `inprogress` → `done`).
2. Mudar **Validado por Thiago** só após aceite explícito dele (`pendente` → `sim`).
3. Registrar na **Observação** a evidência (rota, flag, commit) ou o bloqueio.
4. Atualizar a data no topo a cada revisão.
