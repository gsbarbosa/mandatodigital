"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import { APP_HOME_PATH } from "@/lib/app-home";
import {
  earlyAccessPlans,
  useEarlyAccess,
  writePlanIntent,
  type EarlyAccessPlanId,
  type EarlyAccessReservation,
} from "@/lib/early-access";
import { BILLING_PAYMENT_PATH, REGISTRATION_REQUIRED_PATH } from "@/lib/registration-gate";

const COMPARISON_ROWS: Array<{
  section?: string;
  label: string;
  values: [string, string, string];
}> = [
  { section: "Monitoramento", label: "Sites, Portais e Blogs", values: ["✓", "✓", "✓"] },
  { label: "Perfis em Redes Sociais", values: ["✓", "✓", "✓"] },
  { label: "Perfis de adversários", values: ["✓", "✓", "✓"] },
  { label: "Monitoramento de temas de campanha com expansão semântica", values: ["✓", "✓", "✓"] },
  { label: "Acesso ao painel de monitoramento com ranking de notícias", values: ["✓", "✓", "✓"] },
  { section: "Personalização", label: "Replicação da voz do candidato", values: ["✓", "✓", "✓"] },
  { label: "Gêmeo Digital com voz do candidato", values: ["2", "22 com Renderização Avançada", "60 com Renderização Avançada"] },
  { label: "Avatar Caricato com voz do candidato", values: ["3", "22", "60"] },
  { label: "Avatar 3D com voz do candidato", values: ["✕", "22", "60"] },
  { label: "Inclusão de posicionamento ideológico", values: ["✓", "✓", "✓"] },
  { label: "Inclusão de arquétipo político", values: ["✓", "✓", "✓"] },
  { label: "Inclusão de tom de linguagem", values: ["✓", "✓", "✓"] },
  { label: "Inclusão de glossário de expressões pessoais", values: ["✓", "✓", "✓"] },
  { section: "Produção", label: "Roteiro viral com posicionamento do candidato em temas selecionados", values: ["20", "220", "600"] },
];

