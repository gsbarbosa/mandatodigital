# Marketing outbound (`/admin/marketing`)

Vertical slice interna do painel de gestão para prospecção: base de contatos públicos,
segmentação de público e campanhas de e-mail/WhatsApp, com acompanhamento por envio.

Não é feature de cliente — é ferramenta nossa de aquisição. O público é dirigente partidário e
parlamentar, não o usuário final do produto.

Por que dentro do monólito e não em projeto separado: [adr-marketing-outbound-no-monolito.md](adr-marketing-outbound-no-monolito.md).

**Status (17/ago/2026): em produção e validado ponta a ponta.** App publicado na Meta, webhook
recebendo, IA respondendo. O ciclo completo foi exercitado com número real: lead perguntou "é
pago?" às 18:29:33 e a resposta da Marina saiu às 18:29:37.

## Módulos

| Aba | Função |
|---|---|
| Contatos | Base de prospects + filtro exploratório + contadores |
| Segmentos | Filtros salvos e reutilizáveis, com contagem resolvida na hora |
| Campanhas | Criação, prévia de público, disparo e trilha de envios |
| Conversas | Threads do WhatsApp, janela de 24h e botão para assumir no braço (pausa a IA) |

## Modelo de dados

| Collection | Conteúdo |
|---|---|
| `marketingContacts` | Prospects (doc id = `dir_<canal>` ou `cam_<id do deputado>`) |
| `marketingSegments` | Definição de filtro salva |
| `marketingCampaigns` | Campanha + status + estatísticas agregadas |
| `marketingSends` | Um registro por contato por disparo (trilha) |
| `marketingConversations` | Thread de WhatsApp por contato (doc id = telefone E.164) |

As rules negam o client em tudo (`firestore.rules`) — só Admin SDK lê e escreve. Nenhuma das
quatro está no `db:reset`: contato é dado de referência caro de reimportar, e campanha é
histórico operacional nosso.

**Segmento é filtro, não lista congelada.** A campanha resolve o público no momento do disparo,
contra a base atual. Reimportar contatos muda o alcance de uma campanha ainda não enviada — isso é
intencional.

## Base de contatos

Populada por `npm run marketing:seed` a partir de três fontes. CSVs ficam em `.local/`
(fora do git).

```bash
cp <export do SGIP3>.csv          .local/diretorios-partidarios.csv
cp consulta_cand_2026_BRASIL.csv  .local/consulta_cand_2026_BRASIL.csv   # opcional, ver abaixo
cp <enriquecido do Instagram>.csv .local/instagram-enriquecido.csv       # opcional

npm run marketing:seed -- --dry-run        # só estatísticas
npm run marketing:seed                     # grava
npm run marketing:seed -- --only=camara    # uma fonte só (diretorio|camara|instagram)
```

O seed é idempotente: `createdAt` só é gravado em doc novo, então reimportar atualiza sem duplicar
nem resetar histórico.

**Os CSVs de origem não estão no Git** (são PII e ficam em `.local/`). Em máquina nova:

