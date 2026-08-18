/**
 * Captura para clone de voz (IVC).
 * echoCancellation / noiseSuppression / autoGainControl são otimizados para
 * ligação VoIP e achatam o timbre que a clonagem precisa preservar.
 */
export const VOICE_RECORDER_AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
} as const;

/** Bitrate alvo do MediaRecorder — default do browser costuma ficar no nível WhatsApp. */
export const VOICE_RECORDER_AUDIO_BITS_PER_SECOND = 128_000;
