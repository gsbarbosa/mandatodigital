# ADR: Distribuidor via Ayrshare

Status: **superseded** (2026-08-16) — ver [adr-distribution-instagram.md](../adr-distribution-instagram.md).

O recorte ativo do Publicador passou a ser Instagram-only via Graph (Instagram Login).
Este ADR permanece como histórico da decisão de 2026-07-28.

---

Status original: **accepted** (2026-07-28)

## Contexto

O Agente Distribuidor precisa publicar vídeo selado nas sete redes do marketing
(Instagram, Facebook, TikTok, YouTube Shorts, Threads, LinkedIn, X) com Go/No-go
humano, agendamento e blackout eleitoral. Integrações first-party (Meta Graph,
TikTok Content Posting, YouTube Data, X, LinkedIn) exigem App Review longo e
OAuth por rede — risco operacional alto para o mesmo resultado de produto.

## Decisão

1. **Publisher pluggável** (`SocialPublisher`) com implementação
   `AyrsharePublisher` em `src/lib/distribution/providers/`.
2. **Ayrshare Business** (multi-profile): 1 profile key por `politicianProfile`;
   JWT SSO para o usuário conectar redes; `/post` + webhook de status.
3. **Jobs** no padrão existente: tipo `publish_post`, topic `md-jobs-publish`,
   worker `POST /api/workers/publish` (ver [adr-async-jobs-pubsub.md](../adr-async-jobs-pubsub.md)).
4. **Flags fail-closed:** `DISTRIBUTION_ENABLED` (UI/APIs) e
   `DISTRIBUTION_PUBLISH_ENABLED` (enqueue real).
5. **Gates:** vídeo selado, contas conectadas, blackout 72h/24h, fact-check
   rejeitado bloqueia Go quando `AUDITOR_FACTCHECK_ENABLED`.

## Consequências

- Domínio Mandato não importa SDK Ayrshare fora de `ayrshare-client` / provider.
- Troca futura para API direta = novo adapter `SocialPublisher`, sem reescrever
  fila/UI.
- Custo Ayrshare por profile ativo; secrets: `AYRSHARE_API_KEY`,
  `AYRSHARE_DOMAIN`, `AYRSHARE_PRIVATE_KEY`, `AYRSHARE_WEBHOOK_SECRET`.
- WhatsApp / Kwai fora de escopo (APIs distintas).

## Fluxo

```
Criativo (videoUrl selado)
  → POST /api/distribution/posts
  → UI /distribuidor Go/No-go
  → POST .../approve (gates)
  → asyncJobs publish_post
  → worker → Ayrshare → redes
  → webhook → perChannelStatus + distributionAuditLog
```
