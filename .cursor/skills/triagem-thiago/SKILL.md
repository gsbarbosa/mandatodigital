---
name: triagem-thiago
description: >
  Triage demandas do sócio Thiago a partir de dumps de WhatsApp (textos longos,
  listas misturadas, prazos). Extrai itens atômicos, criva impacto/factibilidade,
  clarifica ambiguidades e propõe ordem de execução no Mandato Digital. Use when
  the user cola mensagens do Thiago/WhatsApp, pede triagem, crivo de demandas,
  "o que o Thiago pediu", ou TARS a partir de áudio/texto do sócio.
---

# Triagem Thiago (WhatsApp → crivo → plano)

## Quando rodar

Usuário cola dump de WhatsApp (com ou sem timestamps/`Thiago Ribeiro:`) ou diz
que veio pedido do Thiago / sócio. Não espere WhatsApp nativo — o gatilho é o
**paste** no chat (ou `@triagem-thiago`).

## Contexto do produto (âncora)

- Repo: Mandato Digital (Next.js + Firebase App Hosting + Supabase).
- Branches: `staging` = preview; `main` = prod. Deploy automático por branch.
- Prazo recorrente: janela eleitoral / convidados — tratar deadline como
  constraint de prioridade, não como feature isolada.
- Status vivo: `docs/status-desenvolvimento.md` (pode estar desatualizado —
  **validar no código** quando o impacto for grande).
- Conformidade/Compliance, Sentinela, HeyGen, onboarding/fluxos, precificação
  são eixos frequentes do Thiago.

## Procedimento (sempre nesta ordem)

### 1. Segmentar

Quebrar o dump em **itens atômicos** (1 intenção = 1 item). Separar:
- Deadline / pressão de calendário
- Feature / bug / copy / design
- Pedido de artefato (GIF script, texto, plano comercial)
- Decisão bloqueante (produto/jurídico/plano de API)

Ignorar saudações ("Vamo q vamo") salvo como sinal de urgência.

### 2. Crivar cada item

Para cada item, preencher:

| Campo | Conteúdo |
|-------|----------|
| Pedido (voz do Thiago) | Citação curta / parafrase imediata |
| O que ele precisa de verdade | Interpretação de produto (1–2 frases) |
| Tipo | deadline / feature / fix / design / doc / ops / comercial |
| Superfície | rotas/módulos tocados (Compliance, Sentinela, HeyGen, onboarding…) |
| Impacto | P0/P1/P2 + por quê (usuário convidado, legal, demo, receita) |
| Estado atual | ✅ / 🟡 / 🔶 / ❌ baseado em código + docs |
| Factível? | sim / parcial / não — com 1 linha de razão |
| Esforço | S (≤0,5d) / M (1–2d) / L (3d+) |
| Bloqueios | o que falta dele (copy, plano HeyGen, GIF assets) ou técnico |
| Pergunta de clarificação | no máximo 1, só se bloquear execução |
| Próximo passo | ação concreta (commit em staging, doc, mensagem de volta ao Thiago) |

### 3. Síntese (topo da resposta)

Abrir com:
1. Deadline e risco da janela (se houver)
2. Itens P0 ordenados
3. O que dá para executar **agora** sem esperar resposta dele
4. O que precisa voltar no WhatsApp (perguntas mínimas)

### 4. Modo execução

Só **implementar código** se o usuário pedir explicitamente ("implementa",
"faz o P0", "responde o TARS…"). Caso contrário entregar o crivo + artefatos
textuais (ex.: script de GIF).

Pedidos "pede pro TARS gerar descritivo/GIF":
- Mapear fluxo real no código (UI + API + terceiros)
- Entregar roteiro numerado com tags `[Usuário] [App] [API] [HeyGen|Sentinela]`
- Foco em **o que filmar**, não em arquitetura interna demais

### 5. Resposta ao Thiago (opcional)

Se o usuário pedir, gerar mensagem curta de WhatsApp (tom parceiro, sem jargão
de eng) com: o que entendi, o que já está ok, o que falta dele, prazo realista.

## Anti-padrões

- Não virar 1 dump em 1 mega-PR; manter atomicidade.
- Não inventar status — checar código/`apphosting.yaml`/rotas.
- Não misturar precificação comercial com refactor técnico no mesmo P0.
- Não expandir escopo ("enquanto faz Sentinela, refatora tudo").

## Formato de saída (padrão)

```markdown
## Crivo — <data ou assunto>

### Síntese
- ...

### Itens
#### 1. <título curto>
| ... | tabela do passo 2 |

### Ordem sugerida (esta semana)
1. ...

### Mensagem pronta pro Thiago (se pedida)
> ...
```
