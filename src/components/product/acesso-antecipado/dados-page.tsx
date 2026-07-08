"use client";

import { useEffect, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import {
  useEarlyAccess,
  type EarlyAccessPlanId,
  type EarlyAccessReservation,
} from "@/lib/early-access";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/** Partidos registrados no TSE disputando a eleição de 2026. */
const PARTIDOS_2026 = [
  "AGIR", "AVANTE", "CIDADANIA", "DC", "MDB", "MOBILIZA", "NOVO", "PCB", "PCdoB",
  "PCO", "PDT", "PL", "PMB", "PODE", "PP", "PRD", "PRTB", "PSB", "PSD", "PSDB",
  "PSOL", "PSTU", "PT", "PV", "REDE", "REPUBLICANOS", "SOLIDARIEDADE", "UNIÃO BRASIL", "UP",
];

const CARGOS_2026 = [
  "Deputado Federal",
  "Deputado Estadual",
  "Deputado Distrital",
  "Senador",
  "Governador",
  "Presidente",
];

const inputClasses =
  "bg-[#0E1321] border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 w-full outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed";

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5">
      {children} {required ? <span className="text-cyan-400">*</span> : null}
    </label>
  );
}

function maskCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 5) {
    return cpf;
  }
  return `${digits.slice(0, 3)}...-${digits.slice(-2)}`;
}

