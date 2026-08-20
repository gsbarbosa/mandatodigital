# Cotas de produção de vídeo por parcela paga

**Status:** plano de implantação — aguardando execução
**Autor:** Thiago Ribeiro
**Executor previsto:** Gustavo (owner)
**Data:** 19/08/2026
**Impacto:** páginas de planos (site e app), landing de conversão, trava de geração de vídeo, tela de pagamentos

---

## 1. Contexto — por que essa mudança é necessária

Hoje existe um descasamento entre **como vendemos** e **como cobramos**, e uma trava que simplesmente não existe no código.

### 1.1 O texto vende mensal, a cobrança é pacote

Todos os planos são cobrados como **pacote de campanha em 3 parcelas** (`PLAN_PRICING` em [plan-pricing.ts](../src/lib/billing/plan-pricing.ts)), mas o texto comercial promete volume **por mês** ("5 avatares/mês", "22 avatares/mês", "60 avatares/mês"). Além de confundir o candidato, isso desalinha a promessa do ciclo eleitoral, que é o horizonte real de uso do produto.

### 1.2 Não existe nenhuma trava de produção para plano pago

O campo `avatarsPerMonth` (5 / 22 / 60) está declarado em [account-tier.ts:53](../src/lib/account-tier.ts) e **nunca é lido por nenhum código de produção** — só pelos testes. A única cota aplicada hoje é a do convidado (2 vídeos por tipo de avatar, em [guest-usage-storage.ts](../src/lib/guest-usage-storage.ts)), e ela é explicitamente pulada para qualquer conta paga:

```ts
// src/app/api/heygen/videos/route.ts:155
const premium = await isPremiumAccountMode(sessionForQuota?.email);
if (!premium) { /* ... cota de convidado ... */ }
```

Na prática: **qualquer assinante ativo pode gerar vídeos sem limite algum.** O que anunciamos como 5, 22 ou 60 é, no sistema, infinito. Isso é exposição direta de custo — cada vídeo consome crédito HeyGen e/ou ElevenLabs.

### 1.3 Risco de caixa: produzir tudo na primeira parcela

Com o pacote em 3x, um candidato pode pagar **só a primeira parcela**, produzir todo o volume do plano e simplesmente não pagar as duas seguintes. Nós já entregamos o serviço inteiro; a inadimplência vira prejuízo puro. Amarrar a liberação ao pagamento resolve isso sem cobrar nada a mais de quem paga em dia.

### 1.4 Risco comercial: o Essencial canibalizando o Avançado

O que diferencia o Avançado não é só o número — é o **Gêmeo Digital** com renderização avançada, que é o item caro. Se o Essencial tiver uma cota única de 20, nada impede gastar os 20 em Gêmeo Digital e ter, por R$ 998 × 3, quase o pacote do Avançado (R$ 1.998 × 3). Por isso o Essencial precisa de **duas cotas separadas**, exatamente como o texto comercial já descreve: 8 digitais e 12 caricaturas/3D.

### 1.5 Resumo do que essa entrega faz

1. Troca o texto de "XX avatares/mês" para "XX avatares no período eleitoral", com os novos volumes.
2. Cria a trava de produção que hoje não existe, com teto proporcional às parcelas pagas.
3. No Essencial, separa a cota em Gêmeo Digital e Caricatura/3D.
4. Dá ao usuário bloqueado um caminho claro: quitar as parcelas restantes e liberar o plano.

---

## 2. Regra de negócio

### 2.1 Volumes novos

| Plano | Antes | Depois |
|---|---|---|
| Essencial | 5 avatares/mês (2 digitais e 3 caricaturas/3D) | **20 avatares no período eleitoral (8 digitais e 12 caricaturas/3D)** |
| Avançado | 22 avatares/mês | **66 avatares no período eleitoral** |
| Elite | 60 avatares/mês | **180 avatares no período eleitoral** |

O volume vale para o **pacote inteiro** — não reseta por mês e não há renovação dentro do período.

### 2.2 Liberação proporcional às parcelas

Fórmula do teto **acumulado**:

```
teto = arredondaParaCima( total × parcelas_pagas ÷ total_de_parcelas )
```

| Plano / cota | 1ª parcela | 2ª parcela | 3ª parcela |
|---|---|---|---|
| Essencial — Gêmeo Digital (8) | 3 | 6 | 8 |
| Essencial — Caricatura/3D (12) | 4 | 8 | 12 |
| **Essencial — soma** | **7** | **14** | **20** |
| Avançado — livre escolha (66) | 22 | 44 | 66 |
| Elite — livre escolha (180) | 60 | 120 | 180 |

