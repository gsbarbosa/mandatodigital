"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AvatarCameraCapture } from "@/components/product/avatar-camera-capture";
import { AvatarImageCropModal } from "@/components/product/avatar-image-crop-modal";
import { AvatarVoicePreviewPicker } from "@/components/product/avatar-voice-preview-picker";
import { AvatarVoiceRecorder } from "@/components/product/avatar-voice-recorder";
import { useOnboarding } from "@/components/product/onboarding-provider";
import { ProductPageHeader } from "@/components/product/product-page-header";
import { trainingAssetFileUrl } from "@/components/product/persona-shared";
import { useProductApp } from "@/components/product/provider";
import type { AvatarTipo } from "@/lib/avatar-tipos";
import type { ProfileTrainingAsset, TrainingAssetRole } from "@/lib/types";

const VOICE_SCRIPT =
  "“Olá! Eu estou gravando este áudio para treinar a minha voz na plataforma Mandato Digital. O nosso objetivo aqui é garantir que a minha comunicação chegue a cada cidadão do nosso estado, com clareza, verdade e muita energia. Eu acredito que a política precisa de inovação e, acima de tudo, de coragem para mudar o que não está funcionando. Durante a nossa caminhada, vamos enfrentar grandes desafios, mas eu estou preparado para ouvir as pessoas, propor soluções reais e trabalhar incansavelmente. Peço que a inteligência artificial capture o tom da minha voz, o meu sotaque e a minha determinação. Vamos juntos construir um futuro melhor para todos!”";

function trainConsentStorageKey(profileId: string) {
  return `mandato:avatar-train-consent:${profileId}`;
}

