"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";

import { useProductApp } from "@/components/product/provider";
import { APP_HOME_PATH } from "@/lib/app-home";
import {
  formatCpf,
  formatEmailInput,
  formatPhoneBr,
  isValidCpf,
  isValidEmail,
  isValidPhoneBr,
} from "@/lib/br-input";
import {
  PLAN_SELECTION_PATH,
  REGISTRATION_REQUIRED_PATH,
  resolveIncompleteRegistrationPath,
} from "@/lib/registration-gate";
import {
  earlyAccessPlans,
  readPlanIntent,
  useEarlyAccess,
  writePlanIntent,
  type EarlyAccessPlanId,
  type EarlyAccessReservation,
} from "@/lib/early-access";
import { isDemoMode } from "@/lib/demo-mode";

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

const BETA_CARGOS = new Set(["Senador", "Governador", "Presidente"]);

const inputClasses =
  "bg-md-surface-inset border border-md-border text-md-text text-sm rounded-lg p-2.5 w-full outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed";

const cargoSelectClasses =
  "bg-md-surface-inset border border-md-border text-md-text text-base rounded-lg px-3 py-3 min-h-[3rem] w-full outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed";

function BetaVersionBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--curador-text)]">
      Versão beta
    </span>
  );
}

function CargoSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${cargoSelectClasses} flex items-center justify-between gap-2 text-left`}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {value && BETA_CARGOS.has(value) ? <BetaVersionBadge /> : null}
          <span className={value ? "truncate text-md-text" : "text-md-text-soft"}>
            {value || "Selecione"}
          </span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-md-text-soft transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-md-border bg-md-surface-inset py-1 shadow-xl"
          role="listbox"
        >
          {CARGOS_2026.map((cargo) => {
            const selected = value === cargo;

            return (
              <li key={cargo}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-base transition-colors ${
                    selected
                      ? "bg-[var(--curador-soft)] text-[var(--curador-text)]"
                      : "text-md-text hover:bg-md-overlay-hover/80"
                  }`}
                  onClick={() => {
                    onChange(cargo);
                    setOpen(false);
                  }}
                >
                  {BETA_CARGOS.has(cargo) ? <BetaVersionBadge /> : null}
                  <span>{cargo}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-[10px] font-bold tracking-wider text-md-text-soft uppercase mb-1.5">
      {children} {required ? <span className="text-[var(--curador-text)]">*</span> : null}
    </label>
  );
}

function redactCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 5) {
    return formatCpf(cpf);
  }
  return `${digits.slice(0, 3)}...-${digits.slice(-2)}`;
}