Lido de forma incremental, o Essencial libera 7 + 7 + 6; o Avançado, 22 + 22 + 22; o Elite, 60 + 60 + 60.

### 2.3 Decisões já fechadas

| # | Decisão |
|---|---|
| 1 | **O teto é acumulado, não incremental.** Cota não usada não evapora: quem produziu 2 vídeos na 1ª parcela do Essencial fica com 12 disponíveis ao pagar a 2ª (14 − 2), não com 7. |
| 2 | **O gatilho é parcela paga, não parcela vencida.** Quem atrasa não ganha faixa nova — senão a trava não protegeria nada. |
| 3 | **Quem paga tudo de uma vez libera tudo.** Não precisa de regra separada para "à vista": pagar as 3 cobranças leva `paidInstallments` a 3 e o teto ao total. |
| 4 | **1 vídeo gerado = 1 unidade da cota.** Não contamos geração de imagem/caricatura isolada, só vídeo. |
| 5 | **Só o Essencial tem cota dividida.** Avançado e Elite mantêm cota única, porque o texto deles é "livre escolha". |
| 6 | **"Quitar" = pagar as cobranças restantes que já existem na Asaas.** Sem desconto, sem cancelar e sem recriar cobrança — nada que mexa em nota fiscal. |
| 7 | **Quem já gerou vídeo antes do deploy começa do zero.** O contador não existe hoje e o histórico não é reconstruível. |

### 2.4 Mensagem ao usuário bloqueado

Quando a cota da faixa atual acabar, informar que a produção é liberada proporcionalmente às parcelas, dizendo quanto foi usado, qual o teto atual, qual o teto total e quando vence a próxima parcela — e oferecer a ação **"Quitar parcelas e liberar o plano"**, levando para Meus Pagamentos.

No Essencial a mensagem é por tipo. Exemplo: *"Você usou os 3 Gêmeos Digitais liberados até a 1ª parcela. Ainda restam 4 caricaturas/3D. O próximo bloco abre com a 2ª parcela, que vence em 12/09."*

---

## 3. Mapa do código hoje

O que já existe e pode ser reaproveitado:

| Peça | Onde | Situação |
|---|---|---|
| Textos dos planos (site) | [planos-content.ts](../src/lib/marketing/planos-content.ts) | trocar |
| Textos dos planos (app) | [early-access.ts](../src/lib/early-access.ts) | trocar |
| Direitos por plano | [account-tier.ts](../src/lib/account-tier.ts) | `avatarsPerMonth` é código morto — substituir |
| Tier a partir da cobrança | [account-tier.server.ts](../src/lib/account-tier.server.ts) | pronto, usar |
| Parcelas pagas / status | `registration.paidInstallments`, `billingStatus` ([user-registration-types.ts](../src/lib/user-registration-types.ts)) | pronto, usar |
| Visão de parcelas (nº, vencimento, status) | `buildBillingInstallmentViews` — [asaas-payment-sync.ts:345](../src/lib/billing/asaas-payment-sync.ts) | pronto, estender com link |
| Cota de convidado (padrão a copiar) | [guest-usage-storage.ts](../src/lib/guest-usage-storage.ts) | referência de transação/rollback |
| Criação de vídeo | [api/heygen/videos/route.ts](../src/app/api/heygen/videos/route.ts) e [api/jobs/video/route.ts](../src/app/api/jobs/video/route.ts) | **os dois** precisam da trava |
| Gate visual do Criativo | [criativo-page-v2.tsx:399](../src/components/product/criativo-page-v2.tsx) | ponto de entrada da mensagem |
| Endpoint de cotas do front | [api/sentinel/credits/route.ts](../src/app/api/sentinel/credits/route.ts) | estender |
| Tela de pagamentos | [pagamento-page.tsx](../src/components/product/acesso-antecipado/pagamento-page.tsx) | estender |

Ponto de atenção: `isPremiumAccountMode` resolve o tier real vindo da cobrança, não só contas de desenvolvimento. Ou seja, hoje o assinante pula a cota de convidado e não cai em nenhuma outra.

---

## 4. Plano de implantação

### Etapa 1 — Textos (independente do resto, pode ir sozinha)

Padrão: `XX avatares no período eleitoral`, preservando o restante de cada frase.