export function AcessoDadosPage() {
  const { profileForm, sessionUser } = useProductApp();
  const [earlyAccess, updateEarlyAccess] = useEarlyAccess();
  const reservation = earlyAccess.reservation;
  const isReserved = Boolean(reservation);

  const [form, setForm] = useState({
    fullName: "",
    party: "",
    cpf: "",
    uf: "",
    role: "",
    phone: "",
    email: "",
    teamEmail: "",
    teamPhone: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [teamSavedMessage, setTeamSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (reservation) {
      setForm({
        fullName: reservation.fullName,
        party: reservation.party,
        cpf: reservation.cpf,
        uf: reservation.uf,
        role: reservation.role,
        phone: reservation.phone,
        email: reservation.email,
        teamEmail: reservation.teamEmail,
        teamPhone: reservation.teamPhone,
      });
      return;
    }
    setForm((current) => ({
      ...current,
      fullName: current.fullName || profileForm.fullName,
      uf: current.uf || profileForm.state.toUpperCase(),
      role: current.role || profileForm.role,
      email: current.email || sessionUser?.email || "",
    }));
  }, [reservation, profileForm.fullName, profileForm.state, profileForm.role, sessionUser?.email]);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleReserve() {
    setFormError(null);
    if (!form.fullName.trim() || !form.party || !form.cpf.trim() || !form.uf || !form.role || !form.phone.trim() || !form.email.trim()) {
      setFormError("Preencha todos os campos obrigatórios (*) para reservar a vaga.");
      return;
    }
    if (form.cpf.replace(/\D/g, "").length !== 11) {
      setFormError("CPF inválido — informe os 11 dígitos.");
      return;
    }
    const planId: EarlyAccessPlanId =
      (typeof window !== "undefined"
        ? (window.sessionStorage.getItem("mandato-early-access-plan-intent") as EarlyAccessPlanId | null)
        : null) ?? "avancado";
    const newReservation: EarlyAccessReservation = {
      fullName: form.fullName.trim(),
      party: form.party,
      cpf: form.cpf.trim(),
      uf: form.uf,
      role: form.role,
      phone: form.phone.trim(),
      email: form.email.trim(),
      teamEmail: form.teamEmail.trim(),
      teamPhone: form.teamPhone.trim(),
      planId,
      reservedAt: new Date().toISOString(),
    };
    updateEarlyAccess({ reservation: newReservation });
    if (!earlyAccess.reservationPopupSeen) {
      setShowPopup(true);
    }
  }

  function handleSaveTeamContact() {
    if (!reservation) {
      return;
    }
    updateEarlyAccess({
      reservation: {
        ...reservation,
        teamEmail: form.teamEmail.trim(),
        teamPhone: form.teamPhone.trim(),
      },
    });
    setTeamSavedMessage("Contato da equipe atualizado.");
    window.setTimeout(() => setTeamSavedMessage(null), 3200);
  }

  function dismissPopup() {
    setShowPopup(false);
    updateEarlyAccess({ reservationPopupSeen: true });
  }

  return (
    <div className="min-h-full relative pb-24">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-12">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-10 shadow-2xl">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {isReserved ? "Dados Pessoais" : "Garanta sua Vaga"}
            </h1>
            {isReserved ? (
              <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest rounded-full px-4 py-2 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reserva Confirmada
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-400 mb-8">
            {isReserved
              ? "Sua reserva está ativa. Somente o contato da equipe pode ser alterado."
              : (
                <>
                  Preencha os dados abaixo para acautelar sua vaga.{" "}
                  <span className="text-cyan-400">Campos com * são obrigatórios.</span>
                </>
              )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <FieldLabel required>Nome Completo</FieldLabel>
              <input
                className={inputClasses}
                value={form.fullName}
                disabled={isReserved}
                placeholder="Nome do Candidato"
                onChange={(event) => setField("fullName", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>Partido</FieldLabel>
              <select
                className={inputClasses}
                value={form.party}
                disabled={isReserved}
                onChange={(event) => setField("party", event.target.value)}
              >
                <option value="" disabled>
                  Selecione um partido
                </option>
                {PARTIDOS_2026.map((party) => (
                  <option key={party} value={party}>
                    {party}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                * Informação de uso interno. A vaga não sofre alteração caso mude de partido.
              </p>
            </div>

            <div>
              <FieldLabel required>CPF</FieldLabel>
              <input
                className={inputClasses}
                value={form.cpf}
                disabled={isReserved}
                placeholder="000.000.000-00"
                onChange={(event) => setField("cpf", event.target.value)}
              />
              <p className="text-[10px] text-amber-500/80 mt-1">
                Atenção: O CPF deve ser do titular do CNPJ de Campanha.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Estado</FieldLabel>
                <select
                  className={inputClasses}
                  value={form.uf}
                  disabled={isReserved}
                  onChange={(event) => setField("uf", event.target.value)}
                >
                  <option value="" disabled>
                    UF
                  </option>
                  {UF_LIST.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel required>Cargo Pretendido</FieldLabel>
                <select
                  className={inputClasses}
                  value={form.role}
                  disabled={isReserved}
                  onChange={(event) => setField("role", event.target.value)}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {CARGOS_2026.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <FieldLabel required>Telefone (WhatsApp)</FieldLabel>
              <input
                className={inputClasses}
                value={form.phone}
                disabled={isReserved}
                placeholder="(00) 00000-0000"
                onChange={(event) => setField("phone", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>E-mail</FieldLabel>
              <input
                className={inputClasses}
                value={form.email}
                disabled={isReserved}
                placeholder="seu@email.com"
                onChange={(event) => setField("email", event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 border border-dashed border-slate-700 rounded-xl p-5">
            <p className="text-sm text-slate-300 font-medium mb-4">Contato da Equipe (Opcional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <FieldLabel>E-mail Assessor/Gabinete</FieldLabel>
                <input
                  className={inputClasses}
                  value={form.teamEmail}
                  placeholder="equipe@email.com"
                  onChange={(event) => setField("teamEmail", event.target.value)}
                />
              </div>
              <div>
                <FieldLabel>WhatsApp Assessor/Gabinete</FieldLabel>
                <input
                  className={inputClasses}
                  value={form.teamPhone}
                  placeholder="(00) 00000-0000"
                  onChange={(event) => setField("teamPhone", event.target.value)}
                />
              </div>
            </div>
            {isReserved ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveTeamContact}
                  className="px-5 py-2 bg-slate-800/80 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                  Salvar contato da equipe
                </button>
                {teamSavedMessage ? (
                  <span className="text-xs text-emerald-400" role="status">
                    {teamSavedMessage}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {!isReserved ? (
            <>
              <div className="mt-6 bg-amber-950/20 border border-amber-800/40 rounded-xl p-5">
                <p className="text-[11px] font-bold tracking-wider text-amber-500 uppercase mb-2 flex items-center gap-2">
                  ⚠ Regra de Caducidade Eleitoral
                </p>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  A adesão no botão abaixo protege a sua vaga estritamente até às{" "}
                  <strong>12h00 do dia 16 de Agosto</strong>. Caso o CNPJ de campanha não seja
                  informado no painel até este horário limite, o acautelamento do seu Gêmeo Digital{" "}
                  <u>expira instantaneamente</u> e a licença será liberada de forma automática para o
                  Candidato #4 da Fila de Espera do seu Estado.
                </p>
              </div>

              {formError ? (
                <p className="mt-4 text-sm text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleReserve}
                className="mt-6 w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_6px_25px_rgba(6,182,212,0.35)]"
              >
                Realizar reserva de vaga (100% gratuita)
              </button>
            </>
          ) : null}

          <p className="mt-6 text-[10px] text-slate-600 text-center">
            Fase de acesso antecipado: os dados da reserva ficam armazenados neste dispositivo até a
            ativação do cadastro definitivo.
          </p>
        </div>
      </div>

      {showPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-[#0F1623] border border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Reserva Confirmada!</h3>
            <p className="text-sm text-slate-400 mb-6">
              O CPF <span className="text-cyan-400">{maskCpf(form.cpf)}</span> acaba de travar
              oficialmente <strong className="text-white">1 das 3 vagas</strong> do seu estado. Seu
              desconto de 50% foi ancorado com sucesso.
            </p>
            <button
              type="button"
              onClick={dismissPopup}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
