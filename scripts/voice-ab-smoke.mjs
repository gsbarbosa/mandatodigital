#!/usr/bin/env node
/**
 * Checklist A/B voz (Fase 3.3) — smoke manual em staging.
 *
 * Uso:
 *   node scripts/voice-ab-smoke.mjs
 *
 * Critérios (preencher após 1 vídeo caricatura 1080p em cada path):
 *   A) HEYGEN_VOICE_PROVIDER=heygen_clone
 *   B) HEYGEN_VOICE_PROVIDER=elevenlabs_audio
 */

console.log(`
=== Voice A/B smoke (Mandato Digital / Fase 3.3) ===

Pre-req staging:
  - ELEVENLABS_API_KEY secret liberado no App Hosting
  - HEYGEN_VOICE_PROVIDER=elevenlabs_audio (apphosting.yaml)
  - Fallback testavel: setar heygen_clone e redeploy

Checklist por path (A heygen_clone | B elevenlabs_audio):
  [ ] Lip-sync caricatura 1080p aceitavel
  [ ] Latencia E2E medida (B <= ~1.5x A, ou justificado)
  [ ] Custo observado (wallet HeyGen vs chars ElevenLabs)
  [ ] Escala: B nao toca cota de 10 clones HeyGen

Flip OK → manter elevenlabs_audio no stg; prod so apos OK.
Fallback: HEYGEN_VOICE_PROVIDER=heygen_clone
`);
