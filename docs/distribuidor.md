# Distribuidor (Publicador)

Spec viva do Agente Distribuidor: publicação do vídeo selado com Go/No-go
humano, agendamento e blackout eleitoral. O recorte ativo é **Instagram Reels
via Graph** — decisão em [adr-distribution-instagram.md](adr-distribution-instagram.md).
O caminho Ayrshare permanece no repo como legado, fora do factory
`getSocialPublisher()`; histórico em
[archive/adr-distribution-ayrshare.md](archive/adr-distribution-ayrshare.md).

## Fluxo

```
Criativo (vídeo selado)
  → POST /api/distribution/posts        (cria pacote + adapta captions por rede)
  → /distribuidor  fila Go/No-go
  → POST .../approve                    (gates: conectado, blackout, fact-check)
  → asyncJob publish_post → /api/workers/publish
  → re-assina a URL da mídia → Instagram Graph (container REELS → media_publish)
  → perChannelStatus + distributionAuditLog
```

## Acesso: recurso de assinante

O Publicador **inteiro** — inclusive a pré-visualização — é exclusivo de conta
com plano pago. Qualquer plano serve (Essencial, Avançado ou Elite); trial não
entra, e inadimplente perde o acesso porque `resolveAccountTierFromBilling`
rebaixa `past_due`/`pending_payment` para trial. Regra em
`canUsePublisher` ([account-tier.ts](../src/lib/account-tier.ts)), gate de
servidor em [access.ts](../src/lib/distribution/access.ts).

Todas as rotas de distribuição respondem **402** para não-assinante. A única
exceção é `GET /connections`, que responde 200 com `subscribed: false` — é por
ela que a tela sabe que deve renderizar o upsell em vez de erro.

## Modo real x pré-visualização

Quem decide é **o servidor**, não a flag pública do bundle. A tela chama
`GET /api/distribution/connections`:

| Resposta | Modo | Comportamento |
|---|---|---|
| `subscribed: false` | paywall | upsell com CTA para `/acesso-antecipado/planos` |
| `enabled: true` | real | fila, aprovação, conexão OAuth e disparo via API |
| `enabled: false`, 401 ou erro de rede | pré-visualização | store local (`demo-store.ts`), disparo simulado no navegador |

`enabled` = `DISTRIBUTION_ENABLED` **e** Instagram configurado
(`isInstagramConfigured`: `INSTAGRAM_APP_ID`/`SECRET`, ou o fallback de smoke
`INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_IG_USER_ID`). O envio do criativo
(`criativo-list-page`) segue a mesma regra: `503` da API cai no store local. Na
pré-visualização o botão **Conectar redes** vincula os canais localmente — sem
isso o Go da fila falharia sempre ("conecte ao menos uma rede").

## Canais

A UI lista as 7 redes, mas só o Instagram conecta e publica
(`ACTIVE_DISTRIBUTION_CHANNEL_IDS = ["instagram"]` no OAuth, na criação do
pacote e no worker). As outras seis aparecem desconectadas.

## Gates de publicação

| Gate | Onde | Efeito |
|---|---|---|
| Plano pago ativo | `access.ts` | 402 em todas as rotas (paywall na UI) |
| `DISTRIBUTION_ENABLED` + Instagram configurado | `guard.ts` | 503 em todas as rotas |
| `DISTRIBUTION_PUBLISH_ENABLED` | approve / retry | 503 (permite revisar sem disparar) |
| Vídeo selado presente | approve | 400 |
| Canal conectado | approve | só publica na interseção com as redes conectadas |
| Blackout 72h/24h | approve, retry, worker | 423 + status `blocked_blackout` |
| Fact-check `rejected` | approve, se `AUDITOR_FACTCHECK_ENABLED` | 422 |
| 1 publicação em voo por dono | `async-jobs-enqueue` | 429 |

Blackout usa `ELECTION_DATE` (2026-10-04, vale para todos os candidatos de 2026);
`socialConnections.electionDate` só sobrescreve quando o perfil tem pleito com
data distinta (suplementar). Data inválida cai na data geral.

`checkElectoralBlackout({ at, electionDate })` é chamado em quatro pontos, todos
passando o `electionDate` da conexão:

| Chamador | `at` |
|---|---|
| `approve` | `scheduledAt` do pacote, ou agora |
| `retry` | agora (o retry dispara imediato) |
| worker | `scheduledAt` se ainda futuro, senão agora |
| sweep de agendados | agora (é o instante real da publicação) |

O worker usa o horário marcado quando o pacote ainda está agendado de propósito:
checar "agora" ali bloquearia um agendamento legítimo fora da janela só porque o
enfileiramento caiu dentro dela.

## URL da mídia (crítico)

O vídeo selado vive em `compliance/sealed/<heygenVideoId>.mp4` e é servido por
**signed URL V4 com validade de 7 dias** — o teto do GCS. Os servidores da Meta
baixam a mídia no momento do publish, então a URL gravada na criação do pacote
pode estar morta no disparo (agendamento longo, retry tardio, criativo antigo).

Por isso o pacote guarda `videoStoragePath` e o worker re-assina a URL logo antes
de publicar (`fresh-video-url.ts`). Sem `storagePath` conhecido, publica com a URL
original e loga o motivo — nunca aborta o disparo por causa disso.

## Captions por rede

