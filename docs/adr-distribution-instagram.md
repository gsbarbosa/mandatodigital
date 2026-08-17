# ADR: Distribuidor via Instagram Graph

Status: **accepted** (2026-08-16)

Substitui [adr-distribution-ayrshare.md](archive/adr-distribution-ayrshare.md) neste recorte.

## Contexto

O Publicador precisa publicar o vídeo selado. O recorte atual é **somente Instagram Reels**,
via API da Meta (Instagram Login / Graph em `graph.instagram.com`). Ayrshare sai do caminho
quente: o contrato `SocialPublisher` permanece, com adapter `InstagramGraphPublisher`.

## Decisão

1. **Publisher** `InstagramGraphPublisher` em `src/lib/distribution/providers/instagram-publisher.ts`.
2. **OAuth Instagram Login** (`instagram_business_basic` + `instagram_business_content_publish`);
   callback em `/api/distribution/instagram/callback` (URI já cadastrada na Meta).
3. **Token** criptografado em `socialConnections` (`encryptProviderSecret`). Fallback local de
   smoke: `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_IG_USER_ID` (não vai para o Git).
4. **Jobs** inalterados: `publish_post` → worker cria container REELS, espera `FINISHED`,
   `media_publish`. Graph não agenda: `scheduledAt` futuro marca `scheduled` e não posta agora.
5. **Flags:** em staging `DISTRIBUTION_ENABLED` e `DISTRIBUTION_PUBLISH_ENABLED` ligados
   para smoke. Produção permanece fail-closed até promover `staging` → `main`.
6. **Canais:** a UI lista as 7 redes. Só o Instagram conecta e publica
   (`ACTIVE_DISTRIBUTION_CHANNEL_IDS = ["instagram"]` no OAuth, create post e worker).

## Consequências

- App Review da Meta (screencast + 1 publish real) continua **depois** do smoke no
  `@mandatodigital.app` (tester). Gabinetes que não são testers só depois do review.
- `videoUrl` precisa ser URL que os servidores da Meta consigam baixar. O worker
  **renova a URL assinada do Storage** na hora do publish (GCS v4 expira em 7 dias).
- Ayrshare permanece no repo como legado, fora do factory `getSocialPublisher()`.

## Fluxo

```
Criativo (videoUrl selado)
  → POST /api/distribution/posts
  → UI /distribuidor Go/No-go
  → POST .../approve (gates)
  → asyncJobs publish_post
  → worker → Instagram Graph (Reels)
  → perChannelStatus + distributionAuditLog
```
