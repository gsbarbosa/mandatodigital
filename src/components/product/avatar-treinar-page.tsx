"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { AvatarImageCropModal } from "@/components/product/avatar-image-crop-modal";
import { useProductApp } from "@/components/product/provider";
import type { AvatarTipo } from "@/lib/avatar-tipos";
import type { TrainingAssetRole } from "@/lib/types";

const VOICE_SCRIPT =
  "“Olá! Eu estou gravando este áudio para treinar a minha voz na plataforma Mandato Digital. O nosso objetivo aqui é garantir que a minha comunicação chegue a cada cidadão do nosso estado, com clareza, verdade e muita energia. Eu acredito que a política precisa de inovação e, acima de tudo, de coragem para mudar o que não está funcionando. Durante a nossa caminhada, vamos enfrentar grandes desafios, mas eu estou preparado para ouvir as pessoas, propor soluções reais e trabalhar incansavelmente. Peço que a inteligência artificial capture o tom da minha voz, o meu sotaque e a minha determinação. Vamos juntos construir um futuro melhor para todos!”";

function latestAssetName(
  assets: Array<{ trainingRole: TrainingAssetRole; originalFilename: string; createdAt: string }>,
  role: TrainingAssetRole,
) {
  const found = [...assets]
    .filter((asset) => asset.trainingRole === role)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return found?.originalFilename ?? null;
}

