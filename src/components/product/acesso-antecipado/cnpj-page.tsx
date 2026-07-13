"use client";

import { useState } from "react";

import { useEarlyAccess } from "@/lib/early-access";

const DEADLINE_ISO = "2026-08-16T12:00:00-03:00";

function daysUntilDeadline(): number {
  const deadline = new Date(DEADLINE_ISO).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
}

function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function AcessoCnpjPage() {
  const [earlyAccess, updateEarlyAccess] = useEarlyAccess();
  const [cnpjInput, setCnpjInput] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const signed = Boolean(earlyAccess.cnpj);
  const remainingDays = daysUntilDeadline();
  const reservation = earlyAccess.reservation;

  async function handleSign() {
    setError(null);
    setEmailNote(null);
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14) {
      setError("CNPJ inválido — informe os 14 dígitos.");
      return;
    }
    if (!accepted) {
      setError("Marque o aceite do Contrato de Prestação de Serviços Eleitorais.");
      return;
    }
    if (!reservation) {
      setError("Complete a reserva de dados antes de assinar o contrato.");
      return;
    }
    if (!reservation.address?.trim()) {
      setError("Endereço da campanha ausente. Volte em Dados e preencha o endereço.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/contract/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: digits,
          accepted: true,
          campaignName: reservation.fullName,
          campaignAddress: reservation.address,
          financialResponsible: reservation.fullName,
          email: reservation.email,
          planId: reservation.planId,
          party: reservation.party,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        cnpj?: string;
        acceptedAt?: string;
        emailSent?: boolean;
        emailSkipReason?: string;
        contractPdfUrl?: string;
        dossierPdfUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível registrar o aceite.");
      }

      updateEarlyAccess({
        cnpj: payload.cnpj || formatCnpj(digits),
        cnpjSignedAt: payload.acceptedAt || new Date().toISOString(),
      });

      if (!payload.emailSent && payload.emailSkipReason) {
        setEmailNote(
          `Aceite registrado. E-mail não enviado: ${payload.emailSkipReason}`,
        );
      } else if (payload.emailSent) {
        setEmailNote("Contrato e Dossiê enviados por e-mail.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao assinar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full relative pb-24 bg-gradient-to-b from-[#0B0F19] via-[#0d1526] to-[#0B0F19]">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[70%] h-[40%] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-widest rounded-full px-4 py-1.5">
            Reserva VIP Ativa
          </span>
          <p className="text-xs text-slate-400 mt-2">
            Última etapa: assine o contrato e libere acesso antecipado ao painel.
          </p>
        </div>

        {!signed ? (
          <div className="bg-gradient-to-r from-blue-900/40 to-emerald-900/30 border border-blue-500/30 rounded-2xl py-5 px-6 md:px-8 text-center mb-6">
            <p className="text-white font-bold text-base md:text-lg">
              Faltam{" "}
              <span className="bg-slate-900/80 text-cyan-300 rounded-md px-2 py-0.5">
                {remainingDays} dias
              </span>{" "}
              para garantir sua assinatura
            </p>
            <p className="text-sm text-blue-200/80 mt-2 leading-relaxed max-w-3xl mx-auto">
              Em função dos prazos das convenções partidárias, você pode enviar seu CNPJ de campanha
              até o dia <strong>16 de Agosto às 12:00hrs</strong>. Após esse período, a sua vaga
              bloqueada será repassada ao próximo candidato na fila de espera.
            </p>
          </div>
        ) : null}

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 lg:p-10 shadow-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-white mb-2">
              Contrato de Adesão Antecipada
            </h1>
          </div>

          {signed ? (
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-6">
                Aceite registrado com trilha de auditoria (IP, timestamp de servidor, User-Agent e
                hash do contrato). Sua vaga está garantida.
              </p>
              <div className="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-6 py-4 mb-4">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <p className="text-white font-mono font-bold">{earlyAccess.cnpj}</p>
                  <p className="text-[11px] text-emerald-400">
                    Assinado em{" "}
                    {earlyAccess.cnpjSignedAt
                      ? new Date(earlyAccess.cnpjSignedAt).toLocaleString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </div>
              {emailNote ? (
                <p className="text-xs text-slate-400 mt-2" role="status">
                  {emailNote}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm md:text-base text-slate-400 mb-5 leading-relaxed">
                Se você já possui o CNPJ de campanha registrado no TSE, insira abaixo para assinar o
                Contrato de Prestação de Serviços Eleitorais e desbloquear a plataforma
                provisoriamente. O CNPJ será validado quanto à natureza jurídica (Comitê Financeiro
                ou Candidato a Cargo Político Eletivo).
              </p>

              <div className="text-left w-full">
                <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                  CNPJ da Campanha
                </label>
                <input
                  value={cnpjInput}
                  onChange={(event) => setCnpjInput(formatCnpj(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  className="w-full bg-[#0E1321] border border-slate-700 text-slate-200 text-center font-mono text-lg rounded-xl p-3.5 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                />

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 mt-3 text-xs md:text-sm text-slate-400 leading-relaxed text-left">
                  <strong className="text-slate-300">Atenção ao Calendário:</strong> Para facilitar
                  sua prestação de contas no SPCE/TSE, os boletos no seu CNPJ serão emitidos somente
                  a partir de <strong>16/Agosto</strong>. O pagamento é mensal e o desconto VIP de
                  50% é válido exclusivamente durante os meses de eleição para quem realizou esta
                  reserva.
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-600"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  <span>
                    Li e aceito o Contrato de Prestação de Serviços Eleitorais e o Dossiê de
                    Transparência (Res. TSE 23.732).
                  </span>
                </label>

                {error ? (
                  <p className="text-sm text-red-400 mt-3" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSign()}
                  className="mt-3 w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {submitting ? "Validando e gerando documentos…" : "Assinar contrato"}
                </button>

                <p className="text-[10px] text-slate-600 text-center mt-3">
                  O aceite registra IP, timestamp de servidor, User-Agent e hash SHA-256 da versão
                  do contrato. Contrato e Dossiê em PDF são gerados automaticamente.
                </p>
              </div>
            </>
          )}

          <p className="mt-5 text-[10px] text-slate-600 text-center">
            Fase de acesso antecipado: o resumo local fica neste dispositivo; a trilha jurídica
            completa é gravada no servidor.
          </p>
        </div>
      </div>
    </div>
  );
}
