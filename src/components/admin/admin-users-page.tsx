"use client";

import { useEffect, useState } from "react";

type UserRow = {
  ownerUserId: string;
  email: string;
  fullName: string;
  party: string;
  uf: string;
  status: string;
  planId: string;
  createdAt: string;
  updatedAt: string;
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/users");
        const payload = (await response.json()) as { users?: UserRow[]; message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao listar usuários.");
        }
        if (!cancelled) {
          setUsers(payload.users ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">Usuários</h2>
        <p className="mt-1 text-sm text-slate-400">
          Cadastros em `userRegistrations` (somente leitura neste MVP).
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">E-mail</th>
              <th className="px-4 py-3 font-semibold">Partido / UF</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !error ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum usuário ou ainda carregando…
                </td>
              </tr>
            ) : null}
            {users.map((user) => (
              <tr key={user.ownerUserId} className="border-t border-slate-800/80 text-slate-300">
                <td className="px-4 py-3 text-white">{user.fullName || "—"}</td>
                <td className="px-4 py-3">{user.email || "—"}</td>
                <td className="px-4 py-3">
                  {[user.party, user.uf].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-4 py-3 capitalize">{user.planId || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.status === "complete" ? "text-emerald-300" : "text-amber-200"
                    }
                  >
                    {user.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
