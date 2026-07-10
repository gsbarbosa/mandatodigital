"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import { pickLatestCaricatureForVariant } from "@/lib/caricature-asset-variant";
import type { AvatarTipo } from "@/lib/avatar-tipos";
import {
  readCuradorHeygenPrefs,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-6 w-6 transform group-hover:translate-x-1 transition-transform"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function AvatarHubPage({ tipo }: { tipo: AvatarTipo }) {
  const router = useRouter();
  const { trainingAssets, profile, profileForm } = useProductApp();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmRetrain, setConfirmRetrain] = useState(false);

  const previewAsset = useMemo(() => {
    if (tipo.caricatureVariant) {
      return pickLatestCaricatureForVariant(trainingAssets, tipo.caricatureVariant);
    }
    return (
      [...trainingAssets]
        .filter((asset) => asset.trainingRole === "avatar_image")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ??
      null
    );
  }, [trainingAssets, tipo.caricatureVariant]);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    if (!previewAsset) {
      return;
    }
    void (async () => {
      try {
        const response = await fetch(
          `/api/profile/training-assets/${encodeURIComponent(previewAsset.id)}/preview-url`,
        );
        const payload = (await response.json()) as { previewUrl?: string };
        if (!cancelled && response.ok && payload.previewUrl) {
          setPreviewUrl(payload.previewUrl);
        }
      } catch {
        // Mantém o placeholder.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewAsset]);

  const profileIdForPrefs = profile?.id ?? profileForm.id ?? null;

  useEffect(() => {
    if (!profileIdForPrefs) {
      return;
    }
    const current = readCuradorHeygenPrefs(profileIdForPrefs);
    const overrides: Parameters<typeof writeCuradorHeygenPrefs>[1] = {
      ...current,
      lastAvatarTipoSlug: tipo.slug,
    };
    if (tipo.slug === "foto-real") {
      overrides.avatarTrack = "photo_real";
    } else if (tipo.slug === "caricato") {
      overrides.avatarTrack = "caricature";
      if (previewAsset?.id) {
        overrides.lastCaricatureAssetId = previewAsset.id;
      }
    } else if (tipo.slug === "3d") {
      overrides.avatarTrack = "caricature";
      if (previewAsset?.id) {
        overrides.lastCaricatureAssetId = previewAsset.id;
      }
    }
    writeCuradorHeygenPrefs(profileIdForPrefs, overrides);
  }, [profileIdForPrefs, tipo.slug, previewAsset?.id]);

  const treinarHref = `/avatares/${tipo.slug}/treinar` as Route;
  const independenteHref = `/independente?avatar=${tipo.slug}` as Route;

  return (
    <div className="min-h-full relative overflow-hidden pb-24">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-[51px] md:pt-[77px]">
        <header className="mb-12 border-b border-slate-800/60 pb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            <svg className="h-8 w-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {tipo.label}
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center mb-16">
          {/* Avatar */}
          <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-8 flex flex-col items-center justify-center shadow-xl relative transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] group">
            <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden border-2 border-slate-700/80 group-hover:border-cyan-400/60 transition-colors shadow-2xl bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`Avatar ${tipo.label}`}
                  className="w-full h-full object-cover btn-transition group-hover:scale-105"
                />
              ) : (
                <div className="text-center px-6">
                  <p className="text-slate-500 text-sm">
                    {previewAsset
                      ? "Carregando pré-visualização..."
                      : "Nenhum avatar treinado ainda. Use “Editar avatar” para enviar foto e voz."}
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-transparent opacity-60 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => setConfirmRetrain(true)}
              className="w-full max-w-[280px] mt-4 group/edit inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/50 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-sm transition-all hover:border-cyan-500/45 hover:bg-cyan-950/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
            >
              <svg
                className="h-4 w-4 shrink-0 text-cyan-400 transition-colors group-hover/edit:text-cyan-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-center leading-snug">
                Editar avatar / Retreinar {tipo.label}
              </span>
            </button>
          </div>

          {/* Ações */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <Link
              href={"/monitoramento" as Route}
              className="no-underline w-full text-left bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-5 px-6 rounded-2xl btn-transition shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_6px_25px_rgba(6,182,212,0.35)] focus:outline-none focus:ring-2 focus:ring-cyan-400 flex items-center justify-between group"
            >
              <span className="text-base sm:text-lg">
                Criar conteúdo a partir do monitoramento de notícias
              </span>
              <ArrowIcon />
            </Link>

            <Link
              href={independenteHref}
              className="no-underline w-full text-left bg-slate-900/40 hover:bg-slate-800 text-slate-300 hover:text-white font-medium py-5 px-6 rounded-2xl btn-transition border border-slate-800 hover:border-slate-700 shadow-md focus:outline-none focus:ring-2 focus:ring-slate-500 flex items-center justify-between group"
            >
              <span className="text-base sm:text-lg">Criar conteúdo independente</span>
              <ArrowIcon className="h-6 w-6 text-slate-500 group-hover:text-slate-300 transform group-hover:translate-x-1 transition-transform" />
            </Link>

            <div className="h-px w-full bg-slate-800/80 my-2" />

            <Link
              href={"/curador" as Route}
              className="no-underline w-full text-left bg-slate-900/50 hover:bg-slate-800 text-slate-200 font-medium py-5 px-6 rounded-2xl btn-transition border border-slate-700/80 hover:border-slate-500 shadow-md focus:outline-none focus:ring-2 focus:ring-slate-500 flex items-center justify-between group"
            >
              <span className="text-sm sm:text-base">
                Personalizar - posição ideológica e glossário pessoal
              </span>
              <svg className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Aviso */}
        <div className="bg-gradient-to-br from-[#131C2D] to-[#0A1628] border border-amber-500/40 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="bg-amber-500/20 text-amber-500 p-2.5 rounded-full shrink-0">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="text-amber-500 text-xs font-bold tracking-wider uppercase mb-2">
                Atenção
              </div>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                O &quot;tom de linguagem&quot; e o &quot;arquétipo&quot; são definidos para cada
                notícia, viabilizando o posicionamento adequado para cada novo conteúdo gerado.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pop-up de confirmação de retreino */}
      {confirmRetrain ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancelar"
            className="absolute inset-0 bg-black/70"
            onClick={() => setConfirmRetrain(false)}
          />
          <div className="relative bg-[#0F1623] border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-3">Treinar novamente seu Avatar?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Você deseja treinar novamente seu Avatar? O avatar atual será descartado imediatamente
              após iniciar o novo treinamento.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRetrain(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => router.push(treinarHref)}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
