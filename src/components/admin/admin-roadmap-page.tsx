"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  ROADMAP_SECTION_LABELS,
  ROADMAP_SECTIONS,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUSES,
  ROADMAP_VALIDATED,
  ROADMAP_VALIDATED_LABELS,
  type RoadmapSection,
  type RoadmapStatus,
  type RoadmapTask,
  type RoadmapValidated,
} from "@/lib/admin/roadmap-types";

const STATUS_COLUMN_STYLE: Record<RoadmapStatus, string> = {
  todo: "border-slate-700",
  inprogress: "border-amber-500/40",
  done: "border-emerald-500/40",
};

export function AdminRoadmapPage() {
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterSection, setFilterSection] = useState<RoadmapSection | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSection, setNewSection] = useState<RoadmapSection>("sistema-agora");
  const [newObservation, setNewObservation] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/roadmap");
    const payload = (await response.json()) as { tasks?: RoadmapTask[]; message?: string };
    if (!response.ok) {
      throw new Error(payload.message || "Falha ao carregar roadmap.");
    }
    setTasks(payload.tasks ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const visible = useMemo(() => {
    if (filterSection === "all") {
      return tasks;
    }
    return tasks.filter((task) => task.section === filterSection);
  }, [tasks, filterSection]);

  const byStatus = useMemo(() => {
    const map: Record<RoadmapStatus, RoadmapTask[]> = {
      todo: [],
      inprogress: [],
      done: [],
    };
    for (const task of visible) {
      map[task.status].push(task);
    }
    return map;
  }, [visible]);

  async function patchTask(id: string, patch: Partial<RoadmapTask>) {
    setSavingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/roadmap/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json()) as { task?: RoadmapTask; message?: string };
      if (!response.ok || !payload.task) {
        throw new Error(payload.message || "Falha ao salvar.");
      }
      setTasks((prev) => prev.map((task) => (task.id === id ? payload.task! : task)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeTask(id: string) {
    if (!window.confirm("Excluir esta task?")) {
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/roadmap/${id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message || "Falha ao excluir.");
      }
      setTasks((prev) => prev.filter((task) => task.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setSavingId(null);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          section: newSection,
          observation: newObservation,
          status: "todo",
        }),
      });
      const payload = (await response.json()) as { task?: RoadmapTask; message?: string };
      if (!response.ok || !payload.task) {
        throw new Error(payload.message || "Falha ao criar.");
      }
      setTasks((prev) => [...prev, payload.task!]);
      setNewTitle("");
      setNewObservation("");
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Roadmap</h2>
          <p className="mt-1 text-sm text-slate-400">
            Board compartilhado (Guga + Thiago). Edite status, validação e observações inline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          {showCreate ? "Cancelar" : "+ Adicionar task"}
        </button>
      </header>

      {showCreate ? (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
              Título
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/60"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Seção
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value as RoadmapSection)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
              >
                {ROADMAP_SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {ROADMAP_SECTION_LABELS[section]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Observação
              <input
                value={newObservation}
                onChange={(e) => setNewObservation(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/60"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
          >
            {creating ? "Criando…" : "Criar task"}
          </button>
        </form>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip
          active={filterSection === "all"}
          onClick={() => setFilterSection("all")}
          label="Todas as seções"
        />
        {ROADMAP_SECTIONS.map((section) => (
          <FilterChip
            key={section}
            active={filterSection === section}
            onClick={() => setFilterSection(section)}
            label={ROADMAP_SECTION_LABELS[section]}
          />
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {ROADMAP_STATUSES.map((status) => (
          <section
            key={status}
            className={`rounded-2xl border bg-slate-950/40 ${STATUS_COLUMN_STYLE[status]}`}
          >
            <header className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {ROADMAP_STATUS_LABELS[status]}
              </h3>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs tabular-nums text-slate-300">
                {byStatus[status].length}
              </span>
            </header>
            <div className="flex flex-col gap-3 p-3">
              {byStatus[status].length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-slate-600">Vazio</p>
              ) : null}
              {byStatus[status].map((task) => (
                <article
                  key={task.id}
                  className={`rounded-xl border border-slate-800 bg-[#0B1220] p-3 ${
                    savingId === task.id ? "opacity-60" : ""
                  }`}
                >
                  <textarea
                    value={task.title}
                    rows={2}
                    onChange={(e) =>
                      setTasks((prev) =>
                        prev.map((t) => (t.id === task.id ? { ...t, title: e.target.value } : t)),
                      )
                    }
                    onBlur={(e) => void patchTask(task.id, { title: e.target.value })}
                    className="w-full resize-none bg-transparent text-sm font-medium text-white outline-none"
                  />

                  <div className="mt-2 grid gap-2">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        void patchTask(task.id, { status: e.target.value as RoadmapStatus })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-200"
                    >
                      {ROADMAP_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          Status: {ROADMAP_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>

                    <select
                      value={task.validatedByThiago}
                      onChange={(e) =>
                        void patchTask(task.id, {
                          validatedByThiago: e.target.value as RoadmapValidated,
                        })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-200"
                    >
                      {ROADMAP_VALIDATED.map((value) => (
                        <option key={value} value={value}>
                          Thiago: {ROADMAP_VALIDATED_LABELS[value]}
                        </option>
                      ))}
                    </select>

                    <select
                      value={task.section}
                      onChange={(e) =>
                        void patchTask(task.id, { section: e.target.value as RoadmapSection })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-200"
                    >
                      {ROADMAP_SECTIONS.map((value) => (
                        <option key={value} value={value}>
                          {ROADMAP_SECTION_LABELS[value]}
                        </option>
                      ))}
                    </select>

                    <textarea
                      value={task.observation}
                      rows={2}
                      placeholder="Observação…"
                      onChange={(e) =>
                        setTasks((prev) =>
                          prev.map((t) =>
                            t.id === task.id ? { ...t, observation: e.target.value } : t,
                          ),
                        )
                      }
                      onBlur={(e) => void patchTask(task.id, { observation: e.target.value })}
                      className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-slate-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void removeTask(task.id)}
                    className="mt-2 text-[11px] text-rose-300/80 hover:text-rose-200"
                  >
                    Excluir
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
          : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