| Arquivo | Linha | Conteúdo atual |
|---|---|---|
| [planos-content.ts](../src/lib/marketing/planos-content.ts) | 53 | `Produção de 5 avatares/mês (2 digitais e 3 caricaturas/3D), vídeos de até 1 minuto.` → `Produção de 20 avatares no período eleitoral (8 digitais e 12 caricaturas/3D), vídeos de até 1 minuto.` |
| [planos-content.ts](../src/lib/marketing/planos-content.ts) | 74 | `Produção de 22 avatares/mês (livre escolha)…` → `Produção de 66 avatares no período eleitoral (livre escolha)…` |
| [planos-content.ts](../src/lib/marketing/planos-content.ts) | 99 | `strongPrefix: "Produção de 60 avatares/mês"` → `"Produção de 180 avatares no período eleitoral"` |
| [planos-content.ts](../src/lib/marketing/planos-content.ts) | 175-177 | tabela comparativa: `5, sendo máximo com 2 Gêmeo Digital` → `20 no período eleitoral, sendo no máximo 8 Gêmeo Digital`; `22 com renderização avançada…` → `66 no período eleitoral…`; `60 com renderização avançada…` → `180 no período eleitoral…` |
| [early-access.ts](../src/lib/early-access.ts) | 159, 172, 185 | mesmos três textos, versão do app |
| [dev-account-mode-page.tsx](../src/components/product/dev-account-mode-page.tsx) | 22, 27, 32 | dicas internas do modo de teste (`5 avatares/mês` → `20 no período eleitoral`, etc.) |
| [public/vozdelas/index.html](../public/vozdelas/index.html) | 506 | `22 avatares/mês, renderização avançada do Gêmeo Digital, vídeos de até 90 segundos` → `66 avatares no período eleitoral, …` |

**Varredura já feita — nada a alterar nestes:** `public/chapas-femininas/index.html`, `public/vozdelas/provas.html`, `public/materialidade/index.html`, `public/na-pratica/index.html`, `public/na-pratica/agentes/criativo.html`, `public/na-pratica/agentes/sentinela.html`. Nenhuma delas cita volume de avatares ou vídeos. Conforme combinado, **não criar** essa informação onde ela não existe.

**`teste-gratis` não existe no repositório** — nem pasta, nem rota, nem arquivo. A única menção é texto solto ("Teste grátis, sem cartão") em `public/na-pratica/index.html`, sem número. Se a landing estiver hospedada fora do repositório, precisa ser atualizada à parte.

> `public/na-pratica/` ainda está fora do controle de versão (aparece como não rastreado no git). Ao tocar nesses arquivos, eles entram no commit.

### Etapa 2 — Modelo de cotas (`account-tier.ts`)

Remover `avatarsPerMonth` (código morto) e colocar no lugar a cota de campanha:

```ts
export type CampaignVideoQuota =
  | { kind: "split"; digital: number; caricature: number; total: number }
  | { kind: "free"; total: number };
```

| Tier | Valor |
|---|---|
| `trial` | `null` (segue na cota de convidado) |
| `essencial` | `{ kind: "split", digital: 8, caricature: 12, total: 20 }` |
| `avancado` | `{ kind: "free", total: 66 }` |
| `elite` | `{ kind: "free", total: 180 }` |

Atualizar [account-tier.test.ts:46,51,57](../src/lib/account-tier.test.ts), que ainda espera `avatarsPerMonth`.

### Etapa 3 — Cálculo puro (`src/lib/plan-video-quota.ts`, novo)

Módulo sem I/O, fácil de testar:

- `videoBucketFromGenerateMode(mode)` → `"digital"` para `photo_real` e `avatar`; `"caricature"` para `caricature`. Os três valores já existem e chegam do cliente em [criativo-page-v2.tsx:1766](../src/components/product/criativo-page-v2.tsx).
- `allowanceFor(total, paidInstallments, installmentCount)` → `ceil(total × pagas ÷ total)`, limitado ao total, mínimo 0.
- `resolvePlanVideoQuota({ tier, paidInstallments, installmentCount, used })` → por cota: `limit`, `used`, `remaining`, `blocked`, além de `paidInstallments`, `nextInstallmentNumber` e `totalLimit`.

