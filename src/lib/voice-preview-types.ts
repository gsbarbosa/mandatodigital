export type VoicePreviewSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

export type VoicePreviewItem = {
  id: string;
  label: string;
  description: string;
  storagePath: string;
  audioUrl: string;
  voiceSettings: VoicePreviewSettings;
};

export type ProfileVoiceSelection = {
  profileId: string;
  voiceAudioAssetId: string;
  elevenLabsVoiceId: string;
  selectedPreviewId: string | null;
  previews: VoicePreviewItem[];
  previewScript: string;
  createdAt: string;
  updatedAt: string;
};