| Arquivo | Onde conseguir |
|---|---|
| `diretorios-partidarios.csv` | export do [SGIP3](https://sgip3-consulta.tse.jus.br/) — órgãos partidários por UF |
| `consulta_cand_2026_BRASIL.csv` | [`consulta_cand_2026.zip`](https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip) (latin-1, `;`) |
| `instagram-enriquecido.csv` | produzido fora daqui; sem ele o seed roda só com as outras duas fontes |

**A base já está no Firestore** — rodar o seed de novo só é necessário para atualizar ou incluir
fonte nova, não para retomar o trabalho.

### 1. Diretórios partidários (TSE / SGIP3)

Contato institucional de presidente, tesoureiro etc. por UF — público por obrigação de prestação
de contas. Tratamento aplicado:

- **Telefone → E.164 com classificação móvel/fixo.** O campo vem em formato livre e às vezes com
  vários números separados por `/`. Só linha móvel entra como `phoneE164` (fixo não recebe
  WhatsApp). Ver `src/lib/outbound/phone.ts`.
- **Dedup pelo canal real** (celular, ou e-mail quando não há celular): a mesma pessoa não recebe
  duas mensagens.
- **Contato compartilhado**: presidente e tesoureiro do mesmo diretório costumam dividir o mesmo
  telefone/e-mail institucional. Vira um contato só, personalizado no nome de quem preside.
- **`suspended`**: último status do histórico da coluna `Situação` (o campo é um histórico
  separado por `;`, não um estado único). Marcado, não filtrado — o segmento decide.

### 2. Câmara dos Deputados (API de dados abertos)

Deputados federais em exercício, com e-mail institucional público. Cruzado por nome normalizado +
UF com `consulta_cand_2026_BRASIL.csv` para marcar `isCandidate2026` e o cargo disputado — sem esse
CSV o seed roda igual, só não marca ninguém como candidato.

O telefone do gabinete é fixo (Brasília), então esses contatos entram como **e-mail apenas**.

### 3. Instagram enriquecido (CSV externo) — com validação obrigatória

Planilha produzida fora daqui: perfil do Instagram do candidato → telefone/e-mail extraídos da bio
e de links (linktree e afins).

**Essa fonte erra com frequência, e erra de um jeito perigoso.** A associação linha↔candidato vem
embaralhada: a coluna `INSTAGRAM_USERNAME` nem sempre corresponde ao `NM_URNA_CANDIDATO` da mesma
linha, o mesmo telefone aparece atribuído a pessoas diferentes, e o link da bio às vezes é de um
terceiro. O `CONFIDENCE_SCORE` vem 100 justamente nas linhas erradas — não serve de filtro.

O risco concreto: mandar `md_intro_*` com o nome trocado para um desconhecido é o caminho curto
para "denunciar spam", e isso derruba a nota de qualidade do número.

Por isso a validação é código, não curadoria manual — `src/lib/outbound/instagram-enrichment.ts`,
com teste para cada regra sobre casos reais da base:

| Trava | Descarta quando |
|---|---|
| Nome ↔ handle | o `@` não é plausível para o nome do candidato |
| Telefone exclusivo | o mesmo número é reivindicado por mais de um candidato |
| DDD ↔ UF | o DDD não bate com a UF da candidatura |
| Bio própria | o link da bio pertence a outra pessoa |

Rodando sobre o CSV atual (1.849 linhas): **32 aprovados**, 69 reprovados por defeito (35 nome
trocado, 18 bio de terceiro, 12 telefone compartilhado, 4 DDD) e 983 sem telefone utilizável.

Aproveitamento de ~2%. É baixo de propósito: o custo de um falso positivo (mensagem com nome errado)
é muito maior que o de um falso negativo (um contato a menos).

### Números da última importação (17/ago/2026)

| Fonte | Resultado |
|---|---|
| Diretórios partidários | 1.259 linhas → **744 contatos** (650 com WhatsApp, 31 suspensos, 273 com canal compartilhado) |
| Câmara dos Deputados | 513 deputados, 513 com e-mail, **364 candidatos em 2026** |
| Instagram (lote 1, planilha antiga) | 1.849 linhas → **32 aprovados** |
| Instagram (lote Pasta1) | 1.080 linhas → **651 aprovados** (642 novos, 9 já existiam, 1 telefone de diretório pulado) |
| **Total gravado** | **1.931 contatos** (1.324 com WhatsApp) |

O lote Pasta1 já vem com gênero e `whatsapp_e164`. As mesmas travas do lote 1 se aplicam
(`scripts/import-instagram-pasta1.ts`). Reprovados: 181 sem telefone, 25 bio de terceiro,
18 DDD, 17 @ vs nome, 2 telefone compartilhado.

Staging e produção compartilham o mesmo Firestore (projeto `madatodigital`), então o seed roda uma
vez e vale para os dois.

### Sexo e cargo no segmento

`onlyWomen` exige `gender === "F"`. Contato sem sexo classificado **não entra** — o template de
candidatas no vocativo feminino não pode ir para nome trocado nem para homem.

`offices` filtra pelo texto de `candidateRole`/`roles`: estadual, distrital ou federal.

Depois do lote Pasta1, mulheres com WhatsApp classificadas: **233** (125 estaduais, 97 federais,
7 distritais, 2 senadoras, 2 suplentes). Diretório continua sem sexo.

### Fontes do Drive (`mandatodigital-base`) e o que fazer com cada uma

A pasta de origem tem quatro arquivos. O cruzamento com a base já importada:

| Arquivo | O que é | Já na base? | Uso |
|---|---|---|---|
| `Pasta1.csv` (1.080 linhas) | Instagram + WhatsApp de candidatos 2026, com gênero | Sim, 651 aprovados pelas travas | Público operacional de WhatsApp |
| `Presidentes_e_Adm_Partidos_Consolidado.xlsx` | Mesmo export SGIP3 (1.259 linhas, ~857 presidentes) | Sim, via `diretorio_partidario` | Filtrar `onlyPartyPresidents` — não reimportar |
| `Candidatos_em_Reeleicao.xlsx` | 345 federais + 600 estaduais/distritais em mandato e recandidatos | **Não como flag** | Enriquecer `isReelection` |
| `Suplentes_Mais_VotadosScraper_2022.xlsx` | 498 suplentes 2022 + scraper Instagram (CEL_58) | CEL_58 ≈ o lote 1 antigo (2% de aproveitamento) | **Não importar.** Lista futura quando houver telefone confiável |

A coluna `Tentando reeleicao` do Pasta1 está corrompida (vem `#N/D` ou o nome de outra pessoa). Reeleição só vale pela planilha dedicada, cruzada por nome normalizado + UF. Só **66** das 1.080 linhas do Pasta1 são incumbentes — o WhatsApp da reeleição é pequeno; o restante dos 945 incumbentes é e-mail de gabinete ou contato pessoal.

```bash
npm run marketing:enrich -- --dry-run   # cruza reeleição + followers e pontua
npm run marketing:enrich
npm run marketing:segments              # cria/atualiza os 11 segmentos canônicos
```

### Relevância (VIP vs disparo)

Calculada em `src/lib/outbound/relevance.ts` e gravada em `relevanceScore` / `relevanceTier`.

VIP **não recebe template em massa** — o custo de um WhatsApp frio (assessoria, denúncia, presidente de partido grande) é maior que o de um falso negativo. Critério absoluto, não só corte de score:

- Deputado federal em reeleição
- Senador / governador
- Presidente de partido grande (PL, PT, MDB, UNIÃO, PP, PSD, REPUBLICANOS, PSB, PDT, PSDB, PODE)
- ≥ 400 mil seguidores no Instagram (celebridade digital: Sikêra Jr e afins)

Alta: reeleição estadual/distrital, presidente de partido menor, candidata com ≥ 50 mil seguidores. Média/padrão: o restante com WhatsApp.

Mulher **sem mandato e sem audiência não sobe de faixa só por ser mulher** — a cota de 30% não é atalho de relevância. Continua em segmento próprio (tom e landing diferentes).

### Segmentos canônicos

O filtro avulso no painel continua existindo para exploração. O disparo usa os segmentos abaixo (`excludeVip` ligado em todos os `WA ·`):

| Segmento | Canal | CTA / landing |
|---|---|---|
| VIP — contato pessoal | telefone / e-mail / indicação | — |
| Alta relevância — humano se responder | WhatsApp, lote 5; pausar IA no primeiro "tenho interesse" | degustação |
| WA · Reeleição · F · Estadual/Distrital | WhatsApp | `/vozdelas/provas.html#recursos` + `/materialidade` |
| WA · Reeleição · F · Federal | WhatsApp residual (quase tudo é VIP) | `/materialidade` |
| WA · Reeleição · M · Estadual/Distrital | WhatsApp | `/materialidade` |
| WA · Reeleição · M · Federal | WhatsApp residual | `/planos` |
| WA · Candidatas · Estadual/Distrital | WhatsApp | `/vozdelas` ou `/chapas-femininas` |
| WA · Candidatas · Federal | WhatsApp | `/vozdelas/provas.html#recursos` |
| WA · Candidatos · Estadual/Distrital | WhatsApp | `/` + degustação (`/login`) |
| WA · Candidatos · Federal | WhatsApp | `/planos` |
| WA · Presidentes de partido | WhatsApp | `/planos` (3 campanhas por sigla/UF) |

### Cadência anti-spam

Número novo, qualidade GREEN, tier baixo. O disparo agora **embaralha** o restante e **espalha UF** no lote (`dispatch-batch.ts`) — o mesmo clique não manda cinco paulistas seguidos, e o próximo clique usa outro seed.

Operação (manual, dois turnos por dia):

| Semana | Teto / dia | Lotes | Janela BRT |
|---|---|---|---|
| 1 | 20 | 4 × 5 | 9h–11h30 e 14h–17h30, dias úteis |
| 2 | 35 | 7 × 5 | idem, se qualidade continuar GREEN |
| 3 | 50 | 10 × 5 | teto técnico do canal; não subir sem o tier da Meta subir |

Regras: não gastar o dia num segmento só; intercalar candidatas / candidatos / presidentes / reeleição; um contato = um template de abertura; VIP fora. Intervalo de 1,2s entre mensagens já está no código.

### Templates por segmento

Os 9 aprovados cobrem parte do mapa. Onde o texto promete "página de um minuto" / "vídeo de 3 minutos" que **não existe**, não usar — a Marina hoje gasta o pico de interesse pedindo para esperar. Submeter versões novas com o landing real:

| Segmento | Reusar agora | Submeter (CTA no corpo) |
|---|---|---|
| Candidatas (não incumbentes) | `md_intro_feito_candidatas_v1` / `md_intro_candidatas_soft_v1` | apontar `/vozdelas` ou `/chapas-femininas` |
| Presidentes | `md_intro_vaga_sigla_v1` | apontar `/planos` |
| Reeleição | `md_intro_materialidade_v1` (se o texto não prometer material fantasma) | `md_intro_reeleicao_v1` → `/materialidade` |
| Candidatos homens | `md_intro_prova_v1` / `md_intro_tempo_volume_v1` | `md_intro_degusta_v1` → `/login` |
| Follow-up 48h (quem abriu e não respondeu) | `md_followup_candidatas_v1` só no público mulher | um follow-up neutro por público |

Textos sugeridos para submissão na Meta (1 parâmetro = primeiro nome). Corpo curto, um CTA, sem
prometer material que não existe:

**Candidatas (estadual/distrital)** — `md_intro_vozdelas_v1` → vozdelas
> Oi {{1}}, aqui é a Marina do Mandato Digital. Montamos uma plataforma para candidatas produzirem vídeo com a própria voz, monitorarem a pauta da região e comprovarem atuação se a chapa for questionada. Posso te mandar a página? https://mandatodigital.ia.br/vozdelas

**Candidatas (federal)** — `md_intro_chapas_v1` → chapas-femininas
> Oi {{1}}, Marina do Mandato Digital. Para campanha de mulher, o jogo é voto de verdade e prova de verdade — conteúdo no ritmo da base e registro do que foi feito. Dá para ver os dois lados aqui: https://mandatodigital.ia.br/chapas-femininas

**Reeleição (F e M, estadual)** — `md_intro_reeleicao_v1` → materialidade
> Oi {{1}}, Marina do Mandato Digital. Quem já tem mandato precisa de volume de comunicação e de materialidade se a campanha for questionada. Preparei um dossiê modelo de 1 minuto: https://mandatodigital.ia.br/materialidade

**Candidatos homens** — `md_intro_degusta_v1` → login/degustação
> Oi {{1}}, Marina do Mandato Digital. A gente produz vídeo da candidatura em volume, com o seu rosto e a sua voz, a partir da pauta do dia — sem estúdio. Quer experimentar de graça? https://mandatodigital.ia.br/login

**Presidentes** — `md_intro_vaga_sigla_v1` já existe; se for resubmeter, terminar em `/planos`.

Enquanto a Meta não aprova os novos, usar os aprovados que **não** prometem vídeo/página fantasma (`md_intro_feito_candidatas_v1`, `md_intro_vaga_sigla_v1`) e deixar a Marina enviar o landing na primeira resposta.

Configurar `WHATSAPP_DEMO_LINK_URL=https://mandatodigital.ia.br/login` (degustação). A Marina agora escolhe o landing conforme o perfil e tira o lead do WhatsApp em 1–2 turnos.

## Disparo

E-mail sai por Resend (`resend.batch.send`, 100 por chamada), reaproveitando o cofre de provider
secrets → env, igual a `src/lib/legal/email.ts`.

Variáveis no assunto e no corpo: `{{nome}}` (primeiro nome, capitalizado — a base do TSE é toda
caixa alta), `{{nome_completo}}`, `{{uf}}`, `{{partido}}`, `{{cargo}}`, `{{municipio}}`. Placeholder
sem valor vira string vazia, nunca chega cru no destinatário.

Proteções:

- **Não reenvia para quem já recebeu** aquela campanha (consulta `marketingSends`). Redisparar
  atinge só quem ficou pendente — é assim que o lote de 5 em 5 avança.
- **Lote por clique** (`batchSize` na campanha). WhatsApp nasce em 5; o teto duro do canal
  continua 50 (`MAX_WHATSAPP_RECIPIENTS_PER_DISPATCH`). O clique envia o lote, o próximo clique
  pega os que faltam. Não recusa mais o disparo quando o segmento é maior que o teto: corta o lote.
- **Trilha gravada mesmo em erro** — sem isso um erro parcial deixaria envio real sem registro e o
  redisparo duplicaria mensagem.
- Erro inesperado marca a campanha como `erro`, nunca deixa presa em `enviando` (o guard de
  reentrada impediria nova tentativa).

## WhatsApp — configuração e teste

O disparo por WhatsApp usa a **Cloud API da Meta** direto (sem BSP). Tudo é fail-closed: sem as
variáveis abaixo, o disparo recusa e o webhook responde erro, em vez de fingir que funcionou.

### Identificadores do Meta (referência)

| O quê | Valor |
|---|---|
| App ID | `1754129402447742` (MandatoDigital, publicado) |
| WABA ID | `1736757104132656` (MandatoDigital IA BR) |
| Phone Number ID | `1180191901853184` |
| Número | +55 31 7535-5968 — `VERIFIED`, qualidade `GREEN` |
| System user | `mandatodigital-whatsapp` (token sem expiração) |
| Política de privacidade | `https://mandatodigital.ia.br/politica-de-privacidade` |

Nenhum desses é segredo. Os secretos (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`) vivem no `.env.local` e no Secret Manager
(`whatsapp-access-token`, `whatsapp-app-secret`, `whatsapp-verify-token`) — para recuperá-los:
`npm run env:pull -- --env prod`.

### Templates aprovados

Os 9 estão `APPROVED` em `pt_BR`. **A contagem de parâmetros varia** — passar quantidade
diferente faz a Meta rejeitar o envio, então confira antes de montar a campanha:

| Template | Params | Gatilho |
|---|---|---|
| `md_intro_adversario_v1` | 1 | resposta a ataque em ~20 min |
| `md_intro_feito_candidatas_v1` | 1 | plataforma pensada para candidatas |
| `md_intro_tempo_volume_v1` | 1 | volume de vídeo por semana |
| `md_followup_candidatas_v1` | 1 | follow-up do convite |
| `md_intro_candidatas_curta_v1` | 3 | versão curta |
| `md_intro_candidatas_soft_v1` | 3 | versão consultiva |
| `md_intro_materialidade_v1` | 3 | comprovação de atuação da chapa |
| `md_intro_vaga_sigla_v1` | 3 | escassez: 3 campanhas por partido/estado |
| `md_intro_prova_v1` | 4 | prova de IA lendo notícia do dia |

O template `md_intro_feito_candidatas_v1` está aprovado na persona **Anna** (1 parâmetro =
primeiro nome). A IA que responde depois da primeira mensagem do lead continua sendo Marina —
são personas diferentes de propósito (campanha vs. conversa).

Persona da conversa: **Marina**. A maior parte dos outros templates também pede autorização para
enviar um material ("página de um minuto" / "vídeo de 3 minutos") — material que ainda não existe,
ver Pendências.

Listar direto da API (fonte da verdade):

```bash
curl "https://graph.facebook.com/v25.0/1736757104132656/message_templates?fields=name,status,language,components" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```

### Variáveis

| Variável | Onde achar no Meta | Para quê |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | App → WhatsApp → Configuração da API → "ID do número de telefone" | Enviar |
| `WHATSAPP_ACCESS_TOKEN` | System user token (permanente) em Business Settings → Usuários do sistema | Enviar |
| `WHATSAPP_VERIFY_TOKEN` | Você escolhe; repete no painel ao cadastrar o webhook | Handshake do webhook |
| `WHATSAPP_APP_SECRET` | App → Configurações → Básico → "Chave secreta do aplicativo" | Validar assinatura |
| `APP_BASE_URL` | Já configurado no `apphosting.yaml` | Montar a URL do webhook |
| `WHATSAPP_DEMO_LINK_URL` | Opcional | Link que a IA envia; vazio = ela não promete link |

O token **temporário de 24h** do painel serve só para o primeiro teste — para produção é preciso o
token de system user, senão o disparo para de funcionar no dia seguinte.

### Ativação em produção — já feita, registrada para reprodução

Feito em 17/ago/2026. O que vale guardar: **os secrets precisam existir antes** de o
`apphosting.yaml` referenciá-los. Secret inexistente derruba o build inteiro do App Hosting, não só
o WhatsApp — por isso as entradas subiram comentadas primeiro, em commit separado.

```bash
# 1. token permanente (system user) já no .env.local — não o temporário de 24h
npm run firebase:secrets:apply

# 2. liberar leitura para CADA backend que for usar
firebase apphosting:secrets:grantaccess --backend mandatodigital-stg --project madatodigital
firebase apphosting:secrets:grantaccess --backend mandatodigital     --project madatodigital

# 3. só então publicar o yaml com as entradas ativas
git merge chore/whatsapp-secrets-ativos && git push origin staging
```

Requisitos que a Meta exige para publicar o app (sair do modo desenvolvimento):

- **URL de política de privacidade** pública e sem login — é o único requisito bloqueante.
  Usamos `https://mandatodigital.ia.br/politica-de-privacidade`.
- Não há App Review para este caso de uso: Cloud API com número próprio e os escopos
  `whatsapp_business_messaging` + `whatsapp_business_management` não passam por revisão.

**Enquanto o app está em modo desenvolvimento o webhook não recebe mensagem real** — só os testes
disparados pelo próprio painel da Meta. Isso não aparece em nenhuma validação de configuração: o
handshake passa, a assinatura valida, e mesmo assim nada chega. Foi o último bloqueio encontrado.

Publicar afeta **todos os casos de uso do app** (aqui: Threads, WhatsApp, Instagram e Página), não
só o WhatsApp.

O token de system user (`Nunca` expira) deve ser conferido antes de virar secret:

```bash
# escopos e expiração
curl "https://graph.facebook.com/v25.0/debug_token?input_token=$TOKEN&access_token=$APP_ID|$APP_SECRET"
# acesso à WABA — falha aqui = ativo não atribuído ao system user
curl "https://graph.facebook.com/v25.0/$WABA_ID" -H "Authorization: Bearer $TOKEN"
```

O erro mais comum é criar o system user e gerar o token **sem atribuir a conta do WhatsApp como
ativo**: o token nasce válido, com os escopos certos, e mesmo assim o envio falha por permissão.

### Cadastro do webhook no Meta

**Atenção: são dois backends.** `staging` publica em `mandatodigital-stg--…` e `main` em
`mandatodigital--…`. Push na `staging` **não** atualiza a URL de produção — confira em qual você
está cadastrando o webhook.

| Branch | Backend | URL do webhook |
|---|---|---|
| `staging` | `mandatodigital-stg` | `https://mandatodigital-stg--madatodigital.us-central1.hosted.app/api/webhooks/whatsapp` |
| `main` | `mandatodigital` | `https://mandatodigital--madatodigital.us-central1.hosted.app/api/webhooks/whatsapp` |

(`APP_BASE_URL` no `apphosting.yaml` aponta para a URL de prod nos dois backends — não sirva de
referência para montar a URL do webhook em staging.)

1. App → WhatsApp → Configuração → Webhook → Editar.
2. Callback URL: a URL acima. Verify token: o valor de `WHATSAPP_VERIFY_TOKEN`.
3. A Meta chama `GET` com `hub.challenge`; a rota devolve o desafio se o token bater.
4. Assinar o campo **`messages`** (é o que traz resposta do lead e status de entrega).

O webhook precisa estar publicado para o handshake passar — em local, use um túnel HTTPS e ajuste
`APP_BASE_URL`.

### Segurança do webhook

`POST` valida `X-Hub-Signature-256` (HMAC-SHA256 do corpo cru com o app secret), em comparação de
tempo constante. Sem `WHATSAPP_APP_SECRET` a rota responde 500 e não processa nada: é uma URL
pública que dispara chamada de LLM e envio de mensagem, então aceitar payload não autenticado
sairia caro. Reentrega da Meta é absorvida pela idempotência por `wamid`.

### Teste ponta a ponta

```bash
npm run whatsapp:test -- --check                    # só valida a configuração
npm run whatsapp:test -- --agente="tenho interesse" # roda a IA e imprime, sem enviar
npm run whatsapp:test -- --to=5531992439177 --template=md_intro_vaga_sigla_v1 --params="Gustavo"
```

O modo `--agente` não precisa de nenhuma credencial da Meta: serve para revisar tom e conteúdo da
IA antes de falar com gente de verdade.

## Conversa com IA (pós-resposta)

Quando o lead responde, o webhook grava a mensagem em `marketingConversations` (doc id = telefone
E.164) e o agente responde na hora, com a persona **Marina**.

- **Janela de 24h**: a Meta só permite texto livre nas 24h após a última mensagem do lead. Fora
  disso o agente não responde (só um template reabriria a conversa) — `isWithinServiceWindow`.
- **Idempotência por `wamid`**: a Meta reentrega o evento se a resposta demorar; sem isso a IA
  responderia duas vezes à mesma frase.
- **Assumir no braço**: "Pausar IA" na aba Conversas desliga a resposta automática daquela thread.
  Com a conversa aberta, o operador escreve no campo e o texto sai pela Cloud API (`sendText`) —
  a mesma janela de 24h da Meta. Enviar pausa a IA automaticamente, para ela não responder em cima.
- **Guarda-corpos no prompt**: não inventar preço/prazo/funcionalidade, encerrar com cordialidade
  em pedido de opt-out, e não prometer link quando `WHATSAPP_DEMO_LINK_URL` está vazio.
- Mídia (áudio/imagem) fica registrada mas não é respondida pela IA — vai para atendimento humano.

## Limites conhecidos

- **Teto de 50 destinatários por disparo no WhatsApp** (`MAX_WHATSAPP_RECIPIENTS_PER_DISPATCH`),
  com 1,2s entre mensagens. O lote da campanha (padrão 5) fica abaixo disso de propósito: número
  novo começa em tier baixo e rajada fria derruba a nota de qualidade.
- **O lote é aleatório e espalhado por UF** (`pickDispatchBatch`). A prévia do painel mostra o
  mesmo recorte que o clique vai enviar (seed = campanha + já enviados).
- **Status de entrega chega mas não é gravado**: o webhook separa `statuses`, porém hoje só loga.
  A trilha registra "a API aceitou o envio", não "foi entregue/lido".
- **E-mail não tem webhook**: sem abertura, clique ou bounce.
- **Segmento é avaliado em memória** (`applySegment`): a base inteira é carregada a cada consulta.
  Correto e barato na ordem de milhares de contatos; acima de ~10 mil, migrar para query no
  Firestore com índice composto.
- **Sem agendamento** — disparo é manual, no clique.
- Envio é síncrono na request; um volume grande dependeria de worker assíncrono
  (ver `docs/adr-async-jobs-pubsub.md`).

## Pendências abertas

- **`WHATSAPP_DEMO_LINK_URL`**: se vazio, a Marina cai na degustação (`/login`) e nos landings
  listados no prompt. Configure o env para forçar um único destino.
- **Girar o app secret e o token**: ambos passaram por canal de chat durante a configuração e estão
  valendo em produção. Rotacionar em Configurações → Básico → Redefinir, atualizar `.env.local`,
  `npm run firebase:secrets:apply`, redeploy.
- **A IA presume candidatura.** No primeiro teste real ela disse "sua pré-candidatura" sem que o
  lead tivesse dito isso. Inofensivo com candidato, presunçoso com dirigente partidário que não
  concorre — o prompt deveria usar `cargo`/`partido` do contato em vez de assumir.
- **Status de entrega não é persistido** (ver Limites).

## Primeiro disparo: o que a validação mostrou

A lista inicial proposta tinha 31 handles do Instagram (28 únicos). Depois das travas de validação,
**10 sobreviveram** — 14 caíram por nome trocado, 4 por telefone compartilhado (um número estava
atribuído a **4 candidatos diferentes**), 1 por DDD de outro estado e 1 sem telefone.

Vale como referência de expectativa: de uma lista enriquecida "pronta", algo em torno de um terço
costuma ser aproveitável. E 10 é um primeiro lote melhor que 30 — número novo não deve estrear com
volume frio, mesmo com qualidade GREEN.

Os 10 que passaram (handle bate com o nome, telefone exclusivo, DDD compatível, bio própria):

| Handle | Candidato | UF | Telefone |
|---|---|---|---|
| helioferreiravereador | HELIO FERREIRA | BA | 5571991475655 |
| sarah | SARAH PONCIO | RJ | 5521999496430 |
| renatomachadocariacica | RENATO MACHADO | ES | 5527995736670 |
| hugohgarcia | HUGO GARCIA | MT | 5565999910163 |
| depdalmoribeiro | DALMO RIBEIRO | MG | 5531998895051 |
| cabo.meireles | CABO MEIRELES | MG | 5531988107528 |
| leilabedani | LEILA BEDANI | SP | 5511937080505 |
| silvinhadudu | SILVINHA DUDU | MG | 5531985229416 |
| marcoshenriques_ | MARCOS HENRIQUES | PB | 5583991375151 |
| dhiegoserra | DHIEGO SERRA | PE | 5587999968499 |

Estão em `marketingContacts` com `source: instagram_enriquecido` — filtrar por essa origem no
segmento os isola. Os reprovados **não** foram gravados.

Casos que justificam a régua, para quem duvidar dela: `carlosrussorj` caiu porque o telefone
`5522997692727` está atribuído a **4 candidatos diferentes** na planilha; `vereadoraestelaalmagro`
aponta para "FÁBIO FERRACINI"; `monicarosenbergsp` para "PROF CIDACARLOS ELASCOM O POVO".

## Próximas fontes de contato

Os contatos hoje cobrem dirigente partidário e deputado federal. Faltam candidatos individuais em
geral (7.239 candidaturas a deputado estadual, o maior cargo em disputa):

- **CNPJ de campanha (TSE → Receita Federal)**: toda candidatura abre um CNPJ próprio, e o cadastro
  na Receita exige telefone e e-mail (comitê / contabilidade) — dado público, mesma legitimidade do
  que já usamos. O TSE publica o CNPJ de campanha no grupo "Prestação de Contas Eleitorais", mas a
  edição 2026 ainda não existe: o marco é o prazo da primeira prestação parcial, **13/set/2026**,
  mais o tempo de processamento. Checar a partir de meados de setembro.
- **Assembleias legislativas**: mesma lógica da Câmara para deputados estaduais em exercício, mas
  são 27 sites sem API unificada.
- A base de candidaturas do TSE (`consulta_cand_2026`) **não** tem contato: `DS_EMAIL` vem
  redigido como "NÃO DIVULGÁVEL" em 100% das 13.339 linhas, e não há telefone.
