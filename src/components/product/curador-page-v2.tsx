"use client";

import { useState } from "react";

import { useProductApp } from "@/components/product/provider";
import { IdeologicalSpectrumSlider } from "@/components/product/persona-shared";

export function CuradorPageV2() {
  const { profileForm, setProfileForm, saveProfile, isSavingProfile } = useProductApp();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaveMessage(null);
    try {
      await saveProfile({ allowDraftDefaults: true, silent: true, throwOnError: true });
      setSaveMessage("Persona salva com sucesso.");
      window.setTimeout(() => setSaveMessage(null), 2800);
    } catch {
      // erro exibido pelo provider
    }
  }

  return (
    <div className="min-h-full relative pb-28">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <header id="persona" data-onboarding-anchor="avatar-persona" className="mb-10 scroll-mt-24">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
            Calibragem de <span className="text-cyan-400">Persona</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl">
            Defina o posicionamento ideológico e o glossário pessoal usados na geração dos
            roteiros.
          </p>
        </header>

        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Posicionamento ideológico
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-full">
                Obrigatório
              </span>
            </h2>
          </div>
          <p className="text-sm text-slate-400 mb-2">
            Arraste na linha para calibrar entre esquerda e direita. O centro representa
            posicionamento moderado.
          </p>
          <p className="text-sm text-slate-500 mb-4">
            O posicionamento é utilizado para calibrar os roteiros dos vídeos.
          </p>
          <IdeologicalSpectrumSlider
            value={profileForm.spectrum}
            onChange={(spectrum) =>
              setProfileForm((current) => ({
                ...current,
                spectrum,
              }))
            }
          />
        </section>

        <section
          id="glossario"
          data-onboarding-anchor="avatar-glossario"
          className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 scroll-mt-24"
        >
          <p className="text-sm text-slate-400 mb-4">
            Inclua características fundamentais da sua expressão, como por exemplo: né, tipo,
            entendeu, sabe, tá, ok, certo, mano, assim. As expressões do glossário são
            incorporadas nos roteiros dos vídeos.
          </p>
          <textarea
            className="w-full min-h-[140px] rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50"
            value={profileForm.glossaryTerms ?? ""}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                glossaryTerms: event.target.value,
              }))
            }
            placeholder="Digite suas expressões, separadas por vírgula..."
          />
        </section>
      </div>

      <div className="sticky bottom-0 left-0 right-0 mt-10 border-t border-slate-800 bg-[#0B0F19]/90 backdrop-blur-md z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {saveMessage ? (
              <span className="text-emerald-400" role="status">
                {saveMessage}
              </span>
            ) : (
              <span>As preferências de persona entram nos próximos roteiros gerados.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSavingProfile}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-2.5 px-8 rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
          >
            {isSavingProfile ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
