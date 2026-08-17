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
| Instagram enriquecido | 1.849 linhas → **32 aprovados** (69 reprovados por defeito, 983 sem telefone) |
| **Total gravado** | **1.289 contatos** |

Staging e produção compartilham o mesmo Firestore (projeto `madatodigital`), então o seed roda uma
vez e vale para os dois.

## Disparo

E-mail sai por Resend (`resend.batch.send`, 100 por chamada), reaproveitando o cofre de provider
secrets → env, igual a `src/lib/legal/email.ts`.

Variáveis no assunto e no corpo: `{{nome}}` (primeiro nome, capitalizado — a base do TSE é toda
caixa alta), `{{nome_completo}}`, `{{uf}}`, `{{partido}}`, `{{cargo}}`, `{{municipio}}`. Placeholder
sem valor vira string vazia, nunca chega cru no destinatário.

Proteções:

- **Não reenvia para quem já recebeu** aquela campanha (consulta `marketingSends`). Redisparar
  atinge só quem ficou pendente.
- **Teto de 500 destinatários por disparo** (`MAX_RECIPIENTS_PER_DISPATCH`). O envio é síncrono
  dentro da request; acima disso, estreitar o segmento e mandar em levas.
- **Trilha gravada mesmo em erro** — sem isso um erro parcial deixaria envio real sem registro e o
  redisparo duplicaria mensagem.
- Erro inesperado marca a campanha como `erro`, nunca deixa presa em `enviando` (o guard de
  reentrada impediria nova tentativa).

## WhatsApp — configuração e teste

O disparo por WhatsApp usa a **Cloud API da Meta** direto (sem BSP). Tudo é fail-closed: sem as
variáveis abaixo, o disparo recusa e o webhook responde erro, em vez de fingir que funcionou.

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
- **Guarda-corpos no prompt**: não inventar preço/prazo/funcionalidade, encerrar com cordialidade
  em pedido de opt-out, e não prometer link quando `WHATSAPP_DEMO_LINK_URL` está vazio.
- Mídia (áudio/imagem) fica registrada mas não é respondida pela IA — vai para atendimento humano.

## Limites conhecidos

- **Teto de 50 destinatários por disparo no WhatsApp** (`MAX_WHATSAPP_RECIPIENTS_PER_DISPATCH`),
  com 1,2s entre mensagens. Número novo começa em tier baixo e rajada fria derruba a nota de
  qualidade — subir só depois que o tier subir.
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

- **`WHATSAPP_DEMO_LINK_URL` está vazio.** Todos os 9 templates terminam prometendo enviar algo
  ("a página de um minuto", "o vídeo de 3 minutos") e esse material não existe. Hoje a IA contorna
  dizendo que retorna depois — funciona, mas gasta o pico de interesse do lead. É a maior perda de
  conversão conhecida do fluxo.
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
