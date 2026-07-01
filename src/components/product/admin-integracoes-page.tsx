"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { PlatformCredentialId } from "@/lib/platform-credential-registry";

type AdminCredentialService = {
  serviceId: PlatformCredentialId;
  id: PlatformCredentialId;
  label: string;
  description: string;
  placeholder: string;
  docsUrl?: string;
  configured: boolean;
  source: "env" | "database" | "none";
  maskedHint: string;
  updatedAt: string | null;
  updatedByEmail: string;
  lastTestedAt: string | null;
  lastTestStatus: string;
  lastTestMessage: string;
};

type DraftState = Record<string, string>;

function formatTimestamp(value: string | null) {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function sourceLabel(source: AdminCredentialService["source"]) {
  if (source === "env") {
    return "Ambiente (env)";
  }
  if (source === "database") {
    return "Painel admin";
  }
  return "Nao configurado";
}

export function AdminIntegracoesPage() {
  const [services, setServices] = useState<AdminCredentialService[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/credentials");
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        services?: AdminCredentialService[];
      };

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel carregar integracoes.");
      }

      setServices(payload.services ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Falha ao carregar integracoes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  async function handleSave(serviceId: PlatformCredentialId) {
    const apiKey = drafts[serviceId]?.trim() ?? "";
    if (apiKey.length < 8) {
      setError("Informe uma chave valida antes de salvar.");
      return;
    }

    setBusyServiceId(serviceId);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/admin/credentials/${serviceId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel salvar a chave.");
      }

      setDrafts((current) => ({ ...current, [serviceId]: "" }));
      setStatusMessage(payload.message || "Chave salva.");
      await loadServices();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    } finally {
      setBusyServiceId(null);
    }
  }

  async function handleTest(serviceId: PlatformCredentialId) {
    const draft = drafts[serviceId]?.trim();
    setBusyServiceId(serviceId);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/admin/credentials/${serviceId}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft ? { apiKey: draft } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Falha ao testar conexao.");
      }

      setStatusMessage(payload.message || (payload.ok ? "Conexao OK." : "Teste falhou."));
      await loadServices();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Falha ao testar.");
    } finally {
      setBusyServiceId(null);
    }
  }

  async function handleRemove(serviceId: PlatformCredentialId) {
    setBusyServiceId(serviceId);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/admin/credentials/${serviceId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel remover a chave.");
      }

      setStatusMessage("Chave removida do painel.");
      await loadServices();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Falha ao remover.");
    } finally {
      setBusyServiceId(null);
    }
  }

  const configuredCount = services.filter((service) => service.configured).length;

  return (
    <div className="app-page admin-integracoes-page" data-testid="admin-integracoes-page">
      <section className="app-panel app-panel-span-full">
        <div className="admin-integracoes-header">
          <div>
            <p className="admin-integracoes-eyebrow">Plataforma</p>
            <h2 className="admin-integracoes-title">Integrações e chaves</h2>
            <p className="persona-helper-text admin-integracoes-lead">
              Cadastre as API keys dos serviços sem redeploy. Valores salvos aqui ficam
              criptografados no Supabase. Chaves definidas no ambiente (Firebase) têm prioridade.
            </p>
          </div>
          <div className="admin-integracoes-summary" aria-live="polite">
            <strong>{configuredCount}</strong>
            <span>de {services.length || 7} ativas</span>
          </div>
        </div>

        {loading ? (
          <p className="persona-helper-text" role="status">
            Carregando integrações…
          </p>
        ) : null}

        {error ? (
          <p className="heygen-dev-panel-banner is-error" role="alert">
            {error}
          </p>
        ) : null}

        {statusMessage ? (
          <p className="heygen-dev-panel-banner is-success" role="status">
            {statusMessage}
          </p>
        ) : null}

        <div className="admin-integracoes-grid">
          {services.map((service) => {
            const isBusy = busyServiceId === service.serviceId;
            const canEditDatabase = service.source !== "env";

            return (
              <article
                key={service.serviceId}
                className="admin-integracoes-card"
                data-testid={`admin-credential-${service.serviceId}`}
              >
                <div className="admin-integracoes-card-head">
                  <div>
                    <h3>{service.label}</h3>
                    <p className="persona-helper-text">{service.description}</p>
                  </div>
                  <span
                    className={[
                      "admin-integracoes-badge",
                      service.configured ? "is-ok" : "is-missing",
                    ].join(" ")}
                  >
                    {service.configured ? "Configurado" : "Pendente"}
                  </span>
                </div>

                <dl className="admin-integracoes-meta">
                  <div>
                    <dt>Origem</dt>
                    <dd>{sourceLabel(service.source)}</dd>
                  </div>
                  {service.maskedHint ? (
                    <div>
                      <dt>Chave</dt>
                      <dd>{service.maskedHint}</dd>
                    </div>
                  ) : null}
                  {service.updatedAt ? (
                    <div>
                      <dt>Atualizado</dt>
                      <dd>
                        {formatTimestamp(service.updatedAt)}
                        {service.updatedByEmail ? ` · ${service.updatedByEmail}` : ""}
                      </dd>
                    </div>
                  ) : null}
                  {service.lastTestMessage ? (
                    <div>
                      <dt>Último teste</dt>
                      <dd
                        className={
                          service.lastTestStatus === "ok"
                            ? "admin-integracoes-test-ok"
                            : "admin-integracoes-test-error"
                        }
                      >
                        {service.lastTestMessage}
                        {service.lastTestedAt
                          ? ` (${formatTimestamp(service.lastTestedAt)})`
                          : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {service.docsUrl ? (
                  <p className="persona-helper-text">
                    <a href={service.docsUrl} target="_blank" rel="noreferrer">
                      Obter chave em {service.label}
                    </a>
                  </p>
                ) : null}

                {canEditDatabase ? (
                  <>
                    <label className="persona-label" htmlFor={`admin-key-${service.serviceId}`}>
                      Nova chave
                    </label>
                    <input
                      id={`admin-key-${service.serviceId}`}
                      type="password"
                      className="persona-input"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={service.placeholder}
                      value={drafts[service.serviceId] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [service.serviceId]: event.target.value,
                        }))
                      }
                    />

                    <div className="button-row admin-integracoes-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={isBusy || !(drafts[service.serviceId]?.trim().length ?? 0)}
                        onClick={() => void handleSave(service.serviceId)}
                      >
                        {isBusy ? "Salvando…" : "Salvar"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={isBusy}
                        onClick={() => void handleTest(service.serviceId)}
                      >
                        {isBusy ? "Testando…" : "Testar conexão"}
                      </button>
                      {service.source === "database" ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={isBusy}
                          onClick={() => void handleRemove(service.serviceId)}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="admin-integracoes-env-note">
                    <p className="persona-helper-text">
                      Esta chave vem do ambiente do servidor (Firebase / `.env.local`). Remova-a
                      de lá para gerenciar pelo painel.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isBusy}
                      onClick={() => void handleTest(service.serviceId)}
                    >
                      {isBusy ? "Testando…" : "Testar conexão"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="persona-helper-text admin-integracoes-foot">
          Acesso restrito a administradores (`PLATFORM_ADMIN_EMAILS`).{" "}
          <Link href="/inicio">Voltar ao painel</Link>
        </p>
      </section>
    </div>
  );
}

export function AdminAccessDenied() {
  return (
    <div className="app-page admin-integracoes-page" data-testid="admin-access-denied">
      <section className="app-panel app-panel-span-full">
        <h2 className="admin-integracoes-title">Acesso restrito</h2>
        <p className="persona-helper-text">
          Esta área é exclusiva para administradores da plataforma. Peça inclusão do seu e-mail em{" "}
          <code>PLATFORM_ADMIN_EMAILS</code> no ambiente de produção.
        </p>
        <Link href="/inicio" className="secondary-button">
          Voltar ao painel
        </Link>
      </section>
    </div>
  );
}