function latestAsset(
  assets: ProfileTrainingAsset[],
  role: TrainingAssetRole,
) {
  return [...assets]
    .filter((asset) => asset.trainingRole === role)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

export function AvatarTreinarPage({ tipo }: { tipo: AvatarTipo }) {
  const router = useRouter();
  const {
    profile,
    profileForm,
    trainingAssets,
    uploadTrainingAssets,
    isUploadingAvatarImageAsset,
    isUploadingVoiceAudioAsset,
  } = useProductApp();
  const { guideOpen, guideStepId, markStepDone } = useOnboarding();

  const profileId = profile?.id ?? profileForm.id ?? null;
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [selectedVoicePreviewId, setSelectedVoicePreviewId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [localAudioPreviewUrl, setLocalAudioPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const hubHref = `/avatares/${tipo.slug}` as Route;

  const latestPhoto = useMemo(
    () => latestAsset(trainingAssets, "avatar_image"),
    [trainingAssets],
  );
  const latestVoice = useMemo(
    () => latestAsset(trainingAssets, "voice_audio"),
    [trainingAssets],
  );
  const photoName = latestPhoto?.originalFilename ?? null;
  const audioName = latestVoice?.originalFilename ?? null;
  const audioPlaybackSrc =
    localAudioPreviewUrl ?? (latestVoice ? trainingAssetFileUrl(latestVoice.id) : null);

  useEffect(() => {
    return () => {
      if (localAudioPreviewUrl) {
        URL.revokeObjectURL(localAudioPreviewUrl);
      }
    };
  }, [localAudioPreviewUrl]);

  function setAudioPreviewFromFile(file: File) {
    setLocalAudioPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return URL.createObjectURL(file);
    });
  }

  useEffect(() => {
    if (!profileId || typeof window === "undefined") {
      return;
    }
    try {
      setConsentAccepted(window.localStorage.getItem(trainConsentStorageKey(profileId)) === "1");
    } catch {
      // ignore storage errors
    }
  }, [profileId]);

  function persistConsent(next: boolean) {
    setConsentAccepted(next);
    if (!profileId || typeof window === "undefined") {
      return;
    }
    try {
      const key = trainConsentStorageKey(profileId);
      if (next) {
        window.localStorage.setItem(key, "1");
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
  }

  function openPendingPhoto(file: File | null | undefined) {
    if (!file) {
      return;
    }
    // Foto e áudio são biometria: nada sai do dispositivo antes do aceite dos termos.
    if (!consentAccepted) {
      setUploadMessage("Aceite os termos de treinamento antes de enviar foto ou áudio.");
      return;
    }
    setPendingPhoto(file);
  }

  async function handleUpload(file: File | null | undefined, role: TrainingAssetRole, label: string) {
    if (!file) {
      return;
    }
    if (!consentAccepted) {
      setUploadMessage("Aceite os termos de treinamento antes de enviar foto ou áudio.");
      return;
    }
    setUploadMessage(null);
    const uploaded = await uploadTrainingAssets([file], role);
    if (uploaded.length) {
      setUploadMessage(`${label} enviado com sucesso.`);
      window.setTimeout(() => setUploadMessage(null), 4200);
      // Áudio enviado: fecha o passo e leva o tip para Persona (/curador),
      // senão o provider só avança o guideStepId sem mudar a rota.
      if (role === "voice_audio" && guideOpen && guideStepId === "avatar-audio") {
        markStepDone("avatar-audio");
        router.push("/curador#persona" as Route);
      }
    }
  }

  return (
    <div className="min-h-full relative pb-24">
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-[20%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <ProductPageHeader
          title={`Treinar ${tipo.label === "3D" ? "Avatar 3D" : tipo.label}`}
          description={
            <>
              Envie a foto e a voz que alimentam o treinamento do seu avatar.
              {tipo.caricatureVariant
                ? " A versão caricata/3D é gerada a partir da sua foto na tela de criação de conteúdo."
                : ""}
              <span className="mt-3 block text-amber-300">
                Aceite os termos abaixo para liberar o envio de foto e áudio.
              </span>
            </>
          }
        />

        <section className="bg-md-surface/40 border border-md-border rounded-[2rem] p-6 md:p-10 shadow-2xl backdrop-blur-xl">
          <p className="text-sm text-md-text-muted mb-6">
            Quanto melhor a qualidade da foto e do áudio, mais realistas os avatares.
          </p>

          <div className="flex flex-col gap-6 mb-8">
            {/* FOTO */}
            <div
              id="foto"
              data-onboarding-anchor="avatar-foto"
              className="bg-md-surface/60 border border-md-border rounded-2xl p-6 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-md-text">A Foto Perfeita</h4>
              </div>

              <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-8">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-md-text-soft mb-4">
                    Para movimentos naturais e ultra-realistas, siga estas regras rígidas:
                  </p>
                  <ul className="space-y-3 text-xs text-md-text-soft list-none pl-0 ml-0">
                    <li className="flex items-start gap-2"><span className="text-[var(--sentinela-text)]">✓</span> <span>Iluminação é tudo: Luz uniforme no rosto, de frente para a luz. Sem sombras.</span></li>
                    <li className="flex items-start gap-2"><span className="text-[var(--sentinela-text)]">✓</span> <span>Expressão neutra ou sorriso leve: Lábios fechados. Sem mostrar dentes para não distorcer a fala.</span></li>
                    <li className="flex items-start gap-2"><span className="text-[var(--sentinela-text)]">✓</span> <span>Olhe para a lente: O avatar precisa fazer contato visual direto.</span></li>
                    <li className="flex items-start gap-2"><span className="text-[var(--sentinela-text)]">✓</span> <span>Enquadramento: Estilo 3x4 (peito para cima). Não corte topo da cabeça ou laterais.</span></li>
                  </ul>
                </div>

                <div className="md:w-[min(100%,20rem)] md:shrink-0 flex flex-col justify-center space-y-3">
                  <button
                    type="button"
                    disabled={!consentAccepted || isUploadingAvatarImageAsset}
                    onClick={() => {
                      if (!consentAccepted) {
                        setUploadMessage(
                          "Aceite os termos de treinamento antes de enviar foto ou áudio.",
                        );
                        return;
                      }
                      setCameraOpen(true);
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      !consentAccepted || isUploadingAvatarImageAsset
                        ? "cursor-not-allowed border-md-border opacity-50 text-md-text-soft"
                        : "border-[var(--curador-border)] bg-[var(--curador-soft)] text-[var(--curador-text)] hover:opacity-90"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Tirar foto com a câmera
                  </button>

                  <label
                    className={`w-full flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl bg-md-overlay-subtle transition-colors group ${
                      !consentAccepted || isUploadingAvatarImageAsset
                        ? "border-md-border opacity-50 cursor-not-allowed"
                        : "border-md-border-hover hover:border-cyan-500 cursor-pointer"
                    }`}
                  >
                    <svg className="h-8 w-8 text-md-text-soft group-hover:text-[var(--curador-text)] mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm font-medium text-md-text-muted group-hover:text-md-text">
                      {isUploadingAvatarImageAsset ? "Enviando imagem..." : "Escolher imagem da galeria"}
                    </span>
                    <span className="text-[10px] text-md-text-soft mt-1">JPG, PNG (Max. 10MB)</span>
                    <input
                      ref={photoInputRef}
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                      disabled={!consentAccepted || isUploadingAvatarImageAsset}
                      onChange={(event) => {
                        openPendingPhoto(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {photoName ? (
                    <p className="text-[11px] text-[var(--sentinela-text)]">Foto atual: {photoName}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* VOZ */}
            <div
              id="audio"
              data-onboarding-anchor="avatar-audio"
              className="bg-md-surface/60 border border-md-border rounded-2xl p-6 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-md-text">A Voz Perfeita</h4>
              </div>

              <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-8">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-md-text-soft mb-3">
                    Para uma voz idêntica à do Candidato, o áudio precisa ter:
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-md-text-soft mb-4">
                    <div className="flex items-center gap-1"><span className="text-[var(--sentinela-text)]">✓</span> Ritmo natural, 30s a 2 min</div>
                    <div className="flex items-center gap-1"><span className="text-[var(--sentinela-text)]">✓</span> Gravador nativo do celular (WAV/M4A/MP3)</div>
                    <div className="flex items-center gap-1"><span className="text-[var(--sentinela-text)]">✓</span> Ambiente silencioso, 15–20 cm do microfone</div>
                    <div className="flex items-center gap-1"><span className="text-red-400">✕</span> Áudio de WhatsApp</div>
                    <div className="flex items-center gap-1"><span className="text-red-400">✕</span> Ruído de fundo, eco ou fone de ligação</div>
                  </div>

                  <p className="text-xs text-md-text-soft mb-3">
                    O melhor resultado vem de um arquivo do gravador do iPhone ou Android, não de
                    nota de voz do WhatsApp. Se preferir, grave aqui na tela com o roteiro abaixo.
                  </p>

                  <div className="bg-md-bg p-4 rounded-xl border border-md-border overflow-y-auto max-h-40">
                    <p className="text-sm text-md-text-muted italic">{VOICE_SCRIPT}</p>
                  </div>
                </div>

                <div className="md:w-[min(100%,20rem)] md:shrink-0 flex flex-col justify-center space-y-3">
                  <AvatarVoiceRecorder
                    disabled={!consentAccepted}
                    busy={isUploadingVoiceAudioAsset}
                    onRecorded={(file) => {
                      setAudioPreviewFromFile(file);
                      void handleUpload(file, "voice_audio", "Áudio de voz");
                    }}
                  />

                  <label
                    className={`w-full flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl bg-md-overlay-subtle transition-colors group ${
                      !consentAccepted || isUploadingVoiceAudioAsset
                        ? "border-md-border opacity-50 cursor-not-allowed"
                        : "border-md-border-hover hover:border-purple-500 cursor-pointer"
                    }`}
                  >
                    <svg className="h-8 w-8 text-md-text-soft group-hover:text-purple-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span className="text-sm font-medium text-md-text-muted group-hover:text-md-text">
                      {isUploadingVoiceAudioAsset ? "Enviando áudio..." : "Enviar arquivo de áudio"}
                    </span>
                    <span className="text-[10px] text-md-text-soft mt-1">
                      Prefira WAV, M4A ou MP3 (até 2 min). Evite WhatsApp.
                    </span>
                    <input
                      ref={audioInputRef}
                      type="file"
                      className="hidden"
                      accept="audio/*,.opus,.ogg"
                      disabled={!consentAccepted || isUploadingVoiceAudioAsset}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setAudioPreviewFromFile(file);
                          void handleUpload(file, "voice_audio", "Áudio de voz");
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {audioPlaybackSrc ? (
                    <div className="rounded-xl border border-md-border bg-md-overlay-subtle p-3 space-y-2">
                      <p className="text-[11px] font-medium text-md-text-muted break-words">
                        Ouvir áudio {audioName ? `· ${audioName}` : "enviado"}
                      </p>
                      <audio
                        key={audioPlaybackSrc}
                        controls
                        src={audioPlaybackSrc}
                        className="w-full"
                        preload="metadata"
                      />
                    </div>
                  ) : audioName ? (
                    <p className="text-[11px] text-[var(--sentinela-text)] break-words">Áudio atual: {audioName}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <AvatarVoicePreviewPicker
              profileId={profileId}
              voiceAudioAssetId={latestVoice?.id ?? null}
              consentAccepted={consentAccepted}
              uploading={isUploadingVoiceAudioAsset}
              onMessage={setUploadMessage}
              onSelectedPreviewChange={setSelectedVoicePreviewId}
            />
          </div>

          {/* CONSENTIMENTO — exigido antes do upload */}
          <div className="bg-md-surface border border-cyan-900/50 rounded-xl p-5 mb-8">
            <h4 className="text-sm font-bold text-md-text mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Termos de Treinamento de IA e Propaganda Eleitoral
            </h4>
            <div className="text-[11px] text-md-text-soft space-y-2 mb-4 pr-4">
              <p>
                Ao prosseguir, autorizo o Mandato Digital a tratar minha imagem e voz para a
                finalidade exclusiva de treinamento de modelos de Inteligência Artificial e criação
                de avatares personalizados.
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Finalidade:</strong> Criação de avatares por foto e voz para uso em propaganda eleitoral.</li>
                <li><strong>Segurança:</strong> Meus dados biométricos serão criptografados e utilizados exclusivamente para este fim.</li>
                <li><strong>Direito de Exclusão:</strong> Posso solicitar a exclusão total dos meus dados e do modelo de IA criado a qualquer momento, o que resultará na interrupção imediata dos serviços.</li>
                <li><strong>Titularidade da voz e imagem:</strong> O avatar só pode falar em nome do titular deste consentimento — nunca em nome de terceiros, pessoas falecidas ou personas fictícias.</li>
                <li><strong>Cessão de uso:</strong> Cedo à plataforma Mandato Digital o uso da minha imagem e voz para fins de treinamento do modelo de IA e geração dos vídeos do avatar.</li>
                <li><strong>Rotulagem TSE:</strong> Estou ciente de que todo material gerado recebe selo e metadados de conteúdo por Inteligência Artificial, conforme Res. TSE 23.610/19 e 23.755/26.</li>
                <li><strong>Declaração do operador:</strong> Se eu não for o titular da imagem/voz enviada, declaro possuir autorização expressa do titular para realizar este treinamento em seu nome.</li>
              </ul>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => persistConsent(event.target.checked)}
                className="accent-cyan-500 h-5 w-5 rounded border-md-border-hover bg-md-surface cursor-pointer"
              />
              <span className="text-sm font-semibold text-md-text group-hover:text-[var(--curador-text)] transition-colors">
                Li e aceito os termos da Política de Privacidade
              </span>
            </label>
            {!consentAccepted ? (
              <p className="mt-3 text-xs text-amber-300/90">
                Aceite os termos para liberar o envio de foto e áudio.
              </p>
            ) : !selectedVoicePreviewId ? (
              <p className="mt-3 text-xs text-amber-300/90">
                Selecione uma das prévias em “Usar esta voz” para concluir o envio.
              </p>
            ) : null}
          </div>

          {uploadMessage ? (
            <p
              className={`text-sm mb-6 ${
                uploadMessage.startsWith("Aceite") ? "text-amber-300/90" : "text-[var(--sentinela-text)]"
              }`}
              role="status"
            >
              {uploadMessage}
            </p>
          ) : null}

          <div className="mt-8">
            <button
              type="button"
              disabled={!consentAccepted || !selectedVoicePreviewId}
              onClick={() => router.push(hubHref)}
              className={
                consentAccepted && selectedVoicePreviewId
                  ? "w-full block text-center bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-md-text font-bold py-4 px-4 rounded-xl btn-transition shadow-[0_4px_20px_rgba(168,85,247,0.25)] hover:shadow-[0_6px_25px_rgba(168,85,247,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg"
                  : "w-full block text-center bg-slate-700 text-md-text-soft font-bold py-4 px-4 rounded-xl transition-all cursor-not-allowed"
              }
            >
              Concluir envio e voltar ao avatar
            </button>
          </div>
        </section>
      </main>

      {cameraOpen ? (
        <AvatarCameraCapture
          onCaptured={(file) => {
            setCameraOpen(false);
            openPendingPhoto(file);
          }}
          onCancel={() => setCameraOpen(false)}
        />
      ) : null}

      {pendingPhoto ? (
        <AvatarImageCropModal
          file={pendingPhoto}
          onConfirm={(croppedFile) => {
            setPendingPhoto(null);
            void handleUpload(croppedFile, "avatar_image", "Foto do avatar");
          }}
          onCancel={() => setPendingPhoto(null)}
        />
      ) : null}
    </div>
  );
}