export function AcessoPlanosPage() {
  const router = useRouter();
  const [earlyAccess, updateEarlyAccess] = useEarlyAccess();
  const [needsPlan, setNeedsPlan] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<EarlyAccessPlanId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [hasRemainingInstallments, setHasRemainingInstallments] = useState(false);
  const [registeredPlanId, setRegisteredPlanId] = useState<EarlyAccessPlanId | null>(null);
  const [smokeTestAvailable, setSmokeTestAvailable] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<{
    planId: EarlyAccessPlanId;
    method: "pix" | "boleto";
  } | null>(null);
  const selectedPlanId = earlyAccess.reservation?.planId ?? registeredPlanId;

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [regRes, billRes] = await Promise.all([
          fetch("/api/user/registration", { credentials: "same-origin" }),
          fetch("/api/billing/status", { credentials: "same-origin" }),
        ]);
        if (regRes.ok) {
          const payload = (await regRes.json()) as {
            needsPlanSelection?: boolean;
            reservation?: EarlyAccessReservation | null;
            registration?: { planId?: EarlyAccessPlanId | "" };
          };
          if (!cancelled) {
            setNeedsPlan(Boolean(payload.needsPlanSelection));
            if (payload.reservation) {
              updateEarlyAccess({ reservation: payload.reservation });
            }
            const planFromReg = payload.reservation?.planId || payload.registration?.planId;
            if (planFromReg === "essencial" || planFromReg === "avancado" || planFromReg === "elite") {
              setRegisteredPlanId(planFromReg);
            }
          }
        }
        if (billRes.ok) {
          const bill = (await billRes.json()) as {
            billingStatus?: string;
            planId?: EarlyAccessPlanId | null;
            smokeTestAvailable?: boolean;
            hasRemainingInstallments?: boolean;
          };
          if (!cancelled) {
            setBillingStatus(bill.billingStatus ?? null);
            setHasRemainingInstallments(Boolean(bill.hasRemainingInstallments));
            setSmokeTestAvailable(Boolean(bill.smokeTestAvailable));
            if (
              bill.planId === "essencial" ||
              bill.planId === "avancado" ||
              bill.planId === "elite"
            ) {
              setRegisteredPlanId(bill.planId);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [updateEarlyAccess]);

  function handleReserveIntent(planId: EarlyAccessPlanId) {
    writePlanIntent(planId);
    router.push(`${REGISTRATION_REQUIRED_PATH}?plan=${planId}` as Route);
  }

  async function handleCheckout(planId: EarlyAccessPlanId, method: "pix" | "boleto" = "pix") {
    setErrorMessage(null);
    setCheckoutPlanId(planId);
    try {
      // Garante plano no cadastro se ainda estiver escolhendo.
      if (needsPlan && !selectedPlanId) {
        const regResponse = await fetch("/api/user/registration", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        });
        const regPayload = (await regResponse.json().catch(() => null)) as {
          message?: string;
          reservation?: EarlyAccessReservation | null;
          seatStatus?: "active" | "reserve";
        } | null;
        if (!regResponse.ok || !regPayload?.reservation) {
          throw new Error(regPayload?.message || "Nao foi possivel confirmar o plano.");
        }
        updateEarlyAccess({
          reservation: {
            ...regPayload.reservation,
            seatStatus: regPayload.reservation.seatStatus ?? regPayload.seatStatus ?? "active",
          },
        });
        writePlanIntent(planId);
      }

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, method }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (response.status === 409) {
        router.push(BILLING_PAYMENT_PATH as Route);
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.message || "Nao foi possivel gerar a cobranca.");
      }

      router.push(BILLING_PAYMENT_PATH as Route);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel gerar a cobranca.",
      );
    } finally {
      setCheckoutPlanId(null);
    }
  }

  const choosingPlan = needsPlan && !selectedPlanId;

  return (
    <div className="min-h-full relative pb-24">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-12">
        <header className="mb-12 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-md-text md:text-3xl">
            {choosingPlan ? "Escolha seu plano" : "Planos e Preços"}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-md-text-soft">
            {choosingPlan ? (
              <>
                Seus dados já estão salvos. Compare o que cada plano inclui e confirme para
                liberar o acesso - <strong>sem cobrança ou compromisso</strong> no período de
                testes
              </>
            ) : (
              "Monitoramento em tempo real, avatares personalizados com voz do candidato, e compliance total com TSE. Tudo integrado em uma plataforma."
            )}
          </p>
          {choosingPlan ? (
            <p className="mt-4 text-xs text-[var(--curador-text)]">
              Cadastro quase pronto — falta só o plano.
            </p>
          ) : null}
        </header>

        {errorMessage ? (
          <p className="mb-6 text-center text-sm text-red-400" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-12">
          {earlyAccessPlans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const isRecommendedSlot = !selectedPlanId && plan.id === "avancado";
            const highlighted = isSelected || isRecommendedSlot;
            const isSaving = checkoutPlanId === plan.id;
            const billingActive = billingStatus === "active" && !hasRemainingInstallments;
            const billingPending =
              billingStatus === "pending_payment" ||
              billingStatus === "past_due" ||
              (billingStatus === "active" && hasRemainingInstallments);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 flex flex-col border ${
                  highlighted
                    ? "border-cyan-500/60 bg-md-surface/60 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                    : "border-md-border bg-md-surface/40"
                }`}
              >
                {isSelected ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-md-text text-[10px] font-bold uppercase tracking-widest rounded-full px-4 py-1">
                    Selecionado
                  </span>
                ) : isRecommendedSlot ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-md-slate-800 border border-cyan-500/40 text-[var(--curador-text)] text-[10px] font-bold uppercase tracking-widest rounded-full px-4 py-1">
                    Recomendado
                  </span>
                ) : null}

                <h2
                  className={`text-lg font-bold mb-3 ${
                    plan.accent === "purple"
                      ? "text-purple-400"
                      : plan.accent === "cyan"
                        ? "text-[var(--curador-text)]"
                        : "text-md-text"
                  }`}
                >
                  {plan.name}
                </h2>
                <p className="text-xs text-md-text-soft mb-1">
                  <span className="line-through">{plan.originalPriceLabel}</span>{" "}
                  <span className="text-[var(--sentinela-text)] font-bold">50% OFF</span>
                </p>
                <p className="text-3xl font-extrabold text-md-text mb-6">
                  {plan.priceLabel}
                  <span className="text-sm font-normal text-md-text-soft"> / mês</span>
                </p>

                <ul className="space-y-3 text-sm text-md-text-muted flex-grow mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="text-[var(--sentinela-text)] shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <p
                  className={`text-[11px] rounded-lg border px-3 py-2 mb-4 text-center ${
                    plan.id === "essencial"
                      ? "border-md-border text-md-text-soft bg-md-overlay-subtle"
                      : "border-red-800/50 text-red-400 bg-red-950/20"
                  }`}
                >
                  {plan.restriction}
                </p>

                {selectedPlanId ? (
                  isSelected ? (
                    <button
                      type="button"
                      disabled={!hydrated || Boolean(checkoutPlanId) || billingActive}
                      onClick={() =>
                        billingPending
                          ? router.push(BILLING_PAYMENT_PATH as Route)
                          : setPendingCheckout({ planId: plan.id, method: "pix" })
                      }
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 bg-gradient-to-r from-cyan-500 to-blue-600 text-md-text"
                    >
                      {billingActive
                        ? "Plano ativo"
                        : billingPending
                          ? billingStatus === "active"
                            ? "Ver parcelas restantes"
                            : "Ver cobrança pendente"
                          : isSaving
                            ? "Gerando PIX..."
                            : smokeTestAvailable
                              ? "Pagar teste via PIX (R$ 5,00)"
                              : "Pagar com PIX (3 parcelas)"}
                    </button>
                  ) : selectedPlanId === "essencial" && !billingActive && !billingPending ? (
                    // Upgrade livre só sai do Essencial (nunca pago) pra um plano mais caro.
                    // Avançado/Elite já escolhidos travam — sem downgrade/troca lateral por aqui.
                    <button
                      type="button"
                      disabled={!hydrated || Boolean(checkoutPlanId)}
                      onClick={() => setPendingCheckout({ planId: plan.id, method: "pix" })}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 border border-cyan-500/50 text-[var(--curador-text)] hover:bg-cyan-500/10"
                    >
                      {isSaving ? "Gerando PIX..." : `Fazer upgrade para ${plan.name}`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-xl text-sm font-semibold bg-md-surface-inset border border-md-border text-md-text-soft cursor-not-allowed"
                    >
                      Troca de plano indisponível
                    </button>
                  )
                ) : choosingPlan ? (
                  <button
                    type="button"
                    disabled={!hydrated || Boolean(checkoutPlanId)}
                    onClick={() => setPendingCheckout({ planId: plan.id, method: "pix" })}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                      plan.id === "avancado"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-md-text shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        : "bg-md-surface-inset border border-md-border text-md-text hover:bg-md-overlay-hover"
                    }`}
                  >
                    {isSaving
                      ? "Gerando PIX..."
                      : smokeTestAvailable
                        ? "Assinar teste via PIX (R$ 5,00)"
                        : "Assinar com PIX"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleReserveIntent(plan.id)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                      plan.id === "avancado"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-md-text shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        : "bg-md-surface-inset border border-md-border text-md-text hover:bg-md-overlay-hover"
                    }`}
                  >
                    {plan.id === "essencial" ? "Reservar Desconto" : "Reservar Vaga VIP"}
                  </button>
                )}
                {!billingActive &&
                !billingPending &&
                (isSelected || selectedPlanId === "essencial") ? (
                  <button
                    type="button"
                    disabled={!hydrated || Boolean(checkoutPlanId)}
                    onClick={() => setPendingCheckout({ planId: plan.id, method: "boleto" })}
                    className="mt-2 w-full text-center text-[11px] font-medium text-md-text-soft hover:text-md-text hover:underline disabled:opacity-60"
                  >
                    Preferir boleto bancário
                  </button>
                ) : null}
                <p className="text-[10px] text-md-text-soft text-center mt-3">
                  Pacote único em 3x (vencimento hoje + 10/Setembro + 20/Setembro). Não é assinatura mensal.
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center mb-12">
          <Link
            href={"/compliance" as Route}
            className="no-underline inline-flex flex-col items-center gap-1 border border-emerald-500/40 rounded-2xl px-10 py-4 hover:bg-emerald-500/5 transition-colors"
          >
            <span className="text-[var(--sentinela-text)] text-sm font-bold tracking-widest uppercase flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              100% Compliance TSE
            </span>
            <span className="text-xs text-md-text-soft">Acessar Dossiê Jurídico Contábil</span>
          </Link>
        </div>

        <div className="bg-md-surface/60 border border-md-border rounded-3xl p-6 md:p-10 mb-16">
          <p className="text-[11px] font-bold tracking-wider text-amber-500 uppercase mb-3 flex items-center gap-2">
            ⚠ Alerta de Restrição
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-md-text mb-4">
            Limitado a <span className="text-red-400">06 vagas</span> por Partido em cada Estado.
          </h2>
          <p className="text-sm text-md-text-soft leading-relaxed mb-8">
            O Mandato Digital.IA é uma infraestrutura de alta performance com atuação estritamente
            apartidária e imparcial. Para garantir a equidade na disputa, proteger o equilíbrio
            democrático e evitar monopólio de legendas com maior poder econômico, estabelecemos uma
            trava de acessos em dois lotes:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-[var(--curador-border)] bg-[var(--curador-soft)] rounded-2xl p-5 relative">
              <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-[var(--curador-text)] bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2 py-0.5">
                Disponível agora
              </span>
              <p className="text-md-text font-bold mb-2">1 · Cota Antecipada</p>
              <p className="text-sm text-md-text-soft">
                <strong className="text-md-text">03 vagas</strong> liberadas estritamente por
                ordem de chegada na Lista VIP de reserva.
              </p>
              <p className="text-[10px] text-md-text-soft mt-3">
                * Preenchidas as 3 assinaturas, o sistema bloqueará novos CPFs/CNPJs da mesma
                legenda via integração com base do TSE em tempo real.
              </p>
            </div>
            <div className="border border-md-border bg-md-surface/40 rounded-2xl p-5 relative">
              <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-md-text-soft bg-md-slate-800 border border-md-border rounded-full px-2 py-0.5">
                A partir de 16/Jul
              </span>
              <p className="text-md-text font-bold mb-2">2 · Cota Partidária</p>
              <p className="text-sm text-md-text-soft">
                <strong className="text-md-text">03 vagas institucionais</strong> liberadas
                estritamente por indicação oficial da legenda (Diretórios).
              </p>
              <p className="text-[10px] text-md-text-soft mt-3">
                * A divulgação oficial com os convites para os Diretórios ocorrerá no dia 16/julho —
                data do lançamento oficial.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-md-text text-center mb-2">
            Comparativo Detalhado de Entrega
          </h2>
          <p className="text-sm text-md-text-soft text-center mb-8">
            Verifique a capacidade técnica de processamento e os limites de inteligência de cada
            pacote.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-md-border">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-md-surface/80 text-left">
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-md-text-soft">
                    Serviço / Funcionalidade
                  </th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-md-text text-center">
                    Essencial
                  </th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-[var(--curador-text)] text-center">
                    Avançado
                  </th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-purple-400 text-center">
                    Elite
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <Fragment key={row.label}>
                    {row.section ? (
                      <tr className="bg-md-surface/60">
                        <td
                          colSpan={4}
                          className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-cyan-500"
                        >
                          {row.section}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-t border-md-border-soft">
                      <td className="p-4 text-md-text-muted">{row.label}</td>
                      {row.values.map((value, index) => (
                        <td
                          key={index}
                          className={`p-4 text-center ${
                            value === "✓"
                              ? "text-[var(--sentinela-text)]"
                              : value === "✕"
                                ? "text-md-text-soft"
                                : "text-md-text text-xs"
                          }`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] text-md-text-soft text-center">
          A assinatura é mensal e tem vigência no período eleitoral (Julho a Outubro de 2026). É
          possível cancelar a qualquer momento sem fidelidade.
        </p>
      </div>

      {pendingCheckout ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-md-app-bg/75 backdrop-blur-[2px] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-confirm-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-md-border bg-md-surface px-6 py-5 shadow-lg">
            <h2 id="checkout-confirm-title" className="text-base font-semibold text-md-text">
              Confirmar plano
            </h2>
            <p className="mt-2 text-sm text-md-text-soft">
              Você selecionou o plano{" "}
              <strong className="text-md-text">
                {earlyAccessPlans.find((item) => item.id === pendingCheckout.planId)?.name}
              </strong>
              . Ao confirmar, vamos gerar a cobrança para você.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingCheckout(null)}
                className="flex-1 rounded-xl border border-md-border px-4 py-2.5 text-sm font-medium text-md-text-soft hover:bg-md-overlay-hover"
              >
                Não confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingCheckout;
                  setPendingCheckout(null);
                  void handleCheckout(target.planId, target.method);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-md-text"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
