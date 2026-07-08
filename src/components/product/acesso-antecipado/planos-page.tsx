"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment } from "react";

import {
  earlyAccessPlans,
  useEarlyAccess,
  type EarlyAccessPlanId,
} from "@/lib/early-access";

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
  const [earlyAccess] = useEarlyAccess();
  const selectedPlanId = earlyAccess.reservation?.planId ?? null;

  function handleReserveIntent(planId: EarlyAccessPlanId) {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("mandato-early-access-plan-intent", planId);
    }
    router.push("/acesso-antecipado/dados" as Route);
  }

  return (
    <div className="min-h-full relative pb-24">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-12">
        <header className="text-center mb-12">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-3">
            Planos e Preços
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
            Monitoramento em tempo real, avatares personalizados com voz do candidato, e compliance
            total com TSE. Tudo integrado em uma plataforma.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-12">
          {earlyAccessPlans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const isRecommendedSlot = !selectedPlanId && plan.id === "avancado";
            const highlighted = isSelected || isRecommendedSlot;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 flex flex-col border ${
                  highlighted
                    ? "border-cyan-500/60 bg-slate-900/60 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                {isSelected ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full px-4 py-1">
                    Selecionado
                  </span>
                ) : isRecommendedSlot ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-widest rounded-full px-4 py-1">
                    Recomendado
                  </span>
                ) : null}

                <h2
                  className={`text-lg font-bold mb-3 ${
                    plan.accent === "purple" ? "text-purple-400" : plan.accent === "cyan" ? "text-cyan-400" : "text-white"
                  }`}
                >
                  {plan.name}
                </h2>
                <p className="text-xs text-slate-500 mb-1">
                  <span className="line-through">{plan.originalPriceLabel}</span>{" "}
                  <span className="text-emerald-400 font-bold">50% OFF</span>
                </p>
                <p className="text-3xl font-extrabold text-white mb-6">
                  {plan.priceLabel}
                  <span className="text-sm font-normal text-slate-500"> / mês</span>
                </p>

                <ul className="space-y-3 text-sm text-slate-300 flex-grow mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <p
                  className={`text-[11px] rounded-lg border px-3 py-2 mb-4 text-center ${
                    plan.id === "essencial"
                      ? "border-slate-700 text-slate-400 bg-slate-800/40"
                      : "border-red-800/50 text-red-400 bg-red-950/20"
                  }`}
                >
                  {plan.restriction}
                </p>

                {selectedPlanId ? (
                  <button
                    type="button"
                    disabled
                    className={`w-full py-3 rounded-xl text-sm font-semibold ${
                      isSelected
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default"
                        : "bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {isSelected ? "Plano da sua reserva" : "Troca de plano indisponível"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleReserveIntent(plan.id)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                      plan.id === "avancado"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        : "bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {plan.id === "essencial" ? "Reservar Desconto" : "Reservar Vaga VIP"}
                  </button>
                )}
                <p className="text-[10px] text-slate-600 text-center mt-3">
                  Reserva gratuita. No dia 16/julho o convite será enviado para conhecerem a
                  plataforma.
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
            <span className="text-emerald-400 text-sm font-bold tracking-widest uppercase flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              100% Compliance TSE
            </span>
            <span className="text-xs text-slate-500">Acessar Dossiê Jurídico Contábil</span>
          </Link>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-10 mb-16">
          <p className="text-[11px] font-bold tracking-wider text-amber-500 uppercase mb-3 flex items-center gap-2">
            ⚠ Alerta de Restrição
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
            Limitado a <span className="text-red-400">06 vagas</span> por Partido em cada Estado.
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-8">
            O Mandato Digital.IA é uma infraestrutura de alta performance com atuação estritamente
            apartidária e imparcial. Para garantir a equidade na disputa, proteger o equilíbrio
            democrático e evitar monopólio de legendas com maior poder econômico, estabelecemos uma
            trava de acessos em dois lotes:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-cyan-800/50 bg-cyan-950/10 rounded-2xl p-5 relative">
              <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2 py-0.5">
                Disponível agora
              </span>
              <p className="text-white font-bold mb-2">1 · Cota Antecipada</p>
              <p className="text-sm text-slate-400">
                <strong className="text-slate-200">03 vagas</strong> liberadas estritamente por
                ordem de chegada na Lista VIP de reserva.
              </p>
              <p className="text-[10px] text-slate-500 mt-3">
                * Preenchidas as 3 assinaturas, o sistema bloqueará novos CPFs/CNPJs da mesma
                legenda via integração com base do TSE em tempo real.
              </p>
            </div>
            <div className="border border-slate-700 bg-slate-900/40 rounded-2xl p-5 relative">
              <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                A partir de 16/Jul
              </span>
              <p className="text-white font-bold mb-2">2 · Cota Partidária</p>
              <p className="text-sm text-slate-400">
                <strong className="text-slate-200">03 vagas institucionais</strong> liberadas
                estritamente por indicação oficial da legenda (Diretórios).
              </p>
              <p className="text-[10px] text-slate-500 mt-3">
                * A divulgação oficial com os convites para os Diretórios ocorrerá no dia 16/julho —
                data do lançamento oficial.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-2">
            Comparativo Detalhado de Entrega
          </h2>
          <p className="text-sm text-slate-500 text-center mb-8">
            Verifique a capacidade técnica de processamento e os limites de inteligência de cada
            pacote.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-900/80 text-left">
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Serviço / Funcionalidade
                  </th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-200 text-center">Essencial</th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-cyan-400 text-center">Avançado</th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-purple-400 text-center">Elite</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <Fragment key={row.label}>
                    {row.section ? (
                      <tr className="bg-slate-900/60">
                        <td colSpan={4} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-cyan-500">
                          {row.section}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-t border-slate-800/60">
                      <td className="p-4 text-slate-300">{row.label}</td>
                      {row.values.map((value, index) => (
                        <td
                          key={index}
                          className={`p-4 text-center ${
                            value === "✓"
                              ? "text-emerald-400"
                              : value === "✕"
                                ? "text-slate-600"
                                : "text-slate-200 text-xs"
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

        <p className="text-[10px] text-slate-600 text-center">
          A assinatura é mensal e tem vigência no período eleitoral (Julho a Outubro de 2026). É
          possível cancelar a qualquer momento sem fidelidade.
        </p>
      </div>
    </div>
  );
}