Casos de borda a cobrir:
- `installmentCount = 1` (conta de smoke test, ver `resolveCheckoutPricing`) → libera o total já na 1ª.
- `paidInstallments = 0` com `billingStatus` diferente de `active` → o tier já cai para `trial` em `resolveAccountTierFromBilling`; não inventar faixa zero para plano pago.
- `paidInstallments` maior que `installmentCount` (dado inconsistente) → tratar como total.

### Etapa 4 — Persistência (`src/lib/plan-usage-storage.ts`, novo)

Espelhar o padrão de [guest-usage-storage.ts](../src/lib/guest-usage-storage.ts):

- Nova coleção `planVideoUsage` em [collections.ts](../src/lib/firebase/collections.ts), doc id = `ownerUserId`, campos `videosByBucket: { digital: number; caricature: number }` e `updatedAt`.
- Não reaproveitar `guestCredits`: o nome já significa outra coisa e misturar as duas cotas dificulta suporte e auditoria.
- `tryConsumePlanVideoQuota(ownerUserId, bucket, limits)` em transação, recusando quando o uso atinge o teto da faixa.
- `releasePlanVideoQuota(ownerUserId, bucket)` para devolver quando a geração falha.
- Ler `paidInstallments` / `installmentCount` **antes** da transação e passar os tetos como parâmetro — evita ler duas coleções dentro dela.

### Etapa 5 — Trava nas rotas de geração

**As duas rotas precisam da trava**, senão dá para furar por uma delas.

- [api/heygen/videos/route.ts](../src/app/api/heygen/videos/route.ts): dentro do bloco `premium` (hoje o `if (!premium)` cuida só do convidado), consumir a cota antes de chamar a HeyGen, e registrar o release no mesmo mecanismo já existente (`guestQuota.release` no `catch`/`finally`, linhas 845-851) para devolver a unidade em erro.
- [api/jobs/video/route.ts](../src/app/api/jobs/video/route.ts): mesma lógica, junto do bloco de cota de convidado que já existe (linhas 50-75).

Resposta de bloqueio — HTTP **429** com payload estruturado, para a tela montar a mensagem sem interpretar string:

```json
{
  "code": "plan_video_quota",
  "message": "…",
  "quota": {
    "planId": "essencial",
    "bucket": "digital",
    "used": 3, "limit": 3, "totalLimit": 8,
    "paidInstallments": 1, "installmentCount": 3,
    "nextInstallmentNumber": 2, "nextDueDate": "2026-09-12"
  }
}
```

Registrar `appLog("heygen", "video_generate_rejected", { reason: "plan_video_quota", ... })`, no mesmo formato dos rejeitos que já existem.

### Etapa 6 — Cota visível no app

- Estender [api/sentinel/credits/route.ts](../src/app/api/sentinel/credits/route.ts) com um campo `planVideoQuota` (hoje ela devolve `credits` e `videoUsage`, ambos `null` para conta paga). É o endpoint que o gate do front já consome — evita um segundo fetch.
- Refletir o campo em [use-guest-credits-gate.tsx](../src/components/product/use-guest-credits-gate.tsx).
- Em [criativo-page-v2.tsx:399](../src/components/product/criativo-page-v2.tsx), acrescentar um ramo no gate já existente (que retorna `{ reason, href, linkLabel }`) para a cota esgotada do plano, com `href` para `/acesso-antecipado/pagamento` e `linkLabel` "Quitar parcelas e liberar o plano".
- Mostrar o contador de restantes na tela de produção — no Essencial, os dois separados (Gêmeo Digital e Caricatura/3D).

### Etapa 7 — Quitação das parcelas restantes

Hoje a tela de pagamentos mostra o boleto/PIX apenas da **próxima** parcela em aberto, então não há como quitar o pacote pela interface.

- `buildBillingInstallmentViews` ([asaas-payment-sync.ts:345](../src/lib/billing/asaas-payment-sync.ts)) já recebe o pagamento correspondente a cada parcela — incluir `invoiceUrl` e `bankSlipUrl` na visão retornada. Os dois campos já existem em `AsaasPayment` ([client.ts:64-65](../src/lib/asaas/client.ts)), não precisa de chamada nova à Asaas.
- Propagar em [api/billing/status/route.ts](../src/app/api/billing/status/route.ts).
- Em [pagamento-page.tsx](../src/components/product/acesso-antecipado/pagamento-page.tsx), na lista de parcelas (por volta da linha 185), transformar cada parcela em aberto em link de pagamento.

**Não fazer:** cancelar cobranças, recriar o parcelamento como cobrança única, aplicar desconto de antecipação ou mexer no agendamento de NFS-e. Quitar aqui significa pagar as cobranças que já existem, cada uma gerando sua nota como hoje.

