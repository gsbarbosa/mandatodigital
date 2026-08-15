# Notícias do Dia

Tela `/monitoramento/noticias-do-dia`, acessível pelo menu **Monitoramento → Notícias do dia**.

Mostra as manchetes **cruas** dos portais já catalogados — sem tema, sem cluster,
sem LLM — ao contrário do [Sentinela](sentinela-arquitetura.md), que cruza tema ×
geografia e agrupa várias fontes numa mesma "pauta".

**Mecanismo de busca isolado por decisão de produto:** esta tela não importa nada
de `sentinel-suggestions.ts` nem de `sentinel-rss.ts` — tem fetch, cache e rate
limit próprios, para não competir com o orçamento diário do Sentinela nem herdar
mudanças feitas lá. Reaproveita apenas: o catálogo de portais (dado estático,
somente leitura) e o card de UI (`MonitorSignalCard`).

---

## 1. Regra de negócio

| Esfera | Fonte dos portais | Itens por portal | Teto de exibição |
|---|---|---|---|
| Nacional | `NATIONAL_PORTAL_HOSTS` (10, fixo) | até 3 | 15 — mesmo volume de antes do filtro de diversidade |
| Estadual | `STATE_PORTAL_HOSTS[uf]` (5 por UF) | até 3 | 15 (na prática, 5×3 quando todos os portais respondem) |
| Municipal | `profileForm.interestSites` (hoje até 2, cadastrados em `/monitoramento/temas`) | até 3 | 15 (hoje nunca atinge — máximo real é 2×3 = 6) |

Decisões explícitas do produto (não são bugs, não mexer sem confirmar de novo):

- **Diversidade de fontes é resolvida na ORDEM, não na contagem.** O volume por
  esfera voltou a ser o mesmo de sempre (até 3 por portal, teto de 15). O que
  muda é a ordem: os itens saem em "rodadas" (`roundRobin` em
  `noticias-do-dia.ts`) — 1ª manchete de CADA portal primeiro (nunca repete
  fonte nessa rodada), depois a 2ª de quem tiver, depois a 3ª. A tela
  (`noticias-do-dia-page.tsx`, `diverseInitialCount`) calcula quantos itens do
  início da lista têm fonte distinta e mostra só esse prefixo antes de qualquer
  clique — o resto (repetições de fonte) fica atrás do "Ver mais", que continua
  funcionando do jeito que sempre funcionou (`Ver mais (N)`, incrementa
  `VISIBLE_STEP` por clique).
- O catálogo nacional tem 10 portais fixos, não 5 — mantido como está.
- O teto de portais municipais cadastráveis continua em **2** (mesmo valor do
  Sentinela, `MAX_MUNICIPAL_PORTALS`). Elevar isso para usuários pagantes (até
  10) é um projeto futuro, fora deste escopo.
- **Filtro de relevância política/econômica/social** (`noticias-do-dia-relevance.ts`):
  exclui esporte, fofoca/entretenimento e loteria/horóscopo por heurística de
  frase, checando título E subtítulo (sem LLM — ver §2 e §3). Busca-se um pool
  de até 8 manchetes recentes por portal e usa as até 3 primeiras que passarem
  no filtro; se nenhuma passar, o portal fica de fora daquela rodada.
- Não há filtro de "publicado hoje" pela data — pega as manchetes mais recentes
  de cada feed que passem no filtro de relevância, mesmo que o portal não tenha
  postado nada nas últimas horas. Card sem data real do portal mostra a data de
  hoje (ver §2, card compartilhado).

---

## 2. Arquitetura

