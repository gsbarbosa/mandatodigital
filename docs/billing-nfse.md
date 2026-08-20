# Billing e NFS-e (Asaas) — arquitetura

Documento técnico de referência para a cobrança do pacote campanha e a emissão automática de NFS-e. Complementa [`status-desenvolvimento.md`](status-desenvolvimento.md) (seção 7c) e [`painel-gestao.md`](painel-gestao.md) (aba financeira do admin).

**Provedor:** [Asaas](https://www.asaas.com) — PIX + boleto + NFS-e municipal.
**Cliente HTTP:** [`src/lib/asaas/client.ts`](../src/lib/asaas/client.ts).

---

## 1. Modelo de cobrança

Não é assinatura recorrente — é um **pacote único de campanha, dividido em 3 parcelas mensais** (boleto ou PIX), por plano:

| Plano | Parcela | Total (3x) |
|---|---|---|
| Essencial | R$ 998 | R$ 2.994 |
| Avançado | R$ 1.998 | R$ 5.994 |
| Elite | R$ 4.998 | R$ 14.994 |

Fonte de verdade: [`src/lib/billing/plan-pricing.ts`](../src/lib/billing/plan-pricing.ts) (`PLAN_PRICING`).

Vencimentos: 1ª parcela na data escolhida no checkout, 2ª e 3ª em `+1` e `+2` meses civis (`buildInstallmentSchedule`/`addCalendarMonths` — respeita meses curtos, não pula pro mês seguinte em dias 29-31).

**Smoke test:** e-mails em `BILLING_SMOKE_TEST_EMAILS` (hoje só `gsbarbosa180@gmail.com`) recebem cobrança de **1x R$ 5,00** em vez do pacote real — usado pra testar o fluxo ponta a ponta (pagamento + NFS-e) sem cobrar valor de produção. Resolvido em `resolveCheckoutPricing()`.

---

## 2. Fluxo

```text
[Candidato] escolhe plano + método (pix|boleto) na modal de checkout
  ▼
Modal de adesão (checkout-contract-modal):
  1. Digita CNPJ → GET /api/legal/cnpj-lookup (Brasil API; rate limit compartilhado)
  2. Nome/endereço travados se a Receita trouxe dado; senão inputs com fallback do cadastro
  3. Responsável financeiro sempre editável
  4. "Ver contrato completo" → POST /api/legal/contract-preview (texto nominal Contrato + Dossiê)
  5. Checkbox clickwrap + "Aceitar e pagar"
  ▼
POST /api/billing/checkout
  1. Exige cadastro completo (isUserRegistrationComplete)
  2. Se ainda não houver aceite para o plano: deriveContractFields + processContractAcceptance
     (trava no servidor — cliente não sobrescreve razão social/endereço da Receita;
      financialResponsible e fallbacks só quando a consulta não trouxe dado)
  3. Bloqueia se já existe pacote ativo/pendente (hasOpenBillingPackage) — exceto smoke
  4. resolveAsaasBillingCustomer → asaasEnsureCustomer (cria/atualiza customer no Asaas)
     (endereço: Receita e/ou campaignAddress do contrato aceito, depois cadastro)
  5. asaasCreatePayment (parcela 1) + agenda parcelas 2 e 3
  6. PIX → asaasGetPixQrCode | Boleto → link + linha digitável
  7. Grava no cadastro: asaasCustomerId, asaasInstallmentId, asaasPrimaryPaymentId,
     billingFirstDueDate, billingMethod, billingStatus="pending_payment"
  ▼
[Asaas] cobra o candidato (fora do app)
  ▼
POST /api/billing/webhooks/asaas   (evento PAYMENT_CONFIRMED/RECEIVED/OVERDUE/...)
  1. Valida header de auth contra ASAAS_WEBHOOK_TOKEN (timing-safe compare)
  2. Idempotência: registra o evento em billingWebhookEvents (doc id = event id) — reprocessa sem duplicar
  3. applySinglePaidPayment / applyOverdueBillingStatus → atualiza billingStatus, paidInstallments,
     lastPaidPaymentId, lastPaidAt
  4. Se pago: ensureNfsScheduledForPaidPayments → asaasScheduleInvoice (NFS-e), se ASAAS_NFS_ENABLED
  5. Se NFS-e autorizada: sendNfsAuthorizedEmail (Resend)
  ▼
[Candidato] acompanha em "Meus pagamentos" (GET /api/billing/status)
```

---

## 3. Estados (`billingStatus`)

Definido em [`plan-pricing.ts`](../src/lib/billing/plan-pricing.ts) (`BillingStatus`):

| Status | Significado |
|---|---|
| `trial` | Default — sem pacote contratado (free trial / convidado) |
| `pending_payment` | Checkout criado, aguardando 1ª confirmação de pagamento |
| `active` | Ao menos uma parcela paga, dentro do prazo |
| `past_due` | Parcela vencida sem pagamento (`OVERDUE` no Asaas) |
| `canceled` | Pacote cancelado |

**Gate de acesso** ([`payment-access.ts`](../src/lib/billing/payment-access.ts)): `pending_payment`/`past_due` bloqueiam a plataforma inteira, exceto **Meus pagamentos**. Alerta "vence em breve" quando a próxima parcela em aberto está a ≤5 dias (`DUE_SOON_ALERT_DAYS`).

---

## 4. NFS-e automática

Off por padrão — liga com `ASAAS_NFS_ENABLED=true` **e** `ASAAS_NFS_MUNICIPAL_SERVICE_CODE`/`_ID` + `ASAAS_NFS_ISS` configurados (`isAsaasNfsEnabled()`/`buildAsaasNfsInvoiceSettings()` em [`nfs-config.ts`](../src/lib/billing/nfs-config.ts) — sem config completa, a função retorna `null` e nada é agendado, mesmo com a flag ligada).

Cada parcela paga agenda uma NFS-e individual via `asaasScheduleInvoice` (`effectiveDatePeriod: ON_PAYMENT_CONFIRMATION`, `receivedOnly: true`). Idempotência dupla:
- `scheduledNfsPaymentIds` no cadastro do usuário (não re-agenda a mesma parcela).
- Erro 409/"already"/"duplic" do Asaas é tratado como sucesso silencioso (`isDuplicateInvoiceError`).

Hoje em produção: código municipal `010501` ("Licenciamento ou cessão de direito de uso de programas de computação"), ISS `2.5%`, sem retenção (`ASAAS_NFS_RETAIN_ISS=false`).

---

## 5. Campos no cadastro (`userRegistrations`)

Ver [`user-registration-types.ts`](../src/lib/user-registration-types.ts). Os relevantes a billing/NFS-e:

`billingStatus`, `billingMethod`, `asaasCustomerId`, `asaasInstallmentId` (preferir a assinatura legada `asaasSubscriptionId`), `asaasPrimaryPaymentId`, `billingFirstDueDate`, `paidInstallments`, `lastPaidPaymentId`, `lastPaidAt`, `lastNfsPdfUrl`/`lastNfsXmlUrl`/`lastNfsNumber`/`lastNfsStatus`, `lastNfsEmailSentFor`, `scheduledNfsPaymentIds`.

---

## 6. Segurança

- Webhook exige `ASAAS_WEBHOOK_TOKEN` no header (comparação timing-safe); só faz fail-open (aceita sem token) fora de `NODE_ENV=production`.
- `billingWebhookEvents` (Firestore, doc id = event id do Asaas) evita processar o mesmo evento duas vezes — reentrega do Asaas não duplica parcela paga nem NFS-e.
- `ASAAS_API_KEY`/`ASAAS_WEBHOOK_TOKEN` são secrets de produção — ver o agente `.claude/agents/integracoes.md` pra consulta/rotação.

---

## 7. Arquivos principais

```text
src/lib/asaas/client.ts                    # cliente HTTP Asaas (customer/payment/invoice)
src/lib/billing/plan-pricing.ts            # preços, datas, smoke test
src/lib/billing/billing-package.ts         # hasOpenBillingPackage / parcelas restantes
src/lib/billing/payment-access.ts          # gate de acesso por inadimplência
src/lib/billing/asaas-payment-sync.ts      # aplica webhook → billingStatus/paidInstallments
src/lib/billing/nfs-config.ts              # payload de invoiceSettings / scheduleInvoice
src/lib/billing/ensure-nfs.ts              # agenda NFS-e por parcela paga (idempotente)
src/lib/billing/resolve-asaas-customer.ts  # resolve/cria customer Asaas a partir do cadastro
src/app/api/billing/checkout/route.ts      # cria cobrança (PIX/boleto)
src/app/api/billing/status/route.ts        # "Meus pagamentos"
src/app/api/billing/webhooks/asaas/route.ts
```

Testes: `src/lib/billing/*.test.ts`.
