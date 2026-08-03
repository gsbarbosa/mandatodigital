"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useProductApp } from "@/components/product/provider";
import { IdeologicalSpectrumSlider } from "@/components/product/persona-shared";
import { ProductPageHeader } from "@/components/product/product-page-header";
import type { AvatarTipoSlug } from "@/lib/avatar-tipos";
import { readCuradorHeygenPrefs } from "@/lib/curador-heygen-prefs";

/** Tela de origem no hub de avatares — para onde o Salvar desta página retorna o usuário. */
const AVATAR_HUB_HREF_BY_SLUG: Record<AvatarTipoSlug, Route> = {
  "foto-real": "/avatares/foto-real" as Route,
  caricato: "/avatares/caricato" as Route,
  "3d": "/avatares/3d" as Route,
};

/** Só aceita caminho interno (`/algo`) — nunca `//host` (protocol-relative) nem URL absoluta. */
function safeReturnPath(value: string | null): Route | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value as Route;
}

export function CuradorPageV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, profileForm, setProfileForm, saveProfile, isSavingProfile } = useProductApp();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaveMessage(null);
    try {
      await saveProfile({ allowDraftDefaults: true, silent: true, throwOnError: true });

      // Origem explícita (ex.: gate do Criativo) tem prioridade sobre o hub de avatares:
      // evita mandar de volta a uma tela de avatar desatualizada quando o usuário veio
      // do Criativo/Independente para resolver um pré-requisito.
      const returnParam = safeReturnPath(searchParams.get("return"));
      if (returnParam) {
        router.push(returnParam);
        return;
      }

      const profileId = profile?.id ?? profileForm.id ?? null;
      const lastAvatarTipoSlug = profileId
        ? readCuradorHeygenPrefs(profileId).lastAvatarTipoSlug
        : undefined;
      const returnHref = lastAvatarTipoSlug
        ? AVATAR_HUB_HREF_BY_SLUG[lastAvatarTipoSlug]
        : null;
      if (returnHref) {
        router.push(returnHref);
        return;
      }

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
        <ProductPageHeader
          id="persona"
          data-onboarding-anchor="avatar-persona"
          className="scroll-mt-24"
          title={
            <>
              Calibragem de <span className="text-[var(--curador-text)]">Persona</span>
            </>
          }
          description="Defina o posicionamento ideológico e o glossário pessoal usados na geração dos roteiros."
        />

        <section className="bg-gradient-to-b from-md-surface/50 to-md-slate-900/20 backdrop-blur-xl border border-md-border rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8">
          <div className="border-b border-md-border pb-4 mb-6">
            <h2 className="text-xl font-bold text-md-text flex items-center gap-2">
              Posicionamento ideológico
              <span className="text-[10px] font-semibold uppercase tracking-wide text-md-text-soft bg-md-surface-inset border border-md-border px-2 py-0.5 rounded-full">
                Obrigatório
              </span>
            </h2>
          </div>
          <p className="text-sm text-md-text-soft mb-2">
            Arraste na linha para calibrar entre esquerda e direita. O centro representa
            posicionamento moderado.
          </p>
          <p className="text-sm text-md-text-soft mb-4">
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
          className="bg-gradient-to-b from-md-surface/50 to-md-slate-900/20 backdrop-blur-xl border border-md-border rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 scroll-mt-24"
        >
          <div className="border-b border-md-border pb-4 mb-6">
            <h2 className="text-xl font-bold text-md-text flex items-center gap-2">
              Glossário de expressões
            </h2>
          </div>
          <p className="text-sm text-md-text-soft mb-4">
            Caso utilize alguma expressão recorrente, como: né, tipo, entendeu, sabe, tá, ok,
            certo, mano, assim, entre outras, você pode incluí-las no seu glossário de
            expressões. As expressões serão automaticamente incorporadas nos roteiros dos seus
            vídeos.
          </p>
          <textarea
            className="w-full min-h-[140px] rounded-xl border border-md-border bg-md-bg/60 px-4 py-3 text-sm text-md-text placeholder:text-md-text-soft focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50"
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

      <div className="sticky bottom-0 left-0 right-0 mt-10 border-t border-md-border bg-md-app-bg/90 backdrop-blur-md z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-md-text-soft">
            {saveMessage ? (
              <span className="text-[var(--sentinela-text)]" role="status">
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
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-md-text font-semibold py-2.5 px-8 rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
          >
            {isSavingProfile ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