```text
[UI] noticias-do-dia-page.tsx
  │ GET  /api/noticias-do-dia          → lê cache do dia (Firestore)
  │ POST /api/noticias-do-dia/refresh  → força coleta nova
  ▼
fetchNoticiasDoDia()          src/lib/noticias-do-dia.ts
  │ monta hosts (catálogo + portais municipais do perfil)
  │ dispara fetchLatestArticlesForHost() em paralelo por host
  ▼
fetchLatestArticlesForHost()  src/lib/noticias-do-dia-fetch.ts
  │ descobre feed (caminhos comuns → <link rel="alternate"> da home)
  │ parse regex de <item>/<entry> (RSS/Atom) — sem lib externa, sem tema
  │ retorna um pool de até 8 manchetes recentes por host, título + subtítulo
  ▼
isPoliticallyRelevantHeadline()  src/lib/noticias-do-dia-relevance.ts
  │ filtro por frase (heurística, sem LLM) — descarta esporte/fofoca/loteria
  │ checa título E subtítulo; orquestrador pega até 3 manchetes do pool que
  │ passarem no filtro, por host
  ▼
roundRobin()  src/lib/noticias-do-dia.ts
  │ 1ª manchete de cada host primeiro, depois a 2ª/3ª de quem tiver, até 15
  ▼
noticiasDoDiaStorage           src/lib/noticias-do-dia-storage.ts
  → Firestore collection `noticiasDoDiaCache` (doc id = profileId)
```

Arquivos:

- `src/lib/noticias-do-dia-fetch.ts` — busca + parse por host, independente.
  Extrai `title`, `url`, `publishedAt` e `summary` (subtítulo — `<description>`
  do RSS ou `<summary>` do Atom, cortado em 220 caracteres, descartado se igual
  ao título).
- `src/lib/noticias-do-dia-relevance.ts` — `isPoliticallyRelevantHeadline(title, summary)`,
  filtro de exclusão por frase (esporte, fofoca/entretenimento, loteria/horóscopo),
  checando título e subtítulo juntos (uma matéria de esporte às vezes só denuncia
  o assunto no subtítulo). Isolado do Sentinela — não usa `sentinel-theme-verify.ts`
  nem nenhum LLM.
- `src/lib/noticias-do-dia.ts` — orquestrador: busca até 3 manchetes relevantes
  por portal (`relevantPerHost`), monta a lista em rodadas (`roundRobin`, ver
  §1) e converte cada manchete num `MockSentinelSuggestion` enxuto — só
  `evidence.articles[0]` preenchido, `briefing` = subtítulo do feed quando
  existir — pra o card renderizar sem mudanças (o subtítulo usa o mesmo slot
  que o briefing editorial do Sentinela). Quando o portal não tem data real da
  matéria, usa a data/hora da coleta como `publishedAt` (a tela só mostra
  notícia de hoje, então isso nunca destoa).
- `src/lib/noticias-do-dia-storage.ts` — cache Firestore (`noticiasDoDiaCache`,
  collection registrada em `firebase/collections.ts`). No-op se
  `hasFirebaseServiceAccount()` for falso (dev local sem credenciais).
- `src/app/api/noticias-do-dia/route.ts` (GET, cache-only) e
  `.../refresh/route.ts` (POST, força coleta; rate limit próprio via
  `NOTICIAS_DO_DIA_REFRESH_MAX_PER_DAY` em `rate-limit-firestore.ts`, hoje
  10/dia/usuário — não é o mesmo contador do Sentinela).