### Etapa 8 — Documentação e testes

- Este documento vira a especificação viva da regra — atualizar ao fim da execução (tirar o "aguardando execução" e ajustar o que mudar no caminho).
- [docs/status-desenvolvimento.md:61](status-desenvolvimento.md) fala em "Rate limit vídeos (ex.: 5/dia) — no free trial" e precisa registrar a cota de plano pago.
- Testes: `plan-video-quota.test.ts` (fórmula, arredondamento, acúmulo de cota não usada, `installmentCount = 1`), atualização de `account-tier.test.ts` e cobertura do bloqueio nas duas rotas.

---

## 5. Checklist de aceite

**Textos**
- [ ] `/planos` (site) mostra 20 / 66 / 180 "no período eleitoral", inclusive na tabela comparativa
- [ ] Tela de planos do app mostra os mesmos números
- [ ] `public/vozdelas/index.html` atualizado
- [ ] Dicas do modo de teste atualizadas
- [ ] Nenhuma ocorrência restante de "avatares/mês" no repositório

**Regra**
- [ ] Essencial com 1 parcela paga: 3 Gêmeos Digitais e 4 caricaturas; o 4º digital é recusado mesmo com caricatura sobrando
- [ ] Essencial com 2 parcelas: teto vai a 6 e 8; o que não foi usado na 1ª faixa continua disponível
- [ ] Essencial com 3 parcelas: 8 e 12
- [ ] Avançado: 22 / 44 / 66 — Elite: 60 / 120 / 180
- [ ] Pagando as 3 cobranças de uma vez, o teto total libera imediatamente
- [ ] Parcela vencida e não paga **não** libera faixa nova

**Trava**
- [ ] Bloqueio acontece nas duas rotas de geração
- [ ] Falha na geração devolve a unidade consumida
- [ ] Convidado continua na cota antiga, sem regressão
- [ ] Resposta 429 traz o payload estruturado

**Tela**
- [ ] Contador de restantes visível (dois contadores no Essencial)
- [ ] Mensagem de bloqueio explica a proporcionalidade e informa o vencimento da próxima parcela
- [ ] Botão de quitar leva a Meus Pagamentos
- [ ] Parcelas em aberto têm link de pagamento próprio
- [ ] Nenhuma cobrança nova é criada no fluxo de quitação

---

## 6. Riscos e pontos de atenção

| Risco | Cuidado |
|---|---|
| **Cobrança e nota fiscal** | Nada nesta entrega deve criar, cancelar ou substituir cobrança na Asaas. O agendamento de NFS-e (`ensureNfsScheduledForPaidPayments`) continua reagindo a pagamento confirmado, como hoje. Vale um smoke de pagamento na conta interna antes de promover. |
| **Bloquear quem paga em dia** | Um erro de leitura de `paidInstallments` trava produção de cliente adimplente. Em falha ao ler a cobrança, preferir **liberar** e registrar log — é o comportamento já adotado no gate de créditos ("em falha de rede, mantém liberado"). |
| **Inadimplência já bloqueia tudo** | `past_due` e `pending_payment` derrubam o tier para trial e travam a plataforma inteira ([payment-access.ts](../src/lib/billing/payment-access.ts)). A mensagem de cota não pode competir com essa trava — quando as duas valerem, a de pagamento vem primeiro. |
| **Consumo duplicado** | O consumo tem que ser transacional e acontecer uma única vez por vídeo, mesmo com retentativa e mesmo no caminho assíncrono de voz (`enqueueVoiceCreateVideoJob`). |
| **Contagem retroativa** | Todo mundo começa em zero. Se algum cliente já produziu bastante, ele ganha a cota inteira de novo — decisão consciente. |
| **Deploy** | Push em `main` dispara deploy de produção pelo pipe do App Hosting. |

---

## 7. Pendências

1. **`teste-gratis`** — não existe no repositório. Confirmar se é landing externa (e então atualizar fora daqui) ou página ainda não criada.
2. **Fim do período eleitoral** — a cota não reseta, mas também não expira em data nenhuma. Se o pacote tiver que fechar em uma data (ex.: dia da eleição), isso é regra adicional, ainda não especificada.
3. **Caricatura/3D avulsa** — geração de imagem de caricatura sem vídeo não consome cota nesta versão. Se isso virar custo relevante, entra depois.