export function AvatarTreinarPage({ tipo }: { tipo: AvatarTipo }) {
  const router = useRouter();
  const {
    trainingAssets,
    uploadTrainingAssets,
    isUploadingAvatarImageAsset,
    isUploadingVoiceAudioAsset,
    isUploadingTrainingVideoAsset,
  } = useProductApp();

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isGemeo = tipo.slug === "gemeo-digital";
  const hubHref = `/avatares/${tipo.slug}` as Route;

  const photoName = useMemo(() => latestAssetName(trainingAssets, "avatar_image"), [trainingAssets]);
  const audioName = useMemo(() => latestAssetName(trainingAssets, "voice_audio"), [trainingAssets]);
  const videoName = useMemo(() => latestAssetName(trainingAssets, "dataset"), [trainingAssets]);

  async function handleUpload(file: File | null | undefined, role: TrainingAssetRole, label: string) {
    if (!file) {
      return;
    }
    setUploadMessage(null);
    const uploaded = await uploadTrainingAssets([file], role);
    if (uploaded.length) {
      setUploadMessage(`${label} enviado com sucesso.`);
      window.setTimeout(() => setUploadMessage(null), 4200);
    }
  }

  return (
    <div className="min-h-full relative pb-24">
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed top-[20%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Treinar {tipo.label === "3D" ? "Avatar 3D" : tipo.label}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Envie a foto e a voz que alimentam o treinamento do seu avatar.
            {tipo.caricatureVariant
              ? " A versão caricata/3D é gerada a partir da sua foto na tela de criação de conteúdo."
              : ""}
          </p>
        </header>

        <section className="bg-slate-900/40 border border-slate-700/80 rounded-[2rem] p-6 md:p-10 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            {/* FOTO */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-white">A Foto Perfeita</h4>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Para movimentos naturais e ultra-realistas, siga estas regras rígidas:
              </p>

              <ul className="space-y-3 text-sm text-slate-300 flex-grow mb-6">
                <li className="flex items-start gap-2"><span className="text-cyan-500">☀️</span> <span><strong>Iluminação é tudo:</strong> Luz uniforme no rosto, de frente para a luz. Sem sombras.</span></li>
                <li className="flex items-start gap-2"><span className="text-cyan-500">😐</span> <span><strong>Expressão neutra ou sorriso leve:</strong> Lábios fechados. Sem mostrar dentes para não distorcer a fala.</span></li>
                <li className="flex items-start gap-2"><span className="text-cyan-500">👁️</span> <span><strong>Olhe para a lente:</strong> O avatar precisa fazer contato visual direto.</span></li>
                <li className="flex items-start gap-2"><span className="text-cyan-500">⬛</span> <span><strong>Fundo limpo:</strong> Parede de cor sólida, sem objetos ou pessoas atrás.</span></li>
                <li className="flex items-start gap-2"><span className="text-cyan-500">🖼️</span> <span><strong>Enquadramento:</strong> Estilo 3x4 (peito para cima). Não corte topo da cabeça ou laterais.</span></li>
              </ul>

              <div className="mt-auto">
                <label className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-xl cursor-pointer bg-slate-800/30 transition-colors group">
                  <svg className="h-8 w-8 text-slate-500 group-hover:text-cyan-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                    {isUploadingAvatarImageAsset ? "Enviando imagem..." : "Fazer Upload de Imagem"}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">JPG, PNG (Max. 10MB)</span>
                  <input
                    ref={photoInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={isUploadingAvatarImageAsset}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setPendingPhoto(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </label>
                {photoName ? (
                  <p className="text-[11px] text-emerald-400 mt-2">Foto atual: {photoName}</p>
                ) : null}
              </div>
            </div>

            {/* VOZ */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-white">Clonagem de Voz</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Grave a cerca de 15-20cm do microfone, levemente inclinado para o lado.{" "}
                <strong>Silêncio absoluto no fundo.</strong>
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 overflow-y-auto max-h-40 flex-grow relative">
                <span className="absolute top-0 right-0 bg-slate-800 text-[9px] text-slate-300 px-2 py-1 rounded-bl-lg font-bold">
                  ROTEIRO OBRIGATÓRIO
                </span>
                <p className="text-sm text-slate-300 italic pt-2">{VOICE_SCRIPT}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 mb-4">
                <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Ritmo Natural</div>
                <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Respire Normalmente</div>
                <div className="flex items-center gap-1"><span className="text-red-400">✕</span> Sem Ruído de Fundo</div>
                <div className="flex items-center gap-1"><span className="text-red-400">✕</span> Sem Gaguejar (Cacoetes)</div>
              </div>

              <div className="mt-auto">
                <label className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-xl cursor-pointer bg-slate-800/30 transition-colors group">
                  <svg className="h-8 w-8 text-slate-500 group-hover:text-purple-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                    {isUploadingVoiceAudioAsset ? "Enviando áudio..." : "Fazer Upload de Áudio"}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">MP3, WAV (Até 2 minutos)</span>
                  <input
                    ref={audioInputRef}
                    type="file"
                    className="hidden"
                    accept="audio/*"
                    disabled={isUploadingVoiceAudioAsset}
                    onChange={(event) => {
                      void handleUpload(event.target.files?.[0], "voice_audio", "Áudio de voz");
                      event.target.value = "";
                    }}
                  />
                </label>
                {audioName ? (
                  <p className="text-[11px] text-emerald-400 mt-2">Áudio atual: {audioName}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* VÍDEO DE TREINO — exigido pelo treino real do Gêmeo Digital */}
          {isGemeo ? (
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-white">Vídeo de Treinamento do Gêmeo</h4>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Vídeo de 2 a 5 minutos, olhando para a câmera, com boa iluminação — é ele que treina
                o realismo do seu Gêmeo Digital.
              </p>
              <label className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-xl cursor-pointer bg-slate-800/30 transition-colors group">
                <svg className="h-8 w-8 text-slate-500 group-hover:text-cyan-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                  {isUploadingTrainingVideoAsset ? "Enviando vídeo..." : "Fazer Upload de Vídeo"}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">MP4, MOV (2 a 5 minutos)</span>
                <input
                  ref={videoInputRef}
                  type="file"
                  className="hidden"
                  accept="video/*"
                  disabled={isUploadingTrainingVideoAsset}
                  onChange={(event) => {
                    void handleUpload(event.target.files?.[0], "dataset", "Vídeo de treinamento");
                    event.target.value = "";
                  }}
                />
              </label>
              {videoName ? (
                <p className="text-[11px] text-emerald-400 mt-2">Vídeo atual: {videoName}</p>
              ) : null}
            </div>
          ) : null}

          {uploadMessage ? (
            <p className="text-sm text-emerald-400 mb-6" role="status">
              {uploadMessage}
            </p>
          ) : null}

          {/* CONSENTIMENTO */}
          <div className="bg-[#0F1623] border border-cyan-900/50 rounded-xl p-5">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Termos de Treinamento de IA e Propaganda Eleitoral
            </h4>
            <div className="text-[11px] text-slate-400 space-y-2 mb-4 pr-4">
              <p>
                Ao prosseguir, autorizo o Mandato Digital a tratar minha imagem e voz para a
                finalidade exclusiva de treinamento de modelos de Inteligência Artificial e criação
                de avatares personalizados.
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Finalidade:</strong> Criação do meu &apos;Gêmeo Digital&apos; para uso em propaganda eleitoral.</li>
                <li><strong>Segurança:</strong> Meus dados biométricos serão criptografados e utilizados exclusivamente para este fim.</li>
                <li><strong>Direito de Exclusão:</strong> Posso solicitar a exclusão total dos meus dados e do modelo de IA criado a qualquer momento, o que resultará na interrupção imediata dos serviços.</li>
              </ul>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="accent-cyan-500 h-5 w-5 rounded border-slate-600 bg-slate-900 cursor-pointer"
              />
              <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Li e aceito os termos da Política de Privacidade
              </span>
            </label>
          </div>

          <div className="mt-8">
            <button
              type="button"
              disabled={!consentAccepted}
              onClick={() => router.push(hubHref)}
              className={
                consentAccepted
                  ? "w-full block text-center bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold py-4 px-4 rounded-xl btn-transition shadow-[0_4px_20px_rgba(168,85,247,0.25)] hover:shadow-[0_6px_25px_rgba(168,85,247,0.35)] focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg"
                  : "w-full block text-center bg-slate-700 text-slate-400 font-bold py-4 px-4 rounded-xl transition-all cursor-not-allowed"
              }
            >
              Concluir envio e voltar ao avatar
            </button>
          </div>
        </section>
      </main>

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
