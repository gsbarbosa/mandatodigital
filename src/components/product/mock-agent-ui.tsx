"use client";

import { useState, type ReactNode } from "react";

import { PersonaTag } from "@/components/product/persona-shared";

export function MockDemoBanner() {
  return (
    <div className="persona-mock-banner" role="status">
      <strong>Demonstração</strong>
      <span>
        Interface simulada para exibir funcionalidades. Nenhuma configuração é enviada ao servidor.
      </span>
    </div>
  );
}

export function MockAgentPill({ children }: { children: ReactNode }) {
  return <span className="persona-agent-pill">{children}</span>;
}

export function MockDidacticBox({ children }: { children: ReactNode }) {
  return <div className="persona-didactic-box">{children}</div>;
}

export function MockSectionDivider({ title }: { title: string }) {
  return <h3 className="persona-mock-section-title">{title}</h3>;
}

export function MockAgentTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  activeTab: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="persona-agent-tabs" role="tablist" aria-label="Seções do agente">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "persona-agent-tab is-active" : "persona-agent-tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function MockToggleSection({
  title,
  options,
  values,
  onToggle,
  gridClassName,
}: {
  title: string;
  options: readonly string[];
  values: string[];
  onToggle: (value: string) => void;
  gridClassName?: string;
}) {
  return (
    <div className="persona-form-group">
      <MockSectionDivider title={title} />
      <div className={gridClassName ?? "persona-tag-list is-tone-grid"}>
        {options.map((option) => (
          <PersonaTag
            key={option}
            active={values.includes(option)}
            onClick={() => onToggle(option)}
          >
            {option}
          </PersonaTag>
        ))}
      </div>
    </div>
  );
}

export function MockSwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={checked ? "persona-mock-switch is-active" : "persona-mock-switch"}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <div className="persona-mock-switch-copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <span className="persona-mock-switch-track" aria-hidden="true">
        <span className="persona-mock-switch-thumb" />
      </span>
    </button>
  );
}

export function MockSocialProfileList({
  label,
  values,
  onChange,
  maxItems = 10,
}: {
  label: string;
  values: Array<{ network: string; handle: string }>;
  onChange: (values: Array<{ network: string; handle: string }>) => void;
  maxItems?: number;
}) {
  return (
    <div className="persona-form-group">
      <label className="persona-label">{label}</label>
      <div className="persona-mock-list">
        {values.map((row, index) => (
          <div
            key={`${label}-${index}`}
            className="persona-mock-list-row persona-mock-list-row--social"
          >
            <select
              className="persona-mock-select"
              value={row.network}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, network: event.target.value }
                      : item,
                  ),
                )
              }
            >
              {[
                { value: "Instagram", label: "Instagram" },
                { value: "X / Twitter", label: "X" },
                { value: "TikTok", label: "TikTok" },
                { value: "YouTube", label: "YouTube" },
              ].map((network) => (
                <option key={network.value} value={network.value}>
                  {network.label}
                </option>
              ))}
            </select>
            <input
              className="persona-input-control"
              value={row.handle}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, handle: event.target.value } : item,
                  ),
                )
              }
              placeholder="@perfil"
            />
            <button
              type="button"
              className="persona-mock-remove-btn"
              onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
              aria-label="Remover perfil"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="persona-mock-add-btn"
        disabled={values.length >= maxItems}
        onClick={() =>
          onChange([...values, { network: "Instagram", handle: "" }])
        }
      >
        + Adicionar perfil (máx. {maxItems})
      </button>
    </div>
  );
}

export function MockSiteList({
  label,
  values,
  onChange,
  placeholder,
  maxItems = 10,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  maxItems?: number;
}) {
  return (
    <div className="persona-form-group">
      <label className="persona-label">{label}</label>
      <div className="persona-mock-list">
        {values.map((value, index) => (
          <div
            key={`${label}-${index}`}
            className="persona-mock-list-row persona-mock-list-row--site"
          >
            <span className="persona-mock-list-prefix" aria-hidden="true">
              🌐
            </span>
            <input
              className="persona-input-control"
              value={value}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
              placeholder={placeholder}
            />
            <button
              type="button"
              className="persona-mock-remove-btn"
              onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
              aria-label="Remover portal"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="persona-mock-add-btn"
        disabled={values.length >= maxItems}
        onClick={() => onChange([...values, ""])}
      >
        + Adicionar portal (máx. {maxItems})
      </button>
    </div>
  );
}

export function useMockSaveFeedback() {
  const [message, setMessage] = useState<string | null>(null);

  function triggerMockSave(label: string) {
    setMessage(`${label} salvo localmente (demonstração).`);
    window.setTimeout(() => setMessage(null), 3200);
  }

  return { message, triggerMockSave };
}

export function MockSaveRow({
  label,
  onSave,
  feedback,
}: {
  label: string;
  onSave: () => void;
  feedback: string | null;
}) {
  return (
    <div className="persona-cta-block persona-top-gap">
      <div className="persona-cta-row">
        <button type="button" className="persona-btn persona-btn-large" onClick={onSave}>
          {label}
        </button>
      </div>
      {feedback ? (
        <p className="persona-script-approved" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

export function MockStatusCard({
  title,
  meta,
  status,
  statusLabel,
}: {
  title: string;
  meta: string;
  status: "ok" | "warn" | "pending";
  statusLabel: string;
}) {
  return (
    <article className={`persona-mock-status-card is-${status}`}>
      <div className="persona-mock-status-card-top">
        <strong>{title}</strong>
        <span className="persona-mock-status-pill">{statusLabel}</span>
      </div>
      <p>{meta}</p>
    </article>
  );
}