`caption-adapter.ts` gera uma legenda por canal a partir do roteiro aprovado, com
tom e formato de cada rede (Reels, thread curta no X, institucional no LinkedIn…)
e corte no limite de caracteres. Sem OpenAI configurada, cai no truncamento de
`captions.ts` — a adaptação nunca bloqueia o pacote. Chamado na criação do
pacote (`POST /posts`) e na edição (`PATCH /posts/[id]`).

Regras no prompt: não inventar fato/número/promessa fora do roteiro, não pedir
voto, não atacar adversário. Legenda editada à mão vence a automática; trocar a
caption base invalida as versões geradas antes (as manuais sobrevivem).

## Status do pacote

O agregado é calculado no worker (`async-jobs-workers.ts`), a partir da resposta
síncrona do Graph:

- denominador são os canais que o pacote mira (`post.channels`);
- `published` em todos vence `scheduledAt`;
- qualquer canal `failed` → `partial_failure` (é o status que habilita o retry);
- todos `failed` → `failed`.

## Agendamento

O Graph **não agenda do lado da Meta**. Quando `scheduledAt` está a mais de 60s
no futuro, o publisher marca o pacote como `scheduled` e retorna sem postar —
dentro dessa margem de 60s ele publica na hora.

Quem retoma é `POST /api/workers/distribution-scheduled` (auth de worker,
Cloud Scheduler a cada 5 min): varre `status="scheduled"` com `scheduledAt`
vencido e reenfileira com `scheduledAt: null`, que faz o publisher postar.

Dois detalhes que o código carrega por um motivo:

- **Chave de idempotência própria** (`publish-scheduled:<post>:<canais>:<dueAt>`).
  `createAsyncJob` devolve o job existente quando a chave repete, e um job já
  concluído não pode ser reivindicado — reaproveitar a chave do Go faria o
  agendado morrer silenciosamente no claim.
- **Blackout é rechecado no tick**, não só no Go: a janela pode ter entrado em
  vigor entre a aprovação e o horário marcado.

## Execução dos jobs

`PUBSUB_JOBS_ENABLED=true`: o `publish_post` sai por Pub/Sub
(`md-jobs-publish` → push em `/api/workers/publish`), então o publish do Reel
roda dentro de um request de verdade, com `maxDuration = 300`. Com a flag em
false o `enqueueAsyncJob` cai no `kickLocalWorker`, que dispara sem `await` — o
polling de até 180s ficaria correndo depois da resposta HTTP, sujeito ao
throttle de CPU do Cloud Run.

As três push subscriptions (`publish`, `seal`, `voice`) autenticam por **OIDC**,
com o SA de compute do App Hosting e `audience = APP_BASE_URL`. A audience é a
URL de produção nos dois backends, de propósito: o worker valida contra
`JOBS_WORKER_OIDC_AUDIENCE || APP_BASE_URL`, que é o mesmo valor em staging e
prod, então o mesmo comando serve os dois. Push sem OIDC não manda header
nenhum e o `assertJobsWorkerAuthorized` recusaria tudo → DLQ em 5 tentativas.

## Token do Instagram

O token de longa duração vale 60 dias. `POST /api/workers/instagram-token-refresh`
(Cloud Scheduler diário, 04:00 America/Sao_Paulo) renova os que vencem em até 15
dias via `ig_refresh_token`. A Meta exige token com 24h+ de vida e ainda válido;
passado o vencimento não há refresh, só reconectar por OAuth.

## Ativação em produção (ordem)

1. App Review da Meta aprovado (screencast + 1 publish real). Antes disso só
   contas *tester* do app publicam.
2. Secrets `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` cadastrados e o bloco
   correspondente ativo em `apphosting.yaml`.
3. Redirect URI do callback (`/api/distribution/instagram/callback`) registrada
   no app da Meta para o domínio de produção.
4. `DISTRIBUTION_ENABLED=true` → UI real + conexão da conta por OAuth.
5. Smoke: conectar a conta, criar pacote, aprovar com
   `DISTRIBUTION_PUBLISH_ENABLED=false` (deve dar 503).
6. `DISTRIBUTION_PUBLISH_ENABLED=true` → primeiro disparo real.
7. `npm run firebase:indexes:deploy`.

## Pendências conhecidas

- **Índice composto do sweep não deployado.** `listScheduledDue` consulta
  `status == "scheduled"` + `scheduledAt <=` com `orderBy(scheduledAt)`, o que
  exige o índice já declarado em `firestore.indexes.json`. Até rodar
  `npm run firebase:indexes:deploy`, o worker de agendados responde erro do
  Firestore com o link de criação do índice. A query de token é de campo único
  e usa o índice automático — essa já funciona.

- **`ADMIN_SESSION_SECRET` não configurado** (`adminSessionSecretFromEnv: false`
  em `/api/health/runtime-env`). O cofre que cifra o token do Instagram usa
  chave de bootstrap; se ela mudar, os tokens gravados param de descriptografar
  e todo mundo precisa reconectar.

## Fora de escopo

- As outras 6 redes: aparecem na UI, não conectam nem publicam.
- Reconciliação por polling: o caminho Graph é síncrono no worker, não depende
  de webhook. Existiu um `/api/workers/distribution-reconcile` para cobrir
  webhook perdido do Ayrshare — saiu junto com o recorte Ayrshare.
- WhatsApp e Kwai (APIs distintas). WhatsApp Cloud API existe no produto, mas
  para outbound de marketing — ver [marketing-outbound.md](marketing-outbound.md).
- Corte/formato de vídeo por rede.
- Métricas de alcance/engajamento e sugestão de melhor horário — a página de
  marketing ilustra, o produto não entrega.