- `src/components/product/noticias-do-dia-page.tsx` — tela; reaproveita
  `MonitorSignalCard`, `SignalEvidenceDrawer` e `ProductPageHeader` do
  Monitoramento para manter o mesmo layout. Passa `themeCaption="Publicada hoje"`
  e `noDateFallbackToToday` pro card — as duas únicas props que existem
  justamente pra essa tela poder customizar cópia/formatação sem forkar o
  componente nem afetar o Monitoramento (que continua usando os defaults "Tema
  Principal" + fallback "Pauta recente"). `diverseInitialCount` decide quantos
  itens aparecem antes do "Ver mais" (ver §1).

  **Data do card**: quando o feed dá um horário real, mostra `DD/MM/AAAA -
  HH:MMh` — igual ao Monitoramento, sem tratamento especial. Só quando o portal
  não informa nenhum horário (`publishedAt` ausente) é que `noDateFallbackToToday`
  entra em ação e troca o "Pauta recente" padrão por "hoje sem hora"
  (`DD/MM/AAAA`, calculado no cliente em America/Sao_Paulo). Importante: o
  backend (`noticias-do-dia.ts`) **não inventa** um `publishedAt` fictício pra
  cobrir esse caso — se inventasse, o card não teria como distinguir "hora real"
  de "hora do momento da coleta" e mostraria hora errada como se fosse real.
- **Botão "Atualizar"**: reaproveita `RefreshPautasButton`
  (`src/components/product/refresh-pautas-button.tsx`) — o mesmo componente do
  Monitoramento (`variant="monitor"`, mesmo tamanho/comportamento/spinner), só
  com `label`/`loadingLabel` customizados ("Atualizar notícias") e uma classe
  CSS extra (`refresh-pautas-btn--blue`, em `globals.css`) que troca o verde
  padrão (`--cta`) pelo azul do produto (`--curador`), sem afetar o botão do
  Monitoramento (que não recebe essa classe).

### Compatibilidade do botão "Pautar"

O card usa sempre o mesmo link, `/criativo/novo?sugestao=<id>`, que por sua vez
busca `GET /api/sentinel/suggestions/<id>`. Como os ids gerados aqui usam o
prefixo `ndd-` (`NOTICIAS_DO_DIA_ID_PREFIX`, ver `noticias-do-dia.ts`), essa
rota tem um fallback (`src/app/api/sentinel/suggestions/[id]/route.ts`): ids
`ndd-*` são resolvidos via `noticiasDoDiaStorage` em vez do Sentinela. Fora
desse desvio de poucas linhas, a rota original não foi alterada.

---

## 3. Limitações conhecidas

- **Descoberta de feed é simples** (caminhos comuns em `COMMON_FEED_PATHS` +
  `<link rel="alternate">` da home, timeout de 4s por tentativa) — portal sem
  RSS num caminho padrão devolve 0 itens naquela rodada. Isso é esperado: a
  vaga passa pro próximo portal (nacional) ou o item some da lista
  (estadual/municipal). **Diagnóstico feito host a host** (2026-08-14, contra o
  catálogo nacional real) pra não ficar só na hipótese — de 10 portais
  nacionais, 5 falhavam sistematicamente antes do ajuste abaixo:
  - **G1** (`g1.globo.com`) — não expõe feed em nenhum caminho comum nem
    `<link alternate>` na home. O feed real fica em `/dynamo/rss2.xml`
    (convenção do CMS "Dynamo" da Globo) — **corrigido**, esse caminho foi
    adicionado a `COMMON_FEED_PATHS`.
  - **O Globo** (`oglobo.globo.com`) — `/rss` responde 200 com um envelope
    RSS válido, só que vazio (~400 caracteres, zero `<item>`) — parece servir
    um "casco" de feed pra tráfego automatizado. Sem solução conhecida sem
    negociar acesso com o portal; fica documentado, não corrigido.
  - **Estadão** (`estadao.com.br`) — bloqueia com HTTP 403 todo caminho
    testado, incluindo a home. WAF/paywall ativo — só contornável com
    navegador real (headless), fora do escopo deste fetch leve.
  - **Folha** (`folha.uol.com.br`) e **R7** (`r7.com`) — respondem 200 em
    alguns caminhos, mas é HTML (página normal, não feed) — não expõem RSS
    público padrão nem `<link alternate>` na home. Sem solução conhecida.

  Servidor loga uma linha (`[noticias-do-dia] <host>: ...`) sempre que um
  portal fica de fora por essas razões — útil pra diagnosticar de novo sem
  precisar reinstrumentar o código.

  **O mesmo vale pra portais municipais que o usuário cadastra** — não é só o
  catálogo nacional fixo. Caso real diagnosticado (2026-08-14): usuário
  cadastrou `www.otempo.com.br` como portal municipal e não veio nenhuma
  notícia. Investigação confirmou que o site roda WordPress (`wp-content` no
  HTML) mas tem o mecanismo de feed **desativado de propósito** — todo caminho
  comum devolve a mesma página de erro genérica, o parâmetro clássico
  `?feed=rss2` é ignorado (devolve a home normal), e `/wp-json/` (API REST do
  WordPress) retorna 403. Não é um caminho errado como era o caso do G1 — é
  bloqueio deliberado (plugin de segurança ou regra de CDN contra scraping),
  na mesma categoria do Estadão. **Decisão do produto (2026-08-14): não
  perseguir esses casos com uma solução mais pesada** (ex.: navegador headless
  tipo Playwright) — fica documentado como limitação. Não há uma lista fechada
  de "portais bloqueados" pra municipal, já que qualquer usuário pode
  cadastrar qualquer site — o padrão de sintoma pra reconhecer é sempre o
  mesmo: 0 notícias daquele portal + linha de log `[noticias-do-dia] <host>: ...`
  no servidor.

  **Aviso na própria tela (2026-08-14):** como a maioria dos usuários não sabe
  o que é "feed" ou "bloqueio de RSS", o problema não fica só no log do
  servidor — a tela mostra um aviso citando o portal pelo nome. `fetchNoticiasDoDia`
  (`noticias-do-dia.ts`) compara, por portal municipal configurado, se ele
  rendeu pelo menos 1 manchete relevante (`failedHostLabels`); os que não
  renderam nada vão pra `meta.municipalFailedPortals: string[]` (rótulo via
  `getPortalHostLabel`, ex. "O Tempo"). A tela (`noticias-do-dia-page.tsx`)
  mostra isso como um aviso na seção Municipal, **mesmo quando outro portal
  configurado trouxe notícias normalmente** (não é só pra seção vazia — o
  usuário precisa saber que UM dos portais que ele cadastrou está com
  problema, mesmo que o outro esteja funcionando):

  > "O portal *(nome)* não permite esse tipo de busca automática, então não
  > conseguimos trazer notícias dele. Recomendamos substituí-lo por outro
  > portal em **Configurar temas**." (link real pra `/monitoramento/temas`)

  Plural tratado à parte (`municipalFailedPortalsMessage`/`joinPortalNames`)
  pra quando os 2 portais cadastrados falharem juntos. Escopo deliberadamente
  só municipal — nacional/estadual vêm de catálogo fixo que o usuário não
  edita, não faria sentido dizer "troque de portal" pra algo que ele não
  escolheu.
- Filtro de relevância é heurística de frase, não LLM nem classificação
  semântica — pega os casos óbvios (nome de campeonato, "gol de", "bbb",
  "mega-sena" etc.) mas deixa passar manchete ambígua. Exemplo real capturado
  em teste: "Torcida do Fluminense garante nota preta... após o jogo contra o
  Independiente Rivadavia" passou porque não usa nenhuma das frases da lista —
  time e adversário não estão cadastrados (nomes de clube ficam de fora de
  propósito quando colidem com nome de cidade/estado, ex. Bahia, Ceará,
  Fortaleza, Santos, todos usados em notícia municipal/estadual legítima).
  Não há filtro positivo por tema, só exclusão do que é claramente irrelevante
  — e cada frase nova na lista é escolhida a dedo pra não esbarrar em uso
  político do mesmo termo (ex.: "vitória sobre" e "empate com" ficaram de fora
  de propósito por aparecerem em manchete política/eleitoral também). Se
  precisão for mais importante que manter isso sem LLM, dá pra trocar por uma
  classificação via IA (ver conversa/decisão do produto antes de mexer).
- Cache é "do dia" (America/Sao_Paulo); a tela dispara refresh automático uma
  vez quando o cache é de um dia anterior, e o botão "Atualizar notícias"
  força uma nova coleta a qualquer momento (respeitando o rate limit).