export function AcessoDadosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profileForm, sessionUser, setProfileForm } = useProductApp();
  const [earlyAccess, updateEarlyAccess] = useEarlyAccess();
  const reservation = earlyAccess.reservation;
  const isReserved = Boolean(reservation);
  const isOnReserveQueue = reservation?.seatStatus === "reserve";

  const [selectedPlanId, setSelectedPlanId] = useState<EarlyAccessPlanId | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [cpfStatus, setCpfStatus] = useState<"idle" | "checking" | "ok" | "invalid" | "taken">(
    "idle",
  );
  const [cpfStatusMessage, setCpfStatusMessage] = useState<string | null>(null);
  const cpfCheckSeq = useRef(0);
  const [emailStatus, setEmailStatus] = useState<"idle" | "ok" | "invalid">("idle");
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    party: "",
    cpf: "",
    uf: "",
    role: "",
    address: "",
    phone: "",
    email: "",
    teamEmail: "",
    teamPhone: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupKind, setPopupKind] = useState<"active" | "reserve">("active");
  const [seatMessage, setSeatMessage] = useState<string | null>(null);
  const [teamSavedMessage, setTeamSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hydratedFromServer, setHydratedFromServer] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(sessionUser?.email?.trim() || null);

  useEffect(() => {
    const planFromUrl = searchParams.get("plan");
    const intent = readPlanIntent(planFromUrl);
    setSelectedPlanId(intent);
    setChangingPlan(false);
    if (intent) {
      writePlanIntent(intent);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const response = await fetch("/api/user/registration", {
          credentials: "same-origin",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          reservation: EarlyAccessReservation | null;
          needsPlanSelection?: boolean;
          registration?: {
            status: string;
            fullName: string;
            party: string;
            cpf: string;
            uf: string;
            role: string;
            address: string;
            phone: string;
            email: string;
            teamEmail: string;
            teamPhone: string;
          } | null;
          authEmail?: string | null;
        };

        if (cancelled) {
          return;
        }

        if (payload.needsPlanSelection && !searchParams.get("plan")) {
          router.replace(
            resolveIncompleteRegistrationPath({
              needsPlanSelection: true,
              demoMode: isDemoMode(),
            }) as Route,
          );
          return;
        }

        const resolvedAuthEmail =
          payload.authEmail?.trim() || sessionUser?.email?.trim() || null;
        if (resolvedAuthEmail) {
          setAuthEmail(resolvedAuthEmail);
        }

        if (payload.reservation) {
          updateEarlyAccess({ reservation: payload.reservation });
          return;
        }

        // Cadastro incompleto: preenche o que já existir (ex.: e-mail do Auth).
        const reg = payload.registration;
        if (reg) {
          setForm((current) => ({
            ...current,
            fullName: current.fullName || reg.fullName || "",
            party: current.party || reg.party || "",
            cpf: current.cpf || (reg.cpf ? formatCpf(reg.cpf) : ""),
            uf: current.uf || reg.uf || "",
            role: current.role || reg.role || "",
            address: current.address || reg.address || "",
            phone: current.phone || (reg.phone ? formatPhoneBr(reg.phone) : ""),
            email:
              formatEmailInput(
                current.email ||
                  resolvedAuthEmail ||
                  reg.email ||
                  "",
              ),
            teamEmail: formatEmailInput(current.teamEmail || reg.teamEmail || ""),
            teamPhone:
              current.teamPhone || (reg.teamPhone ? formatPhoneBr(reg.teamPhone) : ""),
          }));
        }
      } catch {
        // Mantém cache local se a API falhar.
      } finally {
        if (!cancelled) {
          setHydratedFromServer(true);
        }
      }
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, [updateEarlyAccess, sessionUser?.email, router, searchParams]);

  useEffect(() => {
    if (reservation) {
      setForm({
        fullName: reservation.fullName,
        party: reservation.party,
        cpf: formatCpf(reservation.cpf),
        uf: reservation.uf,
        role: reservation.role,
        address: reservation.address ?? "",
        phone: formatPhoneBr(reservation.phone),
        email: formatEmailInput(reservation.email),
        teamEmail: formatEmailInput(reservation.teamEmail),
        teamPhone: formatPhoneBr(reservation.teamPhone),
      });
      return;
    }
    if (!hydratedFromServer) {
      return;
    }
    setForm((current) => ({
      ...current,
      fullName: current.fullName || profileForm.fullName,
      uf: current.uf || profileForm.state.toUpperCase(),
      role: current.role || profileForm.role,
      email: formatEmailInput(current.email || authEmail || sessionUser?.email || ""),
    }));
  }, [
    reservation,
    hydratedFromServer,
    profileForm.fullName,
    profileForm.state,
    profileForm.role,
    sessionUser?.email,
    authEmail,
  ]);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleCpfChange(raw: string) {
    const masked = formatCpf(raw);
    setField("cpf", masked);
    setCpfStatus("idle");
    setCpfStatusMessage(null);
  }

  function handlePhoneChange(raw: string) {
    setField("phone", formatPhoneBr(raw));
  }

  function handleTeamPhoneChange(raw: string) {
    setField("teamPhone", formatPhoneBr(raw));
  }

  function handleEmailChange(raw: string) {
    const next = formatEmailInput(raw);
    setField("email", next);
    if (!next) {
      setEmailStatus("idle");
      setEmailStatusMessage(null);
      return;
    }
    // Feedback em tempo real depois que o usuário começa a montar o endereço
    if (next.includes("@") && next.includes(".")) {
      if (isValidEmail(next)) {
        setEmailStatus("ok");
        setEmailStatusMessage(null);
      } else {
        setEmailStatus("invalid");
        setEmailStatusMessage("E-mail inválido — use o formato nome@dominio.com");
      }
    } else {
      setEmailStatus("idle");
      setEmailStatusMessage(null);
    }
  }

  function validateEmailField(value: string) {
    const next = formatEmailInput(value);
    if (!next) {
      setEmailStatus("idle");
      setEmailStatusMessage(null);
      return;
    }
    if (isValidEmail(next)) {
      setEmailStatus("ok");
      setEmailStatusMessage(null);
      return;
    }
    setEmailStatus("invalid");
    setEmailStatusMessage("E-mail inválido — use o formato nome@dominio.com");
  }

  async function checkCpfAvailability(cpfValue: string) {
    const seq = ++cpfCheckSeq.current;
    if (!isValidCpf(cpfValue)) {
      if (cpfValue.replace(/\D/g, "").length === 11) {
        setCpfStatus("invalid");
        setCpfStatusMessage("CPF inválido.");
      } else {
        setCpfStatus("idle");
        setCpfStatusMessage(null);
      }
      return;
    }

    setCpfStatus("checking");
    setCpfStatusMessage("Verificando CPF...");
    try {
      const response = await fetch(
        `/api/user/registration/cpf-check?cpf=${encodeURIComponent(cpfValue.replace(/\D/g, ""))}`,
        { credentials: "same-origin" },
      );
      const payload = (await response.json().catch(() => null)) as {
        valid?: boolean;
        available?: boolean;
        message?: string | null;
      } | null;

      if (seq !== cpfCheckSeq.current) {
        return;
      }

      if (!response.ok || !payload) {
        setCpfStatus("idle");
        setCpfStatusMessage(null);
        return;
      }

      if (!payload.valid) {
        setCpfStatus("invalid");
        setCpfStatusMessage(payload.message || "CPF inválido.");
        return;
      }

      if (!payload.available) {
        setCpfStatus("taken");
        setCpfStatusMessage(payload.message || "Já existe uma conta com este CPF.");
        return;
      }

      setCpfStatus("ok");
      setCpfStatusMessage(null);
    } catch {
      if (seq === cpfCheckSeq.current) {
        setCpfStatus("idle");
        setCpfStatusMessage(null);
      }
    }
  }

  async function handleReserve() {
    setFormError(null);
    if (
      !form.fullName.trim() ||
      !form.party ||
      !form.cpf.trim() ||
      !form.uf ||
      !form.role ||
      !form.address.trim() ||
      !form.phone.trim() ||
      !form.email.trim()
    ) {
      setFormError("Preencha todos os campos obrigatórios (*) para reservar a vaga.");
      return;
    }
    if (!isValidCpf(form.cpf)) {
      setFormError("CPF inválido.");
      setCpfStatus("invalid");
      setCpfStatusMessage("CPF inválido.");
      return;
    }
    if (cpfStatus === "taken") {
      setFormError("Já existe uma conta cadastrada com este CPF.");
      return;
    }
    if (!isValidPhoneBr(form.phone)) {
      setFormError("Telefone inválido — use DDD + número.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setFormError("E-mail inválido.");
      return;
    }

    const personalPayload = {
      fullName: form.fullName.trim(),
      party: form.party,
      cpf: form.cpf.trim(),
      uf: form.uf,
      role: form.role,
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      teamEmail: form.teamEmail.trim(),
      teamPhone: form.teamPhone.trim(),
      ...(selectedPlanId ? { planId: selectedPlanId } : {}),
    };

    setIsSaving(true);
    try {
      const response = await fetch("/api/user/registration", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personalPayload),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        needsPlanSelection?: boolean;
        seatStatus?: "active" | "reserve";
        reservation?: EarlyAccessReservation;
        profile?: {
          id: string;
          fullName: string;
          role: string;
          state: string;
          notificationEmail: string;
        };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Nao foi possivel gravar a reserva.");
      }

      if (payload?.profile) {
        setProfileForm((current) => ({
          ...current,
          id: payload.profile?.id ?? current.id,
          fullName: payload.profile?.fullName ?? current.fullName,
          role: payload.profile?.role ?? current.role,
          state: payload.profile?.state ?? current.state,
          notificationEmail:
            payload.profile?.notificationEmail ?? current.notificationEmail,
        }));
      }

      // Sem plano (Entrar) → demonstração (DEMO) ou escolha de plano.
      if (payload?.needsPlanSelection || !payload?.reservation) {
        router.replace(
          resolveIncompleteRegistrationPath({
            needsPlanSelection: true,
            demoMode: isDemoMode(),
          }) as Route,
        );
        router.refresh();
        return;
      }

      const seatStatus =
        payload.reservation.seatStatus ??
        payload.seatStatus ??
        "active";

      updateEarlyAccess({
        reservation: {
          ...payload.reservation,
          seatStatus,
        },
      });

      router.replace(APP_HOME_PATH);
      router.refresh();
      return;
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel gravar a reserva no servidor.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTeamContact() {
    if (!reservation) {
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/user/registration", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamEmail: form.teamEmail.trim(),
          teamPhone: form.teamPhone.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        reservation?: EarlyAccessReservation;
      } | null;

      if (!response.ok || !payload?.reservation) {
        throw new Error(payload?.message || "Nao foi possivel atualizar o contato.");
      }

      updateEarlyAccess({ reservation: payload.reservation });
      setTeamSavedMessage("Contato da equipe atualizado.");
      window.setTimeout(() => setTeamSavedMessage(null), 3200);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar o contato da equipe.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function dismissPopup() {
    setShowPopup(false);
    updateEarlyAccess({ reservationPopupSeen: true });
  }

  return (
    <div className="relative min-h-full pb-16">
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[40%] w-[50%] rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[30%] h-[40%] w-[40%] rounded-full bg-cyan-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="rounded-2xl border border-md-border bg-md-surface/40 p-5 shadow-2xl backdrop-blur-xl sm:p-7 md:p-8">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-md-text sm:text-2xl">
              {isReserved ? "Dados Pessoais" : "Complete seu cadastro"}
            </h1>
            {isReserved ? (
              isOnReserveQueue ? (
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  Lista de reserva
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--sentinela-border)] bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--sentinela-text)]">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reserva Confirmada
                </span>
              )
            ) : null}
          </div>
          <p className="mb-6 text-sm leading-relaxed text-md-text-soft">
            {isReserved
              ? isOnReserveQueue
                ? "Você está na lista de reserva deste partido/UF. Se uma vaga antecipada liberar, avisaremos por e-mail. Somente o contato da equipe pode ser alterado."
                : "Sua reserva está ativa. Somente o contato da equipe pode ser alterado."
              : (
                <>
                  Preencha os dados para liberar o acesso ao Mandato Digital.{" "}
                  <span className="text-[var(--curador-text)]">Campos com * são obrigatórios.</span>
                </>
              )}
          </p>
          {seatMessage && isReserved ? (
            <p className="mb-5 rounded-xl border border-md-border bg-md-bg/50 px-4 py-3 text-sm text-md-text-muted">
              {seatMessage}
            </p>
          ) : null}

          {!isReserved && selectedPlanId ? (
            <div className="mb-6 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--curador-text)]">
                    Plano selecionado
                  </p>
                  {(() => {
                    const plan = earlyAccessPlans.find((item) => item.id === selectedPlanId);
                    if (!plan) {
                      return null;
                    }
                    return (
                      <div className="mt-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="text-base font-semibold text-md-text">{plan.name}</p>
                          <p className="text-sm text-md-text-soft">
                            {plan.priceLabel}{" "}
                            <span className="text-md-text-soft line-through">
                              {plan.originalPriceLabel}
                            </span>
                          </p>
                        </div>
                        {!changingPlan ? (
                          <ul className="mt-3 space-y-1.5">
                            {plan.features.map((feature) => (
                              <li
                                key={feature}
                                className="flex items-start gap-2 text-xs leading-relaxed text-md-text-muted"
                              >
                                <span className="mt-0.5 shrink-0 text-[var(--sentinela-text)]">✓</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-md-border-hover px-3 py-1.5 text-xs font-medium text-md-text transition hover:border-cyan-500/50 hover:bg-md-overlay-hover/80"
                  onClick={() => setChangingPlan((current) => !current)}
                >
                  {changingPlan ? "Fechar" : "Trocar plano"}
                </button>
              </div>

              {changingPlan ? (
                <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {earlyAccessPlans.map((plan) => {
                    const active = plan.id === selectedPlanId;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          writePlanIntent(plan.id);
                          setChangingPlan(false);
                          router.replace(
                            `${REGISTRATION_REQUIRED_PATH}?plan=${plan.id}` as Route,
                          );
                        }}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-cyan-500/60 bg-cyan-500/10"
                            : "border-md-border bg-md-bg/40 hover:border-slate-500"
                        }`}
                      >
                        <p className="text-sm font-semibold text-md-text">{plan.name}</p>
                        <p className="mt-0.5 text-xs text-md-text-soft">{plan.priceLabel}</p>
                        <ul className="mt-2 space-y-1">
                          {plan.features.slice(0, 2).map((feature) => (
                            <li key={feature} className="text-[11px] leading-snug text-md-text-soft">
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-md-text-soft">
                  Quer ver o comparativo completo?{" "}
                  <button
                    type="button"
                    className="text-[var(--curador-text)] underline-offset-2 hover:underline"
                    onClick={() => router.push(PLAN_SELECTION_PATH as Route)}
                  >
                    Abrir planos e preços
                  </button>
                </p>
              )}
            </div>
          ) : !isReserved ? (
            <div className="mb-6 rounded-xl border border-md-border bg-md-bg/40 px-4 py-3.5 text-sm text-md-text-soft">
              Depois de salvar seus dados, você escolhe o plano com o comparativo completo do que
              está incluso.
            </div>
          ) : reservation?.planId ? (
            <div className="mb-5 rounded-xl border border-md-border bg-md-bg/40 px-4 py-3 text-sm text-md-text-muted">
              Plano:{" "}
              <span className="font-semibold text-md-text">
                {earlyAccessPlans.find((p) => p.id === reservation.planId)?.name ??
                  reservation.planId}
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
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
              <p className="text-[10px] text-md-text-soft mt-1">
                * Informação de uso interno. A vaga não sofre alteração caso mude de partido.
              </p>
            </div>

            <div>
              <FieldLabel required>CPF</FieldLabel>
              <input
                className={inputClasses}
                value={form.cpf}
                disabled={isReserved}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                onChange={(event) => handleCpfChange(event.target.value)}
                onBlur={() => void checkCpfAvailability(form.cpf)}
              />
              <p className="text-[10px] text-amber-500/80 mt-1">
                Atenção: O CPF deve ser do titular do CNPJ de Campanha.
              </p>
              {cpfStatusMessage ? (
                <p
                  className={`mt-1 text-[11px] ${
                    cpfStatus === "ok"
                      ? "text-[var(--sentinela-text)]"
                      : cpfStatus === "checking"
                        ? "text-md-text-soft"
                        : "text-red-400"
                  }`}
                  role="status"
                >
                  {cpfStatusMessage}
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(6rem,7.5rem)_minmax(0,1fr)]">
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
                <CargoSelect
                  value={form.role}
                  disabled={isReserved}
                  onChange={(role) => setField("role", role)}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <FieldLabel required>Endereço da Campanha</FieldLabel>
              <input
                className={inputClasses}
                value={form.address}
                disabled={isReserved}
                placeholder="Rua, número, bairro, cidade - UF, CEP"
                onChange={(event) => setField("address", event.target.value)}
              />
            </div>

            <div>
              <FieldLabel required>Telefone (WhatsApp)</FieldLabel>
              <input
                className={inputClasses}
                value={form.phone}
                disabled={isReserved}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                onChange={(event) => handlePhoneChange(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>E-mail</FieldLabel>
              <input
                className={`${inputClasses}${
                  emailStatus === "invalid"
                    ? " border-red-500/60 focus:border-red-400 focus:ring-red-400"
                    : emailStatus === "ok"
                      ? " border-emerald-500/40 focus:border-emerald-400 focus:ring-emerald-400"
                      : ""
                }`}
                type="email"
                value={form.email}
                disabled={isReserved}
                autoComplete="email"
                placeholder="seu@email.com"
                onChange={(event) => handleEmailChange(event.target.value)}
                onBlur={() => validateEmailField(form.email)}
              />
              {emailStatusMessage ? (
                <p className="mt-1 text-[11px] text-red-400" role="status">
                  {emailStatusMessage}
                </p>
              ) : authEmail && form.email === authEmail ? (
                <p className="mt-1 text-[10px] text-md-text-soft">
                  Preenchido com o e-mail da sua conta de login — você pode alterar.
                </p>
              ) : emailStatus === "ok" ? (
                <p className="mt-1 text-[11px] text-[var(--sentinela-text)]" role="status">
                  E-mail com formato válido.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 border border-dashed border-md-border rounded-xl p-5">
            <p className="text-sm text-md-text-muted font-medium mb-4">Contato da Equipe (Opcional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <FieldLabel>E-mail Assessor/Gabinete</FieldLabel>
                <input
                  className={inputClasses}
                  value={form.teamEmail}
                  type="email"
                  placeholder="equipe@email.com"
                  onChange={(event) => setField("teamEmail", formatEmailInput(event.target.value))}
                />
              </div>
              <div>
                <FieldLabel>WhatsApp Assessor/Gabinete</FieldLabel>
                <input
                  className={inputClasses}
                  value={form.teamPhone}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  onChange={(event) => handleTeamPhoneChange(event.target.value)}
                />
              </div>
            </div>
            {isReserved ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSaveTeamContact()}
                  disabled={isSaving}
                  className="px-5 py-2 bg-md-surface-inset text-md-text border border-md-border rounded-lg text-sm font-medium hover:bg-md-overlay-hover transition-colors disabled:opacity-60"
                >
                  {isSaving ? "Salvando..." : "Salvar contato da equipe"}
                </button>
                {teamSavedMessage ? (
                  <span className="text-xs text-[var(--sentinela-text)]" role="status">
                    {teamSavedMessage}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {!isReserved ? (
            <>
              <div className="mt-6 bg-[var(--distribuidor-soft)] border border-[var(--distribuidor-border)] rounded-xl p-5">
                <p className="text-[11px] font-bold tracking-wider text-amber-500 uppercase mb-2 flex items-center gap-2">
                  ⚠ Regra de Caducidade Eleitoral
                </p>
                <p className="text-xs text-[var(--distribuidor-text)] leading-relaxed">
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
                onClick={() => void handleReserve()}
                disabled={
                  isSaving ||
                  cpfStatus === "taken" ||
                  cpfStatus === "invalid" ||
                  cpfStatus === "checking" ||
                  emailStatus === "invalid"
                }
                className="mt-6 w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-md-text font-bold py-4 px-6 rounded-xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_6px_25px_rgba(6,182,212,0.35)] disabled:opacity-60"
              >
                {isSaving
                  ? "Salvando..."
                  : selectedPlanId
                    ? "Realizar reserva de vaga (100% gratuita)"
                    : "Salvar e escolher plano"}
              </button>
            </>
          ) : null}

          <p className="mt-6 text-[10px] text-md-text-soft text-center">
            Seus dados ficam gravados na conta (cadastro) e vinculados ao perfil do mandato.
            A linguagem de “acesso antecipado” é só a oferta desta fase.
          </p>
        </div>
      </div>

      {showPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-md-surface border border-md-border rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            {popupKind === "reserve" ? (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-md-text mb-3">Lista de reserva</h3>
                <p className="text-sm text-md-text-soft mb-6">
                  O CPF <span className="text-[var(--curador-text)]">{redactCpf(form.cpf)}</span> foi incluído na
                  lista de espera deste partido/UF — as 03 vagas antecipadas já estão preenchidas.
                  Se alguém desistir, avisaremos por e-mail.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-[var(--sentinela-border)] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[var(--sentinela-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-md-text mb-3">Reserva Confirmada!</h3>
                <p className="text-sm text-md-text-soft mb-6">
                  O CPF <span className="text-[var(--curador-text)]">{redactCpf(form.cpf)}</span> acaba de travar
                  oficialmente <strong className="text-md-text">1 das 3 vagas</strong> do seu estado. Seu
                  desconto de 50% foi ancorado com sucesso.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={dismissPopup}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-md-text font-semibold py-2.5 px-6 rounded-lg transition-all"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
