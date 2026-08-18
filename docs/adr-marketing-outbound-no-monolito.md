# ADR: Marketing outbound dentro do mandatodigital

Status: **accepted** (2026-08-17)

Substitui o projeto separado `mandatodigital-mrkt`, que ficou fora do Git e não é mais mantido.

## Contexto

A prospecção do Mandato Digital precisa de: base de contatos públicos, segmentação, disparo por
e-mail e WhatsApp, e uma LLM que assume a conversa depois da primeira resposta do lead.

A primeira tentativa foi um projeto standalone (`~/Workspace/mandatodigital-mrkt`): npm workspaces
com `packages/shared` (Firestore + Anthropic), `whatsapp/`, `email/` e `ingestion/`, cada serviço
um processo Express próprio. Chegou a rodar o import da base, mas nunca foi versionado nem
deployado.

O problema apareceu ao montar o segundo subprojeto: quase tudo que ele precisava já existia aqui.

| Necessidade | Já existia no mandatodigital |
|---|---|
| Autenticação de operador | `/admin` com flag `isAdmin` (`requireAdminSession`) |
| Acesso ao Firestore | `src/lib/firebase/admin.ts` + `COLLECTIONS` |
| Envio de e-mail | Resend com cofre de secrets (`src/lib/legal/email.ts`) |
| Chamada de LLM | `requestPlainText` com pool de chaves e fallback de provider |
| Deploy | App Hosting via pipe do GitHub |
| Secrets | Secret Manager + `firebase:secrets:apply` |
| Padrão de rota protegida | `adminApiRoute` (zod + 401/400/500) |

Manter o standalone significava duplicar as sete linhas dessa tabela — inclusive a resolução de
credenciais, que é exatamente onde duplicação vira divergência silenciosa.

## Decisão

Trazer o outbound para dentro do monólito, como um vertical slice do painel de gestão:

1. **Rota** `/admin/marketing`, protegida pela mesma sessão de admin do resto do painel.
2. **Lib** em `src/lib/outbound/` — **não** `src/lib/marketing/`, que já era o conteúdo do site
   institucional (`home-content.ts`, `planos-content.ts`). Dois domínios sem relação na mesma pasta
   confundiria qualquer leitura futura.
3. **Collections** com prefixo `marketing*`, fora do `db:reset` (contato é caro de reimportar e
   campanha é histórico operacional).
4. **Reuso, não reimplementação**: Resend, `requestPlainText`, `adminApiRoute`, Firestore Admin e o
   pipeline de secrets são os mesmos do produto.
5. **Ingestão como script**, no padrão de `seed-tse-candidates.ts` — CSVs de origem ficam em
   `.local/` (fora do Git), o seed é idempotente.

O `mandatodigital-mrkt` foi abandonado no estado em que estava. Não é repositório Git, então não há
histórico a preservar; a lógica que valia a pena (normalização de telefone, dedup) foi portada com
testes.

## Consequências

**A favor**

- Um deploy, um conjunto de secrets, uma autenticação. Ligar o WhatsApp em produção foi
  `secrets:apply` + descomentar 3 entradas no `apphosting.yaml`.
- O painel enxerga a mesma base do produto: `marketingContacts` e `userRegistrations` no mesmo
  Firestore permitem cruzar prospect com cliente sem integração.
- Bug de normalização de telefone foi corrigido **uma vez**, com teste de regressão. A cópia no
  `mandatodigital-mrkt` ficou com o defeito — e ninguém precisa se importar, porque está morta.

**Contra**

- O monólito cresce. `/admin` acumula responsabilidades que não são do produto vendido — é
  ferramenta interna de aquisição convivendo com a plataforma de campanha.
- Disparo síncrono dentro da request do Next: aceitável nos tetos atuais (50 no WhatsApp, 500 no
  e-mail), mas volume maior exige worker assíncrono (ver [adr-async-jobs-pubsub.md](adr-async-jobs-pubsub.md)).
- Uma falha grave no outbound derruba o mesmo processo do produto. Mitigado por tudo ser
  fail-closed, mas a fronteira de isolamento não existe.

**Reversão**: se um dia justificar extrair, `src/lib/outbound/` é autocontido — depende de
`firebase/collections`, `llm` e `admin/api-route`. Extrair é mover a pasta e reimplementar essas
três, não desmontar o slice.

## Duplicação consciente

`resolveResendClient` existe em `src/lib/legal/email.ts` e de novo em `src/lib/outbound/dispatch.ts`.
Não foi extraído para um módulo comum de propósito: o caminho de contrato é crítico de billing, e
refatorá-lo por causa do outbound trocaria risco baixo (20 linhas duplicadas) por risco alto (mexer
no envio de contrato). Se um terceiro consumidor aparecer, aí sim vale extrair.

## Estrutura resultante

```
src/lib/outbound/          tipos, phone, segment-filter, storages, dispatch,
                           whatsapp, whatsapp-webhook, conversation-agent,
                           inbound-handler, operator-reply, outbound-autosend
src/app/api/admin/marketing/   contacts, segments, campaigns (CRUD + send),
                               conversations (pause + reply do operador)
src/app/api/webhooks/whatsapp/ handshake GET + recebimento POST
src/components/admin/marketing/ abas Contatos, Segmentos, Campanhas, Conversas
scripts/seed-marketing-contacts.ts   ingestão das 3 fontes
scripts/whatsapp-test.ts             teste ponta a ponta sem passar pelo painel
```
