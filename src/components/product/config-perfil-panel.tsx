"use client";

import { IdeologicalSpectrumSlider } from "@/components/product/persona-shared";
import { useProductApp } from "@/components/product/provider";

export function ConfigPerfilPanel() {
  const { profileForm, setProfileForm, saveProfile, isSavingProfile } = useProductApp();

  async function handleSave() {
    try {
      await saveProfile({ allowDraftDefaults: true, throwOnError: true });
    } catch {
      // Erro exibido pelo provider.
    }
  }

  return (
    <div data-testid="config-panel-perfil">
      <p className="persona-helper-text">
        Identidade pública e tom de voz. Avatar e materiais de vídeo ficam na seção Avatar.
      </p>

      <div className="persona-form-group persona-top-gap">
        <label className="persona-label">
          Nome completo
          <input
            className="persona-input-control persona-top-gap"
            value={profileForm.fullName}
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, fullName: event.target.value }))
            }
          />
        </label>

        <label className="persona-label persona-top-gap">
          Cargo
          <input
            className="persona-input-control persona-top-gap"
            value={profileForm.role}
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, role: event.target.value }))
            }
          />
        </label>

        <div className="persona-mock-two-column persona-top-gap">
          <label className="persona-label">
            Cidade
            <input
              className="persona-input-control persona-top-gap"
              value={profileForm.city}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, city: event.target.value }))
              }
            />
          </label>
          <label className="persona-label">
            Estado (UF)
            <input
              className="persona-input-control persona-top-gap"
              value={profileForm.state}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, state: event.target.value }))
              }
              maxLength={2}
            />
          </label>
        </div>

        <label className="persona-label persona-top-gap">
          Bio curta
          <textarea
            className="persona-input-control persona-top-gap"
            value={profileForm.bio}
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, bio: event.target.value }))
            }
            rows={3}
          />
        </label>
      </div>

      <div className="persona-form-group persona-top-gap">
        <label className="persona-label">
          Posicionamento ideológico <span className="persona-badge">Obrigatório</span>
        </label>
        <p className="persona-helper-text">
          Calibra o tom dos roteiros entre esquerda e direita. O centro representa posicionamento
          moderado.
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
      </div>

      <div className="persona-form-group persona-top-gap">
        <label className="persona-label">Glossário de expressões</label>
        <p className="persona-helper-text">
          Características da sua fala — por exemplo: né, tipo, entendeu, sabe, tá, ok, certo.
        </p>
        <textarea
          className="persona-input-control persona-top-gap"
          value={profileForm.glossaryTerms ?? ""}
          onChange={(event) =>
            setProfileForm((current) => ({
              ...current,
              glossaryTerms: event.target.value,
            }))
          }
          placeholder="Digite suas expressões, separadas por vírgula..."
        />
      </div>

      <div className="persona-cta-row persona-top-gap">
        <button
          type="button"
          className="persona-btn persona-btn-large"
          onClick={() => void handleSave()}
          disabled={isSavingProfile}
          data-testid="config-save-perfil"
        >
          {isSavingProfile ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}
