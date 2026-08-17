# Marketing outbound (`/admin/marketing`)

Vertical slice interna do painel de gestão para prospecção: base de contatos públicos,
segmentação de público e campanhas de e-mail/WhatsApp, com acompanhamento por envio.

Não é feature de cliente — é ferramenta nossa de aquisição. O público é dirigente partidário e
parlamentar, não o usuário final do produto.

## Módulos

| Aba | Função |
|---|---|
| Contatos | Base de prospects + filtro exploratório + contadores |
| Segmentos | Filtros salvos e reutilizáveis, com contagem resolvida na hora |
| Campanhas | Criação, prévia de público, disparo e trilha de envios |

## Modelo de dados

| Collection | Conteúdo |
|---|---|
| `marketingContacts` | Prospects (doc id = `dir_<canal>` ou `cam_<id do deputado>`) |
| `marketingSegments` | Definição de filtro salva |
| `marketingCampaigns` | Campanha + status + estatísticas agregadas |
| `marketingSends` | Um registro por contato por disparo (trilha) |

As rules negam o client em tudo (`firestore.rules`) — só Admin SDK lê e escreve. Nenhuma das
quatro está no `db:reset`: contato é dado de referência caro de reimportar, e campanha é
histórico operacional nosso.

**Segmento é filtro, não lista congelada.** A campanha resolve o público no momento do disparo,
contra a base atual. Reimportar contatos muda o alcance de uma campanha ainda não enviada — isso é
intencional.

## Base de contatos

Populada por `npm run marketing:seed` a partir de duas fontes públicas. CSVs ficam em `.local/`
(fora do git).

```bash
cp <export do SGIP3>.csv .local/diretorios-partidarios.csv
cp consulta_cand_2026_BRASIL.csv .local/consulta_cand_2026_BRASIL.csv   # opcional, ver abaixo

npm run marketing:seed -- --dry-run     # só estatísticas
npm run marketing:seed                  # grava
npm run marketing:seed -- --only=camara # só uma fonte
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

### Números da última importação (11/ago/2026)

| Fonte | Resultado |
|---|---|
| Diretórios partidários | 1.259 linhas → **744 contatos** (650 com WhatsApp, 31 suspensos, 273 com canal compartilhado) |
| Câmara dos Deputados | 513 deputados, 513 com e-mail, **364 candidatos em 2026** |
| **Total** | **1.257 contatos** |

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

## Limites conhecidos

- **WhatsApp não dispara.** A campanha pode ser criada e segmentada, mas o disparo recusa
  explicitamente — a Cloud API não está configurada. Fail-closed de propósito, em vez de fingir
  envio. Ligar exige `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` e o disparo por template
  aprovado (ver os 9 templates já aprovados no Meta).
- **Sem webhook**: nada de status de entrega, abertura, clique, bounce ou resposta. O que a trilha
  registra é "a API aceitou o envio", não "chegou". Ligar isso é o próximo passo natural.
- **Segmento é avaliado em memória** (`applySegment`): a base inteira é carregada a cada consulta.
  Correto e barato na ordem de milhares de contatos; acima de ~10 mil, migrar para query no
  Firestore com índice composto.
- **Sem agendamento** — disparo é manual, no clique.
- Envio é síncrono na request; um volume grande dependeria de worker assíncrono
  (ver `docs/adr-async-jobs-pubsub.md`).

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
