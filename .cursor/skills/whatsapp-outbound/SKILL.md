---
name: whatsapp-outbound
description: >
  Dispara templates de WhatsApp do outbound do Mandato Digital para pessoas
  nomeadas. Mostra preview (contato + texto como vai ficar) e só envia depois
  de aprovação explícita. Use when the user pedir disparo, enviar template,
  mandar WhatsApp, campanha da Marina/Anna, "envia o md_intro_ para Fulano",
  preview de template, ou iniciar os disparos da base marketingContacts.
---

# Disparo WhatsApp outbound (nomeado)

Operador do canal **+55 31 7535-5968** (Mandato Digital). Não confundir com o
agente `whatsapp-dispatch` da Kenlo/Beyond.

## Contrato inegociável

1. **Preview primeiro.** Nunca chame `--confirm` no mesmo turno em que o
   usuário só pediu para enviar / começar / disparar.
2. **Enviar só depois de aprovação explícita** neste chat: "pode enviar",
   "confirma", "manda", "autorizado". "ok" solto depois de outro assunto não conta.
3. **Não invente destinatário.** Nome ambíguo ou ausente → mostre opções e
   pare. Não chute o homônimo.
4. **Não improvise a Cloud API.** Use o script. Não monte `curl` da Meta na mão.

## Fluxo

### 1. Ler o pedido

Extrair:
- template (`md_intro_*` ou apelido: feito, vaga, materialidade, prova…)
- lista de nomes (vírgula, "e", quebra de linha). UF no fim desambigua (`Maria BA`).

Se faltar template ou nomes, perguntar só isso. Se o usuário mandar um
**segmento** em vez de nomes, avise que este fluxo é nomeado; resolva o
segmento para nomes e ainda assim mostre preview pessoa a pessoa.

### 2. Preview (obrigatório)

```bash
npm run marketing:dispatch -- --template=md_intro_feito_candidatas_v3 --names="Alana Passos, Sarah Poncio"
npm run marketing:dispatch -- --template=feito --from-csv --limit=50
npm run marketing:dispatch -- --template=feito --from-csv --limit=50 --confirm
```

O script carrega Firestore (`marketingContacts`) e, se houver
`WHATSAPP_ACCESS_TOKEN` no `.env.local`, puxa o **corpo oficial** na Meta.

Mostre ao usuário, neste formato:

```markdown
## Preview — {template}

Texto do template:
> …

| Nome | UF | WhatsApp | Status | Como vai ficar |
|---|---|---|---|---|
| … | … | … | pronto / ambíguo / sem tel / VIP | citação do corpo preenchido |

Prontos: N
Nada foi enviado. Confirma?
```

Destaque VIP, sem telefone, suspenso, já enviado, opt-out, teto do dia (50).

### 3. Esperar

Pare. Não envie. Não ofereça comando `--confirm` como se já tivesse rodado.

### 4. Enviar (só com aprovação)

Repita **o mesmo** template e a **mesma** lista (já desambiguada, se o
usuário escolheu). Não acrescente gente nova neste passo.

```bash
npm run marketing:dispatch -- --template="<template>" --names="<nomes>" --confirm
```

Relato curto: enviados / falhou / fora do teto, um linha por pessoa.

## Regras de conteúdo

Catálogo e notas: `src/lib/outbound/whatsapp-templates.ts`.
Spec: `docs/marketing-outbound.md`.

- Preferir templates **aprovados que não prometem material fantasma**:
  `md_intro_feito_candidatas_v1`, `md_intro_vaga_sigla_v1`.
- Mulher sem mandato → feito candidatas. Presidente de diretório → vaga sigla
  (não fale como se fosse candidato). Homem / prova → `md_intro_prova_v1`
  só depois de conferir os 4 params no preview.
- VIP (federal em reeleição, senador, presidente de partido grande, ≥400k
  followers) entra no preview com aviso. Só envia se o usuário nomeou essa
  pessoa **e** confirmou o lote.
- Cadência: teto **50/dia**, lote espalhado por UF, dias úteis. O script corta
  o que passar do teto.
- Primeiro lote de candidatas: `--from-csv --limit=50` lê Pasta1 + scrape
  (não a poça antiga do Firestore). Contato só é gravado no envio.

## Token local

Preview de nomes/telefones funciona com `FIREBASE_SERVICE_ACCOUNT_JSON`.
Envio e corpo oficial da Meta exigem `WHATSAPP_ACCESS_TOKEN` no `.env.local`.
Se faltar, não envie: oriente puxar o secret (`whatsapp-access-token`) — o
agente `integracoes` sabe o pipeline. Não cole o token no chat.

## Anti-padrões

- Não dispare campanha inteira do painel por este fluxo (isso é o botão
  Enviar em `/admin/marketing`).
- Não use `scripts/whatsapp-test.ts` para gente da base — ele não resolve
  nome nem grava `marketingSends`.
- Não mude template entre o preview e o `--confirm`.
- Não envie follow-up (`md_followup_candidatas_v1`) para quem nunca recebeu intro.
